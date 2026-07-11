import { MODE_ORDER } from './model/modes/index.js';
import { $, el } from './dom.js';
import { initHomeFigs } from './home-figs.js';
import { msgFor } from './bilingual.js';

const methodCopy = id => ({
	name: msgFor('en', `home.methods.${id}.name`, id),
	meta: msgFor('en', `home.methods.${id}.meta`, id),
	use: msgFor('en', `home.methods.${id}.useHtml`, ''),
	desc: msgFor('en', `home.methods.${id}.desc`, ''),
});

function methodButton(id) {
	const copy = methodCopy(id);
	const btn = el('button', 'method');
	btn.type = 'button';
	btn.dataset.method = id;
	btn.innerHTML = `
		<span class="method__fig" aria-hidden="true"></span>
		<span class="method__text">
			<span class="method__name lang-copy" data-i18n="home.methods.${id}.name">${copy.name}</span>
			<span class="method__en lang-copy" data-i18n="home.methods.${id}.meta">${copy.meta}</span>
			<span class="method__use lang-copy" data-i18n="home.methods.${id}.useHtml" data-i18n-html="true">${copy.use}</span>
			<span class="method__desc immersive-copy" data-i18n="home.methods.${id}.desc">
				<span class="immersive-copy__text">${copy.desc}</span>
			</span>
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
