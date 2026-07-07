/* 整副 84 张牌，来自 data/deck.json（由 scripts/gen_deck.py 生成） */

export let DECK = [];

export async function loadDeck() {
	DECK = await (await fetch('data/deck.json')).json();
}
