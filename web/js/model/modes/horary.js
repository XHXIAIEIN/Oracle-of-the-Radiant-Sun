import { dualTitle, pair, text } from '../i18n.js';

const K = 'modes.horary';
const QUICK_HOUSES = [
	[1, 5, 6, 10],
	[1, 2, 4, 7, 8, 10],
	[1, 2, 7, 8],
	[1, 2, 4, 7, 10],
	[1, 2, 7, 8],
	[1, 5, 7],
	[1, 4, 5],
	[1, 7, 9],
	[1, 3, 5, 9],
	[1, 6],
	[1, 9],
	[1, 2, 4],
	[1, 3],
	[1, 11],
];

const quickpick = i => ({
	get label() {
		return `${text(`${K}.quickpicks.${i}.label`)} · ${text(`${K}.quickpicks.${i}.q`)}`;
	},
	get q() {
		return text(`${K}.quickpicks.${i}.q`);
	},
	houses: QUICK_HOUSES[i],
});

export default {
	id: 'horary',
	get title() {
		return dualTitle(`${K}.title`);
	},
	dealCount: 12,
	freeOrder: true,
	wheelLabels: 'houses',

	get shuffleLine() {
		return pair(`${K}.shuffleLine`);
	},
	get dealLine() {
		return pair(`${K}.dealLine`);
	},
	revealQueue: S => [...S.chosen].sort((a, b) => a - b),
	get revealLine() {
		return pair(`${K}.revealLine`);
	},

	get quickpicks() {
		return QUICK_HOUSES.map((_, i) => quickpick(i));
	},

	get setup() {
		return {
			step1: {
				rite: pair(`${K}.setup.step1.rite`),
				num: text(`${K}.setup.step1.num`),
				head: text(`${K}.setup.step1.head`),
				sub: text(`${K}.setup.step1.sub`),
				placeholder: text(`${K}.setup.step1.placeholder`),
				hint: text(`${K}.setup.step1.hint`),
				next: text(`${K}.setup.step1.next`),
			},
			step2: {
				rite: pair(`${K}.setup.step2.rite`),
				num: text(`${K}.setup.step2.num`),
				head: text(`${K}.setup.step2.head`),
				sub: text(`${K}.setup.step2.sub`),
				firstHouse: text(`${K}.setup.step2.firstHouse`),
				back: text(`${K}.setup.step2.back`),
				go: text(`${K}.setup.step2.go`),
			},
			infoTitle: text(`${K}.setup.infoTitle`),
		};
	},
};
