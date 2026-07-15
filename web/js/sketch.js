/* Ambient night sky behind the oracle: a field of slowly breathing
   stars and a faint wheel of sun-rays turning once per ~6 minutes.
   Kept deliberately dim — the cards are the light of this page.
   Plain Canvas 2D, no library; throttled to 30fps. */
(function () {
	const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	document.getElementById("bg").append(canvas);

	const TAU = Math.PI * 2;
	const FRAME = 1000 / 30;
	let stars = [];
	let w = 0;
	let h = 0;

	function seed() {
		w = canvas.width = innerWidth;
		h = canvas.height = innerHeight;
		const n = Math.round((w * h) / 14000);
		stars = Array.from({ length: n }, () => ({
			x: Math.random() * w,
			y: Math.random() * h,
			r: 0.4 + Math.random() * 1.2,
			ph: Math.random() * TAU,
			sp: 0.15 + Math.random() * 0.45,
		}));
	}

	function draw(t) {
		ctx.clearRect(0, 0, w, h);

		// rays from a sun sunk just below the top edge
		ctx.save();
		ctx.translate(w / 2, -h * 0.25);
		ctx.rotate(t * 0.018);
		ctx.fillStyle = "rgb(212 178 98)";
		ctx.globalAlpha = 5 / 255;
		for (let i = 0; i < 12; i++) {
			ctx.rotate(TAU / 12);
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(-w * 0.05, h * 1.6);
			ctx.lineTo(w * 0.05, h * 1.6);
			ctx.fill();
		}
		ctx.restore();

		// stars
		ctx.fillStyle = "rgb(230 224 205)";
		for (const s of stars) {
			const a = 105 + 90 * Math.sin(s.ph + t * s.sp);
			ctx.globalAlpha = (a * 0.55) / 255;
			ctx.beginPath();
			ctx.arc(s.x, s.y, s.r, 0, TAU);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	let last = 0;
	function tick(now) {
		requestAnimationFrame(tick);
		if (now - last < FRAME) return;
		last = now;
		// 尺寸跟着帧走：也补上「预渲染时 viewport 还是 0×0」的初始状态
		if (w !== innerWidth || h !== innerHeight) seed();
		draw(now / 1000);
	}

	seed();
	draw(0); // 静态首帧：后台打开的页签在显示前就有一幅夜空
	if (reduced) {
		addEventListener("resize", () => {
			seed();
			draw(0);
		});
	} else {
		requestAnimationFrame(tick);
	}
})();
