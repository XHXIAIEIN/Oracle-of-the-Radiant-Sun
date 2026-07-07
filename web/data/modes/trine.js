/* The Grand Trine（p.141）：只观第一、五、九宫，相距 120° */

export default {
	id: 'trine',
	title: 'The Grand Trine · 大三合',
	dealCount: 12,
	freeOrder: true,
	wheelLabels: 'houses',
	houses: [1, 5, 9],
	roles: { 1: '描述问卜者', 5: '问卜者的创造力', 9: '人生将如何拓展' },

	shuffleLine: ['洗牌，同时想一个具体的问题，或静观此刻的处境——工作、家庭，或爱。', 'Shuffle the cards while thinking about a specific question, or how things are going for you at the moment.'],
	dealLine: ['如太阳年一样，将十二张牌逆时针发成一环，牌面朝下。', 'Place the first card face down on the left, dealing counterclockwise around the Sun wheel.'],
	revealQueue: () => [1, 5, 9],
	revealLine: ['只翻开第一、五、九宫之牌——彼此相距 120°，构成大三合。', 'Turn over only the three cards of the First, Fifth and Ninth Houses.'],
};
