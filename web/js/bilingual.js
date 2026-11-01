import { $, D, replay } from './dom.js';

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

const fill = (value, vars) => String(value).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');

/* 一句文案的两个取法：textIn 指定语言，text 取当前语言；vars 填 {name} 占位 */
export function textIn(lang, key, vars) {
	const value = getPath(dicts[lang], key);
	return vars ? fill(value, vars) : value;
}
export const text = (key, vars) => textIn(currentLang, key, vars);

function setCopyText(node, value, html) {
	if (html) node.innerHTML = value;
	else node.textContent = value;
}

function animateText(textNode, value, html) {
	if (window.gsap) {
		gsap.timeline()
			.to(textNode, { opacity: 0, y: -3, filter: 'blur(2px)', duration: D(0.16), ease: 'power1.out' })
			.call(() => {
				setCopyText(textNode, value, html);
			})
			.fromTo(textNode, { opacity: 0, y: 4, filter: 'blur(2px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: D(0.28), ease: 'power2.out' });
		return;
	}
	setCopyText(textNode, value, html);
}

/* 带切换动画的节点把文字放在内层 span 里，动画只动这一层 */
function ensureTextNode(node) {
	let textNode = node.querySelector(':scope > .i18n-text');
	if (!textNode) {
		textNode = document.createElement('span');
		textNode.className = 'i18n-text';
		node.textContent = '';
		node.append(textNode);
	}
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

/* 一个 data-i18n 节点的文案写入：data-i18n-attr 写属性，data-i18n-html 写 innerHTML，
   data-i18n-vars 是 JSON 的占位值，data-i18n-animate 切换时淡出淡入 */
function applyI18n(node, lang, animate = false) {
	const { i18n: key, i18nAttr: attr, i18nVars: vars } = node.dataset;
	const value = textIn(lang, key, vars && JSON.parse(vars));
	if (attr) {
		node.setAttribute(attr, value);
		return;
	}
	const html = node.hasAttribute('data-i18n-html');
	if (!node.hasAttribute('data-i18n-animate')) {
		setCopyText(node, value, html);
		return;
	}
	const textNode = ensureTextNode(node);
	if (animate) animateText(textNode, value, html);
	else setCopyText(textNode, value, html);
	updateToggle(node.querySelector(':scope > .i18n-toggle'), lang);
}

/* 给节点挂上 data-i18n 并立刻填入当前语言，此后每次切换语言的扫描都会覆盖它 */
export function localize(node, { key, vars, attr, html }) {
	node.dataset.i18n = key;
	if (vars) node.dataset.i18nVars = JSON.stringify(vars);
	else delete node.dataset.i18nVars;
	if (attr) node.dataset.i18nAttr = attr;
	if (html) node.setAttribute('data-i18n-html', '');
	applyI18n(node, currentLang);
	return node;
}

export async function setLanguage(lang, { animate = false, root = document } = {}) {
	currentLang = lang === 'zh' ? 'zh' : 'en';
	try {
		localStorage.setItem(LANG_KEY, currentLang);
	} catch {}
	await loadDict(currentLang);
	document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
	root.querySelectorAll('[data-i18n]').forEach(node => applyI18n(node, currentLang, animate));
	const globalBtn = $('#global-lang');
	if (globalBtn) {
		updateToggle(globalBtn, currentLang);
		replay(globalBtn, 'is-switching');
	}
	updateLanguageMenu(currentLang);
	window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: currentLang } }));
}

export const language = () => currentLang;

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

export function initBilingualCopy(root = document) {
	root.querySelectorAll('[data-i18n]').forEach(node => applyI18n(node, currentLang));
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
