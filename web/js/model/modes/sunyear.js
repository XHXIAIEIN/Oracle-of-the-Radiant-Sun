import { MONTHS } from '../solar-ring.js';
import { cnNum, text } from '../i18n.js';
import { language } from '../../bilingual.js';

const K = 'modes.sunyear';
const A = `${K}.amplify`;
const hour = n => String(n % 24).padStart(2, '0');
const monthName = m => (language() === 'zh' ? m.zh : m.en);

export default {
	id: 'sunyear',
	get title() {
		return text(`${K}.title`);
	},
	dealCount: 13,
	freeOrder: false,
	wheelLabels: 'months',
	centerTheme: true,

	shuffleLine: () => text(`${K}.shuffleLine`),
	dealLine: () => text(`${K}.dealLine`),
	revealQueue: S => {
		const q = Array.from({ length: 12 }, (_, k) => ((S.startPos - 1 + k) % 12) + 1);
		q.push(13);
		return q;
	},
	revealLine: S => text(`${K}.revealLineCurrent`, { month: monthName(MONTHS[S.startPos - 1]) }),
	doneLine: () => text(`${K}.doneLine`),

	get themeWhere() {
		return text(`${K}.themeWhere`);
	},
	get themeCtx() {
		return `${this.title}<br><b>${text(`${K}.themeCtx`)}</b>`;
	},
	monthCtx: m => `${text(`${K}.title`)}<br><b>${text(`${K}.monthCtx`, { month: monthName(m), house: language() === 'zh' ? cnNum(m.pos) : m.pos })}</b>`,

	get amplify() {
		return {
			weeksCap: m => text(`${A}.weeksCap`, { month: monthName(m) }),
			weekTag: k => text(`${A}.weekTag`, { n: cnNum(k) }),
			weekCtx: (m, k) => `${text(`${K}.title`)}<br><b>${text(`${A}.weekCtx`, { month: monthName(m), n: language() === 'zh' ? cnNum(k) : k })}</b>`,
			DAYS: text(`${A}.days`),
			daysCap: k => text(`${A}.daysCap`, { n: cnNum(k) }),
			dayTag: d => text(`${A}.dayTag`, { d }),
			dayCtx: (m, k, d) => `${text(`${K}.title`)}<br><b>${text(`${A}.dayCtx`, { month: monthName(m), n: language() === 'zh' ? cnNum(k) : k, d })}</b>`,
			hourPick: (n, isNow) => text(`${A}.${isNow ? 'hourPickNow' : 'hourPick'}`, { n, hour: hour(n) }),
			hourStackTag: n => text(`${A}.hourStackTag`, { n: n - 1 }),
			hourTag: n => text(`${A}.hourTag`, { n }),
			hourCtx: (m, n) => `${text(`${K}.title`)}<br><b>${text(`${A}.hourCtx`, { month: monthName(m), hour: hour(n) })}</b>`,
			hourCap: n =>
				text(`${A}.${n === 1 ? 'hourCapFirst' : 'hourCapLater'}`, {
					hour: hour(n),
					n,
					down: n - 1,
				}),
		};
	},
};
