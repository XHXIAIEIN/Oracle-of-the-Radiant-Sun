/* 卡片详情对话框 */

import { $, D, esc } from './dom.js';
import { DECK, cardName, cardSignKeyword, cardText } from './model/deck.js';
import { planetNameFor, psLine, signNameFor, suitNameFor } from './model/card-symbols.js';
import { STR, text, textf } from './model/i18n.js';
import { cardImgAttrs, preloadImage, warmCards } from './image-loader.js';
import { initBilingualCopy, language } from './bilingual.js';

const dialog = $('#card-dialog');
const zoom = $('#zoom-dialog');
const body = $('#dialog-body');
const prevBtn = $('#dialog-prev');
const nextBtn = $('#dialog-next');

let nav = null; // { list: [{ idx, ctx }], at } — 同一行牌（如一周七日）间前后翻阅
let currentDeckIdx = null;
let currentCtx = '';
let dialogStack = [];
let openQueue = [];
let queueBusy = false;
let refBubble = null;

const pageRefPattern = /(?:see\s+)?(?:p(?:age|p?\.?)\s*)(\d{1,3})|(?:参见|见)?第?\s*(\d{1,3})\s*页/gi;

let pageIndexCache = null; // 页码 -> deck 下标，牌组装载后不再变
const cardPageIndex = () => (pageIndexCache ??= new Map(DECK.map((card, idx) => [Number(card.page), idx])));

function animateDialogContent(from, to = {}) {
	body.classList.add('is-turning');
	gsap.fromTo('#dialog-body > *', from, {
		...to,
		duration: D(to.duration ?? 0.38),
		stagger: to.stagger ?? D(0.045),
		ease: to.ease ?? 'power2.out',
		clearProps: 'opacity,transform,filter',
		onComplete: () => body.classList.remove('is-turning'),
	});
}

function renderLinkedText(value) {
	const pageIndex = cardPageIndex();
	let out = '';
	let last = 0;
	String(value || '').replace(pageRefPattern, (match, enPage, zhPage, offset) => {
		const page = Number(enPage || zhPage);
		const idx = pageIndex.get(page);
		out += esc(String(value).slice(last, offset));
		out += idx == null
			? esc(match)
			: `<button class="card-ref-link" type="button" data-ref-idx="${idx}" data-ref-page="${page}">${esc(match)}</button>`;
		last = offset + match.length;
		return match;
	});
	out += esc(String(value || '').slice(last));
	return out;
}

function renderContext(ctx) {
	return ctx.replaceAll('<br>', '<span class="sep">/</span>');
}

function navItemAt(offset) {
	if (!nav) {
		return null;
	}
	if (nav.wrap) return nav.list[(nav.at + offset + nav.list.length) % nav.list.length];
	return nav.list[nav.at + offset] || null;
}

function warmDialogNeighbours(card) {
	if (!nav) warmCards([card], { priority: 'high', limit: 1 });
	else warmCards([navItemAt(-1), navItemAt(1)].map(item => item && DECK[item.idx]).concat(card), { priority: 'high' });
}

function render(deckIdx, ctx) {
	const c = DECK[deckIdx];
	const canGoBack = dialogStack.length > 1;
	const sec = ([zh, en], key) => {
		const text = cardText(c, key);
		const textEn = c[key];
		const textZh = c[`${key}_zh`];
		const textHtml = renderLinkedText(text);
		const textEnHtml = renderLinkedText(textEn);
		const textZhHtml = renderLinkedText(textZh);
		const title = language() === 'zh' ? zh : en;
		return (
		text
			? `
    <section class="dlg-sec"><h4>${title}</h4><p${textZh ? ` class="immersive-copy" data-en-html="${esc(textEnHtml)}" data-zh-html="${esc(textZhHtml)}"` : ''}><span${textZh ? ' class="immersive-copy__text"' : ''}>${textHtml}</span></p></section>`
			: ''
		);
	};
	const suitLine = language() === 'zh' ? `${suitNameFor(c.suit_name)}之组` : `The Suit of ${suitNameFor(c.suit_name)}`;
	const signLine = language() === 'zh' ? `${signNameFor(c.sign)}：${cardSignKeyword(c)}` : `${signNameFor(c.sign)}: ${cardSignKeyword(c)}`;
	const metaHtml = canGoBack || ctx
		? `
    <div class="card-dialog__meta">
      ${canGoBack ? `<button class="card-dialog__back" id="dialog-back" type="button">${esc(text('dialog.back', 'Back'))}</button>` : ''}
      ${ctx ? `<p class="card-dialog__ctx">${renderContext(ctx)}</p>` : ''}
    </div>`
		: '';
	body.innerHTML = `
    ${metaHtml}
    <div class="card-dialog__art">
      <img ${cardImgAttrs(c, { loading: 'eager', priority: 'high' })}>
    </div>
    <header class="card-dialog__head">
      <h3>${cardName(c)} <span class="num">No. ${c.number}</span></h3>
      <p class="ps">${psLine(c)}</p>
      <p class="suit">${suitLine}</p>
      <p class="suit">${signLine}</p>
    </header>
    <div class="card-dialog__body">
      ${sec(STR.dialog.image, 'image_description')}
      ${sec(STR.dialog.personality, 'personal')}
      ${sec(STR.dialog.reading, 'reading')}
      ${sec(STR.dialog.events, 'events')}
    </div>`;
	body.querySelector('.card-dialog__body').scrollTop = 0;
	initBilingualCopy(body);
	hideRefBubble();
	warmDialogNeighbours(c);
	body.querySelector('.card-dialog__art img').onclick = () => {
		const z = $('#zoom-img');
		preloadImage(c.img, 'high');
		z.src = c.img;
		z.alt = cardName(c);
		zoom.showModal();
		gsap.fromTo(z, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: D(0.35), ease: 'power2.out' });
	};
	prevBtn.hidden = nextBtn.hidden = !nav || nav.list.length < 2;
	if (nav) {
		prevBtn.disabled = !nav.wrap && nav.at <= 0;
		nextBtn.disabled = !nav.wrap && nav.at >= nav.list.length - 1;
	}
	const backBtn = $('#dialog-back', body);
	if (backBtn) backBtn.onclick = goBack;
}

export function openDialog(deckIdx, ctx, navOpt = null) {
	nav = navOpt;
	currentDeckIdx = deckIdx;
	currentCtx = ctx;
	dialogStack = [{ idx: deckIdx, ctx, nav: navOpt }];
	openQueue = [];
	render(deckIdx, ctx);
	dialog.showModal();
	animateDialogContent({ opacity: 0, y: 14, filter: 'blur(3px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, stagger: D(0.08) });
}

function queueRelatedOpen(deckIdx) {
	openQueue.push({ deckIdx, ctx: textf('dialog.relatedCtx', { card: cardName(DECK[currentDeckIdx]) }, `Related to ${cardName(DECK[currentDeckIdx])}`) });
	processOpenQueue();
}

async function processOpenQueue() {
	if (queueBusy) return;
	queueBusy = true;
	while (openQueue.length) {
		const next = openQueue.shift();
		await openRelated(next.deckIdx, next.ctx);
	}
	queueBusy = false;
}

function openRelated(deckIdx, ctx) {
	hideRefBubble();
	const existing = dialogStack.findIndex(item => item.idx === deckIdx);
	if (existing >= 0) dialogStack = dialogStack.slice(0, existing + 1);
	else {
		dialogStack.push({ idx: deckIdx, ctx, nav: null });
		if (dialogStack.length > 12) dialogStack = dialogStack.slice(-12);
	}
	nav = null;
	currentDeckIdx = deckIdx;
	currentCtx = ctx;
	render(deckIdx, ctx);
	animateDialogContent({ opacity: 0, y: 12, filter: 'blur(2px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.32 });
	return new Promise(resolve => setTimeout(resolve, D(0.32) * 1000));
}

function goBack() {
	if (dialogStack.length < 2) return;
	hideRefBubble();
	dialogStack.pop();
	const prev = dialogStack[dialogStack.length - 1];
	nav = prev.nav;
	currentDeckIdx = prev.idx;
	currentCtx = prev.ctx;
	render(prev.idx, prev.ctx);
	animateDialogContent({ opacity: 0, x: -16, filter: 'blur(2px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.28 });
}

/* 翻到同行的上一张 / 下一张 */
function step(dir) {
	if (!nav) return;
	const at = nav.wrap ? (nav.at + dir + nav.list.length) % nav.list.length : nav.at + dir;
	if (at < 0 || at >= nav.list.length) return;
	nav.at = at;
	const { idx, ctx } = nav.list[at];
	currentDeckIdx = idx;
	currentCtx = ctx;
	dialogStack = [{ idx, ctx, nav }];
	render(idx, ctx);
	animateDialogContent({ opacity: 0, x: 20 * dir, rotationY: -6 * dir }, { opacity: 1, x: 0, rotationY: 0, duration: 0.4 });
}

prevBtn.onclick = () => step(-1);
nextBtn.onclick = () => step(1);

function hideRefBubble() {
	if (!refBubble) return;
	refBubble.remove();
	refBubble = null;
}

function showRefBubble(anchor, deckIdx) {
	hideRefBubble();
	const card = DECK[deckIdx];
	if (!card) return;
	const label = textf('dialog.relatedPage', { page: card.page }, `Page ${card.page}`);
	refBubble = document.createElement('button');
	refBubble.type = 'button';
	refBubble.className = 'card-ref-popover';
	refBubble.dataset.refIdx = String(deckIdx);
	refBubble.innerHTML = `
    <img ${cardImgAttrs(card)}>
    <span class="card-ref-popover__copy">
      <span class="card-ref-popover__eyebrow">${esc(label)}</span>
      <span class="card-ref-popover__name">${esc(cardName(card))}</span>
      <span class="card-ref-popover__meta">${esc(psLine(card))}</span>
    </span>`;
	refBubble.addEventListener('click', e => {
		e.preventDefault();
		e.stopPropagation();
		queueRelatedOpen(Number(refBubble.dataset.refIdx));
	});
	dialog.append(refBubble);
	const anchorRect = anchor.getBoundingClientRect();
	const bubbleRect = refBubble.getBoundingClientRect();
	const gap = 10;
	const topSpace = anchorRect.top;
	const left = Math.min(Math.max(12, anchorRect.left + anchorRect.width / 2 - bubbleRect.width / 2), window.innerWidth - bubbleRect.width - 12);
	const top = topSpace > bubbleRect.height + gap + 12 ? anchorRect.top - bubbleRect.height - gap : anchorRect.bottom + gap;
	refBubble.style.left = `${left}px`;
	refBubble.style.top = `${Math.min(top, window.innerHeight - bubbleRect.height - 12)}px`;
	gsap.fromTo(refBubble, { opacity: 0, y: 6, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: D(0.18), ease: 'power2.out' });
}

body.addEventListener('click', e => {
	const anchor = e.target.closest('.card-ref-link');
	if (anchor) {
		e.preventDefault();
		e.stopPropagation();
		showRefBubble(anchor, Number(anchor.dataset.refIdx));
		return;
	}
});

document.addEventListener('click', e => {
	if (!refBubble) return;
	if (e.target.closest('.card-ref-popover')) {
		const deckIdx = Number(refBubble.dataset.refIdx);
		queueRelatedOpen(deckIdx);
		return;
	}
	if (e.target.closest('.card-ref-link')) return;
	hideRefBubble();
});
dialog.addEventListener('keydown', e => {
	if (e.key === 'ArrowLeft') step(-1);
	else if (e.key === 'ArrowRight') step(1);
	else if (e.key === 'Escape') hideRefBubble();
});

/* 横扫翻到同行的邻牌——竖着卷动照旧交给正文的滚动 */
let swipe = null;
dialog.addEventListener('touchstart', e => (swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY }), { passive: true });
dialog.addEventListener(
	'touchend',
	e => {
		if (!swipe || !nav) return;
		const dx = e.changedTouches[0].clientX - swipe.x;
		const dy = e.changedTouches[0].clientY - swipe.y;
		swipe = null;
		if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.8) step(dx < 0 ? 1 : -1);
	},
	{ passive: true }
);

/* 底部半屏的抓手：随指下拉，拉过门槛即散场，不及则弹回 */
const grab = $('#dialog-grab');
let grabY = null;
grab.addEventListener('pointerdown', e => {
	grabY = e.clientY;
	try {
		grab.setPointerCapture(e.pointerId);
	} catch {} // 指针已然离场（或合成事件）时，捕获不到也无妨
});
grab.addEventListener('pointermove', e => {
	if (grabY == null) return;
	gsap.set(dialog, { y: Math.max(0, e.clientY - grabY) });
});
const grabEnd = e => {
	if (grabY == null) return;
	const dy = e.clientY - grabY;
	grabY = null;
	if (dy > 110) {
		gsap.to(dialog, { y: dialog.getBoundingClientRect().height, duration: D(0.28), ease: 'power2.in', onComplete: () => dialog.close() });
	} else {
		gsap.to(dialog, { y: 0, duration: D(0.3), ease: 'power2.out' });
	}
};
grab.addEventListener('pointerup', grabEnd);
grab.addEventListener('pointercancel', grabEnd);
dialog.addEventListener('close', () => {
	hideRefBubble();
	openQueue = [];
	queueBusy = false;
	dialogStack = [];
	gsap.set(dialog, { y: 0 });
});

/* 点在幕布上才散场——点到弹层自己的留白不算 */
dialog.addEventListener('click', e => {
	if (e.target !== dialog) return;
	const r = dialog.getBoundingClientRect();
	const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
	if (!inside) dialog.close();
});
$('#dialog-close').onclick = () => dialog.close();

zoom.onclick = () => zoom.close();

window.addEventListener('languagechange', () => {
	if (!dialog.open || currentDeckIdx == null) return;
	render(currentDeckIdx, currentCtx);
});
