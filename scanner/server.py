"""
Oracle of the Radiant Sun - Card Scanner Server
手机连局域网，打开浏览器访问 http://<LAN_IP>:8777
可选用任意相机 App（含支持手动对焦 / ISO / 快门的专业 App）或相册拍照，
原图按页码命名上传到 uploads/ 目录，保留原始格式与画质（不再经 canvas 二次编码）。

朝向回正：上传时自动把图片回正存为物理正立——①按 EXIF 朝向烧进像素并清标记；
②因「书页必为竖版」把仍是横向（宽>高）的图旋转 90°回正；③用 Tesseract OSD 识别
页面文字方向，纠正相机标错/没标的 180°倒拍（EXIF 救不了的情况）。已正立的竖图原样
直传、不重新编码。

补拍规则：若某页号已存在 page_NNN.*，再次提交同页号时不覆盖，
而是追加 page_NNN_02.* / _03 ... 作为补充资料（交叉比对用）。
"""

import http.server
import io
import json
import re
import socket
import time
from difflib import SequenceMatcher
from pathlib import Path

try:
    from PIL import Image, ImageOps
    _HAVE_PIL = True
except Exception:  # Pillow optional: without it, files are stored exactly as received
    _HAVE_PIL = False

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    _HAVE_HEIF = True
except Exception:
    _HAVE_HEIF = False

try:
    import cv2
    import numpy as np
    _HAVE_CV = True
except Exception:
    _HAVE_CV = False

try:
    import pytesseract
    for _p in (r"D:\Program Files\bin\Tesseract-OCR\tesseract.exe",
               r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
        if Path(_p).exists():
            pytesseract.pytesseract.tesseract_cmd = _p
            break
    _HAVE_OSD = True
except Exception:  # Tesseract optional: without it, content-based flip detection is skipped
    _HAVE_OSD = False

PORT = 8777
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
CARD_DIR = UPLOAD_DIR / "cards"
CARD_DIR.mkdir(exist_ok=True)
DATA_DIR = Path(__file__).parent.parent / "data" / "cards"
IMG_EXTS = ('.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif')


OSD_MIN_CONF = 5.0  # Tesseract OSD orientation_conf below this is treated as noise


def load_cards():
    cards = []
    for fp in sorted(DATA_DIR.glob("*.json")):
        try:
            cards.extend(json.loads(fp.read_text(encoding="utf-8")))
        except Exception as exc:
            print(f"[WARN] failed to load {fp}: {exc}")
    return cards


CARDS = load_cards()


def clean_key(s):
    return re.sub(r"[^a-z0-9]+", "", str(s).lower())


def clean_lines(s):
    return [clean_key(line) for line in re.split(r"[\r\n]+", str(s)) if clean_key(line)]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", str(s).lower()).strip("_")


def card_base_name(card):
    return f"{slug(card['planet'])}_{slug(card['sign'])}_{int(card['number']):02d}_{slug(card['name'])}"


def card_output_dir(card=None, batch_id=None):
    if card:
        return CARD_DIR / slug(card["planet"])
    if batch_id:
        return CARD_DIR / slug(batch_id)
    return CARD_DIR / f"batch_{time.strftime('%Y%m%d_%H%M%S')}"


def resolve_unique(directory, base, ext):
    directory.mkdir(parents=True, exist_ok=True)
    fn = f"{base}{ext}"
    if not (directory / fn).exists():
        return fn, False
    i = 2
    while (directory / f"{base}_{i:02d}{ext}").exists():
        i += 1
    return f"{base}_{i:02d}{ext}", True


def sniff_image_ext(data):
    head = data[:32]
    if head.startswith(b"\xff\xd8"):
        return ".jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if head.startswith(b"RIFF") and b"WEBP" in head[:16]:
        return ".webp"
    if len(head) >= 12 and head[4:8] == b"ftyp" and head[8:12] in (b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1"):
        return ".heic"
    if _HAVE_PIL:
        try:
            fmt = Image.open(io.BytesIO(data)).format
            return {
                "JPEG": ".jpg",
                "PNG": ".png",
                "WEBP": ".webp",
                "HEIF": ".heic",
                "HEIC": ".heic",
            }.get(str(fmt).upper(), ".webp")
        except Exception:
            pass
    return ".webp"


def open_image(data):
    if not _HAVE_PIL:
        return None
    return ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")


def crop_card_image(im):
    """Find the white card body against a colored table and return a loose crop.
    This keeps OCR regions anchored to the card even when the phone framing moves."""
    if not _HAVE_CV:
        return im
    try:
        arr = np.array(im)
        hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
        mask = cv2.inRange(hsv, np.array([0, 0, 115]), np.array([179, 105, 255]))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return im
        c = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(c)
        if w * h < im.width * im.height * 0.08:
            return im
        pad = int(min(w, h) * 0.02)
        x0 = max(0, x - pad)
        y0 = max(0, y - pad)
        x1 = min(im.width, x + w + pad)
        y1 = min(im.height, y + h + pad)
        return im.crop((x0, y0, x1, y1))
    except Exception:
        return im


def ocr_region(im, box, psm=11, whitelist=None, invert=False):
    if not _HAVE_OSD:
        return ""
    try:
        w, h = im.size
        crop = im.crop(tuple(int(v * (w if i % 2 == 0 else h)) for i, v in enumerate(box)))
        crop = ImageOps.grayscale(crop)
        crop = ImageOps.autocontrast(crop)
        if invert:
            crop = ImageOps.invert(crop)
        scale = max(1, int(1400 / max(crop.width, 1)))
        crop = crop.resize((crop.width * scale, crop.height * scale))
        config = f"--psm {psm}"
        if whitelist:
            config += f" -c tessedit_char_whitelist={whitelist}"
        return pytesseract.image_to_string(crop, config=config).strip()
    except Exception:
        return ""


def identify_card(data):
    """Identify a real card by OCRing the title strip and top number.
    The printed card title is unique in this deck, so it is the strongest signal;
    number is used as a bonus and logged for review."""
    im = open_image(data)
    if im is None:
        return None, {"error": "Pillow unavailable"}
    card_im = crop_card_image(im)
    title_text = ocr_region(card_im, (0.18, 0.78, 0.84, 0.96), psm=11)
    bottom_text = ocr_region(card_im, (0.02, 0.76, 0.98, 0.98), psm=11)
    number_text = ""
    for box in ((0.42, 0.0, 0.58, 0.12), (0.44, 0.0, 0.56, 0.10), (0.43, 0.01, 0.57, 0.09)):
        number_text += "\n" + ocr_region(card_im, box, psm=10, whitelist="0123456789", invert=True)
    ocr_text = "\n".join([title_text, bottom_text, number_text])
    lines = clean_lines(ocr_text)
    nums = {int(n) for n in re.findall(r"\b(?:1[0-2]|[1-9])\b", number_text)}

    best = None
    best_score = 0.0
    for card in CARDS:
        name = clean_key(card["name"])
        score = 0.0
        if name and name in lines:
            score = 1.0
        else:
            for line_key in lines:
                ratio = SequenceMatcher(None, name, line_key).ratio()
                if name and name in line_key and len(line_key) > len(name):
                    # Avoid false positives such as DECISION inside INDECISION.
                    ratio = min(ratio, 0.86)
                score = max(score, ratio)
        if int(card["number"]) in nums:
            score += 0.08
        if score > best_score:
            best_score = score
            best = card

    info = {
        "score": round(best_score, 3),
        "ocr": ocr_text[:1000],
        "number_candidates": sorted(nums),
    }
    if best and best_score >= 0.78:
        return best, info
    return None, info


def detect_rotation(im):
    """Content-based orientation check via Tesseract OSD on a clean block of body
    text: returns the clockwise degrees (0/90/180/270) needed to read the page
    upright. This catches pages the camera mis-tagged (or didn't tag) — e.g. an
    upside-down shot saved with orientation=1, which EXIF alone cannot fix. Returns
    0 when OSD is unavailable, finds too little text, or isn't confident enough.
    Cropping to the lower body-text region (away from the illustration, decorative
    glyphs and italic caption) and upscaling is what makes OSD reliable here."""
    if not _HAVE_OSD:
        return 0
    try:
        w, h = im.size
        crop = im.crop((int(w * 0.06), int(h * 0.42), int(w * 0.94), int(h * 0.96)))
        cw, ch = crop.size
        crop = crop.resize((2400, max(1, int(ch * 2400 / cw))))
        d = pytesseract.image_to_osd(crop, config='--dpi 300',
                                     output_type=pytesseract.Output.DICT)
        rot = int(d.get('rotate', 0)) % 360
        if rot in (90, 180, 270) and float(d.get('orientation_conf', 0)) >= OSD_MIN_CONF:
            return rot
    except Exception:
        pass  # too little text / OSD failure → leave orientation unchanged
    return 0


def normalize_orientation(data, ext):
    """Make the stored file physically upright at import time, in three passes:
    (1) bake any EXIF orientation tag into the pixels; (2) since every book page is
    portrait, rotate any still-landscape image to portrait; (3) read the page text
    with Tesseract OSD to catch flips the camera mis-tagged (e.g. an upside-down
    shot saved as orientation=1) and rotate to upright. Pages already upright pass
    through untouched (no recompression). Needs Pillow; OSD additionally needs
    Tesseract — without it, pass (3) is skipped."""
    if not _HAVE_PIL or ext.lower() not in IMG_EXTS:
        return data
    if ext.lower() in ('.heic', '.heif'):
        # Keep HEIC/HEIF originals intact. Re-saving through Pillow would convert
        # the bytes to another format while the filename still says .heic.
        return data
    try:
        im = Image.open(io.BytesIO(data))
        ori = im.getexif().get(0x0112, 1) or 1
        fixed = im if ori in (0, 1) else ImageOps.exif_transpose(im)
        changed = ori not in (0, 1)
        if fixed.width > fixed.height:                  # landscape book page → portrait
            fixed = fixed.transpose(Image.ROTATE_90)
            changed = True
        rot = detect_rotation(fixed)                    # content-based flip detection
        if rot:
            fixed = fixed.rotate(360 - rot, expand=True)  # PIL rotates CCW; CW-correct it
            changed = True
            print(f"[OSD] page mis-tagged orientation; rotated {rot}° to upright")
        if not changed:
            return data                                 # already upright → keep bytes
        buf = io.BytesIO()
        e = ext.lower()
        if e in ('.jpg', '.jpeg'):
            fixed.save(buf, 'JPEG', quality=95, subsampling=0, optimize=True)
        elif e == '.png':
            fixed.save(buf, 'PNG', optimize=True)
        else:
            fixed.save(buf, 'WEBP', quality=100, method=6)
        return buf.getvalue()
    except Exception as exc:
        print(f"[WARN] orientation normalize failed ({exc}); storing original bytes")
        return data

HTML_PAGE = r"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Oracle Scanner</title>
<style>
  :root{
    --bg:#15152b; --card:#1d2747; --card2:#16203c; --gold:#e6a817; --gold-dim:#c4900f;
    --ink:#eef0f7; --muted:#9aa0b8; --line:#2c355c; --ok:#4ecca3; --err:#e8584a; --warn:#f0a850;
  }
  *{ margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body{
    font-family:-apple-system,system-ui,"Segoe UI",sans-serif; background:var(--bg); color:var(--ink);
    min-height:100vh; padding:14px 14px calc(244px + env(safe-area-inset-bottom));
    display:flex; flex-direction:column; align-items:center;
  }
  .wrap{ width:100%; max-width:460px; }
  header{ text-align:center; margin:4px 0 14px; }
  h1{ font-size:1.12em; color:var(--gold); letter-spacing:.4px; }
  .sub{ font-size:.78em; color:var(--muted); margin-top:4px; }
  .panel{ background:var(--card); border-radius:16px; padding:16px; margin-bottom:13px; }
  /* page stepper */
  .stepper{ display:flex; align-items:center; justify-content:center; gap:14px; }
  .btn-adj{
    width:54px; height:54px; font-size:1.7em; font-weight:700; line-height:1;
    background:transparent; color:var(--gold); border:2px solid var(--gold); border-radius:50%; cursor:pointer;
  }
  .btn-adj:active{ background:var(--gold); color:var(--bg); }
  #pn{
    width:96px; text-align:center; font-size:2.3em; font-weight:800; padding:5px 0;
    background:var(--bg); color:var(--gold); border:2px solid var(--gold); border-radius:12px; -moz-appearance:textfield;
  }
  #pn::-webkit-inner-spin-button{ -webkit-appearance:none; margin:0; }
  .exists{ text-align:center; margin:10px 0; font-size:.84em; font-weight:600; min-height:1.2em; line-height:1.3; }
  .exists.new{ color:var(--ok); }
  .exists.dup{ color:var(--warn); }
  /* capture */
  .btn-capture{
    display:block; width:100%; padding:21px; border:none; border-radius:14px;
    font-size:1.28em; font-weight:800; background:var(--gold); color:var(--bg); cursor:pointer;
  }
  .btn-capture:active{ background:var(--gold-dim); transform:scale(.985); }
  .btn-capture:disabled{ background:#3a3f5c; color:#7b809a; }
  .btn-capture.dup{ background:var(--warn); }
  .capture-row{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
  .capture-row .btn-capture{ padding:15px 10px; font-size:1em; }
  .btn-quick{
    display:block; width:100%; margin-top:9px; padding:10px; cursor:pointer;
    background:transparent; color:var(--muted); border:1px solid var(--line);
    border-radius:10px; font-size:.82em; font-weight:600;
  }
  .btn-quick:active{ background:var(--card2); }
  .btn-jump{
    display:block; width:100%; margin-top:8px; padding:8px; cursor:pointer;
    background:transparent; color:var(--gold); border:1px dashed var(--gold-dim);
    border-radius:10px; font-size:.82em; font-weight:700;
  }
  .btn-jump:active{ background:var(--card2); }
  .status{ text-align:center; font-size:.8em; color:var(--muted); margin-top:11px; min-height:1.2em; }
  #preview{ width:100%; border-radius:11px; border:1px solid var(--line); display:block; }
  /* fixed bottom capture bar */
  .capbar{
    position:fixed; left:0; right:0; bottom:0; z-index:20;
    padding:12px 14px calc(12px + env(safe-area-inset-bottom));
    background:rgba(21,21,43,.94); backdrop-filter:blur(9px); -webkit-backdrop-filter:blur(9px);
    border-top:1px solid var(--line); display:flex; justify-content:center;
  }
  .capbar .inner{ width:100%; max-width:460px; }
  .capbar .stepper{ margin-bottom:2px; }
  .capbar .status{ margin:8px 0 0; }
  .modebar{ display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px; }
  .modebtn{
    padding:9px 8px; border:1px solid var(--line); border-radius:10px;
    background:var(--card2); color:var(--muted); font-size:.82em; font-weight:800; cursor:pointer;
  }
  .modebtn.active{ background:var(--gold); color:var(--bg); border-color:var(--gold); }
  .page-tools.hidden{ display:none; }
  /* chips */
  .row{ display:flex; justify-content:space-between; align-items:center; font-size:.76em; color:var(--muted); margin-bottom:10px; }
  .coverage{ font-size:.92em; line-height:1.55; }
  .cov-line{ padding:2px 0; color:#d4d8ec; }
  .cov-k{ display:inline-block; min-width:78px; color:var(--muted); font-size:.74em; text-transform:uppercase; letter-spacing:.6px; }
  .cov-line.gap{ color:var(--warn); }
  .cov-line.gap b{ cursor:pointer; border-bottom:1px dashed var(--warn); padding:0 1px; font-weight:700; }
  .cov-line.allok{ color:var(--ok); }
  .cov-line.sup b{ color:var(--gold); cursor:pointer; }
  .empty{ color:#5a607e; font-size:.84em; }
  /* log */
  .log{ font-size:.76em; max-height:148px; overflow-y:auto; }
  .log-entry{ padding:4px 2px; border-bottom:1px solid var(--card2); color:var(--muted); }
  .log-ok{ color:var(--ok); } .log-err{ color:var(--err); } .log-sup{ color:var(--warn); }
  input[type=file]{ display:none; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Oracle of the Radiant Sun</h1>
    <div class="sub" id="sub">Scanner ready</div>
  </header>

  <div class="panel" id="previewPanel" style="display:none">
    <img id="preview" alt="preview">
  </div>

  <div class="panel">
    <div class="row"><span>Coverage &middot; tap a number to jump</span><span id="counts"></span></div>
    <div class="coverage" id="coverage"><span class="empty">none yet</span></div>
  </div>

  <div class="panel">
    <div class="row"><span>Real Cards</span><span id="cardCounts"></span></div>
    <div class="status" id="cardStatus">Saved to scanner/uploads/cards</div>
    <div class="log" id="cardLog" style="margin-top:10px"></div>
  </div>

  <div class="panel">
    <div class="row"><span>Activity</span></div>
    <div class="log" id="log"></div>
  </div>
</div>

<div class="capbar">
  <div class="inner">
    <div class="modebar">
      <button class="modebtn active" id="modeCards" onclick="setMode('cards')">Card OCR</button>
      <button class="modebtn" id="modePages" onclick="setMode('pages')">Book pages</button>
    </div>
    <div class="page-tools hidden" id="pageTools">
      <div class="stepper">
        <button class="btn-adj" onclick="adj(-1)">&minus;</button>
        <input type="number" id="pn" value="1" min="1" max="300" inputmode="numeric">
        <button class="btn-adj" onclick="adj(1)">+</button>
      </div>
      <button class="btn-jump" id="btnNext" onclick="jumpNext()">→ latest</button>
      <div class="exists" id="exists"></div>
    </div>
    <div class="capture-row">
      <button class="btn-capture" id="btnGallery" onclick="openPicker('gallery')">Choose photos</button>
      <button class="btn-capture" id="btnCamera" onclick="openPicker('camera')">Open camera</button>
    </div>
    <div class="status" id="status">Ready</div>
  </div>
</div>

<!-- fi: gallery picker, multi-select → pick one or many photos; they upload in
     selection order and page numbers accumulate from the shown page. -->
<input type="file" id="fi" accept="image/*" multiple>
<!-- fc: capture hint → quick single grab via the system camera -->
<input type="file" id="fc" accept="image/*" capture="environment">

<script>
const $ = id => document.getElementById(id);
let pages = {};        // { pageNum: imageCount }
let uploaded = 0;
let mode = 'cards';

function adj(d){ const el=$('pn'); el.value=Math.max(1,(+el.value||0)+d); onPn(); }
function nextPageNum(){ const ns=Object.keys(pages).map(Number); return ns.length ? Math.max(...ns)+1 : 1; }
function jumpNext(){ $('pn').value=nextPageNum(); onPn(); }
$('pn').addEventListener('input', onPn);

function onPn(){
  const pn=+$('pn').value||0;
  renderExists(pn);
}

function renderExists(pn){
  const el=$('exists'), n=pages[pn]||0;
  if(mode==='cards'){
    el.className='exists new'; el.textContent='';
    $('btnGallery').classList.remove('dup');
    return;
  }
  if(n===0){
    el.className='exists new'; el.textContent='';
    $('btnGallery').classList.remove('dup');
  } else {
    el.className='exists dup'; el.textContent='re-shoot · original kept';
    $('btnGallery').classList.add('dup');
  }
}

function setMode(next){
  mode=next;
  $('modeCards').classList.toggle('active', mode==='cards');
  $('modePages').classList.toggle('active', mode==='pages');
  $('pageTools').classList.toggle('hidden', mode!=='pages');
  $('btnGallery').textContent=mode==='cards' ? 'Choose card photos' : 'Choose page photos';
  $('btnCamera').textContent=mode==='cards' ? 'Open camera' : 'Open camera';
  $('status').textContent=mode==='cards' ? 'Card OCR → scanner/uploads/cards' : 'Book pages → scanner/uploads';
  renderExists(+$('pn').value||0);
}

function openPicker(source){
  $(source==='camera' ? 'fc' : 'fi').click();
}

async function loadList(){
  try{
    const d=await (await fetch('/list')).json();
    pages={}; uploaded=0;
    (d.files||[]).forEach(f=>{
      const m=f.match(/^page_(\d+)(?:_(\d+))?\./);
      if(!m) return;
      const num=+m[1];
      pages[num]=(pages[num]||0)+1; uploaded++;
    });
    renderCounts(); renderCoverage(); onPn();
  }catch(e){}
}

async function loadCards(){
  try{
    const d=await (await fetch('/cards/list')).json();
    $('cardCounts').textContent=(d.files||[]).length+' cards';
    const box=$('cardLog'); box.innerHTML='';
    (d.files||[]).slice(-12).reverse().forEach(f=>{
      const div=document.createElement('div'); div.className='log-entry log-ok';
      div.textContent=f; box.appendChild(div);
    });
  }catch(e){}
}

function renderCounts(){
  const np=Object.keys(pages).length;
  $('counts').textContent=uploaded+' imgs · '+np+' pages';
  $('sub').textContent='Scanner · '+uploaded+' images uploaded';
  $('btnNext').textContent='→ latest · p'+nextPageNum();
}

function compressRanges(nums){
  const out=[]; let s=nums[0], p=nums[0];
  for(let i=1;i<nums.length;i++){ if(nums[i]===p+1){ p=nums[i]; } else { out.push([s,p]); s=p=nums[i]; } }
  out.push([s,p]);
  return out.map(r=> r[0]===r[1] ? ''+r[0] : r[0]+'–'+r[1]).join(', ');
}
function renderCoverage(){
  const nums=Object.keys(pages).map(Number).sort((a,b)=>a-b);
  const box=$('coverage');
  if(!nums.length){ box.innerHTML='<span class="empty">none yet</span>'; return; }
  const lo=nums[0], hi=nums[nums.length-1];
  const gaps=[]; for(let n=lo;n<=hi;n++){ if(!pages[n]) gaps.push(n); }
  const sup=nums.filter(n=>pages[n]>1);
  let h='<div class="cov-line"><span class="cov-k">captured</span>'+compressRanges(nums)+'</div>';
  if(gaps.length){
    h+='<div class="cov-line gap"><span class="cov-k">⚠ missing</span>'+
       gaps.map(g=>'<b data-pg="'+g+'">'+g+'</b>').join(', ')+'</div>';
  } else {
    h+='<div class="cov-line allok"><span class="cov-k">✓ no gaps</span>continuous '+lo+'–'+hi+'</div>';
  }
  if(sup.length){
    h+='<div class="cov-line sup"><span class="cov-k">re-shot</span>'+
       sup.map(n=>'<b data-pg="'+n+'">'+n+'</b>×'+pages[n]).join(', ')+'</div>';
  }
  box.innerHTML=h;
  box.querySelectorAll('b[data-pg]').forEach(b=> b.onclick=()=>{ $('pn').value=b.dataset.pg; onPn(); });
}

// Upload the ORIGINAL file bytes as-is — no canvas re-encode. Whatever your camera
// app produced (full-res, manually focused, full quality) is preserved; the server
// keeps the original extension. This avoids the lossy WebP round-trip entirely.
let lastUrl=null;

function extOf(file){
  let e=(/\.([a-z0-9]+)$/i.exec(file.name)||[,'jpg'])[1].toLowerCase();
  return e==='jpeg' ? 'jpg' : e;
}

async function uploadOne(file, page){
  if(lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl=URL.createObjectURL(file);
  $('preview').src=lastUrl; $('previewPanel').style.display='block';
  const fd=new FormData();
  fd.append('page', String(page));
  fd.append('image', file, 'page.'+extOf(file));
  const r=await fetch('/upload',{method:'POST',body:fd});
  return await r.json();
}

// One photo: upload to the shown page; advance only on a fresh page (stay put on a
// re-shoot so you can try again). Many photos: assign consecutive page numbers from
// the shown page, in selection order, advancing for every photo.
async function handleFiles(fileList){
  // Multi-select FileList order is unreliable across phones, so sort by filename
  // (numeric-aware): sequentially-shot photos are named in order, so this assigns
  // page numbers in true capture order and avoids a scrambled batch.
  const files=[...fileList].filter(Boolean)
    .sort((a,b)=> a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:'base'}));
  if(!files.length) return;
  setBusy(true);
  const start=+$('pn').value||1;

  if(files.length===1){
    $('status').textContent='Uploading…';
    try{
      const d=await uploadOne(files[0], start);
      if(d.ok){
        const kb=Math.round((d.size||files[0].size)/1024);
        $('status').textContent=(d.supplement?'＋ Re-shoot saved':'✓ Page '+d.page+' saved')+' · '+kb+' KB';
        log((d.supplement?'＋ re-shoot · ':'✓ ')+d.filename, d.supplement?'sup':'ok');
        await loadList();
        if(!d.supplement){ $('pn').value=start+1; }
        onPn();
      } else { $('status').textContent='✕ Upload failed'; log('✕ '+d.error,'err'); }
    }catch(err){ $('status').textContent='✕ Network error'; log('✕ network error','err'); }
  } else {
    let ok=0;
    for(let i=0;i<files.length;i++){
      const page=start+i;
      $('pn').value=page;
      $('status').textContent='Uploading '+(i+1)+'/'+files.length+' → p'+page+'…';
      try{
        const d=await uploadOne(files[i], page);
        if(d.ok){ ok++; log((d.supplement?'＋ re-shoot · ':'✓ ')+d.filename, d.supplement?'sup':'ok'); }
        else { log('✕ p'+page+' '+d.error,'err'); }
      }catch(err){ log('✕ p'+page+' network error','err'); }
    }
    $('pn').value=start+files.length;
    await loadList(); onPn();
    $('status').textContent='✓ Batch done · '+ok+'/'+files.length+' saved (p'+start+'–p'+(start+files.length-1)+')';
  }
  setBusy(false);
}

$('fi').addEventListener('change', e=>{ handleSelectedFiles(e.target.files); e.target.value=''; });
$('fc').addEventListener('change', e=>{ handleSelectedFiles(e.target.files); e.target.value=''; });

function handleSelectedFiles(files){
  return mode==='cards' ? handleCardFiles(files) : handleFiles(files);
}

function setBusy(busy){
  $('btnGallery').disabled=busy;
  $('btnCamera').disabled=busy;
  $('modeCards').disabled=busy;
  $('modePages').disabled=busy;
}

function makeBatchId(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  return 'batch_'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+
         pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds());
}

async function uploadCardOne(file,batchId){
  if(lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl=URL.createObjectURL(file);
  $('preview').src=lastUrl; $('previewPanel').style.display='block';
  const fd=new FormData();
  fd.append('batch', batchId);
  fd.append('image', file, file.name || ('card.'+extOf(file)));
  const r=await fetch('/upload-card',{method:'POST',body:fd});
  return await r.json();
}

async function handleCardFiles(fileList){
  const files=[...fileList].filter(Boolean)
    .sort((a,b)=> a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:'base'}));
  if(!files.length) return;
  setBusy(true);
  const batchId=makeBatchId();
  let ok=0;
  for(let i=0;i<files.length;i++){
    $('cardStatus').textContent='Recognizing '+(i+1)+'/'+files.length+'…';
    try{
      const d=await uploadCardOne(files[i], batchId);
      if(d.ok){
        ok++;
        const label=d.card ? (d.card.name+' · '+d.card.planet+' '+d.card.sign+' #'+d.card.number) : 'unknown card';
        $('cardStatus').textContent='✓ '+label+' · '+d.filename;
        log('✓ card · '+label+' → '+d.filename, 'ok');
      } else {
        $('cardStatus').textContent='✕ '+(d.error||'Card upload failed');
        log('✕ card · '+(d.error||'upload failed'), 'err');
      }
    }catch(err){
      $('cardStatus').textContent='✕ Card network error';
      log('✕ card network error','err');
    }
  }
  await loadCards();
  if(files.length>1) $('cardStatus').textContent='✓ Card batch done · '+ok+'/'+files.length+' saved';
  setBusy(false);
}

function log(msg,kind){
  const div=document.createElement('div'); div.className='log-entry log-'+kind;
  div.textContent=new Date().toLocaleTimeString()+'  '+msg;
  $('log').prepend(div);
}

onPn(); loadList(); loadCards(); setMode(mode);
</script>
</body>
</html>"""


class ScannerHandler(http.server.BaseHTTPRequestHandler):

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            self._ok("text/html", HTML_PAGE.encode())
        elif path == "/count":
            n = sum(1 for f in UPLOAD_DIR.iterdir()
                    if f.suffix.lower() in IMG_EXTS and f.name.startswith('page_'))
            self._ok("application/json", json.dumps({"count": n}).encode())
        elif path == "/list":
            files = sorted(f.name for f in UPLOAD_DIR.iterdir()
                           if f.suffix.lower() in IMG_EXTS and f.name.startswith('page_'))
            self._ok("application/json", json.dumps({"files": files}).encode())
        elif path == "/cards/list":
            files = sorted(str(f.relative_to(CARD_DIR)).replace("\\", "/")
                           for f in CARD_DIR.rglob("*")
                           if f.is_file() and f.suffix.lower() in IMG_EXTS)
            self._ok("application/json", json.dumps({"files": files}).encode())
        else:
            self.send_error(404)

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/upload-card":
            self._handle_card_upload()
            return
        if path != "/upload":
            self.send_error(404)
            return

        upload = self._parse_upload()
        if not upload.get("ok"):
            self._ok("application/json", json.dumps(upload).encode())
            return
        page_num = upload["page"]
        file_ext = upload["ext"]
        file_data = upload["data"]

        fn, supplement = self._resolve_name(page_num, file_ext)
        file_data = normalize_orientation(file_data, file_ext)
        fp = UPLOAD_DIR / fn
        fp.write_bytes(file_data)
        tag = "SUPP" if supplement else "SCAN"
        print(f"[{tag}] {fn} ({len(file_data)} bytes)")

        self._ok("application/json", json.dumps({
            "ok": True, "filename": fn, "size": len(file_data),
            "page": page_num, "supplement": supplement,
        }).encode())

    def _parse_upload(self):
        clen = int(self.headers.get("Content-Length", 0))
        ctype = self.headers.get("Content-Type", "")
        body = self.rfile.read(clen)

        m = re.search(r'boundary=([^\s;]+)', ctype)
        if not m:
            return {"ok": False, "error": "No boundary"}

        boundary = m.group(1).encode()
        parts = body.split(b"--" + boundary)

        page_num = 0
        file_data = None
        file_ext = ".webp"  # fallback; overwritten by the uploaded file's real extension
        fields = {}

        for part in parts:
            if b"Content-Disposition" not in part:
                continue
            sep = part.find(b"\r\n\r\n")
            if sep == -1:
                continue
            hdr = part[:sep].decode("utf-8", errors="replace")
            payload = part[sep + 4:]
            if payload.endswith(b"\r\n"):
                payload = payload[:-2]

            if 'filename=' in hdr:
                file_data = payload
                fnm = re.search(r'filename="([^"]*)"', hdr)
                if fnm:
                    suf = Path(fnm.group(1)).suffix.lower()
                    if suf == ".jpeg":
                        suf = ".jpg"
                    if suf in IMG_EXTS:
                        file_ext = suf
            elif 'name="page"' in hdr:
                try:
                    page_num = int(payload.decode().strip())
                except Exception:
                    pass
            else:
                nm = re.search(r'name="([^"]*)"', hdr)
                if nm:
                    fields[nm.group(1)] = payload.decode("utf-8", errors="replace").strip()

        if file_data is None:
            return {"ok": False, "error": "No image"}

        if file_ext == ".webp":
            file_ext = sniff_image_ext(file_data)

        return {"ok": True, "page": page_num, "ext": file_ext, "data": file_data, "fields": fields}

    def _handle_card_upload(self):
        upload = self._parse_upload()
        if not upload.get("ok"):
            self._ok("application/json", json.dumps(upload).encode())
            return
        file_data = upload["data"]
        file_ext = upload["ext"]
        batch_id = upload.get("fields", {}).get("batch")
        card, info = identify_card(file_data)

        if card:
            base = card_base_name(card)
            out_card = {
                "name": card["name"],
                "planet": card["planet"],
                "sign": card["sign"],
                "number": card["number"],
            }
        else:
            base = f"unknown_card_{time.strftime('%Y%m%d_%H%M%S')}"
            out_card = None

        out_dir = card_output_dir(card, batch_id)
        fn, duplicate = resolve_unique(out_dir, base, file_ext)
        rel_fn = str((out_dir / fn).relative_to(CARD_DIR)).replace("\\", "/")
        fp = out_dir / fn
        fp.write_bytes(file_data)
        meta = {
            "filename": rel_fn,
            "card": out_card,
            "batch": batch_id,
            "group": out_dir.name,
            "duplicate": duplicate,
            "recognition": info,
            "saved_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        (out_dir / f"{Path(fn).stem}.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tag = "CARD" if card else "CARD?"
        print(f"[{tag}] {rel_fn} ({len(file_data)} bytes) score={info.get('score')}")
        self._ok("application/json", json.dumps({
            "ok": True, "filename": rel_fn, "size": len(file_data),
            "card": out_card, "duplicate": duplicate, "recognition": info,
        }, ensure_ascii=False).encode())

    def _resolve_name(self, page_num, ext=".webp"):
        """Pick a filename, preserving the uploaded file's extension. Never overwrite
        an existing page (in any image format): re-submitted page numbers become
        page_NNN_02.ext, _03 ... supplements for cross-checking."""
        if page_num <= 0:
            n = len(list(UPLOAD_DIR.glob('scan_*'))) + 1
            return f"scan_{n:03d}{ext}", False
        base = f"page_{page_num:03d}"
        if not list(UPLOAD_DIR.glob(f"{base}.*")):
            return f"{base}{ext}", False
        i = 2
        while list(UPLOAD_DIR.glob(f"{base}_{i:02d}.*")):
            i += 1
        return f"{base}_{i:02d}{ext}", True

    def _ok(self, ct, data):
        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def handle_expect_100(self):
        self.send_response_only(100)
        self.end_headers()
        return True

    def log_message(self, *a):
        pass


def lan_ip():
    """Best-effort LAN IPv4 of the default route interface."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    ip = lan_ip()
    srv = http.server.HTTPServer(("0.0.0.0", PORT), ScannerHandler)
    print(f"\n  Oracle Scanner @ http://{ip}:{PORT}\n  Uploads: {UPLOAD_DIR}")
    print("  Re-submitting an existing page number saves a _NN supplement (no overwrite).\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.server_close()
