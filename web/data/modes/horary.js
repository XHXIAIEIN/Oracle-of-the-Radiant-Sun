/* The Horary（pp.135–139）：以一个可用「是 / 否」作答的问题起卦，
   只翻开与问题相关宫位上的牌 */

export default {
	id: 'horary',
	title: 'The Horary · 时占',
	dealCount: 12,
	freeOrder: true, // 相关宫位可任意先后翻开
	wheelLabels: 'houses',

	shuffleLine: ['洗牌，同时在心中默想你的问题。', 'Shuffle the cards while thinking about the question you wish to have answered.'],
	dealLine: ['如太阳年一样，将十二张牌逆时针发成一环，牌面朝下。', 'Place the first card face down on the left, dealing counterclockwise around the Sun wheel.'],
	revealQueue: S => [...S.chosen].sort((a, b) => a - b),
	revealLine: ['只翻开与问题相关宫位上的牌；第一宫永远代表问卜者。', 'Turn upwards only the cards covering the house positions that relate to the question.'],

	/* 前三问是原书实例（pp.135–139）；其余依 pp.16–19 宫位释义推得，
	   行尾注明各宫取自书中的哪条职掌。第一宫恒为问卜者，不再逐条注 */
	quickpicks: [
		{ label: '求职 · Will I get the job?', q: '我会得到这份工作吗？', houses: [1, 5, 6, 10] },
		{ label: '售房 · Will we sell our house?', q: '我们能顺利卖掉房子吗？', houses: [1, 2, 4, 7, 8, 10] },
		{ label: '婚配 · Should we marry?', q: '我们该结婚吗？', houses: [1, 2, 7, 8] },
		{ label: '购房 · Should I buy this house?', q: '我该买下这处房子吗？', houses: [1, 2, 4, 7, 10] }, // 2 己方钱财；4 房产；7 对方（卖家）；10 市价（仿售房例）
		{ label: '合作 · Should we go into business?', q: '我该与此人合伙吗？', houses: [1, 2, 7, 8] }, // 7 business partnerships；8 partner's money（与婚配同构）
		{ label: '恋情 · Will this romance last?', q: '这段感情会有结果吗？', houses: [1, 5, 7] }, // 5 love affairs, lovers；7 long-term partners
		{ label: '子嗣 · Will we have a child?', q: '我们会有孩子吗？', houses: [1, 4, 5] }, // 5 children, pregnancy；4 home and family、事之归结
		{ label: '官司 · Will I win the lawsuit?', q: '这场官司我会赢吗？', houses: [1, 7, 9] }, // 7 lawsuits、对方当事人；9 law
		{ label: '考试 · Will I pass the exam?', q: '我能通过这场考试吗？', houses: [1, 3, 5, 9] }, // 3 knowledge, learning；9 academic subjects；5 运气与竞争（仿求职例）
		{ label: '健康 · Will my health improve?', q: '我的健康会好转吗？', houses: [1, 6] }, // 1 问卜者之 health；6 matters relating to health
		{ label: '远行 · Will the journey go well?', q: '这趟远行会顺利吗？', houses: [1, 9] }, // 9 overseas travel, foreign places
		{ label: '寻物 · Will I find what I lost?', q: '我能找回失物吗？', houses: [1, 2, 4] }, // 2 possessions in the portable sense；4 事之归结
		{ label: '消息 · Will the news arrive?', q: '我在等的消息会来吗？', houses: [1, 3] }, // 3 letters, messages and documents
		{ label: '心愿 · Will my wish come true?', q: '我的心愿会实现吗？', houses: [1, 11] }, // 11 hopes and wishes
	],

	/* 起卦前的两步：先默想问题，再择定宫位 */
	setup: {
		step1: {
			rite: ['时占以一问起卦——它应当可以用「是」或「否」作答。', 'The Horary is used to answer a specific question.'],
			num: '壹',
			head: '默想你的问题',
			sub: '写下一个可以用「是」或「否」回答的问题，或从书中的例问里挑一个。',
			placeholder: '例：我会得到这份工作吗？ · Will I get the job?',
			hint: '也可以不写下来——只在心中默想，同样有效。',
			next: '下一步 · 择定宫位',
		},
		step2: {
			rite: ['每一宫各司其事——问题落在哪几宫，翻牌时便只看那几宫。', 'Turn upwards only the cards covering the houses that relate to the question.'],
			num: '贰',
			head: '择定宫位',
			sub: '第一宫永远代表问卜者，已默认选中。点 ⓘ 可查每一宫所司之事（原书 pp.16–19）。',
			firstHouse: '第一宫永远代表问卜者',
			back: '← 改一改问题',
			go: '默想问题 · 开始洗牌',
		},
		infoTitle: '宫位释义',
	},
};
