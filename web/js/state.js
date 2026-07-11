/* 一场占卜的全部状态，与从牌堆顶取牌的唯一入口 */

import { cryptoShuffle } from './dom.js';
import { updateBadge } from './stage.js';
import { DECK } from './model/deck.js';
import { MODES } from './model/modes/index.js';

export const S = {
	seq: 0, // 局次序号：换局即递增，旧局残留的动画回调据此作废
	method: null,
	order: [], // shuffled indices into DECK
	preset: [], // deck indices pinned to the top of the deck, in dealing order (via router)
	ptr: 0, // next card to leave the top of the deck
	shuffles: 0,
	placed: new Map(), // wheel position (1..13) -> deck index
	revealQueue: [], // positions still to be turned, in reading order
	freeOrder: false, // horary/trine/cross may be turned in any order
	startPos: 1, // sun year: this month's wheel position
	question: '',
	chosen: new Set([1]),
	drawn: 0,
	busy: false,
};

export const mode = () => MODES[S.method];

export function resetState(method) {
	Object.assign(S, {
		seq: S.seq + 1,
		method,
		order: DECK.map((_, i) => i),
		preset: [],
		ptr: 0,
		shuffles: 0,
		placed: new Map(),
		revealQueue: [],
		freeOrder: MODES[method].freeOrder,
		question: '',
		chosen: new Set([1]),
		drawn: 0,
		busy: false,
	});
	S.startPos = ((new Date().getMonth() + 1 - 4 + 12) % 12) + 1; // this month on the wheel
	cryptoShuffle(S.order);
}

/* 把指定的牌钉进牌堆：给了 positions（轮盘位 1..13）便让第 k 张预设牌
   恰好发到 positions[k]；否则依序钉在堆顶。其余牌保持洗过的次序补位 */
export function applyPreset(idxs, positions = []) {
	S.preset = idxs;
	const pin = new Set(idxs);
	const rest = S.order.filter(i => !pin.has(i));
	if (!positions.length) {
		S.order = [...idxs, ...rest];
		return;
	}
	const slots = new Array(S.order.length).fill(null);
	idxs.forEach((di, k) => {
		const p = positions[k];
		if (p) slots[p - 1] = di;
	});
	/* 排不进指定位置的预设牌，与余牌一道填满空档 */
	const fill = [...idxs.slice(positions.length), ...rest];
	S.order = slots.map(s => s ?? fill.shift());
}

export const drawCount = () => S.order.length - S.ptr;

export function takeCards(n) {
	if (drawCount() < n) return null;
	const t = S.order.slice(S.ptr, S.ptr + n);
	S.ptr += n;
	updateBadge(drawCount());
	return t;
}
