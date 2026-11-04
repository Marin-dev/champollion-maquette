// ---------- Navigation ----------
const nav = document.getElementById('nav');
const burger = nav.querySelector('.nav__burger');

const heroEl = document.getElementById('hero');
const onScroll = () => nav.classList.toggle('is-solid', heroEl.getBoundingClientRect().bottom < 64);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

burger.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  burger.setAttribute('aria-expanded', open);
});
nav.querySelectorAll('.nav__links a').forEach(a =>
  a.addEventListener('click', () => nav.classList.remove('is-open'))
);

// ---------- Hero : zoom vers l'œuvre puis révélation ----------
const heroArt = document.getElementById('heroArt');
const heroIntro = document.getElementById('heroIntro');
const heroReveal = document.getElementById('heroReveal');
const heroLabel = document.getElementById('heroLabel');
const heroCue = document.getElementById('heroCue');
const heroSpot = document.getElementById('heroSpot');
const labelTech = heroLabel.querySelector('.label__tech');

const clamp01 = v => Math.min(1, Math.max(0, v));
const range = (p, a, b) => clamp01((p - a) / (b - a));
const ease = t => 1 - Math.pow(1 - t, 3);

const updateHero = () => {
  const r = heroEl.getBoundingClientRect();
  const p = clamp01(-r.top / (r.height - window.innerHeight));

  // 0 → 0.35 : le titre s'efface, l'œuvre s'approche
  const intro = range(p, 0, 0.3);
  heroIntro.style.opacity = 1 - intro;
  heroIntro.style.transform = `translateY(${-intro * 60}px)`;
  heroCue.style.opacity = 1 - range(p, 0, 0.08);

  const zoom = ease(range(p, 0, 0.45));
  heroArt.style.transform = `translateY(${-zoom * 4}vh) scale(${1 + zoom * 0.16})`;

  // 0.2 → 0.4 : le cartel apparaît
  heroLabel.style.opacity = range(p, 0.18, 0.36);

  // 0.5 → 0.75 : révélation, l'œuvre redescend pour laisser place au texte
  const rev = ease(range(p, 0.5, 0.75));
  heroReveal.style.opacity = rev;
  heroReveal.style.transform = `translateY(${(1 - rev) * 30}px)`;
  heroReveal.classList.toggle('is-on', rev > 0.5);
  heroArt.style.transform = `translateY(${-zoom * 4 + rev * (innerWidth < 600 ? 19 : 11)}vh) scale(${1 + zoom * 0.16 - rev * 0.36})`;

  const revealed = p > 0.55;
  if (heroLabel.classList.contains('is-revealed') !== revealed) {
    heroLabel.classList.toggle('is-revealed', revealed);
    labelTech.textContent = revealed ? labelTech.dataset.after : labelTech.dataset.before;
  }
};
window.addEventListener('scroll', updateHero, { passive: true });
window.addEventListener('resize', updateHero);
updateHero();

// Le spot suit doucement la souris : la lumière bouge, l'œuvre ne brille jamais
heroEl.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  heroSpot.style.setProperty('--sx', 40 + (e.clientX / window.innerWidth) * 20 + '%');
  heroSpot.style.setProperty('--sy', 44 + (e.clientY / window.innerHeight) * 16 + '%');
});

// ---------- Manifeste : les mots s'allument au défilement ----------
const manifesto = document.querySelector('.reveal-words');
manifesto.innerHTML = manifesto.textContent
  .split(' ')
  .map(w => `<span class="w">${w}</span>`)
  .join(' ');
const words = manifesto.querySelectorAll('.w');

const lightWords = () => {
  const r = manifesto.getBoundingClientRect();
  const vh = window.innerHeight;
  const progress = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
  const lit = Math.round(progress * words.length);
  words.forEach((w, i) => w.classList.toggle('on', i < lit));
};
window.addEventListener('scroll', lightWords, { passive: true });
lightWords();

// ---------- Comparateur avant / après ----------
const stage = document.getElementById('compare');
const gloss = document.getElementById('compareGloss');
const handle = document.getElementById('compareHandle');
let split = 50;
let dragging = false;
let hovering = false;

const setSplit = pct => {
  split = Math.min(100, Math.max(0, pct));
  gloss.style.clipPath = `inset(0 ${100 - split}% 0 0)`;
  handle.style.left = split + '%';
  handle.setAttribute('aria-valuenow', Math.round(split));
};

const pctFromEvent = e => {
  const r = stage.getBoundingClientRect();
  return ((e.clientX - r.left) / r.width) * 100;
};

const moveLight = e => {
  const r = stage.getBoundingClientRect();
  stage.style.setProperty('--x', ((e.clientX - r.left) / r.width) * 100 + '%');
  stage.style.setProperty('--y', ((e.clientY - r.top) / r.height) * 100 + '%');
};

handle.addEventListener('pointerdown', e => {
  dragging = true;
  handle.setPointerCapture(e.pointerId);
});
handle.addEventListener('pointermove', e => { if (dragging) setSplit(pctFromEvent(e)); });
handle.addEventListener('pointerup', () => { dragging = false; });
stage.addEventListener('click', e => { if (!handle.contains(e.target)) setSplit(pctFromEvent(e)); });
stage.addEventListener('pointerenter', () => { hovering = true; });
stage.addEventListener('pointerleave', () => { hovering = false; });
stage.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') moveLight(e); });

handle.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') setSplit(split - 5);
  if (e.key === 'ArrowRight') setSplit(split + 5);
});

// Sans survol, la lumière dérive lentement pour montrer le reflet
let t = 0;
const drift = () => {
  if (!hovering) {
    t += 0.006;
    stage.style.setProperty('--x', 50 + Math.sin(t) * 30 + '%');
    stage.style.setProperty('--y', 40 + Math.cos(t * 0.8) * 18 + '%');
  }
  requestAnimationFrame(drift);
};
drift();
setSplit(50);

// ---------- Collection : filtres ----------
const filters = document.querySelectorAll('.filter');
const works = document.querySelectorAll('.work');
filters.forEach(btn => btn.addEventListener('click', () => {
  filters.forEach(b => b.classList.toggle('is-active', b === btn));
  const f = btn.dataset.filter;
  works.forEach(w => w.classList.toggle('is-hidden', f !== 'all' && w.dataset.cat !== f));
}));

// ---------- Espaces : mises en situation ----------
const spaces = {
  hotel: {
    title: 'Hôtellerie',
    text: "Lobbies, couloirs, chambres et suites. Des œuvres signées, en séries limitées, qui tiennent sous toutes les lumières — et une identité artistique cohérente d'un étage à l'autre.",
    list: ['Grands formats sans vitre, plus légers', 'Séries coordonnées par établissement', 'Aucun reflet sous les spots']
  },
  archi: {
    title: "Maisons d'architecte",
    text: "Murs nus, baies vitrées, lumière naturelle. L'œuvre se lit comme une peinture originale, sans miroir parasite, en dialogue avec la matière du lieu.",
    list: ['Formats sur mesure selon le projet', 'Matité en accord avec les matériaux bruts', "Sélection accompagnée avec l'architecte"]
  },
  office: {
    title: 'Sièges & bureaux',
    text: "Salles de conseil, accueils, espaces de réception. Une collection qui affirme une culture d'entreprise, lisible sous l'éclairage technique des bureaux.",
    list: ['Lisible sous néons et spots', "Communication d'entreprise & identité", 'Rotation possible des œuvres']
  },
  expo: {
    title: 'Expositions & événements',
    text: "Lieux de vente, salons, scénographies. Des images à l'impact pictural, parfaitement lisibles sous les projecteurs les plus durs.",
    list: ['Rendu impeccable sous projecteurs', 'Supports légers et transportables', 'Tirages photographiques grand format']
  }
};

const scenes = document.querySelectorAll('.scene');
const info = document.querySelector('.spaces__info');
const tabs = document.querySelectorAll('.space-tab');

tabs.forEach(tab => tab.addEventListener('click', () => {
  const key = tab.dataset.space;
  if (tab.classList.contains('is-active')) return;
  const s = spaces[key];
  tabs.forEach(t => {
    t.classList.toggle('is-active', t === tab);
    t.setAttribute('aria-selected', t === tab);
  });
  scenes.forEach(sc => sc.classList.toggle('is-active', sc.dataset.space === key));
  info.classList.add('is-swapping');
  setTimeout(() => {
    document.getElementById('spaceTitle').textContent = s.title;
    document.getElementById('spaceText').textContent = s.text;
    document.getElementById('spaceList').innerHTML = s.list.map(l => `<li>${l}</li>`).join('');
    info.classList.remove('is-swapping');
  }, 380);
}));

// ---------- Apparitions au défilement ----------
document.querySelectorAll('.section-head, .work, .process__steps li, .compare__stage, .scenes, .contact__card, .quote blockquote')
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
