/* 单张牌的构件：正反两面、轮盘上的牌、面板里的小牌，与共用的翻牌动画 */

import { el, D } from './dom.js';
import { BACK_SVG } from './model/card-back.js';
import { DECK, cardName } from './model/deck.js';
import { STR } from './model/i18n.js';
import { openDialog } from './dialog.js';
import { cardImgAttrs } from './image-loader.js';
import { t } from './bilingual.js';

export const cardShell = deckIdx => {
	const card = DECK[deckIdx];
	return `<span class="card__inner">
     <span class="card__face card__back">${BACK_SVG}</span>
     <span class="card__face card__front"><img ${cardImgAttrs(card, { loading: 'eager', priority: 'low' })}></span>
   </span>`;
};

export function makeCard(pos, deckIdx, onClick) {
	const b = el('button', 'card', cardShell(deckIdx));
	b.type = 'button';
	b.dataset.pos = pos;
	b.style.width = '12.8%';
	b.setAttribute('aria-label', t(STR.reveal.faceDownAria(pos)));
	b.onclick = () => onClick(pos, b);
	gsap.set(b, { xPercent: -50, yPercent: -50 });
	return b;
}

export function flipCard(node, peak = 1.16, speed = 1) {
	return new Promise(res => {
		const dur = seconds => D(seconds / Math.max(1, speed));
		const inner = node.querySelector('.card__inner');
		const mood = node._flipMood ?? {};
		const baseRotation = Number(gsap.getProperty(node, 'rotation')) || 0;
		const lift = mood.lift ?? 0;
		const lean = mood.lean ?? 0;
		const revealPeak = 1 + (peak - 1) * 0.72;
		const windupDuration = Math.max(0.14, 0.18 + (mood.durationJitter ?? 0) * 0.2);
		const turnDuration = Math.max(0.36, 0.46 + (mood.durationJitter ?? 0) * 0.25);
		const settleDuration = Math.max(0.18, 0.26 + (mood.durationJitter ?? 0) * 0.22);
		node.classList.add('is-flipping');
		gsap.set(inner, { transformOrigin: '50% 50%', transformPerspective: 1100 });
		gsap.timeline({
			onComplete: () => {
				// stacking is class-driven (.is-up / .is-next) — drop the flip's inline z-index
				node.classList.remove('is-flipping');
				gsap.set(node, { opacity: 1, clearProps: 'zIndex,filter' });
				res();
			},
		})
			.to(node, {
				scale: revealPeak,
				y: -lift,
				rotation: baseRotation + lean,
				filter: 'brightness(1.08) saturate(1.04)',
				zIndex: 30,
				duration: dur(windupDuration),
				ease: 'power2.out',
			})
			.to(inner, { rotationY: 88, rotationZ: -lean * 0.35, duration: dur(turnDuration * 0.46), ease: 'power2.in' }, '<0.03')
			.to(node, { filter: 'brightness(1.2) saturate(1.08)', duration: dur(turnDuration * 0.36), ease: 'sine.inOut' }, '<0.04')
			.to(inner, { rotationY: 180, rotationZ: 0, duration: dur(turnDuration * 0.54), ease: mood.ease ?? 'power3.out' })
			.to(node, {
				scale: 1,
				y: 0,
				rotation: baseRotation,
				filter: 'brightness(1) saturate(1)',
				duration: dur(settleDuration),
				ease: 'power2.out',
			}, '<0.02');
	});
}

/* mini face-up card in the panel; nav = { list, at } lets the dialog leaf
   through the row's neighbours (a fresh copy per opening, so the position
   never goes stale) */
export function miniCard(deckIdx, tag, ctx, nav) {
	const c = DECK[deckIdx];
	const m = el('button', 'mini', `<img ${cardImgAttrs(c)}><span class="mini__tag">${tag}</span><span class="mini__name">${cardName(c)}</span>`);
	m.type = 'button';
	m.onclick = () => openDialog(deckIdx, ctx, nav && { list: nav.list, at: nav.at });
	return m;
}

/* mini that arrives face down and waits for revealMini — the hour card
   is dealt like the rest of its pile, then turned up */
export function miniFlipCard(deckIdx, tag, ctx, nav) {
	const c = DECK[deckIdx];
	const m = el(
		'button',
		'mini mini--flip',
		`<span class="mini__inner">
       <span class="mini__face mini__back">${BACK_SVG}</span>
       <span class="mini__face mini__front"><img ${cardImgAttrs(c)}></span>
     </span>
     <span class="mini__tag">${tag}</span><span class="mini__name">${cardName(c)}</span>`
	);
	m.type = 'button';
	m.disabled = true; // 未翻开的牌先不应答
	m.onclick = () => openDialog(deckIdx, ctx, nav && { list: nav.list, at: nav.at });
	return m;
}

/* the mini's turn-up, kin to flipCard; returns the timeline so the caller
   can seat it inside a dealing sequence */
export function revealMini(m) {
	const inner = m.querySelector('.mini__inner');
	m.classList.add('is-flipping');
	gsap.set(inner, { transformOrigin: '50% 50%', transformPerspective: 760 });
	return gsap
		.timeline({
			onComplete: () => {
				m.classList.add('is-up');
				m.classList.remove('is-flipping');
				m.disabled = false;
			},
		})
		.to(m, { scale: 1.14, y: -5, duration: D(0.18), ease: 'power2.out' })
		.to(inner, { rotationY: 92, duration: D(0.22), ease: 'power2.in' }, '<0.04')
		.to(inner, { rotationY: 180, duration: D(0.28), ease: 'power3.out' })
		.to(m, { scale: 1, y: 0, duration: D(0.24), ease: 'power2.out' }, '<0.04');
}

window.addEventListener('languagechange', () => {
	document.querySelectorAll('.card:not(.is-up)[data-pos]').forEach(card => {
		card.setAttribute('aria-label', t(STR.reveal.faceDownAria(Number(card.dataset.pos))));
	});
});
