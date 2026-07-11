/* Page-level scroll polish: native smooth scrolling plus gentle reveal-on-enter.
   The library rebuilds its DOM often, so this watches for new pieces instead of
   relying on one startup pass. */

import { currentScreen, REDUCED, scrollScreenToTop } from './dom.js';

const REVEAL_SELECTOR = [
	'.masthead',
	'.home-intro',
	'.method',
	'.lib-open',
	'.home-foot',
	'.ritual-head',
	'.setup',
	'.stage-wrap',
	'.panel',
	'.lib-filters',
	'.lib-sec__cap',
	'.lib-card',
	'.card-dialog__grid',
].join(',');

const revealSeen = new WeakSet();
const screenSeen = new WeakSet();

let revealObserver;

function revealDelay(node) {
	if (node.classList.contains('method')) return [...node.parentElement.children].indexOf(node) * 70;
	if (node.classList.contains('lib-card')) return Math.min([...node.parentElement.children].indexOf(node) * 18, 220);
	return 0;
}

function registerReveal(node) {
	if (!(node instanceof HTMLElement) || revealSeen.has(node)) return;
	if (node.hidden || node.closest('[hidden]')) return;
	revealSeen.add(node);
	node.dataset.scrollReveal = '';
	const delay = revealDelay(node);
	if (delay) node.style.setProperty('--scroll-reveal-delay', `${delay}ms`);
	revealObserver?.observe(node);
}

function scan(root = document) {
	if (root instanceof HTMLElement && root.matches(REVEAL_SELECTOR)) registerReveal(root);
	root.querySelectorAll?.(REVEAL_SELECTOR).forEach(registerReveal);
}

export function settleToPageTop({ instant = false } = {}) {
	const screen = currentScreen();
	if (!screen || screen.scrollTop <= 1) return;
	scrollScreenToTop(screen, instant || REDUCED ? 'auto' : 'smooth');
}

export function animateScreenIn(screen) {
	if (REDUCED || !screen || screenSeen.has(screen)) return;
	screenSeen.add(screen);
	const pieces = [...screen.querySelectorAll(':scope > header, :scope > .masthead, :scope > .home-intro, :scope > nav, :scope > button, :scope > footer, :scope > .ritual-body, :scope > .lib-filters, :scope > .lib-secs')].filter(
		n => !n.hidden
	);
	if (!pieces.length) return;
	gsap.fromTo(
		pieces,
		{ opacity: 0, y: 14, filter: 'blur(4px)' },
		{ opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.55, stagger: 0.055, ease: 'power2.out', clearProps: 'opacity,transform,filter' }
	);
}

export function initScrollMotion() {
	if (!REDUCED && 'IntersectionObserver' in window) {
		revealObserver = new IntersectionObserver(
			entries => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					entry.target.classList.add('is-in-view');
					revealObserver.unobserve(entry.target);
				}
			},
			{ rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
		);
	}

	if (REDUCED || !revealObserver) return;
	scan();
	new MutationObserver(records => {
		for (const r of records) {
			r.addedNodes.forEach(node => scan(node));
		}
	}).observe(document.body, { childList: true, subtree: true });
}
