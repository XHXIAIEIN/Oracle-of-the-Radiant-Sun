/* Card-facing astrology symbols, suit labels, and compact planet/sign lines. */

import { CATALOG } from './catalog.js';
import { language, msgFor } from '../bilingual.js';

const glyphMap = entries => Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, [value.glyph]]));

/* ︎ keeps the glyphs in text presentation (no colour emoji) */
export const SIGN = glyphMap(CATALOG.signs);
export const PLANET = glyphMap(CATALOG.planets);
export const PLANET_ORDER = Object.keys(CATALOG.planets);
export const ELEMENTS = CATALOG.elements;

export const planetNameFor = (planet, lang = language()) => msgFor(lang, `catalog.planets.${planet}`, planet);
export const signNameFor = (sign, lang = language()) => msgFor(lang, `catalog.signs.${sign}`, sign);
export const suitNameFor = (suit, lang = language()) => msgFor(lang, `catalog.suits.${suit}`, suit);
export const elementNameFor = (element, lang = language()) => msgFor(lang, `catalog.elements.${element}`, element);
export const psLine = c => (language() === 'zh' ? `${planetNameFor(c.planet)}在${signNameFor(c.sign)} ${SIGN[c.sign][0]}` : `${PLANET[c.planet][0]} ${planetNameFor(c.planet)} in ${signNameFor(c.sign)} ${SIGN[c.sign][0]}`);
export const psSuitLine = c => (language() === 'zh' ? `${psLine(c)} · ${suitNameFor(c.suit_name)}之组` : `${psLine(c)} · The Suit of ${suitNameFor(c.suit_name)}`);
