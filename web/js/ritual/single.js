/* 单张：牌堆留在桌上作源头，点堆（或堆下按钮）即再抽一张，
   放回重洗的链接就挂在翻开那张牌的下方 */

import { $, el, D, cryptoShuffle } from '../dom.js';
import { wheel, setRite, setActions, updateBadge } from '../stage.js';
import { S, takeCards, drawCount } from '../state.js';
import { DECK } from '../../data/card/deck.js';
import { MODES } from '../../data/modes/index.js';
import { STR } from '../../data/i18n.js';
import { psSuitLine } from '../../data/card/glyphs.js';
import { cardShell, flipCard } from '../cards.js';
import { openPanel, placeEntry } from '../panel.js';
import { openDialog } from '../dialog.js';
import { deckPile, animateShuffle, syncDeckThickness, topLayerPose } from './deck-pile.js';
import { showShare } from '../share.js';

const M = () => MODES.single;

/* 桌面几何（% of wheel）：牌堆与大牌的落点、宽，以及牌面宽高比 */
const RATIO = 300 / 446; // 与 --card-ratio 一致
const PILE_X = 31;
const PILE_W = 12.8;
const CARD_X = 63;
const CARD_W = 24;
/* 中心在 topPct、宽 w 的牌，其下缘再留一点呼吸的位置 */
const underY = (topPct, w) => topPct + w / RATIO / 2 + 2.2 + '%';

let again = null; // 牌堆下的“再抽一张”
let live = null; // 桌上已翻开的那张：{ card, link }

export function singleDeal() {
	openPanel();
	$('#panel-title').innerHTML = M().panelTitle;
	setActions([]);
	live = null;

	gsap.to(deckPile, { left: PILE_X + '%', duration: D(0.7), ease: 'power2.inOut' });

	// 牌堆自身就是“再抽一张”，堆下缘再贴一枚同义按钮
	again = el('button', 'act-btn act-btn--quiet act-btn--deck', M().again);
	again.type = 'button';
	again.hidden = true;
	again.onclick = drawAgain;
	Object.assign(again.style, { left: PILE_X + '%', top: underY(50, PILE_W) });
	wheel.append(again);
	deckPile.disabled = true;
	deckPile.onclick = drawAgain;

	singleDrawNext();
}

/* 桌上有翻开的牌时，牌堆与堆下按钮才应邀请再抽 */
function setDrawable(on) {
	deckPile.disabled = !on;
	again.hidden = !on;
	if (on) gsap.fromTo(again, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: D(0.5), ease: 'power2.out' });
}

function drawAgain() {
	if (S.busy || !live) return;
	const { card, link } = live;
	live = null;
	setDrawable(false);
	// 编排：旧牌先被“拿起”再向右放走，新牌错开半拍从堆顶抽出，
	// 新牌逼近落点时旧牌已基本让开，桌面不显挤
	card.disabled = true;
	gsap.to(link, { opacity: 0, duration: D(0.25), ease: 'power1.in', onComplete: () => link.remove() });
	gsap.timeline()
		.to(card, { scale: 1.05, y: '-=6', duration: D(0.16), ease: 'power1.out' })
		.to(card, {
			opacity: 0,
			scale: 0.9,
			left: '+=18%',
			rotation: '+=7',
			duration: D(0.5),
			ease: 'power2.in',
			onComplete: () => card.remove(),
		});
	singleDrawNext(D(0.34));
}

function singleDrawNext(delay = 0) {
	const idxs = takeCards(1);
	if (!idxs) {
		setRite(STR.deck.empty);
		again?.remove();
		deckPile.disabled = true;
		return;
	}
	const di = idxs[0];
	const n = ++S.drawn;
	S.placed.set(n, di);
	showShare(); // 已有牌离堆，这一局从此可以分享
	const c = DECK[di];
	const ctx = M().ctx(n);
	const seq = S.seq;

	const card = el('button', 'card', cardShell(di));
	card.type = 'button';
	card.style.width = CARD_W + '%';
	card.style.left = PILE_X + '%';
	card.style.top = '50%';
	card.setAttribute('aria-label', M().nthAria(n));
	wheel.append(card);
	// 起飞点是堆顶那张的姿态（0.53 ≈ 12.8/24，恰是牌堆与大牌的宽度比），飞行时压过牌堆
	const pose = topLayerPose(drawCount() + 1);
	gsap.set(card, { xPercent: -50, yPercent: -50, opacity: 0, x: pose.x, y: pose.y, scale: 0.53, rotation: pose.rotation, zIndex: 6 });
	S.busy = true;
	gsap.delayedCall(delay, syncDeckThickness); // 牌堆在起飞那一刻才收薄
	const landTop = 50 + gsap.utils.random(-1.2, 1.2); // 落点带一点错位，放回链接照它贴
	gsap.to(card, {
		opacity: 1,
		scale: 1,
		rotation: gsap.utils.random(-2.5, 2.5),
		left: CARD_X + '%',
		top: landTop + '%',
		x: 0,
		y: 0,
		delay,
		duration: D(0.65),
		ease: 'power2.out',
		onComplete: () => {
			if (seq !== S.seq) return; // 这一局已被换掉，别碰新局的桌面
			gsap.set(card, { clearProps: 'zIndex' });
			S.busy = false;
			card.classList.add('is-next');
		},
	});
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
			card.setAttribute('aria-label', c.name);
			const entry = appendSingleEntry(di, n);
			setRite(...M().afterFlip);

			const link = el('button', 'act-link act-link--card', M().putBack);
			link.type = 'button';
			link.onclick = () => returnToDeck(card, link, entry, n);
			Object.assign(link.style, { left: CARD_X + '%', top: underY(landTop, CARD_W) });
			wheel.append(link);
			gsap.fromTo(link, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: D(0.5), ease: 'power2.out' });

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
	gsap.to(link, { opacity: 0, duration: D(0.25), ease: 'power1.in', onComplete: () => link.remove() });
	/* the returned card no longer counts as drawn */
	S.placed.delete(n);
	S.drawn--;
	S.ptr--;
	updateBadge(drawCount());
	gsap.to(entry, { opacity: 0, y: 14, duration: D(0.4), ease: 'power2.in', onComplete: () => entry.remove() });
	setRite(...M().returned);
	// 放回也走堆顶：压过牌堆飞回，落在归还后堆顶的位置
	const back = topLayerPose(drawCount());
	const seq = S.seq;
	gsap.set(card, { zIndex: 6 });
	gsap.to(card, {
		opacity: 0,
		scale: 0.53,
		left: PILE_X + '%',
		top: '50%',
		x: back.x,
		y: back.y,
		rotation: back.rotation,
		duration: D(0.55),
		ease: 'power2.in',
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
	});
}

function appendSingleEntry(di, n) {
	const c = DECK[di];
	const ctx = M().ctx(n);
	const entry = el('article', 'entry');
	entry.innerHTML = `
    <p class="entry__where">${M().where(n)}</p>
    <h4 class="entry__name">${c.name}</h4>
    <p class="entry__ps">${psSuitLine(c)}</p>
    <p class="entry__reading">${c.reading}</p>
    <p class="entry__events">Events — ${c.events}</p>`;
	entry.querySelector('.entry__name').onclick = () => openDialog(di, ctx);
	placeEntry(entry);
	return entry;
}
