/* 整副 84 张牌，结构来自 data/deck.json，正文来自 data/lang/*.json */

import { language, loadDict } from '../bilingual.js';

export let DECK = [];

const TEXT_KEYS = ['name', 'sign_keyword', 'image_description', 'personal', 'reading', 'events'];
const cardKey = c => `${c.planet}_${c.sign}`.toLowerCase();

const loadCardTextPack = lang => loadDict(lang).then(dict => dict.cards ?? {});

function hydrateCard(card, enCards, zhCards) {
	const key = cardKey(card);
	const en = enCards[key] ?? {};
	const zh = zhCards[key] ?? {};
	for (const field of TEXT_KEYS) {
		if (en[field] != null) card[field] = en[field];
		if (zh[field] != null) card[`${field}_zh`] = zh[field];
	}
	return card;
}

export async function loadDeck() {
	const [rawDeck, enCards, zhCards] = await Promise.all([
		fetch('data/deck.json').then(res => res.json()),
		loadCardTextPack('en'),
		loadCardTextPack('zh').catch(() => ({})),
	]);
	DECK = rawDeck.map(card => hydrateCard(card, enCards, zhCards));
}

export function cardText(card, field) {
	if (language() === 'zh' && card[`${field}_zh`]) return card[`${field}_zh`];
	return card[field] ?? '';
}

export const cardName = card => cardText(card, 'name');
export const cardSignKeyword = card => cardText(card, 'sign_keyword');
