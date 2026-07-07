/* 桌面中央的牌堆：层数与厚度随余牌收放，供洗牌、发牌、单张取牌共用 */

import { el, D } from '../dom.js';
import { wheel } from '../stage.js';
import { drawCount } from '../state.js';
import { BACK_SVG } from '../../data/card/back.js';
import { DECK } from '../../data/card/deck.js';
import { STR } from '../../data/i18n.js';

export let deckPile;

const LAYERS = 10;

/* 每层牌各自的错落，洗牌后重新掷一副 */
const jitter = () => ({ x: gsap.utils.random(-1.4, 1.4), r: gsap.utils.random(-2.4, 2.4) });

/* 第 i 层在余 remaining 张时的姿态：牌越少，叠得越矮越紧 */
function layerPose(c, i, remaining) {
	const gap = 1.1 * (0.3 + (0.7 * remaining) / DECK.length);
	return { x: (i - 5) * 0.5 + c._j.x, y: -i * gap, rotation: c._j.r };
}

const visibleLayers = remaining => (remaining <= 0 ? 0 : Math.max(1, Math.ceil((remaining / DECK.length) * LAYERS)));

/* 余 remaining 张时堆顶那张的姿态——发牌自这里起飞，还牌也落回这里 */
export function topLayerPose(remaining = drawCount()) {
	const i = Math.max(0, visibleLayers(remaining) - 1);
	const c = deckPile?.children[i];
	return c ? layerPose(c, i, remaining) : { x: 0, y: 0, rotation: 0 };
}

export function createDeckPile() {
	deckPile = el('button', 'deck');
	deckPile.type = 'button';
	deckPile.setAttribute('aria-label', STR.deck.aria);
	Object.assign(deckPile.style, { left: '50%', top: '50%', width: '12.8%' });
	gsap.set(deckPile, { xPercent: -50, yPercent: -50 });
	const remaining = drawCount();
	for (let i = 0; i < LAYERS; i++) {
		const c = el('span', 'deck-card', BACK_SVG);
		c._j = jitter();
		gsap.set(c, { ...layerPose(c, i, remaining), opacity: i < visibleLayers(remaining) ? 1 : 0 });
		deckPile.append(c);
	}
	wheel.append(deckPile);
	gsap.fromTo(deckPile, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: D(0.8), ease: 'power2.out' });
	return deckPile;
}

/* 牌离开或放回后，按余牌数收放牌堆的层数与厚度 */
export function syncDeckThickness(remaining = drawCount()) {
	if (!deckPile || !deckPile.isConnected) return;
	const vis = visibleLayers(remaining);
	[...deckPile.children].forEach((c, i) => {
		gsap.to(c, {
			...layerPose(c, i, remaining),
			opacity: i < vis ? 1 : 0,
			duration: D(0.32),
			ease: 'power2.out',
		});
	});
}

export function animateShuffle() {
	return new Promise(res => {
		const remaining = drawCount();
		const vis = visibleLayers(remaining);
		const cards = [...deckPile.children].slice(0, vis);
		const tl = gsap.timeline({ onComplete: res });
		cards.forEach((c, i) => {
			const side = i % 2 ? 1 : -1;
			tl.to(c, { x: side * 58 + (i - 5) * 0.5, rotation: side * 10, duration: D(0.28), ease: 'power2.out' }, i * 0.012);
		});
		cards.forEach((c, i) => {
			c._j = jitter();
			tl.to(c, { ...layerPose(c, i, remaining), duration: D(0.3), ease: 'power3.inOut' }, D(0.34) + i * 0.045);
		});
	});
}

/* 发牌结束后，牌堆淡出退场 */
export function retireDeckPile() {
	gsap.to(deckPile, {
		opacity: 0,
		scale: 0.7,
		duration: D(0.6),
		ease: 'power2.in',
		onComplete: () => deckPile.remove(),
	});
}
