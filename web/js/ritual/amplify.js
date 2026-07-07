/* 太阳年的深察：任一月可再发四周之牌、观一周七日，或为某一钟点起卦
   （pp.134–135） */

import { el, popIn, dealIn, D, REDUCED } from '../dom.js';
import { takeCards, drawCount } from '../state.js';
import { MONTHS } from '../../data/houses.js';
import { STR } from '../../data/i18n.js';
import { BACK_SVG } from '../../data/card/back.js';
import { MODES } from '../../data/modes/index.js';
import { miniCard, miniFlipCard, revealMini } from '../cards.js';
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
	autoScrollTo(block, true, true);
	dealIn(row.querySelectorAll('.mini'));
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
	autoScrollTo(block, true, true);
	dealIn(row.querySelectorAll('.mini'));
}

/* “…deal face down fourteen cards, turning the fifteenth face up
   (three o'clock being the fifteenth hour of the twenty-four-hour clock)”

   钟点自一枚二十四格的时盘上点选，默认落在此刻；起卦后先逐张发下
   面朝下的牌，末张停一拍再翻开。可再问下一个钟点。 */
function hourForm(pos, amp) {
	const m = MONTHS[pos - 1];
	const block = el('div', 'amplify__block');
	const form = el('div', 'hour-form');
	const lead = el('p', 'hour-lead', A().hourLead);
	form.append(lead);

	/* 二十四格时盘：0 时即第 24 个钟点 */
	const now = new Date().getHours() || 24;
	let sel = now;
	const note = el('p', 'hour-note');
	const setNote = () => (note.textContent = A().hourPick(sel, sel === now));

	const grid = el('div', 'hour-grid');
	grid.setAttribute('role', 'radiogroup');
	grid.setAttribute('aria-label', A().hourSelAria);
	const cells = [];
	for (let h = 1; h <= 24; h++) {
		const c = el('button', 'hour-cell' + (h === now ? ' hour-cell--now' : ''), String(h));
		c.type = 'button';
		c.setAttribute('role', 'radio');
		c.setAttribute('aria-checked', h === sel);
		c.onclick = () => {
			sel = h;
			cells.forEach((x, i) => x.setAttribute('aria-checked', String(i + 1 === h)));
			setNote();
		};
		cells.push(c);
		grid.append(c);
	}
	setNote();

	const go = el('button', 'sub-btn', A().hourGo);
	go.type = 'button';
	const act = el('div', 'hour-act');
	act.append(note, go);
	form.append(grid, act);
	block.append(form);
	amp.append(block);
	autoScrollTo(block, true, true);
	popIn([form]);

	/* 抽过之后，够不着的钟点格随余牌一同暗下；所选超出余牌便收到最大可及处 */
	const syncAvail = () => {
		const left = drawCount();
		cells.forEach((c, i) => (c.disabled = i + 1 > left));
		if (left < 1) {
			go.disabled = true;
			return;
		}
		if (sel > left) {
			sel = left;
			cells.forEach((x, i) => x.setAttribute('aria-checked', String(i + 1 === sel)));
			setNote();
		}
	};
	syncAvail();

	let dealing = false;
	go.onclick = () => {
		if (dealing) return;
		const n = sel;
		const idxs = takeCards(n);
		if (!idxs) {
			block.insertBefore(el('p', 'deck-empty-note', STR.deck.shortOfHour), form);
			syncAvail();
			return;
		}
		dealing = true;
		go.disabled = true;
		cells.forEach(c => (c.disabled = true));

		const res = el('div', 'amplify__block');
		res.append(el('p', 'amplify__cap', A().hourCap(n)));
		const row = el('div', 'minirow minirow--hour');
		let backs = [];
		let stackTag;
		if (n > 1) {
			const stack = el('div', 'hour-stack');
			for (let k = 0; k < n - 1; k++) stack.append(el('span', 'mini--hourback', BACK_SVG));
			backs = [...stack.children];
			/* 不论几张，面朝下的扇列都排进同一跨度：少则轻叠，多则挤紧
			   （SPAN、W 与 panel.css 的 --hour-span、.mini--hourback 宽一致） */
			const SPAN = 150,
				W = 34;
			if (n > 2) stack.style.setProperty('--hour-overlap', Math.min(W - 8, (SPAN - W) / (n - 2)) - W + 'px');
			stackTag = el('span', 'mini__tag mini__tag--dim', A().hourStackTag(n));
			const col = el('div', 'mini-col mini-col--stack');
			col.append(stack, stackTag);
			row.append(col);
		}
		const revealed = miniFlipCard(idxs[n - 1], A().hourTag(n), A().hourCtx(m, n));
		row.append(revealed);
		res.append(row);

		/* 新一问落在旧问之下，时盘滑退到末位候着——盘与钮始终紧随
		   最新一张牌，问得再多也无需回卷去够 */
		const formTop = form.getBoundingClientRect().top;
		lead.remove(); // 引导语读过一遍即可，此后让位于牌
		block.insertBefore(res, form);
		const dy = formTop - form.getBoundingClientRect().top;
		if (dy) gsap.from(form, { y: dy, duration: D(0.55), ease: 'power3.out' });
		autoScrollTo(res, true, true);

		/* 发牌的次第：面朝下逐张叠起 → 末张落下 → 一拍悬念 → 翻开。
		   牌与签先各自藏好，免得随整块淡入后又消失重来 */
		gsap.set(backs, { opacity: 0, y: -14, rotation: () => gsap.utils.random(-8, 8) });
		if (stackTag) gsap.set(stackTag, { opacity: 0 });
		gsap.set(revealed, { opacity: 0, y: -14 });
		const tl = gsap.timeline({
			onComplete: () => {
				dealing = false;
				go.disabled = false;
				syncAvail();
				if (!go.disabled) go.textContent = A().hourAgain;
			},
		});
		tl.from(res, { opacity: 0, duration: D(0.3) });
		if (backs.length) {
			const per = Math.min(0.05, 1.1 / backs.length);
			tl.to(backs, { opacity: 1, y: 0, rotation: 0, duration: D(0.26), stagger: REDUCED ? 0 : per, ease: 'power2.out' }, '<0.1');
			tl.to(stackTag, { opacity: 1, duration: D(0.3) }, '>-0.1');
		}
		tl.to(revealed, { opacity: 1, y: 0, duration: D(0.3), ease: 'power2.out' }, backs.length ? '>-0.05' : '<0.1');
		tl.add(revealMini(revealed), `+=${D(0.3)}`);
	};
}
