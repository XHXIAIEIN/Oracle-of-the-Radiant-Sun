/* 发牌阶段：自左侧（四月 · 白羊）起逆时针发成一环，牌面朝下 */

import { REDUCED, D } from '../dom.js';
import { wheel, actions, setRite } from '../stage.js';
import { S, mode, takeCards, drawCount } from '../state.js';
import { posXY } from '../wheel.js';
import { makeCard } from '../cards.js';
import { retireDeckPile, syncDeckThickness, topLayerPose } from './deck-pile.js';
import { revealPhase, onCardClick } from './reveal.js';
import { singleDeal } from './single.js';

export function dealPhase() {
	if (S.method === 'single') return singleDeal();
	S.busy = true;
	actions.replaceChildren();
	const themeLab = wheel.querySelector('.slot-label[data-pos="13"]');
	if (themeLab) {
		themeLab.hidden = false;
		gsap.fromTo(themeLab, { opacity: 0 }, { opacity: 1, duration: D(0.8) });
	}
	const n = mode().dealCount;
	const idxs = takeCards(n);
	const left = drawCount(); // 全部发完后的余牌数，牌堆逐张随之收薄

	setRite(...mode().dealLine);

	const seq = S.seq;
	const tl = gsap.timeline({
		onComplete: () => {
			if (seq !== S.seq) return; // 这一局已被换掉，别碰新局的桌面
			S.busy = false;
			revealPhase();
		},
	});

	// 末张离手，余堆便散场——中央的主题牌要落在腾空后的桌面上
	const retireAt = (n - 1) * 0.16 + D(0.12);
	tl.call(() => {
		if (seq === S.seq) retireDeckPile();
	}, null, retireAt);

	for (let k = 0; k < n; k++) {
		const pos = k + 1;
		S.placed.set(pos, idxs[k]);
		const c = makeCard(pos, idxs[k], onCardClick);
		const { x, y } = posXY(pos);
		c.style.left = '50%';
		c.style.top = '50%';
		wheel.append(c);
		// 每张牌落位时带一点随机的歪斜与错位，像手放上去的
		const drift = pos === 13 ? 0.3 : 0.8;
		const tilt = pos === 13 ? 0 : gsap.utils.random(-3.5, 3.5);
		const jx = gsap.utils.random(-drift, drift);
		const jy = gsap.utils.random(-drift, drift);
		// 起飞点是此刻堆顶那张的姿态，飞行时压过牌堆（z 高于 .deck），落位后交还给 CSS；
		// 中央那张与堆同位，须等堆散尽才交还，否则落位一瞬会被堆盖住
		const pose = topLayerPose(left + (n - k));
		gsap.set(c, { opacity: 0, x: pose.x, y: pose.y, rotation: pose.rotation, xPercent: -50, yPercent: -50, zIndex: 6 });
		tl.to(c, { opacity: 1, duration: D(0.12) }, k * 0.16)
			.to(c, { left: x + jx + '%', top: y + jy + '%', x: 0, y: 0, rotation: tilt, duration: D(0.55), ease: 'power2.out' }, k * 0.16)
			.set(c, { clearProps: 'zIndex' }, pos === 13 ? retireAt + D(0.6) : k * 0.16 + D(0.55))
			.call(() => syncDeckThickness(left + (n - 1 - k)), null, k * 0.16);
	}
	tl.timeScale(REDUCED ? 100 : 1);
}
