import { dualTitle, pair, text } from '../i18n.js';

const K = 'modes.cross';

export default {
	id: 'cross',
	get title() {
		return dualTitle(`${K}.title`);
	},
	dealCount: 12,
	freeOrder: true,
	wheelLabels: 'houses',
	houses: [1, 4, 7, 10],
	get roles() {
		return { 1: text(`${K}.roles.1`), 4: text(`${K}.roles.4`), 7: text(`${K}.roles.7`), 10: text(`${K}.roles.10`) };
	},

	get shuffleLine() {
		return pair(`${K}.shuffleLine`);
	},
	get dealLine() {
		return pair(`${K}.dealLine`);
	},
	revealQueue: () => [1, 4, 7, 10],
	get revealLine() {
		return pair(`${K}.revealLine`);
	},
};
