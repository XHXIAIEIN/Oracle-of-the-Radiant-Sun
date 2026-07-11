/* Localization helpers. User-facing copy lives in data/lang/*.json. */

import { language, msg, msgFor } from '../bilingual.js';

const fill = (text, vars = {}) => String(text).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');

export const pair = key => [msgFor('zh', key), msgFor('en', key)];
export const pairf = (key, vars) => pair(key).map(text => fill(text, vars));
export const text = (key, fallback = '') => msg(key, fallback);
export const textf = (key, vars, fallback = '') => fill(msg(key, fallback), vars);
export const dualTitle = key => text(key);
export const dualText = key => text(key);

export const cnNum = n => msgFor('zh', 'common.cnNums', [])[n] ?? String(n);
export const cnHouse = n => fill(msgFor('zh', 'common.houseLabel'), { n: cnNum(n) });
export const houseLabel = n => fill(msg('common.houseLabel'), { n: (msg('common.cnNums', [])[n] ?? String(n)) });

export const bi = ([zh, en]) => textFromPair([zh, en]);

export function textFromPair([zh, en]) {
	return language() === 'zh' ? zh : en ?? zh;
}

export const STR = {
	get loadFail() {
		return pair('system.loadFail');
	},

	deck: {
		get aria() {
			return pair('deck.aria');
		},
		get hint() {
			return pair('deck.hint');
		},
		get hintAgain() {
			return pair('deck.hintAgain');
		},
		get deal() {
			return pair('deck.deal');
		},
		get drawOne() {
			return pair('deck.drawOne');
		},
		get empty() {
			return pair('deck.empty');
		},
		get shortOfHour() {
			return pair('deck.shortOfHour');
		},
	},

	reveal: {
		get all() {
			return pair('reveal.all');
		},
		get speedUp() {
			return pair('reveal.speedUp');
		},
		get done() {
			return pair('reveal.done');
		},
		faceDownAria: pos => (pos === 13 ? pair('reveal.centralFaceDown') : pairf('reveal.positionFaceDown', { pos })),
	},

	panel: {
		get reading() {
			return pair('panel.reading');
		},
		get sortAsc() {
			return pair('panel.sortAsc');
		},
		get sortDesc() {
			return pair('panel.sortDesc');
		},
	},

	wheel: {
		get theme() {
			return pair('wheel.theme');
		},
	},

	dialog: {
		get image() {
			return pair('dialog.sections.image');
		},
		get personality() {
			return pair('dialog.sections.personality');
		},
		get reading() {
			return pair('dialog.sections.reading');
		},
		get events() {
			return pair('dialog.sections.events');
		},
	},
};
