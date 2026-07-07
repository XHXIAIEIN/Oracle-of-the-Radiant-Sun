/* 整副 84 张牌，来自 deck.json（由 gen_deck.py 生成） */

export let DECK = [];

export async function loadDeck() {
	DECK = await (await fetch('deck.json')).json();
}
