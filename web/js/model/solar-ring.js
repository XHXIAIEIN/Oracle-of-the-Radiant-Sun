/* Solar-ring positions shared by the Sun Year wheel and house-based readings. */

import { CATALOG } from './catalog.js';
import { text, textIn } from '../bilingual.js';

/* wheel position 1 = April/Aries at the left, dealt counterclockwise */
export const MONTHS = CATALOG.months.map((month, i) => ({
	pos: i + 1,
	...month,
	get en() {
		return textIn('en', `catalog.months.${month.key}`);
	},
	get zh() {
		return textIn('zh', `catalog.months.${month.key}`);
	},
}));

export const HOUSES = CATALOG.houses.map((house, i) => ({
	n: house.id ?? i + 1,
	get en() {
		return textIn('en', `catalog.houses.${this.n}.title`);
	},
	get zh() {
		return textIn('zh', `catalog.houses.${this.n}.title`);
	},
	get desc() {
		return text(`catalog.houses.${this.n}.desc`);
	},
}));
