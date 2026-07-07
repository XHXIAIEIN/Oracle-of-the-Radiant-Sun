/* The Cardinal Cross（p.143）：只观第一、四、七、十宫，四个本位轴角 */

export default {
	id: 'cross',
	title: 'The Cardinal Cross · 本位十字',
	dealCount: 12,
	freeOrder: true,
	wheelLabels: 'houses',
	houses: [1, 4, 7, 10],
	roles: { 1: '人格', 4: '家庭 · 家宅', 7: '婚姻 · 伴侣', 10: '事业 · 成就' },

	shuffleLine: ['洗牌，同时默想一个具体的问题，或此刻最挂心的那件事。', 'Shuffle the cards while pondering a specific question, or an area of life that concerns you.'],
	dealLine: ['如太阳年一样，将十二张牌逆时针发成一环，牌面朝下。', 'Place the first card face down on the left, dealing counterclockwise around the Sun wheel.'],
	revealQueue: () => [1, 4, 7, 10],
	revealLine: ['只翻开第一、四、七、十宫之牌——四个本位轴角。', 'Turn up only the four angular cards: the First, Fourth, Seventh and Tenth House positions.'],
};
