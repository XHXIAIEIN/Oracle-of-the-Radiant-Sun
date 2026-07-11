import { MONTHS } from '../solar-ring.js';
import { cnNum, dualTitle, pair, pairf, text, textf } from '../i18n.js';
import { language } from '../../bilingual.js';

const K = 'modes.sunyear';
const A = `${K}.amplify`;
const hour = n => String(n % 24).padStart(2, '0');

export default {
	id: 'sunyear',
	get title() {
		return dualTitle(`${K}.title`);
	},
	dealCount: 13,
	freeOrder: false,
	wheelLabels: 'months',
	centerTheme: true,

	get shuffleLine() {
		return pair(`${K}.shuffleLine`);
	},
	get dealLine() {
		return pair(`${K}.dealLine`);
	},
	revealQueue: S => {
		const q = Array.from({ length: 12 }, (_, k) => ((S.startPos - 1 + k) % 12) + 1);
		q.push(13);
		return q;
	},
	revealLine: S => {
		const m = MONTHS[S.startPos - 1];
		return pairf(`${K}.revealLineCurrent`, { zh: m.zh, en: m.en });
	},
	get doneLine() {
		return pair(`${K}.doneLine`);
	},

	get themeWhere() {
		return text(`${K}.themeWhere`);
	},
	get themeCtx() {
		return `${this.title}<br><b>${text(`${K}.themeCtx`)}</b>`;
	},
	monthCtx: m => `${dualTitle(`${K}.title`)}<br><b>${textf(`${K}.monthCtx`, { en: m.en, zh: m.zh, house: language() === 'zh' ? cnNum(m.pos) : m.pos })}</b>`,

	get amplify() {
		return {
			weeksBtn: text(`${A}.weeksBtn`),
			hoursBtn: text(`${A}.hoursBtn`),
			weeksCap: m => textf(`${A}.weeksCap`, { en: m.en, zh: m.zh }),
			weekTag: k => textf(`${A}.weekTag`, { n: cnNum(k) }),
			weekCtx: (m, k) => `${dualTitle(`${K}.title`)}<br><b>${textf(`${A}.weekCtx`, { en: m.en, zh: m.zh, n: language() === 'zh' ? cnNum(k) : k })}</b>`,
			daysBtn: text(`${A}.daysBtn`),
			DAYS: text(`${A}.days`, []),
			daysCap: k => textf(`${A}.daysCap`, { n: cnNum(k) }),
			dayTag: d => textf(`${A}.dayTag`, { d }),
			dayCtx: (m, k, d) => `${dualTitle(`${K}.title`)}<br><b>${textf(`${A}.dayCtx`, { en: m.en, zh: m.zh, n: language() === 'zh' ? cnNum(k) : k, d })}</b>`,
			hourLead: text(`${A}.hourLead`),
			hourSelAria: text(`${A}.hourSelAria`),
			hourPick: (n, isNow) => textf(`${A}.${isNow ? 'hourPickNow' : 'hourPick'}`, { n, hour: hour(n) }),
			hourGo: text(`${A}.hourGo`),
			hourAgain: text(`${A}.hourAgain`),
			hourStackTag: n => textf(`${A}.hourStackTag`, { n: n - 1 }),
			hourTag: n => textf(`${A}.hourTag`, { n }),
			hourCtx: (m, n) => `${dualTitle(`${K}.title`)}<br><b>${textf(`${A}.hourCtx`, { en: m.en, zh: m.zh, hour: hour(n) })}</b>`,
			hourCap: n =>
				textf(`${A}.${n === 1 ? 'hourCapFirst' : 'hourCapLater'}`, {
					hour: hour(n),
					n,
					down: n - 1,
				}),
		};
	},
};
