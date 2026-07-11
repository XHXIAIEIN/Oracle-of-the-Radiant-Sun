import { dualTitle, pair, text } from '../i18n.js';

const K = 'modes.trine';

export default {
	id: 'trine',
	get title() {
		return dualTitle(`${K}.title`);
	},
	dealCount: 12,
	freeOrder: true,
	wheelLabels: 'houses',
	houses: [1, 5, 9],
	get roles() {
		return { 1: text(`${K}.roles.1`), 5: text(`${K}.roles.5`), 9: text(`${K}.roles.9`) };
	},

	get shuffleLine() {
		return pair(`${K}.shuffleLine`);
	},
	get dealLine() {
		return pair(`${K}.dealLine`);
	},
	revealQueue: () => [1, 5, 9],
	get revealLine() {
		return pair(`${K}.revealLine`);
	},
};
