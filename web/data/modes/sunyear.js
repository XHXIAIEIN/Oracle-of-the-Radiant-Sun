/* The Sun Year（pp.125–134）：十二个月逆时针成环，第十三张居中为全年主题；
   任一月可再细察四周、七日，乃至某一钟点 */

import { MONTHS } from '../houses.js';
import { CN_NUM } from '../i18n.js';

const TITLE = 'The Sun Year · 太阳年';

export default {
	id: 'sunyear',
	title: TITLE,
	dealCount: 13,
	freeOrder: false, // 自当前月份起逐月依序翻开
	wheelLabels: 'months',
	centerTheme: true,

	shuffleLine: ['洗牌，同时在心中静观即将到来的一年。', 'Shuffle the deck while contemplating the year to come.'],
	dealLine: ['自左侧第一张（四月 · 白羊）起，逆时针发下十二张，牌面朝下；第十三张置于中央。', 'Place the first card face down on the left, dealing counterclockwise around the Sun wheel.'],
	revealQueue: S => {
		const q = Array.from({ length: 12 }, (_, k) => ((S.startPos - 1 + k) % 12) + 1);
		q.push(13);
		return q;
	},
	revealLine: S => {
		const m = MONTHS[S.startPos - 1];
		return [`自当前月份（${m.zh} · ${m.en}）开始，逐月翻开，环行一年；最后翻开中央的主题之牌。`, 'Look first at the card that represents the current month, proceeding month by month around the circle.'];
	},
	doneLine: '圆环已满，中央之牌是全年的主题。点击任意一张牌细读，或在右侧深入某个月份、某一周、某一天。',

	themeWhere: '主题 · THEME OF THE YEAR',
	themeCtx: `${TITLE}<br><b>中央 · 全年主题 The Emphasis or Theme</b>`,
	monthCtx: m => `${TITLE}<br><b>${m.en} ${m.zh} · 第${CN_NUM[m.pos]}宫</b>`,

	/* 细察一月：周、日、钟点（pp.134–135） */
	amplify: {
		weeksBtn: '细察此月 · 发四周之牌',
		hoursBtn: '钟点占问 ▾',
		weeksCap: m => `${m.zh}的四周 <span class="en">The Four Weeks of ${m.en}</span>`,
		weekTag: k => `第${CN_NUM[k]}周`,
		weekCtx: (m, k) => `${TITLE}<br><b>${m.en} ${m.zh} · 第${CN_NUM[k]}周</b>`,
		daysBtn: '观此周七日',
		DAYS: ['日', '一', '二', '三', '四', '五', '六'], // starting, of course, with the Sun's day
		daysCap: k => `第${CN_NUM[k]}周 · 七日 <span class="en">seven days, starting with the Sun's day · 自太阳之日始</span>`,
		dayTag: d => `周${d}`,
		dayCtx: (m, k, d) => `${TITLE}<br><b>${m.zh} 第${CN_NUM[k]}周 · 星期${d}</b>`,
		hourLead: '为某时刻之事占问：',
		hourSelAria: '选择钟点',
		hourOpt: h => `${String(h % 24).padStart(2, '0')}:00 — 第${h}个钟点`,
		hourGo: '起卦',
		hourStackTag: n => `第 1–${n - 1} 张 · 面朝下`,
		hourTag: n => `第${n}张 · ${String(n % 24).padStart(2, '0')}:00`,
		hourCtx: (m, n) => `${TITLE}<br><b>${m.zh} · ${String(n % 24).padStart(2, '0')}:00 的钟点牌</b>`,
		hourCap: n => `钟点牌 <span class="en">deal ${n - 1} face down — the ${n}th, turned up, is the hour</span>`,
	},
};
