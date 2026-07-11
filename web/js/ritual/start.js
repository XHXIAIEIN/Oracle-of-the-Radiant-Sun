/* 屏幕切换：起始页与仪式页，选定占法后重置状态入座 */

import { $, swapScreen } from '../dom.js';
import { wheel, panel, panelList, setup } from '../stage.js';
import { S, resetState, applyPreset } from '../state.js';
import { MODES } from '../model/modes/index.js';
import { resetFollow, resetPanelChrome } from '../panel.js';
import { resetDrawer } from '../drawer.js';
import { horarySetup } from './horary-setup.js';
import { shufflePhase } from './shuffle.js';
import { syncRoute } from '../router.js';
import { hideShare } from '../share.js';
import { dockTopCapsules } from '../bilingual.js';

function updateRitualTitle(m) {
	$('#ritual-title').innerHTML = `<span class="t-main">${MODES[m].title}</span>`;
}

export function showHome() {
	syncRoute('home');
	resetPanelChrome();
	dockTopCapsules(null);
	swapScreen(() => {
		$('#screen-ritual').hidden = true;
		$('#screen-library').hidden = true;
		$('#screen-home').hidden = false;
	});
}

/* opts 来自路由：preset 为钉在堆顶的牌（DECK 下标），question 为题问，
   houses 为时占预选的宫位——给了宫位便跳过时占的两步设置 */
export function startMethod(m, opts = {}) {
	syncRoute(m);
	dockTopCapsules('#ritual-tools');
	resetState(m);
	if (opts.preset?.length) applyPreset(opts.preset);
	if (opts.question) S.question = opts.question;
	if (opts.houses?.length) S.chosen = new Set([1, ...opts.houses]);

	swapScreen(() => {
		$('#screen-home').hidden = true;
		$('#screen-library').hidden = true;
		$('#screen-ritual').hidden = false;
		updateRitualTitle(m);
		$('#deck-badge').hidden = true;
		hideShare();
		panel.hidden = true;
		panelList.replaceChildren();
		resetFollow();
		resetPanelChrome();
		resetDrawer();
		$('#ritual-body').classList.remove('has-panel');
		$('#stage-actions').closest('.stage-wrap')?.classList.toggle('is-single-layout', m === 'single');
		wheel.replaceChildren();
		wheel.classList.toggle('wheel--single', m === 'single');
		setup.hidden = true;
		setup.replaceChildren();
		$('#question-line').hidden = true;
		if (m === 'horary' && !opts.houses?.length) horarySetup();
		else shufflePhase();
	});
}

window.addEventListener('languagechange', () => {
	if (!S.method || $('#screen-ritual').hidden) return;
	updateRitualTitle(S.method);
});
