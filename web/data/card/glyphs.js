/* 行星、星座与花色的双语名称与符号 */

/* ︎ keeps the glyphs in text presentation (no colour emoji) */
export const SIGN = {
	Aries: ['♈︎', '白羊'],
	Taurus: ['♉︎', '金牛'],
	Gemini: ['♊︎', '双子'],
	Cancer: ['♋︎', '巨蟹'],
	Leo: ['♌︎', '狮子'],
	Virgo: ['♍︎', '处女'],
	Libra: ['♎︎', '天秤'],
	Scorpio: ['♏︎', '天蝎'],
	Sagittarius: ['♐︎', '射手'],
	Capricorn: ['♑︎', '摩羯'],
	Aquarius: ['♒︎', '水瓶'],
	Pisces: ['♓︎', '双鱼'],
};
export const PLANET = {
	Sun: ['☉︎', '太阳'],
	Moon: ['☽︎', '月亮'],
	Mercury: ['☿︎', '水星'],
	Venus: ['♀︎', '金星'],
	Mars: ['♂︎', '火星'],
	Jupiter: ['♃︎', '木星'],
	Saturn: ['♄︎', '土星'],
};
export const PLANET_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
export const SUIT_ZH = {
	Fortune: '幸运',
	Security: '安稳',
	Change: '变化',
	Love: '爱',
	Action: '行动',
	Gain: '收获',
	Ambition: '抱负',
};
export const suitZh = s => SUIT_ZH[s] ?? s;

/* the four elements group the signs; a card's number is the number of
   its sign (1 Aries … 12 Pisces), so the sign row doubles as numbers */
export const ELEMENTS = {
	fire: { zh: '火象', signs: ['Aries', 'Leo', 'Sagittarius'] },
	earth: { zh: '土象', signs: ['Taurus', 'Virgo', 'Capricorn'] },
	air: { zh: '风象', signs: ['Gemini', 'Libra', 'Aquarius'] },
	water: { zh: '水象', signs: ['Cancer', 'Scorpio', 'Pisces'] },
};

/* 「☉︎ Sun in Leo ♌︎ · 太阳在狮子」一行 */
export const psLine = c => `${PLANET[c.planet][0]} ${c.planet} in ${c.sign} ${SIGN[c.sign][0]} · ${PLANET[c.planet][1]}在${SIGN[c.sign][1]}`;
export const psSuitLine = c => `${psLine(c)} · ${suitZh(c.suit_name)}之组`;
