// ---------- Outils ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = v => clamp(v, 0, 1);
const range = (p, a, b) => clamp01((p - a) / (b - a));
const ease = t => 1 - Math.pow(1 - t, 3);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Ressort amorti (paramètres « à la Apple » : response en secondes, damping 1 = sans rebond).
// Interruptible : changer la cible conserve la position et la vitesse courantes.
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
    // Intégration en petits pas pour rester stable quelle que soit la cadence d'affichage
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

// Projection de l'élan (fonction de décélération utilisée par UIScrollView)
const project = (velocity, rate = 0.99) => (velocity / 1000) * rate / (1 - rate);
// Résistance progressive au-delà d'une borne
const rubberband = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

// Un seul passage de défilement par image, partagé par toutes les sections
const scrollJobs = [];
let scrollQueued = false;
const runScrollJobs = () => { scrollQueued = false; scrollJobs.forEach(fn => fn()); };
const onScrollFrame = () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(runScrollJobs); } };
window.addEventListener('scroll', onScrollFrame, { passive: true });
window.addEventListener('resize', onScrollFrame);

// ---------- Navigation ----------
const nav = document.getElementById('nav');
const burger = nav.querySelector('.nav__burger');
const heroEl = document.getElementById('hero');

scrollJobs.push(() => nav.classList.toggle('is-solid', heroEl.getBoundingClientRect().bottom < 64));

const setMenu = open => {
  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
};
burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
nav.querySelectorAll('.nav__links a').forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

// ---------- Hero : zoom vers l'œuvre puis révélation ----------
const heroArt = document.getElementById('heroArt');
const heroIntro = document.getElementById('heroIntro');
const heroReveal = document.getElementById('heroReveal');
const heroLabel = document.getElementById('heroLabel');
const heroCue = document.getElementById('heroCue');
const heroSpot = document.getElementById('heroSpot');
const labelTech = heroLabel.querySelector('.label__tech');

const setLabel = revealed => {
  if (heroLabel.classList.contains('is-revealed') === revealed) return;
  heroLabel.classList.toggle('is-revealed', revealed);
  labelTech.textContent = revealed ? labelTech.dataset.after : labelTech.dataset.before;
};

// La progression affichée suit le défilement à travers un ressort critiquement amorti :
// les crans de molette deviennent un mouvement continu, sans rebond ni retard perceptible
const heroProgress = new Spring(0, { response: 0.22, damping: 1 }, p => renderHero(p));

const updateHero = () => {
  if (reducedMotion.matches) {
    // Mouvement réduit : pas de zoom ni de translation, on montre directement l'état révélé
    heroIntro.style.cssText = heroArt.style.transform = '';
    heroReveal.style.opacity = 1; heroReveal.style.transform = '';
    heroReveal.classList.add('is-on');
    heroLabel.style.opacity = 1;
    setLabel(true);
    return;
  }
  const r = heroEl.getBoundingClientRect();
  const p = clamp01(-r.top / (r.height - window.innerHeight));
  // Hors du hero (arrivée par une ancre, retour en haut), on se cale sans animer
  if (r.bottom < 0 || Math.abs(p - heroProgress.value) > 0.5) heroProgress.jump(p);
  else heroProgress.set(p);
};

// Une seule trajectoire, toujours dans le même sens : l'œuvre ne zoome pas puis dézoome,
// elle descend et se pose pendant que le texte de révélation arrive
const renderHero = p => {
  // 0 → 0.3 : le titre s'efface en montant, l'indication de défilement disparaît
  const intro = ease(range(p, 0, 0.3));
  heroIntro.style.opacity = 1 - intro;
  heroIntro.style.transform = `translate3d(0, ${-intro * 40}px, 0)`;
  heroCue.style.opacity = 1 - range(p, 0, 0.08);

  // 0.12 → 0.32 : le cartel apparaît
  heroLabel.style.opacity = range(p, 0.12, 0.32);

  // 0.28 → 0.75 : l'œuvre descend et se réduit légèrement ;
  // 0.55 → 0.92 : le texte de révélation monte dans l'espace qu'elle a libéré
  const move = ease(range(p, 0.28, 0.75));
  const rev = ease(range(p, 0.55, 0.92));
  heroReveal.style.opacity = rev;
  heroReveal.style.transform = `translate3d(0, ${(1 - rev) * 24}px, 0)`;
  heroReveal.classList.toggle('is-on', rev > 0.5);
  heroArt.style.transform = `translate3d(0, ${move * (innerWidth < 600 ? 19 : 11)}vh, 0) scale(${1 - move * 0.2})`;

  setLabel(p > 0.5);
};
scrollJobs.push(updateHero);

// Le spot suit la souris avec l'inertie d'un vrai projecteur : la lumière bouge, l'œuvre ne brille jamais
let spotDX = 0, spotDY = 0;
const renderSpot = () => { heroSpot.style.transform = `translate3d(${spotDX}vw, ${spotDY}vh, 0)`; };
const heroSpotX = new Spring(0, { response: 0.9 }, v => { spotDX = v; renderSpot(); });
const heroSpotY = new Spring(0, { response: 0.9 }, v => { spotDY = v; renderSpot(); });
heroEl.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  heroSpotX.set(((e.clientX / innerWidth) - 0.5) * 20);
  heroSpotY.set(((e.clientY / innerHeight) - 0.5) * 16);
});

// ---------- Manifeste : les mots s'allument au défilement ----------
const manifesto = document.querySelector('.reveal-words');
manifesto.setAttribute('aria-label', manifesto.textContent.trim());
manifesto.innerHTML = manifesto.textContent
  .trim()
  .split(' ')
  .map(w => `<span class="w" aria-hidden="true">${w}</span>`)
  .join(' ');
const words = manifesto.querySelectorAll('.w');
let litCount = -1;

scrollJobs.push(() => {
  const r = manifesto.getBoundingClientRect();
  const vh = window.innerHeight;
  const progress = clamp01((vh * 0.85 - r.top) / (r.height + vh * 0.35));
  const lit = reducedMotion.matches ? words.length : Math.round(progress * words.length);
  if (lit === litCount) return;
  litCount = lit;
  words.forEach((w, i) => w.classList.toggle('on', i < lit));
});

// ---------- Comparateur avant / après ----------
const stage = document.getElementById('compare');
const gloss = document.getElementById('compareGloss');
const handle = document.getElementById('compareHandle');

const renderSplit = v => {
  const shown = clamp(v, 0, 100);
  gloss.style.clipPath = `inset(0 ${100 - shown}% 0 0)`;
  handle.style.left = shown + '%';
  handle.setAttribute('aria-valuenow', Math.round(shown));
  handle.setAttribute('aria-valuetext', `${Math.round(shown)} % tirage brillant`);
};
// Critiquement amorti : aucun dépassement sur un simple clic
const splitSpring = new Spring(50, { response: 0.4, damping: 1 }, renderSplit);
renderSplit(50);

const pctAt = x => {
  const r = stage.getBoundingClientRect();
  return ((x - r.left) / r.width) * 100;
};

// Glisser n'importe où sur l'œuvre, en 1:1, en respectant le point de prise.
// Un appui bref sans déplacement = « aller ici », animé par ressort et interruptible.
let drag = null;
stage.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  // On repart de la valeur affichée, pas de la cible : saisir la poignée en vol l'arrête net
  splitSpring.jump(splitSpring.value);
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, split0: splitSpring.value, active: false, history: [] };
  stage.classList.add('is-pressed');
  if (e.pointerType === 'mouse' || handle.contains(e.target)) {
    drag.active = true;
    stage.setPointerCapture(e.pointerId);
  }
});

stage.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') moveLight(e);
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0;
  const dy = e.clientY - drag.y0;
  // Au toucher, on attend une intention horizontale nette (hystérésis ~10 px) avant de capturer
  if (!drag.active) {
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
    drag.active = true;
    stage.setPointerCapture(e.pointerId);
  }
  const width = stage.getBoundingClientRect().width;
  let v = drag.split0 + (dx / width) * 100;
  // Bords souples plutôt qu'un arrêt sec
  if (v < 0) v = rubberband(v, 100);
  if (v > 100) v = 100 + rubberband(v - 100, 100);
  splitSpring.jump(v);
  drag.history.push({ t: e.timeStamp, v });
  if (drag.history.length > 6) drag.history.shift();
});

const endDrag = e => {
  if (!drag || e.pointerId !== drag.id) return;
  stage.classList.remove('is-pressed');
  const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
  if (e.type === 'pointerup' && moved < 6 && !handle.contains(e.target)) {
    splitSpring.set(clamp(pctAt(e.clientX), 0, 100));
  } else if (drag.active) {
    // Vitesse au lâcher (en %/s), transmise au ressort : pas de couture entre le geste et l'animation
    // Seuls les mouvements des 100 dernières ms comptent : un doigt immobilisé avant de lâcher = vitesse nulle
    const h = drag.history.filter(s => e.timeStamp - s.t < 100);
    let vel = 0;
    if (h.length > 1) {
      const a = h[0], b = h[h.length - 1];
      if (b.t > a.t) vel = ((b.v - a.v) / (b.t - a.t)) * 1000;
    }
    const target = clamp(splitSpring.value + project(vel), 0, 100);
    splitSpring.set(target, vel);
  }
  drag = null;
};
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

handle.addEventListener('keydown', e => {
  const step = e.shiftKey ? 10 : 5;
  const map = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step };
  if (e.key in map) splitSpring.set(clamp(splitSpring.target + map[e.key], 0, 100));
  else if (e.key === 'Home') splitSpring.set(0);
  else if (e.key === 'End') splitSpring.set(100);
  else return;
  e.preventDefault();
});

// Lumière : deux ressorts indépendants (X et Y), elle suit la souris avec inertie et éclaire les deux côtés
const lightX = new Spring(30, { response: 0.45 }, v => stage.style.setProperty('--x', v + '%'));
const lightY = new Spring(30, { response: 0.45 }, v => stage.style.setProperty('--y', v + '%'));
let hovering = false;
function moveLight(e) {
  const r = stage.getBoundingClientRect();
  lightX.set(((e.clientX - r.left) / r.width) * 100);
  lightY.set(((e.clientY - r.top) / r.height) * 100);
}
stage.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hovering = true; });
stage.addEventListener('pointerleave', () => { hovering = false; });

// Sans survol, la lumière dérive lentement pour montrer le reflet — seulement si le comparateur est visible
let driftRaf = 0;
let driftT = 0;
const drift = () => {
  if (!hovering) {
    driftT += 0.006;
    lightX.jump(50 + Math.sin(driftT) * 30);
    lightY.jump(40 + Math.cos(driftT * 0.8) * 18);
  }
  driftRaf = requestAnimationFrame(drift);
};
new IntersectionObserver(([en]) => {
  cancelAnimationFrame(driftRaf); driftRaf = 0;
  if (en.isIntersecting && !reducedMotion.matches) drift();
}).observe(stage);

// ---------- Collection : filtres ----------
const filters = document.querySelectorAll('.filter');
const works = document.querySelectorAll('.work');
const gallery = document.getElementById('gallery');
let filterTimer = 0;
filters.forEach(btn => btn.addEventListener('click', () => {
  if (btn.classList.contains('is-active')) return;
  filters.forEach(b => {
    b.classList.toggle('is-active', b === btn);
    b.setAttribute('aria-pressed', b === btn);
  });
  const f = btn.dataset.filter;
  // Fondu court : la grille se recompose hors de la vue plutôt que de sauter
  clearTimeout(filterTimer);
  gallery.classList.add('is-filtering');
  filterTimer = setTimeout(() => {
    works.forEach(w => w.classList.toggle('is-hidden', f !== 'all' && w.dataset.cat !== f));
    gallery.classList.remove('is-filtering');
  }, reducedMotion.matches ? 0 : 180);
}));

// ---------- Espaces : mises en situation ----------
const spaces = {
  hotel: {
    title: 'Hôtellerie',
    text: "Halls, couloirs, chambres. Des séries limitées qui restent lisibles quel que soit l'éclairage, avec la même sélection d'un étage à l'autre.",
    list: ['Grands formats sans vitre, plus légers', 'Une série coordonnée par établissement', 'Pas de reflet sous les spots']
  },
  archi: {
    title: "Maisons d'architecte",
    text: "Murs nus, baies vitrées, lumière naturelle. L'œuvre se regarde comme une peinture, sans le reflet des fenêtres.",
    list: ['Formats sur mesure', 'Une surface mate qui va avec les matériaux bruts', "Sélection faite avec l'architecte"]
  },
  office: {
    title: 'Sièges & bureaux',
    text: "Salles de réunion, accueils, espaces de réception. Les œuvres restent lisibles sous l'éclairage des bureaux.",
    list: ['Lisible sous les néons et les spots', "Images choisies selon l'identité de l'entreprise", 'Œuvres faciles à changer']
  },
  expo: {
    title: 'Expositions & événements',
    text: "Salons, points de vente, scénographies. Les images restent lisibles sous des projecteurs puissants.",
    list: ['Pas de reflet sous les projecteurs', 'Supports légers, faciles à transporter', 'Tirages photographiques grand format']
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
  // Interruptible : un nouveau clic annule l'échange en cours au lieu de l'empiler
  clearTimeout(swapTimer);
  info.classList.add('is-swapping');
  swapTimer = setTimeout(() => {
    document.getElementById('spaceTitle').textContent = s.title;
    document.getElementById('spaceText').textContent = s.text;
    document.getElementById('spaceList').innerHTML = s.list.map(l => `<li>${l}</li>`).join('');
    info.classList.remove('is-swapping');
  }, reducedMotion.matches ? 0 : 220);
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
document.querySelectorAll('.section-head, .work, .process__steps li, .compare__stage, .proof__item, .scenes, .contact__card, .quote blockquote')
  .forEach(el => el.classList.add('reveal'));
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (en.isIntersecting) {
      en.target.classList.add('in');
      io.unobserve(en.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

reducedMotion.addEventListener('change', onScrollFrame);
runScrollJobs();
