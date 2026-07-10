const decoded = new Map();

const idle = cb => {
	if ('requestIdleCallback' in window) return requestIdleCallback(cb, { timeout: 1200 });
	return setTimeout(cb, 80);
};

export function cardImgAttrs(card, { loading = 'lazy', priority = 'auto' } = {}) {
	return `src="${card.img}" alt="${card.name}" loading="${loading}" decoding="async" fetchpriority="${priority}"`;
}

export function preloadImage(src, priority = 'auto') {
	if (!src) return Promise.resolve();
	if (decoded.has(src)) return decoded.get(src);
	const img = new Image();
	img.decoding = 'async';
	img.fetchPriority = priority;
	const done = new Promise(resolve => {
		img.onload = () => {
			const decode = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
			decode.finally(resolve);
		};
		img.onerror = resolve;
	});
	img.src = src;
	decoded.set(src, done);
	return done;
}

export function warmCards(cards, { priority = 'low', limit = 3 } = {}) {
	const queue = cards.filter(Boolean).slice(0, limit);
	if (!queue.length) return;
	idle(() => {
		for (const card of queue) preloadImage(card.img, priority);
	});
}
