/* 翻牌阶段：依各占法的次序（或任意次序）翻开，逐张写入解读面板 */

import { $, el, D, sleep } from '../dom.js';
import { wheel, actions, setRite, setActions } from '../stage.js';
import { S, mode } from '../state.js';
import { DECK } from '../../data/card/deck.js';
import { MONTHS, HOUSES } from '../../data/houses.js';
import { psSuitLine } from '../../data/card/glyphs.js';
import { STR, cnHouse } from '../../data/i18n.js';
import { flipCard } from '../cards.js';
import { openPanel, placeEntry } from '../panel.js';
import { openDialog } from '../dialog.js';
import { addAmplify } from './amplify.js';
import { showShare } from '../share.js';

export function revealPhase() {
	showShare(); // 牌已入位，这一局从此可以分享
	const m = mode();
	S.revealQueue = m.revealQueue(S);
	setRite(...(typeof m.revealLine === 'function' ? m.revealLine(S) : m.revealLine));

	// fade back the houses that stay face down in this reading
	wheel.querySelectorAll('.card').forEach(c => {
		c.classList.toggle('is-idle', !S.revealQueue.includes(+c.dataset.pos));
	});
	wheel.querySelectorAll('.slot-label').forEach(l => {
		l.classList.toggle('is-idle', !S.revealQueue.includes(+l.dataset.pos));
	});

	openPanel();
	const mt = m.title.split(' · ');
	$('#panel-title').innerHTML = mt[1] + ' · ' + STR.panel.reading + (S.question ? `<small>“${S.question}”</small>` : '');

	markNext();

	const auto = el('button', 'act-btn act-btn--quiet', STR.reveal.all);
	auto.type = 'button';
	auto.onclick = async () => {
		auto.disabled = true;
		const seq = S.seq;
		while (seq === S.seq && S.revealQueue.length) {
			const pos = S.revealQueue[0];
			await flipAt(pos, wheel.querySelector(`.card[data-pos="${pos}"]`));
			await sleep(650);
		}
		auto.remove();
	};
	setActions([auto]);
}

function markNext() {
	wheel.querySelectorAll('.card.is-next').forEach(c => c.classList.remove('is-next'));
	wheel.querySelectorAll('.slot-label.is-active').forEach(c => c.classList.remove('is-active'));
	const targets = S.freeOrder ? S.revealQueue : S.revealQueue.slice(0, 1);
	for (const pos of targets) {
		wheel.querySelector(`.card[data-pos="${pos}"]`)?.classList.add('is-next');
		wheel.querySelector(`.slot-label[data-pos="${pos}"]`)?.classList.add('is-active');
	}
}

export function onCardClick(pos, node) {
	if (node.classList.contains('is-up')) {
		openDialog(S.placed.get(pos), ctxFor(pos));
		return;
	}
	const allowed = S.freeOrder ? S.revealQueue.includes(pos) : S.revealQueue[0] === pos;
	if (!allowed || S.busy) {
		// no clearProps here: it would wipe the whole transform, centring included
		gsap.fromTo(node, { x: 0 }, { x: 5, duration: 0.055, repeat: 5, yoyo: true });
		return;
	}
	flipAt(pos, node);
}

function flipAt(pos, node) {
	S.revealQueue = S.revealQueue.filter(p => p !== pos);
	node.classList.remove('is-next');
	/* 中央主题是全年的收束——翻得更高，翻开时一圈金环自牌沿散开 */
	const isTheme = S.method === 'sunyear' && pos === 13;
	return flipCard(node, isTheme ? 1.28 : 1.16).then(() => {
		node.classList.add('is-up');
		if (isTheme) node.classList.add('halo-burst');
		node.setAttribute('aria-label', DECK[S.placed.get(pos)].name);
		appendEntry(pos);
		if (!S.revealQueue.length) allRevealed();
		else markNext();
	});
}

function allRevealed() {
	actions.replaceChildren();
	setRite(mode().doneLine ?? STR.reveal.done);
}

/* ── the reading panel entries ─────────────────────────────── */

function whereLine(pos) {
	if (S.method === 'sunyear') {
		if (pos === 13) return mode().themeWhere;
		const m = MONTHS[pos - 1];
		return `${m.en} · ${m.zh} <span class="house-note">｜${cnHouse(pos)} ${HOUSES[pos - 1].zh}</span>`;
	}
	const h = HOUSES[pos - 1];
	const role = mode().roles?.[pos];
	return `${cnHouse(pos)} · ${h.zh} <span class="house-note">${role ? '｜' + role : '｜' + h.en}</span>`;
}

function ctxFor(pos) {
	if (S.method === 'sunyear') return pos === 13 ? mode().themeCtx : mode().monthCtx(MONTHS[pos - 1]);
	const h = HOUSES[pos - 1];
	return `${mode().title}<br><b>${cnHouse(pos)} ${h.zh}</b><br>${h.en}`;
}

function appendEntry(pos) {
	const c = DECK[S.placed.get(pos)];
	const entry = el('article', 'entry');
	entry.innerHTML = `
    <p class="entry__where">${whereLine(pos)}</p>
    <h4 class="entry__name">${c.name}</h4>
    <p class="entry__ps">${psSuitLine(c)}</p>
    <p class="entry__reading">${c.reading}</p>
    <p class="entry__events">Events — ${c.events}</p>`;
	entry.querySelector('.entry__name').onclick = () => openDialog(S.placed.get(pos), ctxFor(pos));

	if (S.method === 'sunyear' && pos !== 13) addAmplify(pos, entry);

	placeEntry(entry);
}
