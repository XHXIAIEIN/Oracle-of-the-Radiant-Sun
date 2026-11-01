import { text } from '../i18n.js';

const K = 'modes.trine';

export default {
	id: 'trine',
	get title() {
		return text(`${K}.title`);
	},
	dealCount: 12,
	freeOrder: true,
	wheelLabels: 'houses',
	houses: [1, 5, 9],
	get roles() {
		return { 1: text(`${K}.roles.1`), 5: text(`${K}.roles.5`), 9: text(`${K}.roles.9`) };
	},

	shuffleLine: () => text(`${K}.shuffleLine`),
	dealLine: () => text(`${K}.dealLine`),
	revealQueue: () => [1, 5, 9],
	revealLine: () => text(`${K}.revealLine`),
};
