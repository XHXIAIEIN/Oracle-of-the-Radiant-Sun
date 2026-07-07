/* 通用界面文案 — 中英双语同屏展示。
   约定：成对文案写作 [中文, English]，由 setRite / bi 组合渲染；
   各占法专属文案见 data/modes/*.js，牌面内容见 deck.json。 */

import { PLANET, SIGN, suitZh } from './card/glyphs.js';

export const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
export const cnNum = n => CN_NUM[n] ?? String(n);
export const cnHouse = n => `第${CN_NUM[n]}宫`;

/* 中文主文案后随小字英文 */
export const bi = ([zh, en]) => (en ? `${zh}<small>${en}</small>` : zh);

/* 卡片库文案的小工具 */
const LIB_HEAD = '卡片库 · The Complete Deck<br>';
const fmtHours = hs => hs.map(h => `${String(h).padStart(2, '0')}:00`).join(' / ');
const theP = p => (p === 'Sun' || p === 'Moon' ? `the ${p}` : p); // “the Sun/Moon”，其余行星不加冠词

export const STR = {
	loadFail: '无法载入 deck.json——请通过本地 HTTP 服务打开本页。',

	deck: {
		aria: '牌堆——点击洗牌',
		hint: ['点击牌堆 · 洗牌', 'tap the deck to shuffle'],
		hintAgain: ['心定即止——可再洗几次', 'shuffle again, or begin the deal'],
		deal: '开始发牌',
		drawOne: '取一张牌',
		empty: '牌堆已尽——书中建议为新的问题重新洗牌起卦。',
		shortOfHour: '牌堆余量不足此钟点数——建议重新洗牌起卦。',
	},

	reveal: {
		all: '依次翻开全部',
		done: '牌阵已开。点击任意翻开的牌，可查看整张牌的释义。',
		faceDownAria: pos => (pos === 13 ? '中央主题牌（未翻开）' : `位置 ${pos}（未翻开）`),
	},

	panel: {
		reading: '解读',
		sortAsc: '改为先翻在上',
		sortDesc: '改为新翻在上',
	},

	wheel: { theme: '主题 · THEME' },

	dialog: {
		image: ['牌面', 'The Image'],
		personality: ['性情', 'The Personality'],
		reading: ['释义', 'The Reading'],
		events: ['事象', 'Events'],
	},

	library: {
		rowPlanet: '行星',
		rowSign: '星座',
		rowElement: '元素',
		rowGroup: '排序',
		allPlanets: '全部行星',
		allSigns: '全部星座',
		moreSorts: '更多排序 ▾',
		lessSorts: '收起排序 ▴',
		groupChips: { suit: '按花色', season: '按季节', month: '按月份', week: '按周', time: '按时间' },
		count: (n, total) => `<b>${n}</b> / ${total} 张`,
		secCap: (planet, suit) => `${PLANET[planet][0]} The Suit of ${suit} <span class="zh">· ${PLANET[planet][1]} · ${suitZh(suit)}之组</span>`,
		cardPs: c => `${PLANET[c.planet][1]}在${SIGN[c.sign][1]} ${SIGN[c.sign][0]}`,
		planetChip: (planet, suit) => `${PLANET[planet][0]} ${PLANET[planet][1]} · ${suitZh(suit)}`,
		signChip: (sign, i) => `${i + 1} ${SIGN[sign][0]}${SIGN[sign][1]}`,
		ctx: suit => `${LIB_HEAD}<b>The Suit of ${suit} · ${suitZh(suit)}之组</b>`,
		/* 时间分组的节题与语境行：季节（三个月）、月份（一个星座）、星期（行星值日）、钟点（行星值时，迦勒底序） */
		seasonCap: (en, zh, ms) => `${ms.map(m => SIGN[m.sign][0]).join(' ')} ${en} <span class="zh">· ${zh} · ${ms[0].zh}至${ms[2].zh}</span>`,
		seasonCtx: (en, zh, ms) => `${LIB_HEAD}<b>${en} · ${zh} · ${ms[0].zh}至${ms[2].zh}</b>`,
		monthCap: m => `${SIGN[m.sign][0]} ${m.en} <span class="zh">· ${m.zh} · ${SIGN[m.sign][1]}之月</span>`,
		monthCtx: m => `${LIB_HEAD}<b>${m.en} ${m.zh} · ${SIGN[m.sign][1]}之月</b>`,
		weekCap: ([p, en, zh]) => `${PLANET[p][0]} ${en} <span class="zh">· ${zh} · ${PLANET[p][1]}之日</span>`,
		weekCtx: ([p, en, zh]) => `${LIB_HEAD}<b>${en} ${zh} · ${PLANET[p][1]}之日</b>`,
		timeCap: (p, hs) => `${PLANET[p][0]} The Hours of ${theP(p)} <span class="zh">· ${PLANET[p][1]}之时 · 今日 ${fmtHours(hs)}</span>`,
		timeCtx: (p, hs) => `${LIB_HEAD}<b>${PLANET[p][1]}之时 · 今日 ${fmtHours(hs)}</b>`,
	},
};
