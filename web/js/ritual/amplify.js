/* 太阳年的深察：任一月可再发四周之牌、观一周七日，或为某一钟点起卦
   （pp.134–135） */

import { el, popIn, D } from '../dom.js';
import { takeCards } from '../state.js';
import { MONTHS } from '../../data/houses.js';
import { STR } from '../../data/i18n.js';
import { BACK_SVG } from '../../data/card/back.js';
import { MODES } from '../../data/modes/index.js';
import { miniCard } from '../cards.js';
import { autoScrollTo } from '../panel.js';

const A = () => MODES.sunyear.amplify;

/* 面板条目下的两枚深察按钮与其容器 */
export function addAmplify(pos, entry) {
	const acts = el('div', 'entry__acts');
	const amp = el('div', 'amplify');
	const bW = el('button', 'sub-btn', A().weeksBtn);
	bW.type = 'button';
	bW.onclick = () => dealWeeks(pos, amp, bW);
	const bH = el('button', 'sub-btn', A().hoursBtn);
	bH.type = 'button';
	bH.onclick = () => {
		hourForm(pos, amp);
		bH.disabled = true;
	};
	acts.append(bW, bH);
	entry.append(acts, amp);
}

/* “deal from the top of the deck four more cards … the four weeks” */
function dealWeeks(pos, amp, btn) {
	const idxs = takeCards(4);
	if (!idxs) {
		amp.append(el('p', 'deck-empty-note', STR.deck.empty));
		btn.disabled = true;
		return;
	}
	btn.disabled = true;
	const m = MONTHS[pos - 1];
	const block = el('div', 'amplify__block');
	block.append(el('p', 'amplify__cap', A().weeksCap(m)));
	const row = el('div', 'minirow');
	const navList = idxs.map((di, k) => ({ idx: di, ctx: A().weekCtx(m, k + 1) }));
	idxs.forEach((di, k) => {
		const wrap = el('div', 'mini-col');
		const mini = miniCard(di, A().weekTag(k + 1), navList[k].ctx, { list: navList, at: k });
		const bd = el('button', 'sub-btn', A().daysBtn);
		bd.type = 'button';
		bd.onclick = () => {
			dealDays(pos, k + 1, block);
			bd.disabled = true;
		};
		wrap.append(mini, bd);
		row.append(wrap);
	});
	block.append(row);
	amp.append(block);
	autoScrollTo(block, true);
	popIn(row.querySelectorAll('.mini'));
}

/* “deal seven cards for the days of that week, starting with the Sun's day”
   Day blocks appear on demand but always sit in week order; blocks already
   open glide (FLIP) to make room when an earlier week is opened later. */
function dealDays(pos, week, parentBlock) {
	const idxs = takeCards(7);
	if (!idxs) {
		parentBlock.append(el('p', 'deck-empty-note', STR.deck.empty));
		return;
	}
	const m = MONTHS[pos - 1];
	const block = el('div', 'amplify__block');
	block.dataset.week = week;
	block.append(el('p', 'amplify__cap', A().daysCap(week)));
	const row = el('div', 'minirow');
	const navList = idxs.map((di, k) => ({ idx: di, ctx: A().dayCtx(m, week, A().DAYS[k]) }));
	idxs.forEach((di, k) => {
		row.append(miniCard(di, A().dayTag(A().DAYS[k]), navList[k].ctx, { list: navList, at: k }));
	});
	block.append(row);

	const sibs = [...parentBlock.children].filter(n => n.dataset?.week);
	const tops = new Map(sibs.map(s => [s, s.getBoundingClientRect().top]));
	parentBlock.insertBefore(block, sibs.find(s => +s.dataset.week > week) ?? null);
	for (const s of sibs) {
		const dy = tops.get(s) - s.getBoundingClientRect().top;
		if (dy) gsap.from(s, { y: dy, duration: D(0.55), ease: 'power3.out' });
	}
	autoScrollTo(block, true);
	popIn(row.querySelectorAll('.mini'));
}

/* “…deal face down fourteen cards, turning the fifteenth face up
   (three o'clock being the fifteenth hour of the twenty-four-hour clock)” */
function hourForm(pos, amp) {
	const m = MONTHS[pos - 1];
	const block = el('div', 'amplify__block');
	const form = el('div', 'hour-form');
	const sel = el('select');
	sel.name = 'hour';
	sel.setAttribute('aria-label', A().hourSelAria);
	for (let h = 1; h <= 24; h++) {
		const o = el('option', '', A().hourOpt(h));
		o.value = h;
		if (h === 15) o.selected = true;
		sel.append(o);
	}
	const go = el('button', 'sub-btn', A().hourGo);
	go.type = 'button';
	form.append(A().hourLead, sel, go);
	block.append(form);
	amp.append(block);
	autoScrollTo(block, true);
	popIn([form]);

	go.onclick = () => {
		const n = +sel.value;
		const idxs = takeCards(n);
		if (!idxs) {
			block.append(el('p', 'deck-empty-note', STR.deck.shortOfHour));
			go.disabled = true;
			return;
		}
		const row = el('div', 'minirow minirow--hour');
		if (n > 1) {
			const stack = el('div', 'hour-stack');
			for (let k = 0; k < n - 1; k++) stack.append(el('span', 'mini--hourback', BACK_SVG));
			const col = el('div', 'mini-col');
			col.append(stack, el('span', 'mini__tag mini__tag--dim', A().hourStackTag(n)));
			row.append(col);
		}
		const revealed = miniCard(idxs[n - 1], A().hourTag(n), A().hourCtx(m, n));
		row.append(revealed);
		const res = el('div', 'amplify__block');
		res.append(el('p', 'amplify__cap', A().hourCap(n)), row);
		block.append(res);
		autoScrollTo(res, true);
		popIn(row.children);
	};
}
