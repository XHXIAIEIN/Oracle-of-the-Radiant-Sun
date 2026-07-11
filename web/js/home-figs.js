/* 起始页：每种占法左侧的牌阵预览小图，与太阳之环共用同一几何（posXY） */

import { posXY } from './wheel.js';

const CW = 10.5,
	CH = 15.6;
const r1 = n => +n.toFixed(1);
const seq = n => Array.from({ length: n }, (_, k) => k + 1);

const card = (i, on, glyph) => {
	const { x, y } = posXY(i);
	let s = `<rect class="fig-card${on ? ' fig-card--on' : ''}" x="${r1(x - CW / 2)}" y="${r1(y - CH / 2)}" width="${CW}" height="${CH}" rx="1.6"/>`;
	if (glyph !== undefined) s += `<text class="fig-num" x="${r1(x)}" y="${r1(y)}">${glyph}</text>`;
	return s;
};

/* 十二张发满一环；on 中的宫位点亮并标号 */
const wheelCards = on => seq(12).map(i => card(i, on.includes(i), on.includes(i) ? i : undefined)).join('');

const pt = i => {
	const { x, y } = posXY(i);
	return `${r1(x)},${r1(y)}`;
};
const link = houses => `<polygon class="fig-link" points="${houses.map(pt).join(' ')}"/>`;
const axis = (a, b) => {
	const p = posXY(a),
		q = posXY(b);
	return `<line class="fig-link" x1="${r1(p.x)}" y1="${r1(p.y)}" x2="${r1(q.x)}" y2="${r1(q.y)}"/>`;
};

const RING = '<circle class="fig-ring" cx="50" cy="50" r="47"/><circle class="fig-ring" cx="50" cy="50" r="26"/>';
const wheelFig = inner => `<svg viewBox="0 0 100 100">${RING}${inner}</svg>`;

const FIGS = {
	sunyear: wheelFig(wheelCards(seq(12)) + card(13, true, '☉')),
	horary: wheelFig(wheelCards([1]) + '<text class="fig-glyph" x="50" y="50">?</text>'),
	trine: wheelFig(link([1, 5, 9]) + wheelCards([1, 5, 9])),
	cross: wheelFig(axis(1, 7) + axis(4, 10) + wheelCards([1, 4, 7, 10])),
	single: `<svg viewBox="0 0 100 100">
		<circle class="fig-ring" cx="50" cy="50" r="30"/>
		<rect class="fig-card fig-card--on" x="39.5" y="34.4" width="21" height="31.2" rx="2.4"/>
		<text class="fig-glyph" x="50" y="50">✶</text>
	</svg>`,
};

export function initHomeFigs(root = document) {
	root.querySelectorAll('.method').forEach(b => {
		b.querySelector('.method__fig').innerHTML = FIGS[b.dataset.method] ?? '';
	});
}
