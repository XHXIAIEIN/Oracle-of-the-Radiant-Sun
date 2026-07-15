import { $, D, replay } from './dom.js';

const COPY_SELECTOR = '.immersive-copy[data-i18n], .immersive-copy[data-en][data-zh]';
const STATIC_SELECTOR = '.lang-copy';
const ARIA_SELECTOR = '[data-i18n-aria]';

const LANG_KEY = 'radiant-sun.lang';

function detectLang() {
	try {
		const saved = localStorage.getItem(LANG_KEY);
		if (saved === 'zh' || saved === 'en') return saved;
	} catch {} // 隐私模式下 localStorage 不可用
	return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let currentLang = detectLang();
const dicts = {};
const dictLoads = {};

const getPath = (obj, path) => path?.split('.').reduce((v, k) => (v == null ? v : v[k]), obj);

/* 语言包整包只取一次；deck.js 的卡牌正文也从这里拿 */
export function loadDict(lang) {
	dictLoads[lang] ??= fetch(`data/lang/${lang}.json`)
		.then(res => {
			if (!res.ok) throw new Error(`Unable to load language pack: ${lang}`);
			return res.json();
		})
		.then(
			dict => (dicts[lang] = dict),
			err => {
				delete dictLoads[lang]; // 失败不缓存，下次重试
				throw err;
			},
		);
	return dictLoads[lang];
}

function dictText(key, lang = currentLang) {
	return getPath(dicts[lang], key);
}

function setCopyText(textNode, nextText, html = false) {
	if (html) textNode.innerHTML = nextText;
	else textNode.textContent = nextText;
}

function animateText(textNode, nextText, html = false) {
	if (window.gsap) {
		gsap.timeline()
			.to(textNode, { opacity: 0, y: -3, filter: 'blur(2px)', duration: D(0.16), ease: 'power1.out' })
			.call(() => {
				setCopyText(textNode, nextText, html);
			})
			.fromTo(textNode, { opacity: 0, y: 4, filter: 'blur(2px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: D(0.28), ease: 'power2.out' });
		return;
	}
	setCopyText(textNode, nextText, html);
}

function ensureTextNode(node) {
	let textNode = node.querySelector(':scope > .immersive-copy__text');
	if (!textNode) {
		textNode = document.createElement('span');
		textNode.textContent = dictText(node.dataset.i18n, 'en') || node.dataset.en || node.textContent.trim();
		node.textContent = '';
		node.append(textNode);
	}
	textNode.className = 'immersive-copy__text';
	return textNode;
}

function updateToggle(btn, lang) {
	if (!btn) return;
	const optionCount = document.querySelectorAll('[data-lang-option]').length;
	const direct = optionCount > 0 && optionCount <= 2;
	const label = direct ? (lang === 'zh' ? 'Switch to English' : 'Switch to Chinese') : lang === 'zh' ? 'Language: Chinese' : 'Language: English';
	btn.textContent = direct ? (lang === 'zh' ? 'EN' : '中') : lang === 'zh' ? '中' : 'EN';
	btn.setAttribute('aria-label', label);
	btn.title = label;
	if (btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', String(lang === 'zh'));
}

function updateLanguageMenu(lang) {
	document.querySelectorAll('[data-lang-option]').forEach(btn => {
		btn.setAttribute('aria-checked', String(btn.dataset.langOption === lang));
	});
}

function setCopyLanguage(node, lang, animate = false) {
	const textNode = ensureTextNode(node);
	node.dataset.lang = lang;
	const html = node.dataset[`${lang}Html`];
	const nextText = html ?? dictText(node.dataset.i18n, lang) ?? node.dataset[lang] ?? node.dataset.en;
	if (animate) animateText(textNode, nextText, html != null);
	else setCopyText(textNode, nextText, html != null);
	const btn = node.querySelector(':scope > .immersive-copy__toggle');
	if (btn) updateToggle(btn, lang);
}

function setStaticLanguage(node, lang) {
	const fromDict = dictText(node.dataset.i18n, lang);
	if (fromDict != null) {
		if (node.dataset.i18nHtml === 'true') node.innerHTML = fromDict;
		else node.textContent = fromDict;
		return;
	}
	const html = node.dataset[`${lang}Html`];
	if (html != null) {
		node.innerHTML = html;
		return;
	}
	const text = node.dataset[lang];
	if (text != null) node.textContent = text;
}

function setAriaLanguage(node, lang) {
	const label = dictText(node.dataset.i18nAria, lang);
	if (label != null) node.setAttribute('aria-label', label);
}

export async function setLanguage(lang, { animate = false, root = document } = {}) {
	currentLang = lang === 'zh' ? 'zh' : 'en';
	try {
		localStorage.setItem(LANG_KEY, currentLang);
	} catch {}
	await loadDict(currentLang);
	document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
	root.querySelectorAll(COPY_SELECTOR).forEach(node => setCopyLanguage(node, currentLang, animate));
	root.querySelectorAll(STATIC_SELECTOR).forEach(node => setStaticLanguage(node, currentLang));
	root.querySelectorAll(ARIA_SELECTOR).forEach(node => setAriaLanguage(node, currentLang));
	const globalBtn = $('#global-lang');
	if (globalBtn) {
		updateToggle(globalBtn, currentLang);
		replay(globalBtn, 'is-switching');
	}
	updateLanguageMenu(currentLang);
	window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: currentLang } }));
}

export const language = () => currentLang;
export const msg = (key, fallback = '') => dictText(key, currentLang) ?? fallback;
export const msgFor = (lang, key, fallback = '') => dictText(key, lang === 'zh' ? 'zh' : 'en') ?? fallback;

export function dockTopCapsules(host) {
	const tools = $('#top-capsules');
	if (!tools) return;
	if (tools.dataset.homeMarkerReady !== 'true') {
		tools.before(document.createComment('top capsules home'));
		tools.dataset.homeMarkerReady = 'true';
	}
	const marker = [...document.body.childNodes].find(node => node.nodeType === Node.COMMENT_NODE && node.nodeValue === 'top capsules home');
	const target = typeof host === 'string' ? $(host) : host;
	if (target) {
		if (tools.parentNode !== target) target.append(tools);
		tools.classList.add('top-capsules--docked');
		return;
	}
	if (marker?.parentNode && tools.previousSibling !== marker) marker.parentNode.insertBefore(tools, marker.nextSibling);
	tools.classList.remove('top-capsules--docked');
}

export function t(value) {
	if (Array.isArray(value)) return currentLang === 'zh' ? value[0] : value[1] ?? value[0];
	if (value && typeof value === 'object' && ('zh' in value || 'en' in value)) return currentLang === 'zh' ? value.zh ?? value.en : value.en ?? value.zh;
	return value;
}

export function initBilingualCopy(root = document) {
	root.querySelectorAll(COPY_SELECTOR).forEach(node => {
		if (node.dataset.bilingualReady === 'true') return;
		const textNode = ensureTextNode(node);
		node.dataset.lang ||= currentLang;
		const html = node.dataset[`${node.dataset.lang}Html`];
		setCopyText(textNode, html ?? dictText(node.dataset.i18n, node.dataset.lang) ?? node.dataset[node.dataset.lang] ?? node.dataset.en, html != null);
		node.dataset.bilingualReady = 'true';
	});
	root.querySelectorAll(STATIC_SELECTOR).forEach(node => setStaticLanguage(node, currentLang));
	root.querySelectorAll(ARIA_SELECTOR).forEach(node => setAriaLanguage(node, currentLang));
}

export async function initGlobalLanguageToggle() {
	await Promise.all([loadDict('en'), loadDict('zh')]);
	document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
	const btn = $('#global-lang');
	if (!btn) return;
	const menu = $('#language-menu');
	const options = () => [...document.querySelectorAll('[data-lang-option]')];
	const directToggleLang = () => {
		const langs = options().map(option => option.dataset.langOption).filter(Boolean);
		if (langs.length !== 2) return null;
		return langs.find(lang => lang !== currentLang) ?? null;
	};
	updateToggle(btn, currentLang);
	updateLanguageMenu(currentLang);
	if (!menu || btn.dataset.languageMenuReady === 'true') return;
	btn.dataset.languageMenuReady = 'true';

	const setOpen = open => {
		menu.hidden = !open;
		btn.setAttribute('aria-expanded', String(open));
	};

	btn.addEventListener('click', e => {
		e.stopPropagation();
		const nextLang = directToggleLang();
		if (nextLang) {
			setOpen(false);
			setLanguage(nextLang, { animate: true });
			return;
		}
		setOpen(menu.hidden);
	});

	menu.addEventListener('click', async e => {
		const option = e.target.closest('[data-lang-option]');
		if (!option) return;
		e.stopPropagation();
		await setLanguage(option.dataset.langOption, { animate: true });
		setOpen(false);
	});

	document.addEventListener('click', e => {
		if (menu.hidden || e.target.closest('#language-switch')) return;
		setOpen(false);
	});

	document.addEventListener('keydown', e => {
		if (e.key === 'Escape') setOpen(false);
	});
}
