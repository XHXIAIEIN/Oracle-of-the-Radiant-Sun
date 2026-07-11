/* 解读面板：条目的展开落位、随读跟卷（自动滚动与「回到最新」胶囊）、排序 */

import { $, currentScreen, D, REDUCED } from './dom.js';
import { actions, panel, panelList } from './stage.js';
import { STR } from './model/i18n.js';
import { msg, t } from './bilingual.js';
import { drawerLiftForReading, drawerOnOpen, drawerOnEntry } from './drawer.js';

const analysisPill = $('#analysis-pill');
let panelAvailable = false;
let analysisReady = false;

function updateAnalysisPill() {
	if (!analysisPill) return;
	analysisPill.hidden = !(panelAvailable && analysisReady);
	if (!panelAvailable || !analysisReady) return;
	if (analysisPill.parentNode !== actions) actions.append(analysisPill);
	analysisPill.textContent = msg('ritual.analysisOpen', 'Analysis');
}

/* the reading panel arrives as a grid-track transition (see .ritual-body),
   the wheel easing aside rather than snapping to its smaller column;
   on a phone it rises instead as the bottom drawer (js/drawer.js) */
export function openPanel() {
	panelAvailable = true;
	if (!panel.hidden) {
		updateAnalysisPill();
		return;
	}
	panel.hidden = false;
	void panel.offsetWidth; // commit the collapsed track, so the class change transitions
	$('#ritual-body').classList.add('has-panel');
	drawerOnOpen();
	updateAnalysisPill();
}

export function resetPanelChrome() {
	panelAvailable = false;
	analysisReady = false;
	updateAnalysisPill();
}

export function setAnalysisReady(ready) {
	analysisReady = ready;
	updateAnalysisPill();
}

/* the reading log: newest entry on top by default.
   A new entry unfolds — the list parts to make room (height), then the
   words settle in — rather than cutting straight to a fade. */
let panelDesc = true;

export function placeEntry(entry) {
	drawerOnEntry(); // 解读落下时只同步抽屉占位，不替读者展开 Reading
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
	const p = panel.getBoundingClientRect();
	let h = 0;
	for (const n of panel.querySelectorAll('.panel__grip, .panel__head')) {
		if (getComputedStyle(n).position === 'sticky') {
			h = Math.max(h, n.getBoundingClientRect().bottom - p.top);
		}
	}
	return Math.max(0, h);
};

/* each entry's month/house line rides sticky beneath the drawer chrome —
   its top offset follows the grip and head's real height */
const syncChrome = () => {
	const h = stickyChrome();
	panel.style.setProperty('--chrome-h', h + 'px');
	panel.style.setProperty('--entry-sticky-top', h + 'px');
};
const chromeWatch = new ResizeObserver(syncChrome);
chromeWatch.observe(panel);
chromeWatch.observe($('#panel-grip'));
chromeWatch.observe(panel.querySelector('.panel__head'));
export function scrollPanelTo(node, alignTop = false, extraOffset = 0) {
	const panelScrollable = panel.scrollHeight > panel.clientHeight + 1;
	const scroller = panelScrollable ? panel : currentScreen();
	const p = (panelScrollable ? panel : scroller).getBoundingClientRect(),
		r = node.getBoundingClientRect(),
		m = 10 + stickyChrome();
	const topDelta = r.top - (p.top + m);
	let delta = 0;
	if (alignTop) {
		/* 条目的月份行也粘在上沿——深察块置顶时再让出它的高度，
		   块首的标题行才不会躲进它身后 */
		const where = node.closest('.entry')?.querySelector('.entry__where');
		delta = topDelta - (where && !node.contains(where) ? where.offsetHeight : 0);
	} else if (r.top < p.top + m) delta = topDelta;
	else if (r.bottom > p.bottom - m) delta = Math.min(r.bottom - (p.bottom - m), topDelta);
	delta += extraOffset;
	if (!delta) return;
	autoScrollUntil = performance.now() + (REDUCED ? 50 : 1200);
	scroller.scrollBy({ top: delta, behavior: REDUCED ? 'auto' : 'smooth' });
}

function scrollPanelToSettled(node, alignTop = false, extraOffset = 0) {
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			if (node?.isConnected) scrollPanelTo(node, alignTop, extraOffset);
		});
	});
}

function canFollowInsidePanel() {
	return panel.scrollHeight > panel.clientHeight + 1;
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
   是否在读者手上，都把新内容送到眼前。top 让它对齐视区上沿——
   深察的新牌置顶，其下的后续（七日按钮、时盘）一并入目 */
export function autoScrollTo(node, force = false, top = false, extraOffset = 0) {
	lastAutoTarget = node;
	/* At tablet/narrow desktop widths the reading panel sits below the wheel
	   in normal page flow. A routine card reveal must not pull the whole
	   ritual screen down to the new entry; only explicit reader actions do. */
	if (!force && !canFollowInsidePanel()) return;
	if (!panelFollow && !force) {
		/* something new arrived while the reader is elsewhere — nudge the capsule */
		pillArrow();
		setPill(true);
		gsap.fromTo(jumpPill, { scale: 1.1 }, { scale: 1, duration: D(0.4), ease: 'back.out(2.5)' });
		return;
	}
	scrollPanelTo(node, top, extraOffset);
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
function refreshSortButton() {
	sortBtn.textContent = t(panelDesc ? STR.panel.sortAsc : STR.panel.sortDesc);
}
sortBtn.onclick = () => {
	panelDesc = !panelDesc;
	refreshSortButton();
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

window.addEventListener('languagechange', refreshSortButton);
window.addEventListener('languagechange', updateAnalysisPill);

analysisPill?.addEventListener('click', () => {
	if (!panelAvailable) return;
	if (panel.hidden) {
		panel.hidden = false;
		$('#ritual-body').classList.add('has-panel');
	}
	if (!drawerLiftForReading()) {
		const firstEntry = panel.querySelector('.entry');
		if (firstEntry) scrollPanelToSettled(firstEntry, true);
	}
});
