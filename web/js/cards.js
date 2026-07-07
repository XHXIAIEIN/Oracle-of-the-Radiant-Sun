/* 单张牌的构件：正反两面、轮盘上的牌、面板里的小牌，与共用的翻牌动画 */

import { el, D } from './dom.js';
import { DECK } from '../data/card/deck.js';
import { BACK_SVG } from '../data/card/back.js';
import { STR } from '../data/i18n.js';
import { openDialog } from './dialog.js';

export const cardShell = deckIdx => {
	const card = DECK[deckIdx];
	return `<span class="card__inner">
     <span class="card__face card__back">${BACK_SVG}</span>
     <span class="card__face card__front"><img src="${card.img}" alt="${card.name}"></span>
   </span>`;
};

export function makeCard(pos, deckIdx, onClick) {
	const b = el('button', 'card', cardShell(deckIdx));
	b.type = 'button';
	b.dataset.pos = pos;
	b.style.width = '12.8%';
	b.setAttribute('aria-label', STR.reveal.faceDownAria(pos));
	b.onclick = () => onClick(pos, b);
	gsap.set(b, { xPercent: -50, yPercent: -50 });
	return b;
}

export function flipCard(node, peak = 1.16) {
	return new Promise(res => {
		const inner = node.querySelector('.card__inner');
		gsap.timeline({
			onComplete: () => {
				// stacking is class-driven (.is-up / .is-next) — drop the flip's inline z-index
				gsap.set(node, { clearProps: 'zIndex' });
				res();
			},
		})
			.to(node, { scale: peak, zIndex: 30, duration: D(0.3), ease: 'power2.out' })
			.to(inner, { rotationY: 180, duration: D(0.62), ease: 'power2.inOut' }, '<0.05')
			.to(node, { scale: 1, duration: D(0.35), ease: 'power2.in' }, '>-0.1');
	});
}

/* mini face-up card in the panel; nav = { list, at } lets the dialog leaf
   through the row's neighbours (a fresh copy per opening, so the position
   never goes stale) */
export function miniCard(deckIdx, tag, ctx, nav) {
	const c = DECK[deckIdx];
	const m = el('button', 'mini', `<img src="${c.img}" alt="${c.name}"><span class="mini__tag">${tag}</span><span class="mini__name">${c.name}</span>`);
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
       <span class="mini__face mini__front"><img src="${c.img}" alt="${c.name}"></span>
     </span>
     <span class="mini__tag">${tag}</span><span class="mini__name">${c.name}</span>`
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
	return gsap
		.timeline({
			onComplete: () => {
				m.classList.add('is-up');
				m.disabled = false;
			},
		})
		.to(m, { scale: 1.16, duration: D(0.24), ease: 'power2.out' })
		.to(inner, { rotationY: 180, duration: D(0.5), ease: 'power2.inOut' }, '<0.05')
		.to(m, { scale: 1, duration: D(0.3), ease: 'power2.in' }, '>-0.08');
}
