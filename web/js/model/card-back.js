/* the card back: a radiant sun on the night sky */
export const BACK_SVG = `
<svg viewBox="0 0 300 446" xmlns="http://www.w3.org/2000/svg">
 <rect width="300" height="446" rx="10" fill="#191e33"/>
 <rect x="9" y="9" width="282" height="428" rx="6" fill="none" stroke="#c9a44a" stroke-width="1.4" opacity=".85"/>
 <rect x="16" y="16" width="268" height="414" rx="4" fill="none" stroke="#c9a44a" stroke-width=".6" opacity=".5"/>
 <g transform="translate(150,223)" stroke="#c9a44a" fill="none">
  <circle r="46" stroke-width="1.3"/>
  <circle r="38" stroke-width=".5" opacity=".6"/>
  <g stroke-width="1.1">${Array.from({ length: 16 }, (_, i) => {
		const a = (i * Math.PI) / 8,
			l = i % 2 ? 62 : 74;
		return `<line x1="${(50 * Math.cos(a)).toFixed(1)}" y1="${(50 * Math.sin(a)).toFixed(1)}" x2="${(l * Math.cos(a)).toFixed(1)}" y2="${(l * Math.sin(a)).toFixed(1)}"/>`;
}).join('')}</g>
  <circle r="3.5" fill="#c9a44a" stroke="none"/>
 </g>
 <text x="150" y="404" text-anchor="middle" font-family="Georgia,serif" font-size="13" letter-spacing="4" fill="#c9a44a" opacity=".8">RADIANT SUN</text>
</svg>`;
