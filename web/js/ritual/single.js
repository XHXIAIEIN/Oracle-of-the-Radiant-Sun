/* 单张：牌堆留在桌上作源头，点堆（或"再抽一张"按钮）即再抽一张。
   桌面端两枚小按钮贴在牌堆与翻开那张牌的下缘；手机上桌面太挤，
   它们改列在仪轨行下的操作区，指下即是 */

import { $, el, D, cryptoShuffle, MOBILE } from '../dom.js';
import { wheel, actions, setRite, setActions, updateBadge } from '../stage.js';
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

/* 桌面几何（% of wheel）：牌堆与大牌的落点、宽。手机的轮盘即全宽，
   堆与牌都放大到指得住的尺寸 */
const RATIO = 300 / 446; // 与 --card-ratio 一致
const GEO = () => (MOBILE.matches ? { PILE_X: 26, PILE_W: 16, CARD_X: 64, CARD_W: 30 } : { PILE_X: 31, PILE_W: 12.8, CARD_X: 63, CARD_W: 24 });
/* 中心在 topPct、宽 w 的牌，其下缘再留一点呼吸的位置 */
const underY = (topPct, w) => topPct + w / RATIO / 2 + 2.2 + '%';

let again = null; // “再抽一张”——桌面贴堆下，手机入操作区
let live = null; // 桌上已翻开的那张：{ card, link }

export function singleDeal() {
	openPanel();
	$('#panel-title').innerHTML = M().panelTitle;
	setActions([]);
	live = null;
	const G = GEO();

	deckPile.style.width = G.PILE_W + '%';
	gsap.to(deckPile, { left: G.PILE_X + '%', duration: D(0.7), ease: 'power2.inOut' });

	// 牌堆自身就是“再抽一张”；按钮是它的同义词
	again = el('button', 'act-btn act-btn--quiet' + (MOBILE.matches ? '' : ' act-btn--deck'), M().again);
	again.type = 'button';
	again.hidden = true;
	again.onclick = drawAgain;
	if (!MOBILE.matches) {
		Object.assign(again.style, { left: G.PILE_X + '%', top: underY(50, G.PILE_W) });
		wheel.append(again);
	}
	deckPile.disabled = true;
	deckPile.onclick = drawAgain;

	singleDrawNext();
}

/* 桌上有翻开的牌时，牌堆与“再抽/放回”才应邀请 */
function setDrawable(on) {
	deckPile.disabled = !on;
	if (MOBILE.matches) {
		again.hidden = false;
		setActions(on && live ? [again, live.link] : []);
		// 抽屉升起后按钮落在其后，温和把操作行送回抽屉上沿之上
		if (on) actions.scrollIntoView({ block: 'end', behavior: 'smooth' });
		return;
	}
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
	if (link.isConnected) gsap.to(link, { opacity: 0, duration: D(0.25), ease: 'power1.in', onComplete: () => link.remove() });
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
	card.style.width = G.CARD_W + '%';
	card.style.left = G.PILE_X + '%';
	card.style.top = '50%';
	card.setAttribute('aria-label', M().nthAria(n));
	wheel.append(card);
	// 起飞点是堆顶那张的姿态（缩到堆与牌的宽度比），飞行时压过牌堆
	const pose = topLayerPose(drawCount() + 1);
	gsap.set(card, { xPercent: -50, yPercent: -50, opacity: 0, x: pose.x, y: pose.y, scale: G.PILE_W / G.CARD_W, rotation: pose.rotation, zIndex: 6 });
	S.busy = true;
	gsap.delayedCall(delay, syncDeckThickness); // 牌堆在起飞那一刻才收薄
	const landTop = 50 + gsap.utils.random(-1.2, 1.2); // 落点带一点错位，放回链接照它贴
	gsap.to(card, {
		opacity: 1,
		scale: 1,
		rotation: gsap.utils.random(-2.5, 2.5),
		left: G.CARD_X + '%',
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

			const link = el('button', 'act-link' + (MOBILE.matches ? '' : ' act-link--card'), M().putBack);
			link.type = 'button';
			link.onclick = () => returnToDeck(card, link, entry, n);
			if (!MOBILE.matches) {
				Object.assign(link.style, { left: G.CARD_X + '%', top: underY(landTop, G.CARD_W) });
				wheel.append(link);
				gsap.fromTo(link, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: D(0.5), ease: 'power2.out' });
			}

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
	// 放回也走堆顶：压过牌堆飞回，落在归还后堆顶的位置
	const back = topLayerPose(drawCount());
	const seq = S.seq;
	gsap.set(card, { zIndex: 6 });
	gsap.to(card, {
		opacity: 0,
		scale: GEO().PILE_W / GEO().CARD_W,
		left: GEO().PILE_X + '%',
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
