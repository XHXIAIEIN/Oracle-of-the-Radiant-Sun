/* DOM 与动效小工具 */

export const $ = (s, el = document) => el.querySelector(s);
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const D = x => (REDUCED ? 0.001 : x); // duration helper
export const sleep = ms => new Promise(r => setTimeout(r, REDUCED ? 0 : ms));

/* the phone layout breakpoint — one truth shared by CSS (700px media
   queries) and the JS that arranges the table differently on a phone */
export const MOBILE = matchMedia('(max-width: 700px)');

export const currentScreen = () => document.querySelector('.screen:not([hidden])');

/* 拼 HTML 字符串时，一切不可信文本（用户输入、URL 参数、数据文案）都过这里 */
export const esc = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

/* 重放一遍由 cls 触发的 CSS 动画：摘下类名，强制回流，再戴上 */
export function replay(node, cls) {
	node.classList.remove(cls);
	void node.offsetWidth;
	node.classList.add(cls);
}

export function scrollScreenToTop(screen = currentScreen(), behavior = REDUCED ? 'auto' : 'smooth') {
	screen?.scrollTo({ top: 0, left: 0, behavior });
}

export const el = (tag, cls, html) => {
	const n = document.createElement(tag);
	if (cls) n.className = cls;
	if (html != null) n.innerHTML = html;
	return n;
};

export function cryptoShuffle(a) {
	for (let i = a.length - 1; i > 0; i--) {
		const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
		[a[i], a[j]] = [a[j], a[i]];
	}
}

export function swapScreen(fn) {
	const go = () => {
		fn();
		const screen = currentScreen();
		scrollScreenToTop(screen); // 每一屏都是新的一页，从顶端读起
		import('./scroll-motion.js').then(({ animateScreenIn }) => animateScreenIn(screen));
	};
	if (document.startViewTransition && !REDUCED) document.startViewTransition(go);
	else go();
}

export function popIn(nodes) {
	gsap.fromTo(nodes, { opacity: 0, y: 10, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: D(0.45), stagger: REDUCED ? 0 : 0.09, ease: 'back.out(1.6)' });
}

/* 发牌式入场：自上方逐张落下，带一点手发的歪斜，落定即正 */
export function dealIn(nodes) {
	gsap.fromTo(
		nodes,
		{ opacity: 0, y: -16, rotation: () => gsap.utils.random(-6, 6) },
		{ opacity: 1, y: 0, rotation: 0, duration: D(0.42), stagger: REDUCED ? 0 : 0.1, ease: 'power2.out' }
	);
}
