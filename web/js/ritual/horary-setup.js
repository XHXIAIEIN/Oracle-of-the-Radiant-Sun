/* 时占起卦前的两步：先默想问题，再择定宫位——一次只做一件事，
   如同占卜本身的进行 */

import { el, D, esc, MOBILE } from '../dom.js';
import { setup, wheel, setRite, setActions } from '../stage.js';
import { S } from '../state.js';
import { HOUSES } from '../model/solar-ring.js';
import { cnHouse, houseLabel } from '../model/i18n.js';
import { MODES } from '../model/modes/index.js';
import { shufflePhase } from './shuffle.js';
import { language } from '../bilingual.js';

let currentStep = 1;
let refreshCurrentStep = null;

export function horarySetup() {
	const C = MODES.horary.setup;
	const stepHead = (num, zh, sub) => el('header', 'setup__step', `<span class="setup__step-num">${num}</span><h3>${zh}</h3><p>${sub}</p>`);

	const intro = () => gsap.fromTo(setup.children, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: D(0.55), stagger: 0.08, ease: 'power2.out' });
	const showStep = build => {
		gsap.to([...setup.children], {
			opacity: 0,
			y: -10,
			duration: D(0.3),
			ease: 'power2.in',
			onComplete: () => {
				build();
				intro();
			},
		});
	};

	/* — 壹 · the question — */
	const step1 = () => {
		currentStep = 1;
		setRite(...C.step1.rite);

		const q = el('input', 'setup__q');
		q.name = 'question';
		// 手机的输入框盛不下双语例句，只留中文的一半
		q.placeholder = MOBILE.matches ? C.step1.placeholder.split(' · ')[0] : C.step1.placeholder;
		q.maxLength = 120;
		q.value = S.question;

		const picks = el('div', 'qpicks');
		for (const p of MODES.horary.quickpicks) {
			const b = el('button', 'qpick', p.label);
			b.type = 'button';
			b.onclick = () => {
				q.value = p.q;
				S.chosen = new Set(p.houses);
				picks.querySelectorAll('.qpick').forEach(x => x.setAttribute('aria-pressed', x === b));
			};
			picks.append(b);
		}

		setup.replaceChildren(stepHead(C.step1.num, C.step1.head, C.step1.sub), q, picks, el('p', 'setup__hint', C.step1.hint));

		const next = el('button', 'act-btn', C.step1.next);
		next.type = 'button';
		next.onclick = () => {
			S.question = q.value.trim();
			showStep(step2);
		};
		q.addEventListener('keydown', e => {
			if (e.key === 'Enter') next.click();
		});
		setActions([next]);
	};

	/* — 贰 · the houses — */
	const step2 = () => {
		currentStep = 2;
		setRite(...C.step2.rite);

		const grid = el('div', 'houses-grid');
		for (const h of HOUSES) {
			const chip = el('button', 'house-chip', `<span class="n">${h.n}</span><span class="info" title="${C.infoTitle}">ⓘ</span><span class="kw">${language() === 'zh' ? h.zh : h.en}</span>`);
			chip.type = 'button';
			chip.setAttribute('aria-pressed', S.chosen.has(h.n));
			if (h.n === 1) chip.title = C.step2.firstHouse;
			chip.onclick = e => {
				if (e.target.classList.contains('info')) {
					showHousePop(h, chip);
					return;
				}
				if (h.n === 1) return; // the First House always represents the questioner
				S.chosen.has(h.n) ? S.chosen.delete(h.n) : S.chosen.add(h.n);
				chip.setAttribute('aria-pressed', S.chosen.has(h.n));
			};
			grid.append(chip);
		}

		const frag = [stepHead(C.step2.num, C.step2.head, C.step2.sub)];
		if (S.question) frag.push(el('p', 'setup__echo', `“${esc(S.question)}”`));
		frag.push(grid);
		setup.replaceChildren(...frag);

		const back = el('button', 'act-btn act-btn--quiet', C.step2.back);
		back.type = 'button';
		back.onclick = () => showStep(step1);
		const go = el('button', 'act-btn', C.step2.go);
		go.type = 'button';
		go.onclick = () => {
			if (S.chosen.size < 2) {
				gsap.fromTo(grid, { x: 0 }, { x: 6, duration: 0.06, repeat: 5, yoyo: true });
				return;
			}
			gsap.to(setup, {
				opacity: 0,
				y: -12,
				duration: D(0.45),
				ease: 'power2.in',
				onComplete: () => {
					setup.hidden = true;
					setup.style.opacity = 1;
					setup.style.transform = '';
					shufflePhase();
					/* the wheel unfolds to its full square rather than
					   slamming the page open in one frame */
					gsap.from(wheel, { height: 0, opacity: 0, duration: D(0.8), ease: 'power3.out', clearProps: 'height,opacity' });
				},
			});
		};
		setActions([back, go]);
	};

	setup.hidden = false;
	refreshCurrentStep = () => {
		const q = setup.querySelector('.setup__q');
		if (q) S.question = q.value.trim();
		(currentStep === 2 ? step2 : step1)();
	};
	step1();
	intro();
}

/* house description popover (native Popover API) */
let housePop;
function showHousePop(h, anchor) {
	if (!housePop) {
		housePop = el('div', 'house-pop');
		housePop.popover = 'auto';
		document.body.append(housePop);
	}
	const title = language() === 'zh' ? `${cnHouse(h.n)} · ${h.zh}` : `${houseLabel(h.n)} · ${h.en}`;
	housePop.innerHTML = `<b>${title}</b>${h.desc}`;
	housePop.showPopover();
	const r = anchor.getBoundingClientRect(),
		pw = housePop.offsetWidth,
		ph = housePop.offsetHeight;
	housePop.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.left)) + 'px';
	housePop.style.top = (r.bottom + ph + 12 > innerHeight ? r.top - ph - 8 : r.bottom + 8) + 'px';
}

window.addEventListener('languagechange', () => {
	if (setup.hidden || !refreshCurrentStep) return;
	refreshCurrentStep();
});
