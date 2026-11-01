/* 仪式舞台的常驻节点，与其上的两类提示：仪轨行与操作按钮 */

import { $, D, replay } from './dom.js';

export const wheel = $('#wheel');
export const panel = $('#panel');
export const panelList = $('#panel-list');
export const riteLine = $('#rite-line');
export const actions = $('#stage-actions');
export const setup = $('#setup');

let lastRite = () => '';

/* line 是返回当前语言文案的函数，切换语言时再调一次即可重绘 */
export function setRite(line) {
	lastRite = line;
	replay(riteLine, 'is-changing');
	riteLine.innerHTML = line();
	gsap.fromTo(riteLine, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: D(0.8), ease: 'power2.out' });
}

export function refreshRite() {
	riteLine.innerHTML = lastRite();
}

export function setActions(btns) {
	actions.replaceChildren(...btns);
	if (btns.length) gsap.fromTo(btns, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: D(0.5), stagger: 0.08, ease: 'power2.out' });
}

export function updateBadge(count) {
	const badge = $('#deck-badge');
	badge.hidden = false;
	$('#deck-count').textContent = count;
	replay(badge, 'is-updating');
}

window.addEventListener('languagechange', refreshRite);
