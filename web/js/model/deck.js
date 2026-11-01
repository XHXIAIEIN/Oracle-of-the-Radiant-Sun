/* 整副 84 张牌，结构来自 data/deck.json，正文来自 data/lang/*.json */

import { language, loadDict, textIn } from '../bilingual.js';

export let DECK = [];

const TEXT_KEYS = ['name', 'sign_keyword', 'image_description', 'personal', 'reading', 'events'];
const cardKey = c => `${c.planet}_${c.sign}`.toLowerCase();

/* 英文字段进 DECK：card.name 等被路由和检索当作标识；当前语言的正文走 cardText */
function hydrateCard(card, enCards) {
	const en = enCards[cardKey(card)] ?? {};
	for (const field of TEXT_KEYS) if (en[field] != null) card[field] = en[field];
	return card;
}

export async function loadDeck() {
	const [rawDeck, enCards] = await Promise.all([fetch('data/deck.json').then(res => res.json()), loadDict('en').then(dict => dict.cards ?? {})]);
	DECK = rawDeck.map(card => hydrateCard(card, enCards));
}

export const cardText = (card, field) => textIn(language(), `cards.${cardKey(card)}.${field}`);

export const cardName = card => cardText(card, 'name');
export const cardSignKeyword = card => cardText(card, 'sign_keyword');
