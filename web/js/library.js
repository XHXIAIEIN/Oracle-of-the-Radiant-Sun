/* 卡片库：全副八十四张，默认按花色分节；亦可按季节、月份、
   星期、今日钟点重新分组。行星、星座、元素筛选与分组方式相互独立。 */

import { $, el, D, REDUCED, swapScreen } from './dom.js';
import { DECK } from '../data/card/deck.js';
import { SIGN, ELEMENTS } from '../data/card/glyphs.js';
import { MONTHS } from '../data/houses.js';
import { STR } from '../data/i18n.js';
import { openDialog } from './dialog.js';
import { syncRoute } from './router.js';

let libBuilt = false;
let libSections = [];
let libFilterTl;
let libGhosts; // fixed overlay of clones standing in for leaving pieces
let secsWrap;

/* one button per card, built once and re-seated whenever the grouping changes */
const cardBtns = [];
const cardCtx = []; // dialog context line per card, under the current grouping
const byPS = new Map(); // "Planet/Sign" → deck index

const libFilter = { group: 'suit', suit: 'all', signs: new Set() }; // empty set = all signs
const libSignMatch = sign => !libFilter.signs.size || libFilter.signs.has(sign);
const cardWill = c => (libFilter.suit === 'all' || c.dataset.planet === libFilter.suit) && libSignMatch(c.dataset.sign);

/* the time groupings, all from the book: each planet rules a day of the
   week (the suit affinities), and the hours of a day are dealt out in the
   Chaldean order, the first hour belonging to the day's own planet.
   Hours are counted from midnight, as elsewhere in the app. */
const WEEKDAYS = [
	['Sun', 'Sunday', '周日'],
	['Moon', 'Monday', '周一'],
	['Mars', 'Tuesday', '周二'],
	['Mercury', 'Wednesday', '周三'],
	['Jupiter', 'Thursday', '周四'],
	['Venus', 'Friday', '周五'],
	['Saturn', 'Saturday', '周六'],
];
const CHALDEAN = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];
const SEASONS = [
	['Spring', '春', 0],
	['Summer', '夏', 3],
	['Autumn', '秋', 6],
	['Winter', '冬', 9], // offsets into MONTHS, whose wheel begins at April/Aries
];

/* what one grouping deals onto the table: caption, dialog context,
   and the seating order of its cards */
function libGroupSecs() {
	const idx = (p, s) => byPS.get(`${p}/${s}`);
	const signRow = sign => WEEKDAYS.map(([p]) => idx(p, sign)); // a sign's seven cards, in day order
	const planetRow = planet => Object.keys(SIGN).map(s => idx(planet, s)); // a planet's twelve, in sign order
	switch (libFilter.group) {
		case 'season':
			return SEASONS.map(([en, zh, at]) => {
				const months = MONTHS.slice(at, at + 3);
				return { cap: STR.library.seasonCap(en, zh, months), ctx: STR.library.seasonCtx(en, zh, months), idxs: months.flatMap(m => signRow(m.sign)) };
			});
		case 'month':
			/* MONTHS follows the Sun-Year wheel (April/Aries first); the
			   library reads better in calendar order, January onward */
			return [...MONTHS.slice(9), ...MONTHS.slice(0, 9)].map(m => ({ cap: STR.library.monthCap(m), ctx: STR.library.monthCtx(m), idxs: signRow(m.sign) }));
		case 'week':
			return WEEKDAYS.map(d => ({ cap: STR.library.weekCap(d), ctx: STR.library.weekCtx(d), idxs: planetRow(d[0]) }));
		case 'time': {
			const at = CHALDEAN.indexOf(WEEKDAYS[new Date().getDay()][0]);
			return Array.from({ length: 7 }, (_, i) => {
				const planet = CHALDEAN[(at + i) % 7];
				const hours = [i, i + 7, i + 14, i + 21].filter(h => h < 24);
				return { cap: STR.library.timeCap(planet, hours), ctx: STR.library.timeCtx(planet, hours), idxs: planetRow(planet) };
			});
		}
		default: {
			/* deck.json is already grouped by planet — keep its order */
			const groups = new Map();
			DECK.forEach((c, i) => {
				if (!groups.has(c.planet)) groups.set(c.planet, []);
				groups.get(c.planet).push(i);
			});
			return [...groups].map(([planet, idxs]) => {
				const suit = DECK[idxs[0]].suit_name;
				return { cap: STR.library.secCap(planet, suit), ctx: STR.library.ctx(suit), idxs };
			});
		}
	}
}

function buildSections() {
	libSections = [];
	const frag = document.createDocumentFragment();
	for (const g of libGroupSecs()) {
		const sec = el('section', 'lib-sec');
		sec.append(el('h3', 'lib-sec__cap', g.cap));
		const grid = el('div', 'lib-grid');
		for (const i of g.idxs) {
			grid.append(cardBtns[i]);
			cardCtx[i] = g.ctx;
		}
		sec.append(grid);
		libSections.push(sec);
		frag.append(sec);
	}
	secsWrap.replaceChildren(frag);
}

function buildLibrary() {
	if (libBuilt) return;
	libBuilt = true;
	const filters = $('#lib-filters');
	secsWrap = $('#lib-secs');

	DECK.forEach((c, i) => {
		byPS.set(`${c.planet}/${c.sign}`, i);
		const t = el(
			'button',
			'lib-card',
			`<img src="${c.img}" alt="${c.name}" loading="lazy">
         <span class="lib-card__name">${c.name}</span>
         <span class="lib-card__ps">${STR.library.cardPs(c)}</span>`
		);
		t.type = 'button';
		t.dataset.sign = c.sign;
		t.dataset.planet = c.planet;
		t.onclick = () => openDialog(i, cardCtx[i]);
		cardBtns.push(t);
	});
	buildSections();

	/* three labelled rows: the suit (planet, single pick), the elements
	   (quick picks for their three signs), and the twelve signs
	   (multi-select) — the last two stay in step with each other */
	const rowSuit = el('div', 'qpicks');
	const rowElem = el('div', 'qpicks');
	const rowSign = el('div', 'qpicks');
	const rowGroup = el('div', 'qpicks');
	const frow = (label, row) => {
		const w = el('div', 'lib-frow');
		w.append(el('span', 'lib-frow__label', label), row);
		return w;
	};
	filters.append(frow(STR.library.rowPlanet, rowSuit), frow(STR.library.rowSign, rowSign), frow(STR.library.rowElement, rowElem), frow(STR.library.rowGroup, rowGroup));

	const pop = b => gsap.fromTo(b, { scale: 0.9 }, { scale: 1, duration: D(0.35), ease: 'back.out(2.5)' });

	const mkSuitChip = (label, key) => {
		const b = el('button', 'qpick', label);
		b.type = 'button';
		b.onclick = () => {
			if (b.getAttribute('aria-pressed') === 'true') return;
			rowSuit.querySelectorAll('.qpick').forEach(x => x.setAttribute('aria-pressed', x === b));
			pop(b);
			libFilter.suit = key;
			applyLibFilter();
		};
		return b;
	};
	const allSuit = mkSuitChip(STR.library.allPlanets, 'all');
	allSuit.setAttribute('aria-pressed', true);
	rowSuit.append(allSuit);
	const suitOf = new Map();
	DECK.forEach(c => {
		if (!suitOf.has(c.planet)) suitOf.set(c.planet, c.suit_name);
	});
	for (const [planet, suit] of suitOf) rowSuit.append(mkSuitChip(STR.library.planetChip(planet, suit), planet));

	/* the sign row keeps every chip in step with the selected set */
	const signChips = new Map(),
		elementChips = new Map();
	const syncSignRow = () => {
		const sel = libFilter.signs;
		allSign.setAttribute('aria-pressed', sel.size === 0);
		signChips.forEach((b, sign) => b.setAttribute('aria-pressed', sel.has(sign)));
		for (const [k, e] of Object.entries(ELEMENTS)) {
			elementChips.get(k).setAttribute('aria-pressed', sel.size === 3 && e.signs.every(s => sel.has(s)));
		}
	};
	const mkSignChip = (label, onPick) => {
		const b = el('button', 'qpick', label);
		b.type = 'button';
		b.onclick = () => {
			onPick();
			pop(b);
			syncSignRow();
			applyLibFilter();
		};
		return b;
	};

	const allSign = mkSignChip(STR.library.allSigns, () => libFilter.signs.clear());
	rowSign.append(allSign);
	for (const [k, e] of Object.entries(ELEMENTS)) {
		const b = mkSignChip(e.zh, () => {
			const exact = libFilter.signs.size === 3 && e.signs.every(s => libFilter.signs.has(s));
			libFilter.signs = exact ? new Set() : new Set(e.signs);
		});
		elementChips.set(k, b);
		rowElem.append(b);
	}
	Object.keys(SIGN).forEach((sign, i) => {
		const b = mkSignChip(STR.library.signChip(sign, i), () => {
			libFilter.signs.has(sign) ? libFilter.signs.delete(sign) : libFilter.signs.add(sign);
			if (libFilter.signs.size === 12) libFilter.signs.clear(); // all twelve = no filter
		});
		signChips.set(sign, b);
		rowSign.append(b);
	});
	syncSignRow();

	const mkGroupChip = (label, key) => {
		const b = el('button', 'qpick', label);
		b.type = 'button';
		b.setAttribute('aria-pressed', key === libFilter.group);
		b.onclick = () => {
			if (b.getAttribute('aria-pressed') === 'true') return;
			rowGroup.querySelectorAll('.qpick').forEach(x => x.setAttribute('aria-pressed', x === b));
			pop(b);
			libFilter.group = key;
			regroupLibrary();
		};
		return b;
	};
	for (const [key, label] of Object.entries(STR.library.groupChips)) rowGroup.append(mkGroupChip(label, key));

	/* rows listed here fold under one quiet toggle, closed by default;
	   while the list is empty the toggle stays off the table */
	const foldedRows = [];
	if (foldedRows.length) {
		const morePanel = el('div', 'lib-more__panel');
		morePanel.hidden = true;
		morePanel.append(...foldedRows);
		const moreBtn = el('button', 'lib-more', STR.library.moreSorts);
		moreBtn.type = 'button';
		moreBtn.setAttribute('aria-expanded', 'false');
		moreBtn.onclick = () => {
			const open = morePanel.hidden;
			moreBtn.setAttribute('aria-expanded', open);
			moreBtn.innerHTML = open ? STR.library.lessSorts : STR.library.moreSorts;
			if (open) {
				morePanel.hidden = false;
				gsap.from(morePanel, { height: 0, opacity: 0, duration: D(0.4), ease: 'power2.out', clearProps: 'height,opacity' });
			} else {
				gsap.to(morePanel, {
					height: 0,
					opacity: 0,
					duration: D(0.3),
					ease: 'power2.in',
					onComplete: () => {
						morePanel.hidden = true;
						gsap.set(morePanel, { clearProps: 'height,opacity' });
					},
				});
			}
		};
		filters.append(moreBtn, morePanel);
	}
}

/* re-filtering turns the table over, card by card: what leaves swings
   away edge-on where it stood (a ghost pinned at its old spot), what
   arrives completes the same turn from edge-on to face-up — one card
   giving way to the next in a single rotation, never a blank table.
   What stays simply glides to its new place (FLIP). */
const libPieces = list => list.flatMap(s => [s.querySelector('.lib-sec__cap'), ...s.querySelectorAll('.lib-card')]);

/* clones pinned where the leaving pieces stood, so the real nodes can be
   hidden or re-seated right away instead of after the exit */
function mkGhosts(leaving) {
	if (!leaving.length || REDUCED) return;
	libGhosts = el('div', 'lib-ghosts');
	for (const n of leaving) {
		const r = n.getBoundingClientRect();
		const g = n.cloneNode(true);
		gsap.set(g, { position: 'absolute', left: r.left, top: r.top, width: r.width, margin: 0 });
		libGhosts.append(g);
	}
	document.body.append(libGhosts);
}

/* first half of the turn: each ghost swings to edge-on and is gone */
function mkTurnTimeline() {
	const ghosts = libGhosts; // this run cleans up its own overlay only
	const tl = gsap.timeline({
		onComplete: () => {
			ghosts?.remove();
			if (libGhosts === ghosts) libGhosts = null;
		},
	});
	if (ghosts) {
		const gCaps = [...ghosts.children].filter(n => n.classList.contains('lib-sec__cap'));
		const gCards = [...ghosts.children].filter(n => !n.classList.contains('lib-sec__cap'));
		if (gCaps.length) tl.to(gCaps, { opacity: 0, duration: D(0.18), ease: 'power1.in' }, 0);
		if (gCards.length)
			tl.to(
				gCards,
				{
					rotationY: 90,
					transformPerspective: 900,
					duration: D(0.2),
					ease: 'power2.in',
					stagger: { amount: D(0.18) },
				},
				0
			);
	}
	return tl;
}

/* set hidden flags from the current filters; a section with nothing
   left to show folds away whole */
function applyVisibility() {
	let count = 0;
	for (const s of libSections) {
		let any = false;
		for (const c of s.querySelectorAll('.lib-card')) {
			const w = cardWill(c);
			c.hidden = !w;
			if (w) {
				any = true;
				count++;
			}
		}
		s.hidden = !any;
	}
	updateLibCount(count);
}

function applyLibFilter() {
	/* normalise any half-finished run before measuring */
	libFilterTl?.kill();
	libGhosts?.remove();
	libGhosts = null;
	const everything = libPieces(libSections);
	gsap.killTweensOf(everything);
	gsap.set(everything, { clearProps: 'opacity,transform' });

	/* per-piece plan: was it on the table, will it be */
	const plan = [];
	for (const s of libSections) {
		const cards = [...s.querySelectorAll('.lib-card')];
		const wills = cards.map(cardWill);
		plan.push({ n: s.querySelector('.lib-sec__cap'), sec: s, was: !s.hidden, will: wills.some(Boolean) });
		cards.forEach((c, k) => plan.push({ n: c, sec: s, card: true, was: !s.hidden && !c.hidden, will: wills[k] }));
	}
	const leaving = plan.filter(p => p.was && !p.will).map(p => p.n);
	const staying = plan.filter(p => p.was && p.will).map(p => p.n);
	const entering = plan.filter(p => !p.was && p.will);

	/* first positions, in document coordinates (scroll-proof) */
	const before = new Map(
		staying.map(n => {
			const r = n.getBoundingClientRect();
			return [n, { x: r.left + scrollX, y: r.top + scrollY }];
		})
	);

	/* leaving pieces bow out as clones pinned where they stood, so the
	   real nodes can be hidden right now instead of after the exit */
	mkGhosts(leaving);
	applyVisibility();
	/* jump, don't glide: the whole table is mid-turn, a scroll animation
	   on top of it would read as two competing motions */
	if (scrollY) scrollTo({ top: 0, behavior: 'auto' });

	libFilterTl = mkTurnTimeline();

	/* what stays glides from its old place to the new */
	for (const n of staying) {
		const r = n.getBoundingClientRect();
		const b = before.get(n);
		const dx = b.x - (r.left + scrollX),
			dy = b.y - (r.top + scrollY);
		if (dx || dy) gsap.from(n, { x: dx, y: dy, duration: D(0.4), ease: 'power2.inOut', clearProps: 'transform' });
	}

	/* second half: the newcomers finish the turn, section after section —
	   they start as the ghosts reach edge-on, so the rotation reads as one */
	const flipDelay = leaving.length && !REDUCED ? 0.18 : 0;
	let wave = 0;
	for (const s of libSections) {
		if (s.hidden) continue;
		const ins = entering.filter(p => p.sec === s).map(p => p.n);
		if (!ins.length) continue;
		libFlipIn(ins, flipDelay + (REDUCED ? 0 : wave * 0.03));
		wave++;
	}
}

/* changing the grouping turns the whole table over: everything on show
   bows out as ghosts where it stood, the cards take their new seats,
   and each new section completes the turn in its own wave */
function regroupLibrary() {
	libFilterTl?.kill();
	libGhosts?.remove();
	libGhosts = null;
	const everything = libPieces(libSections);
	gsap.killTweensOf(everything);
	gsap.set(everything, { clearProps: 'opacity,transform' });

	const leaving = [];
	for (const s of libSections) {
		if (s.hidden) continue;
		leaving.push(s.querySelector('.lib-sec__cap'));
		for (const c of s.querySelectorAll('.lib-card')) if (!c.hidden) leaving.push(c);
	}
	mkGhosts(leaving);
	buildSections();
	applyVisibility();
	if (scrollY) scrollTo({ top: 0, behavior: 'auto' });

	libFilterTl = mkTurnTimeline();
	const flipDelay = leaving.length && !REDUCED ? 0.18 : 0;
	let wave = 0;
	for (const s of libSections) {
		if (s.hidden) continue;
		libFlipIn([s.querySelector('.lib-sec__cap'), ...[...s.querySelectorAll('.lib-card')].filter(c => !c.hidden)], flipDelay + (REDUCED ? 0 : wave * 0.03));
		wave++;
	}
}

/* the badge in the corner: how many cards the filters leave on show */
function updateLibCount(n) {
	const badge = $('#lib-count');
	if (badge.dataset.n === String(n)) return;
	badge.dataset.n = n;
	badge.innerHTML = STR.library.count(n, DECK.length);
	gsap.fromTo(badge, { scale: 1.14 }, { scale: 1, duration: D(0.45), ease: 'back.out(2)' });
}

/* arriving pieces complete the turn: each card swings up from edge-on
   in the same direction the leaving ghost swung away, settling with a
   small overshoot — the cap sweeps in along the same axis */
function libFlipIn(nodes, delay = 0) {
	const caps = nodes.filter(n => n.classList.contains('lib-sec__cap'));
	const cards = nodes.filter(n => !n.classList.contains('lib-sec__cap'));
	if (caps.length) gsap.fromTo(caps, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: D(0.35), delay, ease: 'power2.out', clearProps: 'opacity,transform' });
	if (cards.length)
		gsap.fromTo(
			cards,
			{ rotationY: -90, transformPerspective: 900 },
			{ rotationY: 0, duration: D(0.34), delay, ease: 'back.out(1.6)', stagger: REDUCED ? 0 : { amount: 0.18 }, clearProps: 'transform' }
		);
}

/* pieces settle onto the table, each card with a small tilt that
   rights itself as it lands */
function libDealIn(nodes, delay = 0) {
	const caps = nodes.filter(n => n.classList.contains('lib-sec__cap'));
	const cards = nodes.filter(n => !n.classList.contains('lib-sec__cap'));
	if (caps.length) gsap.fromTo(caps, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: D(0.35), delay, ease: 'power2.out', clearProps: 'opacity,transform' });
	if (cards.length)
		gsap.fromTo(
			cards,
			{ opacity: 0, y: 16, scale: 0.96, rotation: () => gsap.utils.random(-3, 3) },
			{ opacity: 1, y: 0, scale: 1, rotation: 0, duration: D(0.4), delay: delay + D(0.03), ease: 'power3.out', stagger: REDUCED ? 0 : 0.008, clearProps: 'opacity,transform' }
		);
}

export function showLibrary() {
	if (!DECK.length) return;
	syncRoute('library');
	buildLibrary();
	swapScreen(() => {
		$('#screen-home').hidden = true;
		$('#screen-ritual').hidden = true; // 路由可能自仪式页直接跳来
		$('#screen-library').hidden = false;
		libDealIn(libPieces(libSections.filter(s => !s.hidden)).filter(n => !n.hidden));
	});
}
