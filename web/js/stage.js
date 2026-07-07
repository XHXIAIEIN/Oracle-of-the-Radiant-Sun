/* 仪式舞台的常驻节点，与其上的两类提示：仪轨行与操作按钮 */

import { $, D } from './dom.js';

export const wheel = $('#wheel');
export const panel = $('#panel');
export const panelList = $('#panel-list');
export const riteLine = $('#rite-line');
export const actions = $('#stage-actions');
export const setup = $('#setup');

export function setRite(zh, en) {
	riteLine.innerHTML = zh + (en ? `<small>${en}</small>` : '');
	gsap.fromTo(riteLine, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: D(0.8), ease: 'power2.out' });
}

export function setActions(btns) {
	actions.replaceChildren(...btns);
	if (btns.length) gsap.fromTo(btns, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: D(0.5), stagger: 0.08, ease: 'power2.out' });
}

export function updateBadge(count) {
	$('#deck-badge').hidden = false;
	$('#deck-count').textContent = count;
}
