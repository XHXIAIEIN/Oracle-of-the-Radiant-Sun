/* 翻牌阶段：依各占法的次序（或任意次序）翻开，逐张写入解读面板 */

import { $, el, D, sleep } from '../dom.js';
import { wheel, actions, panelList, setRite, setActions } from '../stage.js';
import { S, mode } from '../state.js';
import { DECK, cardName, cardText } from '../model/deck.js';
import { psSuitLine } from '../model/card-symbols.js';
import { STR, cnHouse, houseLabel, text } from '../model/i18n.js';
import { HOUSES, MONTHS } from '../model/solar-ring.js';
import { flipCard } from '../cards.js';
import { preloadImage, warmCards } from '../image-loader.js';
import { openPanel, placeEntry, scrollPanelTo, setAnalysisReady } from '../panel.js';
import { openDialog } from '../dialog.js';
import { addAmplify } from './amplify.js';
import { showShare } from '../share.js';
import { language, t } from '../bilingual.js';

const REVEAL_ALL_DELAY_MS = 650; // 自动翻牌时，两张牌之间的停顿。
const REVEAL_ALL_FAST_DELAY_MS = 15; // 点“加速”后，两张牌之间的停顿。
const REVEAL_ALL_FAST_SPEED = 5; // 点“加速”后，单张翻牌动画的播放倍率。

// 进入翻牌阶段，接好面板、提示和自动翻牌按钮。
export function revealPhase() {
	showShare(); // 牌已入位，这一局从此可以分享
	const m = mode();
	setAnalysisReady(false);
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
	refreshPanelTitle();

	markNext();

	const auto = el('button', 'act-btn act-btn--quiet', t(STR.reveal.all));
	auto.dataset.ui = 'reveal-all';
	auto.dataset.state = 'idle';
	auto.type = 'button';
	auto.onclick = async () => {
		if (auto.dataset.state === 'running') {
			auto.dataset.fast = 'true';
			return;
		}
		auto.dataset.state = 'running';
		auto.dataset.fast = 'false';
		auto.textContent = t(STR.reveal.speedUp);
		const seq = S.seq;
		while (seq === S.seq && S.revealQueue.length) {
			const pos = S.revealQueue[0];
			const fast = auto.dataset.fast === 'true';
			await flipAt(pos, wheel.querySelector(`.card[data-pos="${pos}"]`), { speed: fast ? REVEAL_ALL_FAST_SPEED : 1 });
			await sleep(fast ? REVEAL_ALL_FAST_DELAY_MS : REVEAL_ALL_DELAY_MS);
		}
		auto.remove();
	};
	setActions([auto]);
}

// 标出当前允许翻开的下一张牌。
function markNext() {
	wheel.querySelectorAll('.card.is-next').forEach(c => c.classList.remove('is-next'));
	wheel.querySelectorAll('.slot-label.is-active').forEach(c => c.classList.remove('is-active'));
	const targets = S.freeOrder ? S.revealQueue : S.revealQueue.slice(0, 1);
	for (const pos of targets) {
		wheel.querySelector(`.card[data-pos="${pos}"]`)?.classList.add('is-next');
		wheel.querySelector(`.slot-label[data-pos="${pos}"]`)?.classList.add('is-active');
	}
	warmCards(
		targets.map(pos => DECK[S.placed.get(pos)]),
		{ priority: 'high', limit: targets.length }
	);
}

// 刷新解读面板标题与题问。
function refreshPanelTitle() {
	if (!S.method) return;
	$('#panel-title').innerHTML = mode().title + ' · ' + t(STR.panel.reading) + (S.question ? `<small>“${S.question}”</small>` : '');
}

function sunYearReadingOrder() {
	const q = Array.from({ length: 12 }, (_, k) => ((S.startPos - 1 + k) % 12) + 1);
	q.push(13);
	return q;
}

function dialogNavFor(pos) {
	if (S.method !== 'sunyear') return null;
	const revealed = new Set([...wheel.querySelectorAll('.card.is-up[data-pos]')].map(card => Number(card.dataset.pos)));
	const list = sunYearReadingOrder()
		.filter(p => p === pos || revealed.has(p))
		.map(p => ({ idx: S.placed.get(p), ctx: ctxFor(p) }))
		.filter(item => item.idx != null);
	const at = sunYearReadingOrder().filter(p => p === pos || revealed.has(p)).indexOf(pos);
	return list.length > 1 && at >= 0 ? { list, at, wrap: true } : null;
}

// 响应轮盘牌点击：未翻则翻牌，已翻则打开详情。
export function onCardClick(pos, node) {
	if (node.classList.contains('is-up')) {
		openDialog(S.placed.get(pos), ctxFor(pos), dialogNavFor(pos));
		return;
	}
	if (S.busy) return;
	const allowed = S.freeOrder ? S.revealQueue.includes(pos) : S.revealQueue[0] === pos;
	if (!allowed) {
		// no clearProps here: it would wipe the whole transform, centring included
		gsap.fromTo(node, { x: 0 }, { x: 5, duration: 0.055, repeat: 5, yoyo: true });
		return;
	}
	flipAt(pos, node);
}

// 翻开指定位置的牌，并把解读写入面板。
async function flipAt(pos, node, { speed = 1 } = {}) {
	if (S.busy || !node) return;
	S.busy = true;
	node.disabled = true;
	S.revealQueue = S.revealQueue.filter(p => p !== pos);
	node.classList.remove('is-next');
	/* 中央主题是全年的收束——翻得更高，翻开时一圈金环自牌沿散开 */
	const isTheme = S.method === 'sunyear' && pos === 13;
	try {
		await preloadImage(DECK[S.placed.get(pos)].img, 'high');
		await flipCard(node, isTheme ? 1.28 : 1.16, speed);
		node.classList.add('is-up');
		node.disabled = false;
		if (isTheme) node.classList.add('halo-burst');
		node.setAttribute('aria-label', cardName(DECK[S.placed.get(pos)]));
		appendEntry(pos);
		if (!S.revealQueue.length) allRevealed();
		else markNext();
	} finally {
		S.busy = false;
		if (!node.classList.contains('is-up')) node.disabled = false;
	}
}

// 收束翻牌阶段，显示完成提示。
function allRevealed() {
	actions.replaceChildren();
	const done = mode().doneLine ?? STR.reveal.done;
	Array.isArray(done) ? setRite(...done) : setRite(done);
	setAnalysisReady(true);
}

/* ── the reading panel entries ─────────────────────────────── */

// 生成每条解读的月份或宫位行。
function whereLine(pos) {
	if (S.method === 'sunyear') {
		if (pos === 13) return mode().themeWhere;
		const m = MONTHS[pos - 1];
		const house = HOUSES[pos - 1];
		return language() === 'zh' ? `${m.zh} <span class="house-note">｜${cnHouse(pos)} ${house.zh}</span>` : `${m.en} <span class="house-note">| ${houseLabel(pos)} ${house.en}</span>`;
	}
	const h = HOUSES[pos - 1];
	const role = mode().roles?.[pos];
	return language() === 'zh' ? `${cnHouse(pos)} · ${h.zh}${role ? ` <span class="house-note">｜${role}</span>` : ''}` : `${houseLabel(pos)} · ${h.en}${role ? ` <span class="house-note">| ${role}</span>` : ''}`;
}

// 生成打开卡牌详情时使用的上下文标题。
function ctxFor(pos) {
	if (S.method === 'sunyear') return pos === 13 ? mode().themeCtx : mode().monthCtx(MONTHS[pos - 1]);
	const h = HOUSES[pos - 1];
	return language() === 'zh' ? `${mode().title}<br><b>${cnHouse(pos)} ${h.zh}</b>` : `${mode().title}<br><b>${houseLabel(pos)} ${h.en}</b>`;
}

// 为刚翻开的牌追加一条解读。
function appendEntry(pos) {
	const entry = el('article', 'entry');
	entry.dataset.pos = pos;
	entry.dataset.deckIdx = S.placed.get(pos);
	renderEntry(entry, pos);
	entry.querySelector('.entry__name').onclick = () => openDialog(S.placed.get(pos), ctxFor(pos), dialogNavFor(pos));
	/* 深读之中，粘在上沿的月份行便是归途——点它回到这一张的解读 */
	entry.querySelector('.entry__where').onclick = () => scrollPanelTo(entry, true);

	if (S.method === 'sunyear' && pos !== 13) addAmplify(pos, entry);

	placeEntry(entry);
}

// 渲染或重绘单条解读正文。
function renderEntry(entry, pos) {
	const c = DECK[S.placed.get(pos)];
	const acts = entry.querySelector(':scope > .entry__acts');
	const amplify = entry.querySelector(':scope > .amplify');
	acts?.remove();
	amplify?.remove();
	const body = document.createElement('template');
	body.innerHTML = `
    <p class="entry__where">${whereLine(pos)}</p>
    <h4 class="entry__name">${cardName(c)}</h4>
    <p class="entry__ps">${psSuitLine(c)}</p>
    <p class="entry__reading">${cardText(c, 'reading')}</p>
    <p class="entry__events">${text('dialog.sections.events')} — ${cardText(c, 'events')}</p>`;
	entry.replaceChildren(...body.content.children, ...[acts, amplify].filter(Boolean));
}

// 语言切换后刷新已翻开的牌与解读文本。
function refreshRevealedText() {
	if ($('#screen-ritual').hidden || S.method === 'single') return;
	refreshPanelTitle();
	wheel.querySelectorAll('.card.is-up[data-pos]').forEach(card => {
		const deckIdx = S.placed.get(Number(card.dataset.pos));
		if (deckIdx != null) card.setAttribute('aria-label', cardName(DECK[deckIdx]));
	});
	const auto = actions.querySelector('[data-ui="reveal-all"]');
	if (auto) auto.textContent = t(auto.dataset.state === 'running' ? STR.reveal.speedUp : STR.reveal.all);
	panelList.querySelectorAll('.entry[data-pos]').forEach(entry => {
		const pos = Number(entry.dataset.pos);
		renderEntry(entry, pos);
		entry.querySelector('.entry__name').onclick = () => openDialog(S.placed.get(pos), ctxFor(pos), dialogNavFor(pos));
		entry.querySelector('.entry__where').onclick = () => scrollPanelTo(entry, true);
	});
}

window.addEventListener('languagechange', refreshRevealedText);
