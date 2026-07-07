/* 洗牌阶段：绘环、题问上壁、点击牌堆洗牌，心定后开始发牌 */

import { $, el, D, cryptoShuffle, MOBILE } from '../dom.js';
import { wheel, setRite, setActions } from '../stage.js';
import { S, mode, applyPreset } from '../state.js';
import { drawRing } from '../wheel.js';
import { STR, bi } from '../../data/i18n.js';
import { createDeckPile, animateShuffle } from './deck-pile.js';
import { dealPhase } from './deal.js';

export function shufflePhase() {
	if (S.method !== 'single') drawRing(); // the single card needs no wheel
	// the centre label would sit right under the pile — keep it for the deal
	const themeLab = wheel.querySelector('.slot-label[data-pos="13"]');
	if (themeLab) themeLab.hidden = true;

	// the question stays inscribed above the wheel for the whole sitting
	const qLine = $('#question-line');
	qLine.hidden = !S.question;
	if (S.question) {
		qLine.textContent = `“${S.question}”`;
		gsap.fromTo(qLine, { opacity: 0 }, { opacity: 1, duration: D(1.1), ease: 'power1.out' });
	}

	const deckPile = createDeckPile();

	/* 牌序已由路由预先排定：洗牌无从谈起，牌堆落定后即发。
	   此刻宫位已然择定，让预设牌恰好落在这一占法要翻开的位置上 */
	if (S.preset.length) {
		applyPreset(S.preset, mode().revealQueue?.(S) ?? []);
		deckPile.disabled = true;
		setActions([]);
		const seq = S.seq;
		gsap.delayedCall(D(0.9), () => {
			if (seq === S.seq) dealPhase();
		});
		return;
	}

	setRite(...mode().shuffleLine);

	const hint = el('p', 'deck-hint', bi(STR.deck.hint));
	wheel.append(hint);
	gsap.fromTo(hint, { opacity: 0 }, { opacity: 1, duration: D(0.9), delay: D(0.4) });

	/* 桌面端这一钮悬在轮盘下部；手机上那里既挤着提示行，又离拇指远，
	   便让它列在仪轨行下的操作区 */
	const bDeal = el('button', 'act-btn' + (MOBILE.matches ? '' : ' act-btn--wheel'), S.method === 'single' ? STR.deck.drawOne : STR.deck.deal);
	bDeal.type = 'button';
	bDeal.hidden = true;
	if (!MOBILE.matches) wheel.append(bDeal);

	deckPile.onclick = async () => {
		if (S.busy) return;
		S.busy = true;
		cryptoShuffle(S.order);
		S.shuffles++;
		gsap.fromTo(deckPile, { scale: 0.97 }, { scale: 1, duration: D(0.3), ease: 'power2.out' });
		await animateShuffle();
		S.busy = false;
		if (S.shuffles === 1) {
			hint.innerHTML = bi(STR.deck.hintAgain);
			bDeal.hidden = false;
			if (MOBILE.matches) setActions([bDeal]);
			else gsap.fromTo(bDeal, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: D(0.6), ease: 'power2.out' });
		}
	};

	bDeal.onclick = () => {
		if (S.busy) return;
		deckPile.disabled = true;
		hint.style.animation = 'none';
		gsap.to([hint, bDeal], {
			opacity: 0,
			duration: D(0.35),
			ease: 'power2.in',
			onComplete: () => {
				hint.remove();
				bDeal.remove();
				dealPhase();
			},
		});
	};

	setActions([]);
}
