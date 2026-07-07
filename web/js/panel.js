/* 解读面板：条目的展开落位、随读跟卷（自动滚动与「回到最新」胶囊）、排序 */

import { $, D, REDUCED } from './dom.js';
import { panel, panelList } from './stage.js';
import { STR } from '../data/i18n.js';
import { drawerOnOpen, drawerOnEntry } from './drawer.js';

/* the reading panel arrives as a grid-track transition (see .ritual-body),
   the wheel easing aside rather than snapping to its smaller column;
   on a phone it rises instead as the bottom drawer (js/drawer.js) */
export function openPanel() {
	if (!panel.hidden) return;
	panel.hidden = false;
	void panel.offsetWidth; // commit the collapsed track, so the class change transitions
	$('#ritual-body').classList.add('has-panel');
	drawerOnOpen();
}

/* the reading log: newest entry on top by default.
   A new entry unfolds — the list parts to make room (height), then the
   words settle in — rather than cutting straight to a fade. */
let panelDesc = true;

export function placeEntry(entry) {
	drawerOnEntry(); // 首笔解读落下时，收着的抽屉升到半屏
	panelDesc ? panelList.prepend(entry) : panelList.append(entry);
	gsap.set(entry, { overflow: 'clip' });
	gsap.timeline({
		onComplete: () => {
			gsap.set(entry, { clearProps: 'overflow' });
			autoScrollTo(entry);
		},
	})
		.from(entry, { height: 0, paddingTop: 0, paddingBottom: 0, duration: D(0.45), ease: 'power3.inOut', clearProps: 'height,paddingTop,paddingBottom' })
		.from(entry, { opacity: 0, y: 12, duration: D(0.5), ease: 'power2.out' }, '-=0.12');
}

/* ── follow the reading, or let the reader roam ────────────────
   Auto-scroll follows each new reveal only while the reader hasn't
   scrolled away; once they have, the lock holds and a capsule at the
   scrollport's foot offers the way back to the latest. */
let panelFollow = true; // false = the reader has taken the scroll
let lastAutoTarget = null; // where the panel would follow to
let autoScrollUntil = 0; // scroll events before this stamp are ours, not the reader's
let pillShown = false;

const jumpPill = $('#panel-jump');

function latestInView() {
	if (!lastAutoTarget?.isConnected) return true;
	const p = panel.getBoundingClientRect(),
		r = lastAutoTarget.getBoundingClientRect();
	return r.top < p.bottom - 40 && r.bottom > p.top + 40;
}

function pillArrow() {
	if (!lastAutoTarget?.isConnected) return;
	jumpPill.querySelector('.arrow').textContent = lastAutoTarget.getBoundingClientRect().top < panel.getBoundingClientRect().top ? '↑' : '↓';
}

/* scroll the panel alone — scrollIntoView would drag every scrollable
   ancestor along and yank the page itself. The drawer's grip and head
   ride sticky over the log, so they count into the top margin. */
const stickyChrome = () => {
	let h = 0;
	for (const n of panel.querySelectorAll('.panel__grip, .panel__head')) {
		if (getComputedStyle(n).position === 'sticky') h += n.offsetHeight;
	}
	return h;
};
function scrollPanelTo(node) {
	const p = panel.getBoundingClientRect(),
		r = node.getBoundingClientRect(),
		m = 10 + stickyChrome();
	const topDelta = r.top - (p.top + m);
	let delta = 0;
	if (r.top < p.top + m) delta = topDelta;
	else if (r.bottom > p.bottom - m) delta = Math.min(r.bottom - (p.bottom - m), topDelta);
	if (!delta) return;
	autoScrollUntil = performance.now() + (REDUCED ? 50 : 1200);
	panel.scrollBy({ top: delta, behavior: REDUCED ? 'auto' : 'smooth' });
}

function setPill(show) {
	if (pillShown === show) return;
	pillShown = show;
	gsap.killTweensOf(jumpPill);
	if (show) {
		jumpPill.hidden = false;
		gsap.fromTo(jumpPill, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: D(0.4), ease: 'power2.out' });
	} else {
		gsap.to(jumpPill, { opacity: 0, y: 8, duration: D(0.25), ease: 'power2.in', onComplete: () => (jumpPill.hidden = true) });
	}
}

/* force 用于读者亲手唤出的内容（如深察一周七日）：无论跟卷锁
   是否在读者手上，都把新内容送到眼前 */
export function autoScrollTo(node, force = false) {
	lastAutoTarget = node;
	if (!panelFollow && !force) {
		/* something new arrived while the reader is elsewhere — nudge the capsule */
		pillArrow();
		setPill(true);
		gsap.fromTo(jumpPill, { scale: 1.1 }, { scale: 1, duration: D(0.4), ease: 'back.out(2.5)' });
		return;
	}
	scrollPanelTo(node);
}

export function resetFollow() {
	panelFollow = true;
	lastAutoTarget = null;
	pillShown = false;
	gsap.killTweensOf(jumpPill);
	jumpPill.hidden = true;
}

/* the reader's own scrolling takes or returns the lock — scrolling back
   to where the latest sits releases it again; a wheel or touch during
   one of our smooth scrolls cancels the grace window immediately */
panel.addEventListener(
	'scroll',
	() => {
		if (performance.now() < autoScrollUntil) return;
		const vis = latestInView();
		panelFollow = vis;
		if (!vis) pillArrow();
		setPill(!vis);
	},
	{ passive: true }
);
const takeScroll = () => (autoScrollUntil = 0);
panel.addEventListener('wheel', takeScroll, { passive: true });
panel.addEventListener('touchmove', takeScroll, { passive: true });

jumpPill.onclick = () => {
	panelFollow = true;
	setPill(false);
	if (lastAutoTarget?.isConnected) scrollPanelTo(lastAutoTarget);
};

/* flipping the log's order glides every entry to its mirrored place (FLIP) */
const sortBtn = $('#panel-sort');
sortBtn.onclick = () => {
	panelDesc = !panelDesc;
	sortBtn.textContent = panelDesc ? STR.panel.sortAsc : STR.panel.sortDesc;
	const kids = [...panelList.children];
	gsap.killTweensOf(kids);
	gsap.set(kids, { clearProps: 'opacity,transform,height,paddingTop,paddingBottom,overflow' });
	const tops = new Map(kids.map(n => [n, n.getBoundingClientRect().top]));
	panelList.replaceChildren(...kids.reverse());
	kids.forEach((n, i) => {
		const dy = tops.get(n) - n.getBoundingClientRect().top;
		if (dy) gsap.from(n, { y: dy, duration: D(0.65), delay: i * 0.015, ease: 'power3.inOut' });
	});
};
