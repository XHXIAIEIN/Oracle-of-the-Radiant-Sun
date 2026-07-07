/* The Single Card：不构轮盘，洗牌后只取牌堆顶的一张，可再抽或放回重洗 */

import { cnNum } from '../i18n.js';

const TITLE = 'The Single Card · 单张';

export default {
	id: 'single',
	title: TITLE,
	freeOrder: true,
	panelTitle: '单张 · 解读',

	shuffleLine: ['洗牌，同时默想一个问题，或静观此刻最挂心的事。', 'Shuffle the deck while thinking of a question, or of the matter at hand.'],
	turnPrompt: ['心念所问，点牌翻开。', 'Turn the card face up when you are ready.'],
	afterFlip: ['点击牌面可查看整张牌的释义，或再抽一张。', 'Tap the card for the full reading, or draw again.'],
	again: '再抽一张',
	putBack: '放回牌堆 · 重新洗牌',
	returned: ['这张牌回到牌堆，重新洗过。', 'The card returns to the deck, which is shuffled anew.'],

	nthAria: n => `第${cnNum(n)}张（未翻开）`,
	where: n => `第${cnNum(n)}张 · THE SINGLE CARD`,
	ctx: n => `${TITLE}<br><b>第${cnNum(n)}张</b>`,
};
