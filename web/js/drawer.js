/* 移动端的解读抽屉：解读面板固定于页脚，凭抓手在收起（peek）/
   半屏（half）/ 全屏（full）三档之间拖拽或点按切换。桌面端一概不动。 */

import { $, MOBILE } from './dom.js';
import { panel } from './stage.js';

const grip = $('#panel-grip');
const screen = $('#screen-ritual');

const ORDER = ['peek', 'half', 'full'];
let state = 'half';

/* 各档的目标高度（px），与 panel.css 的三档保持一致 */
const heights = () => ({
	peek: 96,
	half: Math.round(innerHeight * 0.46),
	full: innerHeight - 56,
});

/* 抽屉占去的页脚写还给 .screen--ritual 作 padding，页内的仪轨行、
   操作与分享始终能滚到抽屉上沿之上；全屏档按半屏补偿即可 */
function syncPad() {
	if (!MOBILE.matches || panel.hidden) {
		screen.style.removeProperty('--drawer-pad');
		return;
	}
	const h = heights()[state === 'peek' ? 'peek' : 'half'];
	screen.style.setProperty('--drawer-pad', h + 12 + 'px');
}

function setDrawer(s) {
	state = s;
	panel.dataset.drawer = s;
	syncPad();
}

/* 面板初开只露抓手一档，牌桌不被遮；首张解读落笔时升到半屏 */
export function drawerOnOpen() {
	if (MOBILE.matches) setDrawer('peek');
}
export function drawerOnEntry() {
	if (MOBILE.matches && state === 'peek') setDrawer('half');
}
export function resetDrawer() {
	state = 'half';
	delete panel.dataset.drawer;
	screen.style.removeProperty('--drawer-pad');
}

/* ── 抓手：拖动改高，松手吸附最近一档；未曾拖动即为点按，逐档展开 ── */

let startY = 0;
let startH = 0;
let moved = false;

grip.addEventListener('pointerdown', e => {
	if (!MOBILE.matches) return;
	moved = false;
	startY = e.clientY;
	startH = panel.getBoundingClientRect().height;
	panel.classList.add('is-dragging');
	try {
		grip.setPointerCapture(e.pointerId);
	} catch {} // 指针已然离场（或合成事件）时，捕获不到也无妨
});

grip.addEventListener('pointermove', e => {
	if (!panel.classList.contains('is-dragging')) return;
	const dy = e.clientY - startY;
	if (Math.abs(dy) > 6) moved = true;
	const h = Math.max(60, Math.min(startH - dy, innerHeight - 40));
	panel.style.height = h + 'px';
});

const settle = e => {
	if (!panel.classList.contains('is-dragging')) return;
	panel.classList.remove('is-dragging');
	const h = panel.getBoundingClientRect().height;
	panel.style.removeProperty('height');
	if (!moved) {
		// 点按：收起 → 半屏 → 全屏 → 半屏
		setDrawer(state === 'peek' ? 'half' : state === 'half' ? 'full' : 'half');
		return;
	}
	let best = 'half',
		gap = Infinity;
	for (const [k, v] of Object.entries(heights())) {
		if (Math.abs(v - h) < gap) {
			gap = Math.abs(v - h);
			best = k;
		}
	}
	setDrawer(best);
};
grip.addEventListener('pointerup', settle);
grip.addEventListener('pointercancel', settle);

/* 旋屏或跨过断点时，档位与补偿一并对齐当下的窗口 */
addEventListener('resize', syncPad);
MOBILE.addEventListener('change', () => {
	if (panel.hidden) return;
	if (MOBILE.matches) setDrawer(ORDER.includes(state) ? state : 'half');
	else resetDrawer();
});
