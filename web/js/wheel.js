/* 太阳之环：几何与环、辐条、槽位标签的绘制 */

import { el, D } from './dom.js';
import { wheel } from './stage.js';
import { mode } from './state.js';
import { MONTHS, HOUSES } from '../data/houses.js';
import { SIGN } from '../data/card/glyphs.js';
import { STR } from '../data/i18n.js';

/* geometry: house i sits at 165° − 30°(i−1), screen angle */

export const posXY = i => {
	if (i === 13) return { x: 50, y: 50 };
	const t = ((165 - 30 * (i - 1)) * Math.PI) / 180;
	return { x: 50 + 36.5 * Math.cos(t), y: 50 + 36.5 * Math.sin(t) };
};

export const labelXY = i => {
	const t = ((165 - 30 * (i - 1)) * Math.PI) / 180;
	const c = Math.cos(t);
	// side labels anchor at the card's outer edge and grow away from the wheel
	const side = c > 0.35 ? 'r' : c < -0.35 ? 'l' : '';
	const r = side ? 47.5 : 49.5;
	return { x: 50 + r * c, y: 50 + r * Math.sin(t), side };
};

export function drawRing() {
	const spokes = Array.from({ length: 12 }, (_, k) => {
		const t = ((180 - 30 * k) * Math.PI) / 180;
		return `<line x1="50" y1="50" x2="${50 + 44 * Math.cos(t)}" y2="${50 - 44 * Math.sin(t)}"/>`;
	}).join('');
	const ring = el(
		'div',
		'wheel__ring',
		`<svg viewBox="0 0 100 100" width="100%" height="100%">
       <g stroke="oklch(78% 0.12 85 / 0.22)" stroke-width="0.18" fill="none">
         <circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="30.5"/>${spokes}
       </g>
     </svg>`
	);
	wheel.append(ring);

	const months = mode().wheelLabels === 'months';
	for (let i = 1; i <= 12; i++) {
		const { x, y, side } = labelXY(i);
		const m = MONTHS[i - 1],
			h = HOUSES[i - 1];
		const lab = months ? `<span class="glyph">${SIGN[m.sign][0]}</span><span>${m.en.toUpperCase()} · ${m.zh}</span>` : `<span class="glyph">${i}</span><span>${h.zh}</span>`;
		const n = el('div', 'slot-label' + (side ? ` slot-label--${side}` : ''), lab);
		n.style.left = x + '%';
		n.style.top = y + '%';
		n.dataset.pos = i;
		wheel.append(n);
	}
	if (mode().centerTheme) {
		const c = el('div', 'slot-label', `<span>${STR.wheel.theme}</span>`);
		c.style.left = '50%';
		c.style.top = '62%';
		c.dataset.pos = 13;
		wheel.append(c);
	}
	gsap.fromTo(wheel.querySelectorAll('.wheel__ring, .slot-label'), { opacity: 0 }, { opacity: 1, duration: D(1.1), stagger: 0.03, ease: 'power1.out' });
}
