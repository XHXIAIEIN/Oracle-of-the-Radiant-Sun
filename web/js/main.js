/* Oracle of the Radiant Sun — the four readings of the book (pp.124–143):
   The Sun Year, The Horary, The Grand Trine, The Cardinal Cross.
   Wheel geometry, dealing order and reveal rules follow the text exactly:
   twelve cards dealt counterclockwise from the left (April ♈), a 13th in
   the centre for the Sun Year; amplify any month into weeks, days, hours.

   入口：装载牌组、接线起始页——数据见 data/，流程见 js/ritual/。 */

import { $ } from './dom.js';
import { riteLine } from './stage.js';
import { loadDeck } from './model/deck.js';
import { STR } from './model/i18n.js';
import { showHome, startMethod } from './ritual/start.js';
import { showLibrary } from './library.js';
import { applyRoute } from './router.js';
import { initBilingualCopy, initGlobalLanguageToggle, t } from './bilingual.js';
import { initScrollMotion } from './scroll-motion.js';
import { renderHomeMethods } from './home-methods.js';
import './panel.js'; // 排序与跟卷的接线
import './dialog.js'; // 对话框关闭的接线

$('#btn-home').onclick = showHome;

$('#btn-library').onclick = showLibrary;
$('#btn-lib-home').onclick = showHome;
await initGlobalLanguageToggle();
renderHomeMethods(startMethod);
initBilingualCopy();
initScrollMotion();

loadDeck().then(applyRoute, () => {
	riteLine.textContent = t(STR.loadFail);
});
