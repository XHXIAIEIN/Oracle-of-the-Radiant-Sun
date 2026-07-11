/* 移动端的解读抽屉：解读面板固定于页脚，凭抓手在收起（peek）/
   半屏（half）/ 全屏（full）三档之间拖拽或点按切换。桌面端一概不动。 */

import { $, MOBILE } from './dom.js';
import { panel } from './stage.js';

const grip = $('#panel-grip');
const screen = $('#screen-ritual');

const ORDER = ['peek', 'half', 'full'];
let state = 'half';
let dragPointer = null;

/* 各档的目标高度（px），与 panel.css 的三档保持一致 */
const heights = () => ({
	peek: 96,
	half: Math.round(innerHeight * 0.46),
	full: innerHeight - 56,
});

/* 抽屉是覆盖式的：页面只避让露出的抓手高度，展开/拖拽不重排牌桌 */
function syncPad() {
	if (!MOBILE.matches || panel.hidden) {
		screen.style.removeProperty('--drawer-pad');
		return;
	}
	const h = heights().peek;
	screen.style.setProperty('--drawer-pad', h + 12 + 'px');
}

function setDrawer(s) {
	state = s;
	panel.dataset.drawer = s;
	panel.style.removeProperty('height');
	syncPad();
}

function setDrawerHeight(px) {
	state = 'custom';
	panel.dataset.drawer = 'custom';
	panel.style.height = px + 'px';
	syncPad();
}

/* 面板初开只露抓手一档，牌桌不被遮；之后由读者自己点按/拖拽展开 */
export function drawerOnOpen() {
	if (MOBILE.matches) setDrawer('peek');
}
export function drawerOnEntry() {
	syncPad();
}
export function resetDrawer() {
	state = 'half';
	delete panel.dataset.drawer;
	panel.style.removeProperty('height');
	screen.style.removeProperty('--drawer-pad');
}

export function drawerLiftForEntry(entry = panel.querySelector('.entry')) {
	if (!MOBILE.matches || panel.hidden) return false;
	const hs = heights();
	const gripH = grip.offsetHeight || 0;
	const headH = panel.querySelector('.panel__head')?.offsetHeight || 0;
	if (!entry) {
		setDrawer('half');
		return true;
	}
	const hasDeepContent = !!entry.querySelector('.amplify__block, .hour-form, .minirow, .hour-stack');
	const wanted = gripH + headH + entry.scrollHeight + (hasDeepContent ? 72 : 34);
	const floor = hasDeepContent ? Math.round(innerHeight * 0.62) : hs.half;
	setDrawerHeight(clamp(Math.max(wanted, floor), hs.peek, hs.full));
	return true;
}

export function drawerLiftForReading() {
	return drawerLiftForEntry();
}

/* ── 抓手：拖动改高，松手吸附最近一档；未曾拖动即为点按，逐档展开 ── */

let startY = 0;
let startH = 0;
let moved = false;
let lastY = 0;
let lastT = 0;
let velocity = 0;
let pendingH = null;
let dragFrame = 0;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rubber = (n, min, max) => {
	if (n < min) return min - Math.min(42, (min - n) * 0.34);
	if (n > max) return max + Math.min(52, (n - max) * 0.28);
	return n;
};

function snapState(h) {
	const hs = heights();
	const projected = clamp(h - velocity * 170, hs.peek, hs.full);
	let best = state,
		gap = Infinity;
	for (const k of ORDER) {
		const d = Math.abs(hs[k] - projected);
		if (d < gap) {
			gap = d;
			best = k;
		}
	}
	return best;
}

function setDragHeight(h) {
	pendingH = h;
	if (dragFrame) return;
	dragFrame = requestAnimationFrame(() => {
		dragFrame = 0;
		panel.style.height = pendingH + 'px';
	});
}

grip.addEventListener('pointerdown', e => {
	if (!MOBILE.matches) return;
	e.preventDefault();
	dragPointer = e.pointerId;
	moved = false;
	startY = e.clientY;
	lastY = e.clientY;
	lastT = performance.now();
	velocity = 0;
	startH = panel.getBoundingClientRect().height;
	pendingH = startH;
	panel.classList.add('is-dragging');
	try {
		grip.setPointerCapture(e.pointerId);
	} catch {} // 指针已然离场（或合成事件）时，捕获不到也无妨
});

grip.addEventListener('pointermove', e => {
	if (!panel.classList.contains('is-dragging') || e.pointerId !== dragPointer) return;
	e.preventDefault();
	const now = performance.now();
	const dy = e.clientY - startY;
	const dt = Math.max(16, now - lastT);
	velocity = (e.clientY - lastY) / dt;
	lastY = e.clientY;
	lastT = now;
	if (Math.abs(dy) > 5) moved = true;
	const hs = heights();
	const rawH = startH - dy;
	setDragHeight(rubber(rawH, hs.peek, hs.full));
});

const settle = e => {
	if (!panel.classList.contains('is-dragging') || e.pointerId !== dragPointer) return;
	e.preventDefault();
	panel.classList.remove('is-dragging');
	const h = moved && pendingH != null ? pendingH : panel.getBoundingClientRect().height;
	dragPointer = null;
	pendingH = null;
	if (dragFrame) {
		cancelAnimationFrame(dragFrame);
		dragFrame = 0;
	}
	if (!moved) {
		panel.style.removeProperty('height');
		// 点按：收起 → 半屏 → 全屏 → 半屏
		setDrawer(state === 'peek' ? 'half' : state === 'half' ? 'full' : 'half');
		return;
	}
	panel.style.height = h + 'px';
	setDrawer(snapState(h));
	void panel.offsetHeight;
	panel.style.removeProperty('height');
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
