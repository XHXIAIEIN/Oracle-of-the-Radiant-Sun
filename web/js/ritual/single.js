/* 单张：牌堆留在桌上作源头，点堆（或"再抽一张"按钮）即再抽一张。
   提示行固定在操作区附近，随阶段只换文案；操作按钮固定在其下方。 */

import { $, el, D, cryptoShuffle, MOBILE } from '../dom.js';
import { wheel, panelList, setRite, setActions, updateBadge } from '../stage.js';
import { S, takeCards, drawCount } from '../state.js';
import { DECK, cardName, cardText } from '../model/deck.js';
import { MODES } from '../model/modes/index.js';
import { STR, text } from '../model/i18n.js';
import { psSuitLine } from '../model/card-symbols.js';
import { cardShell, flipCard } from '../cards.js';
import { openPanel, placeEntry, scrollPanelTo } from '../panel.js';
import { openDialog } from '../dialog.js';
import { deckPile, animateShuffle, syncDeckThickness, topLayerPose } from './deck-pile.js';
import { showShare } from '../share.js';

const M = () => MODES.single;
const stageWrap = () => $('#stage-actions').closest('.stage-wrap');

/* 桌面几何（% of wheel）：牌堆与大牌的落点、宽。手机的轮盘即全宽，
   堆与牌都放大到指得住的尺寸 */
const GEO = () => (MOBILE.matches ? { PILE_X: 24, PILE_W: 17, CARD_X: 65, CARD_W: 31, TOP: 50 } : { PILE_X: 29, PILE_W: 13.2, CARD_X: 64, CARD_W: 24.5, TOP: 47 });
let again = null; // “再抽一张”——翻牌后进入仪轨行下方的操作区
let live = null; // 桌上已翻开的那张：{ card, link }

function deckTouch(kind = 'draw') {
	const lift = kind === 'return' ? -2 : 2;
	return gsap.timeline({ paused: true })
		.to(deckPile, { scale: kind === 'return' ? 1.045 : 0.975, y: lift, duration: D(0.12), ease: 'sine.out' })
		.to(deckPile, { scale: 1, y: 0, duration: D(0.28), ease: 'elastic.out(1, 0.65)' });
}

function resetCardFace(card) {
	const inner = card.querySelector('.card__inner');
	return gsap.to(inner, {
		rotationY: 360,
		paused: true,
		duration: D(0.36),
		ease: 'power2.inOut',
		onComplete: () => {
			card.classList.remove('is-up');
			gsap.set(inner, { rotationY: 0 });
		},
	});
}

export function singleDeal() {
	openPanel();
	$('#panel-title').innerHTML = M().panelTitle;
	setActions([]);
	stageWrap()?.classList.add('is-single-layout');
	live = null;
	const G = GEO();

	deckPile.style.width = G.PILE_W + '%';
	gsap.to(deckPile, { left: G.PILE_X + '%', top: G.TOP + '%', duration: D(0.7), ease: 'power2.inOut' });

	// 牌堆自身就是“再抽一张”；按钮是它的同义词
	again = el('button', 'act-btn act-btn--quiet', M().again);
	again.dataset.ui = 'single-again';
	again.type = 'button';
	again.hidden = true;
	again.onclick = drawAgain;
	deckPile.disabled = true;
	deckPile.onclick = drawAgain;

	singleDrawNext();
}

/* 桌上有翻开的牌时，牌堆与“再抽/放回”才应邀请 */
function setDrawable(on) {
	deckPile.disabled = !on;
	again.hidden = !on;
	setActions(on && live ? [again, live.link] : []);
}

function drawAgain() {
	if (S.busy || !live) return;
	const { card, link } = live;
	live = null;
	setDrawable(false);
	// 旧牌的讯息已录入阅读栏——带一点光轻轻升离即可，不抢下一张的戏；
	// 升与亮对着「放回」的降温回堆，但只是顺手一送，不作仪式。
	card.disabled = true;
	card.classList.add('is-archiving');
	if (link.isConnected) gsap.to(link, { opacity: 0, duration: D(0.25), ease: 'power1.in', onComplete: () => link.remove() });
	// disabled 按钮的 filter/opacity 有全局 CSS transition，会拖住逐帧补间——先掐掉，
	// filter 也从显式起点出发，免得读到过渡中途的值
	gsap.fromTo(card, { transition: 'none', filter: 'brightness(1) saturate(1)' }, {
		top: '-=6%',
		opacity: 0,
		scale: 0.95,
		filter: 'brightness(1.3) saturate(1)',
		duration: D(0.42),
		ease: 'power1.in',
		onComplete: () => card.remove(),
	});
	singleDrawNext(D(0.2));
}

function singleDrawNext(delay = 0) {
	const idxs = takeCards(1);
	if (!idxs) {
		setRite(...STR.deck.empty);
		again?.remove();
		setActions([]);
		deckPile.disabled = true;
		return;
	}
	const G = GEO();
	const di = idxs[0];
	const n = ++S.drawn;
	S.placed.set(n, di);
	showShare(); // 已有牌离堆，这一局从此可以分享
	const c = DECK[di];
	const ctx = M().ctx(n);
	const seq = S.seq;

	const card = el('button', 'card', cardShell(di));
	card.type = 'button';
	card.dataset.deckIdx = di;
	card.style.width = G.CARD_W + '%';
	card.style.left = G.PILE_X + '%';
	card.style.top = G.TOP + '%';
	card.style.opacity = '0';
	card.setAttribute('aria-label', M().nthAria(n));
	wheel.append(card);
	// 起飞点是堆顶那张的姿态（缩到堆与牌的宽度比），先从牌堆抽出，再落到阅读位。
	const pose = topLayerPose(drawCount() + 1);
	gsap.set(card, { xPercent: -50, yPercent: -50, opacity: 0, x: pose.x, y: pose.y, scale: G.PILE_W / G.CARD_W, rotation: pose.rotation, zIndex: 6 });
	S.busy = true;
	gsap.delayedCall(delay + D(0.58), syncDeckThickness); // 避开牌刚显现的一瞬，牌离堆后再收薄
	const landTop = G.TOP + gsap.utils.random(-0.52, 0.52); // 落点只保留一点手放的活气
	const landRot = gsap.utils.random(-1.05, 1.05);
	const midX = G.PILE_X + (G.CARD_X - G.PILE_X) * 0.48;
	const midTop = G.TOP - (MOBILE.matches ? 9 : 7);
	card.classList.add('is-dealing');
	gsap.timeline({
		delay,
		onComplete: () => {
			if (seq !== S.seq) return; // 这一局已被换掉，别碰新局的桌面
			gsap.set(card, { clearProps: 'zIndex' });
			card.classList.remove('is-dealing');
			S.busy = false;
			card.classList.add('is-next');
		},
	})
		.add(deckTouch('draw'), 0)
		.to(card, { opacity: 1, scale: 0.8, x: pose.x - 4, y: pose.y - 8, rotation: pose.rotation - 4, duration: D(0.16), ease: 'power2.out' }, 0)
		.to(card, {
			left: midX + '%',
			top: midTop + '%',
			x: 0,
			y: 0,
			scale: 1.05,
			rotation: landRot - 7,
			duration: D(0.42),
			ease: 'power3.out',
		}, '>-0.02')
		.to(card, {
			left: G.CARD_X + '%',
			top: landTop + '%',
			x: gsap.utils.random(-0.8, 0.8),
			y: gsap.utils.random(-0.8, 0.8),
			scale: 1,
			rotation: landRot,
			duration: D(0.44),
			ease: 'back.out(1.35)',
		}, '>-0.04')
		.to(card, { x: 0, y: 0, duration: D(0.14), ease: 'sine.out' }, `>-=${D(0.12)}`);
	setRite(...M().turnPrompt);

	card.onclick = () => {
		if (card.classList.contains('is-up')) {
			openDialog(di, ctx);
			return;
		}
		if (S.busy) return;
		S.busy = true;
		card.classList.remove('is-next');
		flipCard(card, 1.12).then(() => {
			if (seq !== S.seq) return;
			S.busy = false;
			card.classList.add('is-up');
			card.setAttribute('aria-label', cardName(c));
			const entry = appendSingleEntry(di, n);
			setRite(...M().afterFlip);

			const link = el('button', 'act-link', M().putBack);
			link.dataset.ui = 'single-put-back';
			link.type = 'button';
			link.onclick = () => returnToDeck(card, link, entry, n);

			live = { card, link };
			setDrawable(true);
		});
	};
}

function returnToDeck(card, link, entry, n) {
	if (S.busy || !live) return;
	S.busy = true;
	live = null;
	setDrawable(false);
	if (link.isConnected) gsap.to(link, { opacity: 0, duration: D(0.25), ease: 'power1.in', onComplete: () => link.remove() });
	/* the returned card no longer counts as drawn */
	S.placed.delete(n);
	S.drawn--;
	S.ptr--;
	updateBadge(drawCount());
	gsap.to(entry, { opacity: 0, y: 14, duration: D(0.4), ease: 'power2.in', onComplete: () => entry.remove() });
	setRite(...M().returned);
	// 放回也走堆顶：先合回牌背，再沿来路放回，最后洗动未抽出的牌。
	const back = topLayerPose(drawCount());
	const seq = S.seq;
	const G = GEO();
	const midX = G.PILE_X + (Number.parseFloat(card.style.left) - G.PILE_X) * 0.45;
	const midTop = G.TOP - (MOBILE.matches ? 8 : 7);
	gsap.set(card, { zIndex: 6 });
	card.classList.add('is-returning');
	gsap.timeline({
		onComplete: async () => {
			card.remove();
			if (seq !== S.seq) return;
			syncDeckThickness(); // 牌归堆，先长回厚度再洗
			/* shuffle only the undrawn part of the deck */
			const rest = S.order.slice(S.ptr);
			cryptoShuffle(rest);
			S.order.splice(S.ptr, rest.length, ...rest);
			await animateShuffle();
			if (seq !== S.seq) return;
			S.busy = false;
			singleDrawNext();
		},
	})
		.to(card, { scale: 1.08, y: '-=6', filter: 'brightness(1.08) saturate(1.04)', duration: D(0.16), ease: 'power2.out' })
		.add(resetCardFace(card), '>-0.04')
		.to(card, {
			left: midX + '%',
			top: midTop + '%',
			x: 0,
			y: 0,
			scale: 0.84,
			rotation: back.rotation + 8,
			filter: 'brightness(0.96) saturate(0.9)',
			duration: D(0.36),
			ease: 'power2.inOut',
		}, '>-0.03')
		.to(card, {
			opacity: 0,
			scale: G.PILE_W / G.CARD_W,
			left: G.PILE_X + '%',
			top: G.TOP + '%',
			x: back.x,
			y: back.y,
			rotation: back.rotation,
			duration: D(0.34),
			ease: 'power3.in',
		})
		.add(deckTouch('return'), `>-=${D(0.16)}`);
}

function appendSingleEntry(di, n) {
	const ctx = M().ctx(n);
	const entry = el('article', 'entry');
	entry.dataset.single = 'true';
	entry.dataset.deckIdx = di;
	entry.dataset.n = n;
	renderSingleEntry(entry, di, n);
	entry.querySelector('.entry__name').onclick = () => openDialog(di, ctx);
	entry.querySelector('.entry__where').onclick = () => scrollPanelTo(entry, true);
	placeEntry(entry);
	return entry;
}

function renderSingleEntry(entry, di, n) {
	const c = DECK[di];
	entry.innerHTML = `
    <p class="entry__where">${M().where(n)}</p>
    <h4 class="entry__name">${cardName(c)}</h4>
    <p class="entry__ps">${psSuitLine(c)}</p>
    <p class="entry__reading">${cardText(c, 'reading')}</p>
    <p class="entry__events">${text('dialog.sections.events')} — ${cardText(c, 'events')}</p>`;
}

function refreshSingleText() {
	if ($('#screen-ritual').hidden || S.method !== 'single') return;
	$('#panel-title').innerHTML = M().panelTitle;
	if (again) again.textContent = M().again;
	if (live?.link) live.link.textContent = M().putBack;
	if (live?.card) {
		const di = Number(live.card.dataset.deckIdx);
		if (Number.isInteger(di)) live.card.setAttribute('aria-label', cardName(DECK[di]));
	}
	panelList.querySelectorAll('.entry[data-single="true"]').forEach(entry => {
		const di = Number(entry.dataset.deckIdx);
		const n = Number(entry.dataset.n);
		renderSingleEntry(entry, di, n);
		const ctx = M().ctx(n);
		entry.querySelector('.entry__name').onclick = () => openDialog(di, ctx);
		entry.querySelector('.entry__where').onclick = () => scrollPanelTo(entry, true);
	});
}

window.addEventListener('languagechange', refreshSingleText);
