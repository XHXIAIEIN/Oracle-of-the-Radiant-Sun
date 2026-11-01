/* 分享当局：把这一局抽中的牌编成路由链接复制到剪贴板，
   他人打开链接，同样的牌便落在同样的位置上；
   或把翻开的牌连释义编成一段 Markdown 牌单 */

import { $, replay } from './dom.js';
import { S, mode } from './state.js';
import { DECK, cardName, cardText } from './model/deck.js';
import { psLine } from './model/card-symbols.js';
import { cnHouse, houseLabel, text } from './model/i18n.js';
import { HOUSES, MONTHS } from './model/solar-ring.js';
import { language } from './bilingual.js';
import { PATH_OF } from './router.js';

const btn = $('#btn-share');
const copyBtn = $('#btn-copy-reading');
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

/* 翻开位置的宫位、月份或主题行 */
function whereText(pos) {
	if (S.method === 'single') return '';
	if (S.method === 'sunyear') return pos === 13 ? mode().themeWhere : language() === 'zh' ? MONTHS[pos - 1].zh : MONTHS[pos - 1].en;
	const h = HOUSES[pos - 1];
	const role = mode().roles?.[pos];
	const house = language() === 'zh' ? `${cnHouse(pos)} · ${h.zh}` : `${houseLabel(pos)} · ${h.en}`;
	return role ? `${house} ｜ ${role}` : house;
}

/* 当局 → Markdown */
export function readingMarkdown() {
	const zh = language() === 'zh';
	const colon = zh ? '：' : ': ';
	const paren = inner => (zh ? `（${inner}）` : ` (${inner})`);
	const date = new Date().toLocaleDateString('sv-SE'); // sv-SE 输出本地 YYYY-MM-DD
	const lines = [`# ${mode().title} · ${date}`];
	if (S.question) lines.push(`> “${S.question}”`);
	for (const pos of S.revealed) {
		const c = DECK[S.placed.get(pos)];
		const where = whereText(pos);
		lines.push('', `### ${where ? `${where} — ` : ''}${cardName(c)}${paren(psLine(c))}`);
		lines.push(`- ${text('dialog.sections.reading')}${colon}${cardText(c, 'reading')}`);
		lines.push(`- ${text('dialog.sections.events')}${colon}${cardText(c, 'events')}`);
	}
	const url = shareURL();
	if (url) lines.push('', url);
	return lines.join('\n');
}

export function showShare() {
	for (const b of [btn, copyBtn]) {
		b.hidden = false;
		gsap.fromTo(b, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
	}
}

export function hideShare() {
	btn.hidden = true;
	copyBtn.hidden = true;
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
		replay(btn, 'is-copied');
	} catch {
		showToast(text('ritual.shareFallback'));
		prompt(text('ritual.shareFallback'), url); // 剪贴板不可用（非安全上下文）时的退路
	}
	clearTimeout(restore);
	restore = setTimeout(() => (btn.textContent = text('ritual.share')), 2600);
};

copyBtn.onclick = async () => {
	if (!S.revealed.length) return;
	const md = readingMarkdown();
	try {
		await navigator.clipboard.writeText(md);
	} catch {
		if (!copyBySelection(md)) {
			showToast(text('ritual.copyReadingFallback'));
			prompt(text('ritual.copyReadingFallback'), md); // 一行输入框会吞掉换行，是最后的退路
			return;
		}
	}
	showToast(text('ritual.copyReadingCopied'));
	replay(copyBtn, 'is-copied');
};

/* 非安全上下文没有 clipboard API，多行文本还能经选区复制 */
function copyBySelection(value) {
	const area = document.createElement('textarea');
	area.value = value;
	area.setAttribute('readonly', '');
	area.style.position = 'fixed';
	area.style.opacity = '0';
	document.body.append(area);
	area.select();
	let ok = false;
	try {
		ok = document.execCommand('copy');
	} catch {}
	area.remove();
	return ok;
}
