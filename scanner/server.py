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
from pathlib import Path

try:
    from PIL import Image, ImageOps
    _HAVE_PIL = True
except Exception:  # Pillow optional: without it, files are stored exactly as received
    _HAVE_PIL = False

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
IMG_EXTS = ('.jpg', '.jpeg', '.png', '.webp')


OSD_MIN_CONF = 5.0  # Tesseract OSD orientation_conf below this is treated as noise


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
    min-height:100vh; padding:14px 14px calc(228px + env(safe-area-inset-bottom));
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
    <div class="row"><span>Activity</span></div>
    <div class="log" id="log"></div>
  </div>
</div>

<div class="capbar">
  <div class="inner">
    <div class="stepper">
      <button class="btn-adj" onclick="adj(-1)">&minus;</button>
      <input type="number" id="pn" value="1" min="1" max="300" inputmode="numeric">
      <button class="btn-adj" onclick="adj(1)">+</button>
    </div>
    <button class="btn-jump" id="btnNext" onclick="jumpNext()">→ latest</button>
    <div class="exists" id="exists"></div>
    <button class="btn-capture" id="btn" onclick="document.getElementById('fi').click()">
      🖼 <span id="capVerb">Add photos</span>&nbsp;from p<span id="pnLabel">1</span>
    </button>
    <button class="btn-quick" id="btnQuick" onclick="document.getElementById('fc').click()">📷 camera</button>
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

function adj(d){ const el=$('pn'); el.value=Math.max(1,(+el.value||0)+d); onPn(); }
function nextPageNum(){ const ns=Object.keys(pages).map(Number); return ns.length ? Math.max(...ns)+1 : 1; }
function jumpNext(){ $('pn').value=nextPageNum(); onPn(); }
$('pn').addEventListener('input', onPn);

function onPn(){
  const pn=+$('pn').value||0;
  $('pnLabel').textContent=pn;
  renderExists(pn);
}

function renderExists(pn){
  const el=$('exists'), btn=$('btn'), n=pages[pn]||0;
  if(n===0){
    el.className='exists new'; el.textContent='';
    btn.classList.remove('dup'); $('capVerb').textContent='Add photos';
  } else {
    el.className='exists dup'; el.textContent='re-shoot · original kept';
    btn.classList.add('dup'); $('capVerb').textContent='Re-shoot';
  }
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
  const btn=$('btn'); btn.disabled=true;
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
      $('pn').value=page; $('pnLabel').textContent=page;
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
  btn.disabled=false;
}

$('fi').addEventListener('change', e=>{ handleFiles(e.target.files); e.target.value=''; });
$('fc').addEventListener('change', e=>{ handleFiles(e.target.files); e.target.value=''; });

function log(msg,kind){
  const div=document.createElement('div'); div.className='log-entry log-'+kind;
  div.textContent=new Date().toLocaleTimeString()+'  '+msg;
  $('log').prepend(div);
}

onPn(); loadList();
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
        else:
            self.send_error(404)

    def do_POST(self):
        path = self.path.split("?")[0]
        if path != "/upload":
            self.send_error(404)
            return

        clen = int(self.headers.get("Content-Length", 0))
        ctype = self.headers.get("Content-Type", "")
        body = self.rfile.read(clen)

        m = re.search(r'boundary=([^\s;]+)', ctype)
        if not m:
            self._ok("application/json", json.dumps({"ok": False, "error": "No boundary"}).encode())
            return

        boundary = m.group(1).encode()
        parts = body.split(b"--" + boundary)

        page_num = 0
        file_data = None
        file_ext = ".webp"  # fallback; overwritten by the uploaded file's real extension

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

        if file_data is None:
            self._ok("application/json", json.dumps({"ok": False, "error": "No image"}).encode())
            return

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
