/* Localization helpers. User-facing copy lives in data/lang/*.json;
   text(key, vars?) reads it in the current language, textIn(lang, key, vars?) in a given one. */

export { text, textIn } from '../bilingual.js';
import { text, textIn } from '../bilingual.js';

export const cnNum = n => textIn('zh', 'common.cnNums')[n] ?? String(n);
export const cnHouse = n => textIn('zh', 'common.houseLabel', { n: cnNum(n) });
export const houseLabel = n => text('common.houseLabel', { n: text('common.cnNums')[n] ?? String(n) });
