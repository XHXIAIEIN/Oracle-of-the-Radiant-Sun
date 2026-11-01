import { text } from '../i18n.js';

const K = 'modes.cross';

export default {
	id: 'cross',
	get title() {
		return text(`${K}.title`);
	},
	dealCount: 12,
	freeOrder: true,
	wheelLabels: 'houses',
	houses: [1, 4, 7, 10],
	get roles() {
		return { 1: text(`${K}.roles.1`), 4: text(`${K}.roles.4`), 7: text(`${K}.roles.7`), 10: text(`${K}.roles.10`) };
	},

	shuffleLine: () => text(`${K}.shuffleLine`),
	dealLine: () => text(`${K}.dealLine`),
	revealQueue: () => [1, 4, 7, 10],
	revealLine: () => text(`${K}.revealLine`),
};
