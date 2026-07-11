/* 卡片库：全副八十四张，默认按花色分节；亦可按季节、月份、
   星期、今日钟点重新分组。行星、星座、元素筛选与分组方式相互独立。 */

import { $, el, D, REDUCED, scrollScreenToTop, swapScreen } from './dom.js';
import { DECK, cardName } from './model/deck.js';
import { ELEMENTS, PLANET, PLANET_ORDER, SIGN, elementNameFor, planetNameFor, signNameFor, suitNameFor } from './model/card-symbols.js';
import { MONTHS } from './model/solar-ring.js';
import { openDialog } from './dialog.js';
import { cardImgAttrs, warmCards } from './image-loader.js';
import { syncRoute } from './router.js';
import { dockTopCapsules, language, msg } from './bilingual.js';
import { resetPanelChrome } from './panel.js';

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
const isZh = () => language() === 'zh';
const libMsg = (key, fallback) => msg(`library.${key}`, fallback);
const fmtHours = hs => hs.map(h => `${String(h).padStart(2, '0')}:00`).join(' / ');
const theP = p => (p === 'Sun' || p === 'Moon' ? `the ${p}` : p);
const planetLabel = planet => planetNameFor(planet);
const suitLabel = suit => (isZh() ? `${suitNameFor(suit)}之组` : `The Suit of ${suitNameFor(suit)}`);
const cardPs = c => (isZh() ? `${planetNameFor(c.planet)}在${signNameFor(c.sign)} ${SIGN[c.sign][0]}` : `${PLANET[c.planet][0]} ${planetNameFor(c.planet)} in ${signNameFor(c.sign)} ${SIGN[c.sign][0]}`);
const planetChip = planet => `${PLANET[planet][0]} ${planetNameFor(planet)}`;
const signChip = (sign, i) => `${i + 1} ${SIGN[sign][0]}${signNameFor(sign)}`;
const suitCtx = (planet, suit) => `<b>${isZh() ? `${planetNameFor(planet)} · ${suitLabel(suit)}` : `${planetLabel(planet)} · ${suitLabel(suit)}`}</b>`;
const secCap = (planet, suit) => (isZh() ? `${PLANET[planet][0]} ${planetNameFor(planet)} · ${suitNameFor(suit)}之组` : `${PLANET[planet][0]} The Suit of ${suitNameFor(suit)}`);
const seasonCap = (en, zh, ms) =>
	isZh() ? `${ms.map(m => SIGN[m.sign][0]).join(' ')} ${zh} · ${ms[0].zh}至${ms[2].zh}` : `${ms.map(m => SIGN[m.sign][0]).join(' ')} ${en}`;
const seasonCtx = (en, zh, ms) => `<b>${isZh() ? `${zh} · ${ms[0].zh}至${ms[2].zh}` : en}</b>`;
const monthCap = m => (isZh() ? `${SIGN[m.sign][0]} ${m.zh} · ${signNameFor(m.sign)}之月` : `${SIGN[m.sign][0]} ${m.en} · ${signNameFor(m.sign)}`);
const monthCtx = m => `<b>${isZh() ? `${m.zh} · ${signNameFor(m.sign)}之月` : `${m.en} · ${signNameFor(m.sign)}`}</b>`;
const weekCap = ([p, en, zh]) => (isZh() ? `${PLANET[p][0]} ${zh} · ${planetNameFor(p)}之日` : `${PLANET[p][0]} ${en} · ${planetLabel(p)}`);
const weekCtx = ([p, en, zh]) => `<b>${isZh() ? `${zh} · ${planetNameFor(p)}之日` : `${en} · ${planetLabel(p)}`}</b>`;
const timeCap = (p, hs) =>
	isZh()
		? `${PLANET[p][0]} ${planetNameFor(p)}之时 · ${libMsg('today', '今日')} ${fmtHours(hs)}`
		: `${PLANET[p][0]} The Hours of ${theP(p)} · ${libMsg('today', 'Today')} ${fmtHours(hs)}`;
const timeCtx = (p, hs) => `<b>${isZh() ? `${planetNameFor(p)}之时` : `The Hours of ${theP(p)}`} · ${fmtHours(hs)}</b>`;
const countText = (n, total) => `<b>${n}</b> / ${total} ${libMsg('countUnit', isZh() ? '张' : 'cards')}`;

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
				return { cap: seasonCap(en, zh, months), ctx: seasonCtx(en, zh, months), idxs: months.flatMap(m => signRow(m.sign)) };
			});
		case 'month':
			/* MONTHS follows the Sun-Year wheel (April/Aries first); the
			   library reads better in calendar order, January onward */
			return [...MONTHS.slice(9), ...MONTHS.slice(0, 9)].map(m => ({ cap: monthCap(m), ctx: monthCtx(m), idxs: signRow(m.sign) }));
		case 'week':
			return WEEKDAYS.map(d => ({ cap: weekCap(d), ctx: weekCtx(d), idxs: planetRow(d[0]) }));
		case 'time': {
			const at = CHALDEAN.indexOf(WEEKDAYS[new Date().getDay()][0]);
			return Array.from({ length: 7 }, (_, i) => {
				const planet = CHALDEAN[(at + i) % 7];
				const hours = [i, i + 7, i + 14, i + 21].filter(h => h < 24);
				return { cap: timeCap(planet, hours), ctx: timeCtx(planet, hours), idxs: planetRow(planet) };
			});
		}
		default: {
			const groups = new Map(PLANET_ORDER.map(planet => [planet, []]));
			DECK.forEach((c, i) => groups.get(c.planet)?.push(i));
			return [...groups].filter(([, idxs]) => idxs.length).map(([planet, idxs]) => {
				const suit = DECK[idxs[0]].suit_name;
				return { cap: secCap(planet, suit), ctx: suitCtx(planet, suit), idxs };
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

function libraryNavFor(deckIdx) {
	const list = [];
	for (const sec of libSections) {
		if (sec.hidden) continue;
		for (const card of sec.querySelectorAll('.lib-card')) {
			if (card.hidden) continue;
			const idx = Number(card.dataset.deckIdx);
			list.push({ idx, ctx: cardCtx[idx] });
		}
	}
	const at = list.findIndex(item => item.idx === deckIdx);
	return at >= 0 && list.length > 1 ? { list, at } : null;
}

function buildFilterRows(filters) {
	filters.replaceChildren();

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
	filters.append(
		frow(libMsg('rows.planet', 'Planet'), rowSuit),
		frow(libMsg('rows.sign', 'Sign'), rowSign),
		frow(libMsg('rows.element', 'Element'), rowElem),
		frow(libMsg('rows.group', 'Sort'), rowGroup)
	);

	const pop = b => gsap.fromTo(b, { scale: 0.9 }, { scale: 1, duration: D(0.35), ease: 'back.out(2.5)' });

	const mkSuitChip = (label, key) => {
		const b = el('button', 'qpick', label);
		b.type = 'button';
		b.setAttribute('aria-pressed', key === libFilter.suit);
		b.onclick = () => {
			if (b.getAttribute('aria-pressed') === 'true') return;
			rowSuit.querySelectorAll('.qpick').forEach(x => x.setAttribute('aria-pressed', x === b));
			pop(b);
			libFilter.suit = key;
			applyLibFilter();
		};
		return b;
	};
	rowSuit.append(mkSuitChip(libMsg('filters.allPlanets', 'All Planets'), 'all'));
	const suitOf = new Map(DECK.map(c => [c.planet, c.suit_name]));
	for (const planet of PLANET_ORDER) {
		const suit = suitOf.get(planet);
		if (suit) rowSuit.append(mkSuitChip(planetChip(planet), planet));
	}

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

	const allSign = mkSignChip(libMsg('filters.allSigns', 'All Signs'), () => libFilter.signs.clear());
	rowSign.append(allSign);
	for (const [k, e] of Object.entries(ELEMENTS)) {
		const b = mkSignChip(elementNameFor(k), () => {
			const exact = libFilter.signs.size === 3 && e.signs.every(s => libFilter.signs.has(s));
			libFilter.signs = exact ? new Set() : new Set(e.signs);
		});
		elementChips.set(k, b);
		rowElem.append(b);
	}
	Object.keys(SIGN).forEach((sign, i) => {
		const b = mkSignChip(signChip(sign, i), () => {
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
	for (const key of ['suit', 'season', 'month', 'week', 'time']) rowGroup.append(mkGroupChip(libMsg(`groups.${key}`, key), key));

	/* rows listed here fold under one quiet toggle, closed by default;
	   while the list is empty the toggle stays off the table */
	const foldedRows = [];
	if (foldedRows.length) {
		const morePanel = el('div', 'lib-more__panel');
		morePanel.hidden = true;
		morePanel.append(...foldedRows);
		const moreBtn = el('button', 'lib-more', libMsg('filters.moreSorts', 'More Sorts ▾'));
		moreBtn.type = 'button';
		moreBtn.setAttribute('aria-expanded', 'false');
		moreBtn.onclick = () => {
			const open = morePanel.hidden;
			moreBtn.setAttribute('aria-expanded', open);
			moreBtn.innerHTML = open ? libMsg('filters.lessSorts', 'Hide Sorts ▴') : libMsg('filters.moreSorts', 'More Sorts ▾');
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
			`<img ${cardImgAttrs(c)}>
         <span class="lib-card__name">${cardName(c)}</span>
         <span class="lib-card__ps">${cardPs(c)}</span>`
		);
		t.type = 'button';
		t.dataset.deckIdx = i;
		t.dataset.sign = c.sign;
		t.dataset.planet = c.planet;
		t.onclick = () => openDialog(i, cardCtx[i], libraryNavFor(i));
		cardBtns.push(t);
	});
	buildSections();
	warmCards(DECK.slice(0, 8), { limit: 8 });
	buildFilterRows(filters);
}

/* re-filtering turns the table over, card by card: what leaves swings
   away edge-on where it stood (a ghost pinned at its old spot), what
   arrives completes the same turn from edge-on to face-up — one card
   giving way to the next in a single rotation, never a blank table.
   What stays simply glides to its new place (FLIP). */
const libPieces = list => list.flatMap(s => [s.querySelector('.lib-sec__cap'), ...s.querySelectorAll('.lib-card')]);
const libScroller = () => $('#screen-library');

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
			return [n, { x: r.left, y: r.top }];
		})
	);

	/* leaving pieces bow out as clones pinned where they stood, so the
	   real nodes can be hidden right now instead of after the exit */
	mkGhosts(leaving);
	applyVisibility();
	/* jump, don't glide: the whole table is mid-turn, a scroll animation
	   on top of it would read as two competing motions */
	if (libScroller()?.scrollTop) scrollScreenToTop(libScroller(), 'auto');

	libFilterTl = mkTurnTimeline();

	/* what stays glides from its old place to the new */
	for (const n of staying) {
		const r = n.getBoundingClientRect();
		const b = before.get(n);
		const dx = b.x - r.left,
			dy = b.y - r.top;
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
	if (libScroller()?.scrollTop) scrollScreenToTop(libScroller(), 'auto');

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
	const lang = language();
	if (badge.dataset.n === String(n) && badge.dataset.lang === lang) return;
	badge.dataset.n = n;
	badge.dataset.lang = lang;
	badge.innerHTML = countText(n, DECK.length);
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

function refreshLibraryText() {
	if (!libBuilt) return;
	libFilterTl?.kill();
	libGhosts?.remove();
	libGhosts = null;
	cardBtns.forEach((btn, i) => {
		const name = btn.querySelector('.lib-card__name');
		const ps = btn.querySelector('.lib-card__ps');
		if (name) name.textContent = cardName(DECK[i]);
		if (ps) ps.textContent = cardPs(DECK[i]);
	});
	buildFilterRows($('#lib-filters'));
	buildSections();
	applyVisibility();
	gsap.set(libPieces(libSections), { clearProps: 'opacity,transform' });
}

window.addEventListener('languagechange', refreshLibraryText);

export function showLibrary() {
	if (!DECK.length) return;
	syncRoute('library');
	resetPanelChrome();
	dockTopCapsules('#library-tools');
	buildLibrary();
	swapScreen(() => {
		$('#screen-home').hidden = true;
		$('#screen-ritual').hidden = true; // 路由可能自仪式页直接跳来
		$('#screen-library').hidden = false;
		libDealIn(libPieces(libSections.filter(s => !s.hidden)).filter(n => !n.hidden));
	});
}
