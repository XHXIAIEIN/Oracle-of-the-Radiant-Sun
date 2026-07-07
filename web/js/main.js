/* Oracle of the Radiant Sun — the four readings of the book (pp.124–143):
   The Sun Year, The Horary, The Grand Trine, The Cardinal Cross.
   Wheel geometry, dealing order and reveal rules follow the text exactly:
   twelve cards dealt counterclockwise from the left (April ♈), a 13th in
   the centre for the Sun Year; amplify any month into weeks, days, hours.

   入口：装载牌组、接线起始页——数据见 data/，流程见 js/ritual/。 */

import { $ } from './dom.js';
import { riteLine } from './stage.js';
import { loadDeck } from '../data/card/deck.js';
import { STR } from '../data/i18n.js';
import { showHome, startMethod } from './ritual/start.js';
import { showLibrary } from './library.js';
import { applyRoute } from './router.js';
import './panel.js'; // 排序与跟卷的接线
import './dialog.js'; // 对话框关闭的接线
import './home-figs.js'; // 起始页牌阵预览小图

$('#btn-home').onclick = showHome;

document.querySelectorAll('.method').forEach(b => {
	b.onclick = () => startMethod(b.dataset.method);
});

$('#btn-library').onclick = showLibrary;
$('#btn-lib-home').onclick = showHome;

loadDeck().then(applyRoute, () => {
	riteLine.textContent = STR.loadFail;
});
