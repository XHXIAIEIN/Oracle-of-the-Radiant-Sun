/* 发牌阶段：自左侧（四月 · 白羊）起逆时针发成一环，牌面朝下 */

import { REDUCED, D } from '../dom.js';
import { wheel, actions, setRite } from '../stage.js';
import { S, mode, takeCards, drawCount } from '../state.js';
import { posXY } from '../wheel.js';
import { makeCard } from '../cards.js';
import { retireDeckPile, topLayerPose } from './deck-pile.js';
import { revealPhase, onCardClick } from './reveal.js';
import { singleDeal } from './single.js';

function naturalPose(pos) {
	const base = posXY(pos);
	if (pos === 13) {
		return {
			x: base.x + gsap.utils.random(-0.45, 0.45),
			y: base.y + gsap.utils.random(-0.45, 0.45),
			rotation: gsap.utils.random(-0.45, 0.45),
			duration: gsap.utils.random(0.66, 0.78),
			ease: 'sine.inOut',
		};
	}
	const t = ((165 - 30 * (pos - 1)) * Math.PI) / 180;
	const radial = gsap.utils.random(-0.38, 0.46);
	const tangent = gsap.utils.random(-0.52, 0.52);
	const x = base.x + radial * Math.cos(t) - tangent * Math.sin(t);
	const y = base.y + radial * Math.sin(t) + tangent * Math.cos(t);
	return {
		x,
		y,
		rotation: gsap.utils.random(-2.1, 2.1),
		duration: gsap.utils.random(0.62, 0.82),
		ease: 'sine.inOut',
	};
}

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
	const left = drawCount();
	const deckStart = topLayerPose(left + n);

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
	const spacing = 0.14;
	const retireAt = (n - 1) * spacing + D(0.08);
	tl.call(() => {
		if (seq === S.seq) retireDeckPile();
	}, null, retireAt);

	for (let k = 0; k < n; k++) {
		const pos = k + 1;
		S.placed.set(pos, idxs[k]);
		const c = makeCard(pos, idxs[k], onCardClick);
		const pose = naturalPose(pos);
		c._tablePose = pose;
		c._flipMood = {
			lift: gsap.utils.random(3, 8),
			lean: gsap.utils.random(-0.55, 0.55),
			durationJitter: gsap.utils.random(0, 0.12),
			ease: 'sine.inOut',
		};
		c.style.opacity = '0';
		c.style.left = '50%';
		c.style.top = '50%';
		wheel.append(c);
		// 发牌期间牌堆保持静止；牌像从同一个堆顶显现，避免堆身在瞬间收缩跳动。
		const start = deckStart;
		const startAt = Math.max(0, k * spacing + (pos === 13 ? 0 : gsap.utils.random(-0.018, 0.028)));
		c.classList.add('is-dealing');
		gsap.set(c, { opacity: 0, x: start.x, y: start.y, scale: 0.94, rotation: start.rotation, xPercent: -50, yPercent: -50, zIndex: 6 });
		if (pos === 13) {
			tl.to(c, { opacity: 1, scale: 0.98, duration: D(0.1), ease: 'sine.out' }, startAt)
				.to(c, {
					y: start.y - 6,
					scale: 1.02,
					rotation: pose.rotation + gsap.utils.random(-0.35, 0.35),
					duration: D(0.26),
					ease: 'power2.out',
				}, startAt + D(0.04))
				.to(c, {
					left: pose.x + '%',
					top: pose.y + '%',
					x: 0,
					y: 0,
					rotation: pose.rotation,
					scale: 1,
					duration: D(0.46),
					ease: 'power2.inOut',
				}, startAt + D(0.2))
				.call(() => c.classList.remove('is-dealing'), null, startAt + D(0.72))
				.set(c, { clearProps: 'zIndex' }, startAt + D(0.78));
		} else {
			tl.to(c, { opacity: 1, scale: 0.98, duration: D(0.12), ease: 'sine.out' }, startAt)
				.to(c, {
					left: pose.x + '%',
					top: pose.y + '%',
					x: gsap.utils.random(-0.8, 0.8),
					y: gsap.utils.random(-0.8, 0.8),
					rotation: pose.rotation,
					scale: 1,
					duration: D(pose.duration),
					ease: 'expo.out',
				}, startAt + D(0.04))
				.to(c, { x: 0, y: 0, duration: D(0.16), ease: 'sine.out' }, `>-=${D(0.16)}`)
				.call(() => c.classList.remove('is-dealing'), null, startAt + D(0.14 + pose.duration))
				.set(c, { clearProps: 'zIndex' }, startAt + D(0.18 + pose.duration));
		}
	}
	tl.timeScale(REDUCED ? 100 : 1);
}
