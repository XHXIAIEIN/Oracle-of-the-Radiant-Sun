import { text } from '../i18n.js';

const K = 'modes.single';
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const roman = n => ROMAN[n] ?? String(n);

export default {
	id: 'single',
	get title() {
		return text(`${K}.title`);
	},
	freeOrder: true,
	get panelTitle() {
		return text(`${K}.panelTitle`);
	},

	shuffleLine: () => text(`${K}.shuffleLine`),
	turnPrompt: () => text(`${K}.turnPrompt`),
	afterFlip: () => text(`${K}.afterFlip`),
	get again() {
		return text(`${K}.again`);
	},
	get putBack() {
		return text(`${K}.putBack`);
	},
	returned: () => text(`${K}.returned`),

	nthAria: n => text(`${K}.nthAria`, { n: roman(n) }),
	where: n => text(`${K}.where`, { n: roman(n) }),
	ctx: n => `${text(`${K}.title`)}<br><b>${text(`${K}.ctx`, { n: roman(n) })}</b>`,
};
