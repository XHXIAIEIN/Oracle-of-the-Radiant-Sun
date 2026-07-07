/* 分享当局：把这一局抽中的牌编成路由链接复制到剪贴板，
   他人打开链接，同样的牌便落在同样的位置上 */

import { $ } from './dom.js';
import { S, mode } from './state.js';
import { DECK } from '../data/card/deck.js';
import { PATH_OF } from './router.js';

const btn = $('#btn-share');
const LABEL = btn.textContent;
let restore;

/* 当局 → 路由：翻牌位上的牌依次序取原书页码；时占再带上宫位与题问 */
function shareURL() {
	const path = PATH_OF[S.method];
	if (!path) return null;
	const idxs = S.method === 'single' ? S.order.slice(0, S.ptr) : mode().revealQueue(S).map(p => S.placed.get(p)).filter(i => i != null);
	if (!idxs.length) return null;
	let url = `${location.origin}${location.pathname}${path}/${idxs.map(i => DECK[i].page).join(',')}`;
	if (S.method === 'horary') {
		const extra = new URLSearchParams({ houses: [...S.chosen].sort((a, b) => a - b).join(',') });
		if (S.question) extra.set('q', S.question);
		url += '?' + extra;
	}
	return url;
}

export function showShare() {
	btn.hidden = false;
}

export function hideShare() {
	btn.hidden = true;
	btn.textContent = LABEL;
}

btn.onclick = async () => {
	const url = shareURL();
	if (!url) return;
	try {
		await navigator.clipboard.writeText(url);
		btn.textContent = '已复制 ✓ 打开链接即重现此局';
	} catch {
		prompt('复制这段链接：', url); // 剪贴板不可用（非安全上下文）时的退路
	}
	clearTimeout(restore);
	restore = setTimeout(() => (btn.textContent = LABEL), 2600);
};
