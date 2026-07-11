/* 分享当局：把这一局抽中的牌编成路由链接复制到剪贴板，
   他人打开链接，同样的牌便落在同样的位置上 */

import { $ } from './dom.js';
import { S, mode } from './state.js';
import { DECK } from './model/deck.js';
import { text } from './model/i18n.js';
import { PATH_OF } from './router.js';

const btn = $('#btn-share');
const toast = $('#toast');
let restore;
let toastRestore;

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
	gsap.fromTo(btn, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
}

export function hideShare() {
	btn.hidden = true;
	btn.textContent = text('ritual.share');
}

function showToast(message) {
	if (!toast) return;
	toast.textContent = message;
	toast.hidden = false;
	clearTimeout(toastRestore);
	gsap.killTweensOf(toast);
	gsap.fromTo(toast, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
	toastRestore = setTimeout(() => {
		gsap.to(toast, { opacity: 0, y: 8, duration: 0.25, ease: 'power2.in', onComplete: () => (toast.hidden = true) });
	}, 2600);
}

btn.onclick = async () => {
	const url = shareURL();
	if (!url) return;
	try {
		await navigator.clipboard.writeText(url);
		showToast(text('ritual.shareCopied'));
		btn.classList.remove('is-copied');
		void btn.offsetWidth;
		btn.classList.add('is-copied');
	} catch {
		showToast(text('ritual.shareFallback'));
		prompt(text('ritual.shareFallback'), url); // 剪贴板不可用（非安全上下文）时的退路
	}
	clearTimeout(restore);
	restore = setTimeout(() => (btn.textContent = text('ritual.share')), 2600);
};

window.addEventListener('languagechange', () => {
	if (!btn.hidden) btn.textContent = text('ritual.share');
});
