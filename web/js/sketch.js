/* Ambient night sky behind the oracle: a field of slowly breathing
   stars and a faint wheel of sun-rays turning once per ~6 minutes.
   Kept deliberately dim — the cards are the light of this page. */
(function () {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let stars = [];

  new p5((p) => {
    p.setup = () => {
      p.pixelDensity(1);
      const c = p.createCanvas(p.windowWidth, p.windowHeight);
      c.parent("bg");
      p.frameRate(30);
      seed();
      if (reduced) p.noLoop();
    };

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
      seed();
    };

    function seed() {
      const n = Math.round((p.width * p.height) / 14000);
      stars = Array.from({ length: n }, () => ({
        x: p.random(p.width),
        y: p.random(p.height),
        r: p.random(0.4, 1.6),
        ph: p.random(p.TWO_PI),
        sp: p.random(0.15, 0.6),
      }));
    }

    p.draw = () => {
      p.clear();
      const t = p.frameCount / 30;

      // rays from a sun sunk just below the top edge
      p.push();
      p.translate(p.width / 2, -p.height * 0.25);
      p.rotate(t * 0.018);
      p.noStroke();
      for (let i = 0; i < 12; i++) {
        p.rotate(p.TWO_PI / 12);
        p.fill(212, 178, 98, 5);
        p.triangle(0, 0, -p.width * 0.05, p.height * 1.6, p.width * 0.05, p.height * 1.6);
      }
      p.pop();

      // stars
      p.noStroke();
      for (const s of stars) {
        const a = 105 + 90 * Math.sin(s.ph + t * s.sp);
        p.fill(230, 224, 205, a * 0.55);
        p.circle(s.x, s.y, s.r * 2);
      }
    };
  });
})();
