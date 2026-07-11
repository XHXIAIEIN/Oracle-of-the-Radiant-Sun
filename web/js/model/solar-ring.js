/* Solar-ring positions shared by the Sun Year wheel and house-based readings. */

import { CATALOG } from './catalog.js';
import { msg, msgFor } from '../bilingual.js';

/* wheel position 1 = April/Aries at the left, dealt counterclockwise */
export const MONTHS = CATALOG.months.map((month, i) => ({
	pos: i + 1,
	...month,
	get en() {
		return msgFor('en', `catalog.months.${month.key}`, month.key);
	},
	get zh() {
		return msgFor('zh', `catalog.months.${month.key}`, month.key);
	},
}));

export const HOUSES = CATALOG.houses.map((house, i) => ({
	n: house.id ?? i + 1,
	get en() {
		return msgFor('en', `catalog.houses.${this.n}.title`, '');
	},
	get zh() {
		return msgFor('zh', `catalog.houses.${this.n}.title`, '');
	},
	get desc() {
		return msg(`catalog.houses.${this.n}.desc`, msgFor('en', `catalog.houses.${this.n}.desc`, ''));
	},
}));
