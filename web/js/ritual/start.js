/* 屏幕切换：起始页与仪式页，选定占法后重置状态入座 */

import { $, swapScreen } from '../dom.js';
import { wheel, panel, panelList, setup } from '../stage.js';
import { S, resetState, applyPreset } from '../state.js';
import { MODES } from '../../data/modes/index.js';
import { resetFollow } from '../panel.js';
import { horarySetup } from './horary-setup.js';
import { shufflePhase } from './shuffle.js';
import { syncRoute } from '../router.js';
import { hideShare } from '../share.js';

export function showHome() {
	syncRoute('home');
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
	resetState(m);
	if (opts.preset?.length) applyPreset(opts.preset);
	if (opts.question) S.question = opts.question;
	if (opts.houses?.length) S.chosen = new Set([1, ...opts.houses]);

	swapScreen(() => {
		$('#screen-home').hidden = true;
		$('#screen-library').hidden = true;
		$('#screen-ritual').hidden = false;
		$('#ritual-title').textContent = MODES[m].title;
		$('#deck-badge').hidden = true;
		hideShare();
		panel.hidden = true;
		panelList.replaceChildren();
		resetFollow();
		$('#ritual-body').classList.remove('has-panel');
		wheel.replaceChildren();
		wheel.classList.toggle('wheel--single', m === 'single');
		setup.hidden = true;
		setup.replaceChildren();
		$('#question-line').hidden = true;
		if (m === 'horary' && !opts.houses?.length) horarySetup();
		else shufflePhase();
	});
}
