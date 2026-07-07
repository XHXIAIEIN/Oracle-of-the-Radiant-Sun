/* 太阳之环上的十二个位置：月份（太阳年）与宫位（其余占法） */

/* wheel position 1 = April/Aries at the left, dealt counterclockwise */
export const MONTHS = [
	['April', '四月', 'Aries'],
	['May', '五月', 'Taurus'],
	['June', '六月', 'Gemini'],
	['July', '七月', 'Cancer'],
	['August', '八月', 'Leo'],
	['September', '九月', 'Virgo'],
	['October', '十月', 'Libra'],
	['November', '十一月', 'Scorpio'],
	['December', '十二月', 'Sagittarius'],
	['January', '一月', 'Capricorn'],
	['February', '二月', 'Aquarius'],
	['March', '三月', 'Pisces'],
].map(([en, zh, sign], i) => ({ pos: i + 1, en, zh, sign }));

/* the associations of each House (p16–19) */
export const HOUSES = [
	[
		'问卜者',
		'The questioner',
		'Questions associated with the First House shed light on the state of mind of the questioner, and his or her health and circumstances. This House also indicates how the enquirer sees him or herself, and how others regard him or her.',
	],
	[
		'财产 · 金钱',
		'Property, finances',
		"Second-house questions are about finances, wealth, poverty, loss or gains. This House describes possessions in the portable sense, such as furniture, art, jewelry and money used in speculation. It can also indicate one's physical abilities and talents as well as anything that can be described as one's “property.”",
	],
	[
		'手足 · 通信',
		'Brothers, sisters, communication',
		'The Third House offers information on communications of all kinds, including letters, messages and documents. This House also represents brothers and sisters and describes sibling relationships. Questions related to everyday travel, knowledge, early learning, short journeys, mental energy and telepathy can also be answered here.',
	],
	[
		'父母 · 家宅',
		'Parents, home, family',
		"Questions of the Fourth House concern home and family. This House describes events and happenings that affect one's father or mother, house, family, land, estates and gardens. The Fourth House also describes the end or the summing up of the question.",
	],
	[
		'子女 · 创造 · 恋情',
		'Children, creative matters, love affairs',
		'The Fifth House deals in questions about children, pregnancy, lotteries, gambling, love affairs and anything involving creativity. This can include artistic pursuits, hobbies, recreation, children and lovers.',
	],
	['工作 · 健康 · 服务', 'Work, health, service', 'Sixth-house questions concern employees, workers and day-to-day life. Also matters relating to health, service to others, small animals and pets.'],
	[
		'婚姻 · 合伙',
		'Marriage, business partnerships',
		'Questions associated with the Seventh House relate to a husband or wife, long-term partners, marriages, business partnerships, lawsuits, contracts, agreements and disagreements with others. This House also refers to matters concerning nieces, nephews and grandparents.',
	],
	[
		'共有财产 · 他人之财',
		"Shared property, others' finances",
		"This House sheds light on questions to do with legacies, inheritances, shared finances, other people's money, a partner's money or possessions, and the health or work of brothers and sisters. Traditionally the house of death — in the broadest sense, the ending of one thing to make room for another.",
	],
	['信仰 · 法律 · 远行', 'Religion, philosophy, law, distant travel', 'Ninth-house questions concern beliefs, philosophy, overseas travel, foreign places, higher learning, academic subjects, law, religion, publishing, foreign culture and sport.'],
	[
		'事业 · 声望',
		'Career, place in community',
		"Questions for this House pertain to one's public life, standing in the community, career, social status and attitudes to parenting. It represents honor, authority, career and professions, life direction and achievement.",
	],
	[
		'朋友 · 愿望',
		'Friends, associations, hopes and wishes',
		"Questions relating to the Eleventh House concern friendships and one's relationships with groups of people. This House also relates to one's hopes and dreams, humanitarian impulses and work for good causes.",
	],
	[
		'隐秘 · 灵性',
		'Spirituality, institutions, secret enemies',
		'Twelfth-house questions deal with hidden strengths and weaknesses. This House also concerns institutions, such as hospitals, jails, libraries and the armed services. It describes fears, hidden enemies, the collective unconscious, spirituality and karma.',
	],
].map(([zh, en, desc], i) => ({ n: i + 1, zh, en, desc }));
