// ---------- Outils ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Ressort amorti, interruptible : changer la cible conserve position et vitesse.
class Spring {
  constructor(value, { response = 0.35, damping = 1 } = {}, onUpdate = () => {}) {
    this.value = this.target = value;
    this.velocity = 0;
    this.k = Math.pow((2 * Math.PI) / response, 2);
    this.c = (4 * Math.PI * damping) / response;
    this.onUpdate = onUpdate;
    this.raf = 0;
    this.last = 0;
  }
  set(target, velocity) {
    this.target = target;
    if (velocity !== undefined) this.velocity = velocity;
    if (reducedMotion.matches) return this.jump(target);
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); }
  }
  jump(value) {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.value = this.target = value; this.velocity = 0;
    this.onUpdate(value);
  }
  tick = now => {
    let dt = Math.min(0.064, (now - this.last) / 1000);
    this.last = now;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      const a = -this.k * (this.value - this.target) - this.c * this.velocity;
      this.velocity += a * h;
      this.value += this.velocity * h;
      dt -= h;
    }
    if (Math.abs(this.velocity) < 0.01 && Math.abs(this.value - this.target) < 0.01) {
      this.value = this.target; this.velocity = 0; this.raf = 0;
    } else {
      this.raf = requestAnimationFrame(this.tick);
    }
    this.onUpdate(this.value);
  };
}
const project = (velocity, rate = 0.99) => (velocity / 1000) * rate / (1 - rate);
const rubberband = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

// ---------- Navigation ----------
const nav = document.getElementById('nav');
const burger = nav.querySelector('.nav__burger');
const setMenu = open => {
  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
};
burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
nav.querySelectorAll('.nav__links a').forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

// ---------- Comparateur ----------
const stage = document.getElementById('compare');
if (stage) {
  const gloss = document.getElementById('compareGloss');
  const handle = document.getElementById('compareHandle');

  const renderSplit = v => {
    const shown = clamp(v, 0, 100);
    gloss.style.clipPath = `inset(0 ${100 - shown}% 0 0)`;
    handle.style.left = shown + '%';
    handle.setAttribute('aria-valuenow', Math.round(shown));
    handle.setAttribute('aria-valuetext', `${Math.round(shown)} % tirage brillant`);
  };
  const split = new Spring(50, { response: 0.4 }, renderSplit);
  renderSplit(50);
  const pctAt = x => { const r = stage.getBoundingClientRect(); return ((x - r.left) / r.width) * 100; };

  let drag = null;
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    split.jump(split.value);
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, s0: split.value, active: false, hist: [] };
    stage.classList.add('is-pressed');
    if (e.pointerType === 'mouse' || handle.contains(e.target)) { drag.active = true; stage.setPointerCapture(e.pointerId); }
  });
  stage.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') moveLight(e);
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.active) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      drag.active = true; stage.setPointerCapture(e.pointerId);
    }
    let v = drag.s0 + (dx / stage.getBoundingClientRect().width) * 100;
    if (v < 0) v = rubberband(v, 100);
    if (v > 100) v = 100 + rubberband(v - 100, 100);
    split.jump(v);
    drag.hist.push({ t: e.timeStamp, v });
    if (drag.hist.length > 6) drag.hist.shift();
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    stage.classList.remove('is-pressed');
    const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
    if (e.type === 'pointerup' && moved < 6 && !handle.contains(e.target)) {
      split.set(clamp(pctAt(e.clientX), 0, 100));
    } else if (drag.active) {
      const h = drag.hist.filter(s => e.timeStamp - s.t < 100);
      let vel = 0;
      if (h.length > 1) { const a = h[0], b = h[h.length - 1]; if (b.t > a.t) vel = ((b.v - a.v) / (b.t - a.t)) * 1000; }
      split.set(clamp(split.value + project(vel), 0, 100), vel);
    }
    drag = null;
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  handle.addEventListener('keydown', e => {
    const step = e.shiftKey ? 10 : 5;
    const map = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step };
    if (e.key in map) split.set(clamp(split.target + map[e.key], 0, 100));
    else if (e.key === 'Home') split.set(0);
    else if (e.key === 'End') split.set(100);
    else return;
    e.preventDefault();
  });

  // La lumière suit la souris ; sinon elle dérive lentement pour montrer le reflet
  const lx = new Spring(30, { response: 0.45 }, v => stage.style.setProperty('--x', v + '%'));
  const ly = new Spring(30, { response: 0.45 }, v => stage.style.setProperty('--y', v + '%'));
  let hovering = false;
  function moveLight(e) {
    const r = stage.getBoundingClientRect();
    lx.set(((e.clientX - r.left) / r.width) * 100);
    ly.set(((e.clientY - r.top) / r.height) * 100);
  }
  stage.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hovering = true; });
  stage.addEventListener('pointerleave', () => { hovering = false; });
  let raf = 0, t = 0;
  const drift = () => {
    if (!hovering) { t += 0.006; lx.jump(50 + Math.sin(t) * 30); ly.jump(40 + Math.cos(t * 0.8) * 18); }
    raf = requestAnimationFrame(drift);
  };
  new IntersectionObserver(([en]) => {
    cancelAnimationFrame(raf); raf = 0;
    if (en.isIntersecting && !reducedMotion.matches) drift();
  }).observe(stage);
}

// ---------- En situation : onglets ----------
const spaces = {
  hotel: {
    title: 'Hôtellerie',
    text: "Halls, couloirs, chambres. Des séries qui restent lisibles quel que soit l'éclairage, avec la même sélection d'un étage à l'autre.",
    list: ['Grands formats sans vitre, plus légers', 'Une série coordonnée par établissement', 'Pas de reflet sous les spots']
  },
  archi: {
    title: "Maisons d'architecte",
    text: "Murs nus, baies vitrées, lumière naturelle. L'œuvre se regarde comme une peinture, sans le reflet des fenêtres.",
    list: ['Formats sur mesure', 'Une surface mate qui va avec les matériaux bruts', "Sélection faite avec l'architecte"]
  },
  office: {
    title: 'Sièges et bureaux',
    text: "Salles de réunion, accueils, espaces de réception. Les images restent lisibles sous l'éclairage des bureaux.",
    list: ['Lisible sous les néons et les spots', "Images choisies selon l'identité de l'entreprise", 'Tirages faciles à changer']
  },
  expo: {
    title: 'Expositions et événements',
    text: 'Salons, points de vente, scénographies. Les images restent lisibles sous des projecteurs puissants.',
    list: ['Pas de reflet sous les projecteurs', 'Supports légers, faciles à transporter', 'Tirages grand format']
  }
};
const scenes = document.querySelectorAll('.scene');
const info = document.querySelector('.spaces__info');
const tabs = [...document.querySelectorAll('.space-tab')];
let swapTimer = 0;
const selectSpace = tab => {
  if (tab.classList.contains('is-active')) return;
  const key = tab.dataset.space;
  const s = spaces[key];
  tabs.forEach(t => {
    const on = t === tab;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
  });
  scenes.forEach(sc => sc.classList.toggle('is-active', sc.dataset.space === key));
  clearTimeout(swapTimer);
  info.classList.add('is-swapping');
  swapTimer = setTimeout(() => {
    document.getElementById('spaceTitle').textContent = s.title;
    document.getElementById('spaceText').textContent = s.text;
    document.getElementById('spaceList').innerHTML = s.list.map(l => `<li>${l}</li>`).join('');
    info.classList.remove('is-swapping');
  }, reducedMotion.matches ? 0 : 200);
};
tabs.forEach((tab, i) => {
  tab.tabIndex = tab.classList.contains('is-active') ? 0 : -1;
  tab.addEventListener('click', () => selectSpace(tab));
  tab.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const next = tabs[(i + d + tabs.length) % tabs.length];
    next.focus();
    selectSpace(next);
  });
});

// ---------- Apparitions au défilement ----------
document.querySelectorAll('.head, .compare, .steps, .tile, .scenes, .offer__body, .contact')
  .forEach(el => el.classList.add('reveal'));
const io = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
