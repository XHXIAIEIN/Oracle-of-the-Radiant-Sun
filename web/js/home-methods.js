import { MODE_ORDER } from './model/modes/index.js';
import { $, el } from './dom.js';
import { initHomeFigs } from './home-figs.js';

/* 文案节点只挂 data-i18n，由 main.js 随后的 initBilingualCopy 填入 */
function methodButton(id) {
	const btn = el('button', 'method');
	btn.type = 'button';
	btn.dataset.method = id;
	btn.innerHTML = `
		<span class="method__fig" aria-hidden="true"></span>
		<span class="method__text">
			<span class="method__name" data-i18n="home.methods.${id}.name"></span>
			<span class="method__en" data-i18n="home.methods.${id}.meta"></span>
			<span class="method__use" data-i18n="home.methods.${id}.useHtml" data-i18n-html></span>
			<span class="method__desc" data-i18n="home.methods.${id}.desc" data-i18n-animate></span>
		</span>
	`;
	return btn;
}

export function renderHomeMethods(onStart) {
	const nav = $('#methods');
	nav.replaceChildren(...MODE_ORDER.map(methodButton));
	nav.querySelectorAll('.method').forEach(btn => {
		btn.onclick = () => onStart(btn.dataset.method);
	});
	initHomeFigs(nav);
}
