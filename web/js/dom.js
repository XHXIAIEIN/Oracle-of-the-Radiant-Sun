/* DOM 与动效小工具 */

export const $ = (s, el = document) => el.querySelector(s);
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const D = x => (REDUCED ? 0.001 : x); // duration helper
export const sleep = ms => new Promise(r => setTimeout(r, REDUCED ? 0 : ms));

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
		scrollTo(0, 0); // 每一屏都是新的一页，从顶端读起
	};
	if (document.startViewTransition && !REDUCED) document.startViewTransition(go);
	else go();
}

export function popIn(nodes) {
	gsap.fromTo(nodes, { opacity: 0, y: 10, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: D(0.45), stagger: 0.09, ease: 'back.out(1.6)' });
}
