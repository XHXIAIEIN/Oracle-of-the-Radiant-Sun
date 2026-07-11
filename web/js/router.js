/* 路由：地址栏与页面双向同步。读取 hash 路径与查询参数，抵达即应用，
   并响应前进/后退与 hash 变化；应用内切换屏幕时也回写地址栏。

   路径以「这一占法要读几张牌」为名：
     #/1 单张   #/3 大三合   #/4 本位十字   #/12 时占   #/13 太阳年
   也接受占法 id（#/trine）与 #/library（卡片库）。

   牌可以直接接在路径后，或写进查询参数（两处皆可，hash 内的优先）：
     cards   钉在翻牌位上的牌，逗号分隔，以原书页码为编号（每张牌
             恰占一页，28–123）；也认 planet_sign（assets/cards/ 的
             文件名）或牌名。第 k 张落在第 k 个翻牌位上
     q       题问，横陈于轮盘上方（时占亦以此起卦）
     houses  时占择定的宫位，逗号分隔的 1–12，第一宫恒在；
             给出此参数便跳过时占的两步设置，直接入座

   只给 cards 不给路径时，按牌数推断占法（三张即大三合……）。

   例：index.html#/4/62,41,98,72
       index.html#/12?houses=1,7&q=我们该结婚吗
       index.html?cards=62,41,98 */

import { DECK } from './model/deck.js';
import { MODES } from './model/modes/index.js';
import { showHome, startMethod } from './ritual/start.js';
import { showLibrary } from './library.js';

/* 读几张牌 → 占法 */
const BY_COUNT = { 1: 'single', 3: 'trine', 4: 'cross', 12: 'horary', 13: 'sunyear' };
/* 屏幕 → 地址栏路径（syncRoute 回写、share.js 编链接用） */
export const PATH_OF = { single: '#/1', trine: '#/3', cross: '#/4', horary: '#/12', sunyear: '#/13', library: '#/library', home: '' };

const norm = s => s.trim().toLowerCase().replace(/[\s-]+/g, '_');

let cardIndex; // norm(token) -> deck index，首次解析时按已装载的牌组建立
function resolveCard(token) {
	if (!cardIndex) {
		cardIndex = new Map();
		DECK.forEach((c, i) => {
			cardIndex.set(String(c.page), i); // 原书页码
			cardIndex.set(norm(`${c.planet}_${c.sign}`), i);
			if (!cardIndex.has(norm(c.name))) cardIndex.set(norm(c.name), i);
		});
	}
	return cardIndex.get(norm(token));
}

function parseCards(raw) {
	if (!raw) return [];
	const idxs = [];
	for (const t of raw.split(',')) {
		const i = resolveCard(decodeURIComponent(t));
		if (i == null) console.warn(`[router] 未识别的牌：${t}`);
		else if (!idxs.includes(i)) idxs.push(i);
	}
	return idxs;
}

const parseHouses = raw => (raw ? [...new Set(raw.split(',').map(Number))].filter(n => Number.isInteger(n) && n >= 1 && n <= 12) : []);

let lastApplied;
let applying = false; // 路由驱动的切换不再回写地址栏

/* 应用内切换屏幕时回写地址栏（key 为占法 id、'library' 或 'home'）。
   pushState 不触发任何事件，applyRoute 不会被连带调用 */
export function syncRoute(key) {
	if (applying) return;
	const target = PATH_OF[key] ?? '';
	if ((location.hash || '') === target && !location.search) return;
	history.pushState(null, '', location.pathname + target);
	lastApplied = location.href; // 地址所指即眼前所见，回到此项无需重放
}

export function applyRoute() {
	/* 同一路由只应用一次：hash 跳转会同时触发 popstate 与 hashchange */
	if (location.href === lastApplied) return;
	lastApplied = location.href;

	const route = location.hash.startsWith('#/') ? location.hash.slice(2) : '';
	applying = true;
	try {
		if (!route && !location.search) return showHome();

		const [path = '', hashQuery = ''] = route.split('?');
		const qs = new URLSearchParams(location.search);
		for (const [k, v] of new URLSearchParams(hashQuery)) qs.set(k, v);
		const [head = '', pathCards = ''] = path.split(/\/(.*)/);

		// history.replaceState(null, '', location.pathname + (route ? '' : location.hash)); // 应用后抹净地址栏，暂时停用

		if (head === 'library') return showLibrary();

		const preset = parseCards(pathCards || qs.get('cards'));
		const m = BY_COUNT[head] ?? (MODES[head] && head) ?? BY_COUNT[preset.length];
		if (!MODES[m]) return;

		startMethod(m, {
			preset,
			question: (qs.get('q') || '').trim().slice(0, 120),
			houses: parseHouses(qs.get('houses')),
		});
	} finally {
		applying = false;
	}
}

addEventListener('popstate', applyRoute);
addEventListener('hashchange', applyRoute);
