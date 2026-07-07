/* 卡片详情对话框 */

import { $, D } from './dom.js';
import { DECK } from '../data/card/deck.js';
import { psLine, SUIT_ZH } from '../data/card/glyphs.js';
import { STR } from '../data/i18n.js';

const dialog = $('#card-dialog');
const zoom = $('#zoom-dialog');
const body = $('#dialog-body');
const prevBtn = $('#dialog-prev');
const nextBtn = $('#dialog-next');

let nav = null; // { list: [{ idx, ctx }], at } — 同一行牌（如一周七日）间前后翻阅

function render(deckIdx, ctx) {
	const c = DECK[deckIdx];
	const sec = ([zh, en], text) =>
		text
			? `
    <section class="dlg-sec"><h4>${en} <span class="zh">· ${zh}</span></h4><p>${text}</p></section>`
			: '';
	body.innerHTML = `
    ${ctx ? `<p class="card-dialog__ctx">${ctx.replaceAll('<br>', '<span class="sep"></span>')}</p>` : ''}
    <div class="card-dialog__art">
      <img src="${c.img}" alt="${c.name}">
    </div>
    <header class="card-dialog__head">
      <h3>${c.name} <span class="num">No. ${c.number}</span></h3>
      <p class="ps">${psLine(c)}</p>
      <p class="suit">The Suit of ${c.suit_name} · ${SUIT_ZH[c.suit_name] ?? ''}之组</p>
      <p class="suit">${c.sign}：${c.sign_keyword}</p>
    </header>
    <div class="card-dialog__body">
      ${sec(STR.dialog.image, c.image_description)}
      ${sec(STR.dialog.personality, c.personal)}
      ${sec(STR.dialog.reading, c.reading)}
      ${sec(STR.dialog.events, c.events)}
    </div>`;
	body.scrollTop = 0;
	body.querySelector('.card-dialog__art img').onclick = () => {
		const z = $('#zoom-img');
		z.src = c.img;
		z.alt = c.name;
		zoom.showModal();
		gsap.fromTo(z, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: D(0.35), ease: 'power2.out' });
	};
	prevBtn.hidden = nextBtn.hidden = !nav;
	if (nav) {
		prevBtn.disabled = nav.at <= 0;
		nextBtn.disabled = nav.at >= nav.list.length - 1;
	}
}

export function openDialog(deckIdx, ctx, navOpt = null) {
	nav = navOpt;
	render(deckIdx, ctx);
	dialog.showModal();
	gsap.fromTo('#dialog-body > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: D(0.5), stagger: 0.08, ease: 'power2.out' });
}

/* 翻到同行的上一张 / 下一张 */
function step(dir) {
	if (!nav) return;
	const at = nav.at + dir;
	if (at < 0 || at >= nav.list.length) return;
	nav.at = at;
	const { idx, ctx } = nav.list[at];
	render(idx, ctx);
	gsap.fromTo('#dialog-body > *', { opacity: 0, x: 20 * dir }, { opacity: 1, x: 0, duration: D(0.4), stagger: 0.05, ease: 'power2.out' });
}

prevBtn.onclick = () => step(-1);
nextBtn.onclick = () => step(1);
dialog.addEventListener('keydown', e => {
	if (e.key === 'ArrowLeft') step(-1);
	else if (e.key === 'ArrowRight') step(1);
});

dialog.addEventListener('click', e => {
	if (e.target === dialog) dialog.close();
});
$('#dialog-close').onclick = () => dialog.close();

zoom.onclick = () => zoom.close();
