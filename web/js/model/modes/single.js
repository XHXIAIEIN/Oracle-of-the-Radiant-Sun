import { dualTitle, pair, text, textf } from '../i18n.js';

const K = 'modes.single';
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const roman = n => ROMAN[n] ?? String(n);

export default {
	id: 'single',
	get title() {
		return dualTitle(`${K}.title`);
	},
	freeOrder: true,
	get panelTitle() {
		return text(`${K}.panelTitle`);
	},

	get shuffleLine() {
		return pair(`${K}.shuffleLine`);
	},
	get turnPrompt() {
		return pair(`${K}.turnPrompt`);
	},
	get afterFlip() {
		return pair(`${K}.afterFlip`);
	},
	get again() {
		return text(`${K}.again`);
	},
	get putBack() {
		return text(`${K}.putBack`);
	},
	get returned() {
		return pair(`${K}.returned`);
	},

	nthAria: n => textf(`${K}.nthAria`, { n: roman(n) }),
	where: n => textf(`${K}.where`, { n: roman(n) }),
	ctx: n => `${dualTitle(`${K}.title`)}<br><b>${textf(`${K}.ctx`, { n: roman(n) })}</b>`,
};
