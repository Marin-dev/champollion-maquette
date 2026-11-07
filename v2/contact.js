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

// ---------- Formulaire ----------
// Maquette statique sans serveur : la demande part par la messagerie du visiteur.
const form = document.getElementById('contactForm');
const done = document.getElementById('formDone');
const TO = 'contact@champollion.art';

const check = el => {
  const isBox = el.type === 'checkbox';
  const ok = isBox ? el.checked : el.value.trim() !== '' && el.checkValidity();
  if (isBox) form.classList.toggle('consent-invalid', !ok);
  else el.closest('.cform__field').classList.toggle('is-invalid', !ok);
  el.setAttribute('aria-invalid', !ok);
  return ok;
};
form.querySelectorAll('[required]').forEach(el => {
  if (el.type === 'checkbox') { el.addEventListener('change', () => check(el)); return; }
  el.addEventListener('blur', () => { if (el.value.trim() !== '') check(el); });
  el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') check(el); });
});

form.addEventListener('submit', e => {
  e.preventDefault();
  const invalid = [...form.querySelectorAll('[required]')].filter(el => !check(el));
  if (invalid.length) { invalid[0].focus(); return; }

  const d = new FormData(form);
  const val = key => (d.get(key) || '').trim();
  const opt = (label, key) => val(key) ? [`${label} : ${val(key)}`] : [];
  const lines = [
    `Intérêt : ${val('interet')}`,
    `Profil : ${val('profil')}`,
    `Nom : ${val('nom')}`,
    ...opt('Société', 'societe'),
    `E-mail : ${val('email')}`,
    ...opt('Téléphone', 'tel'),
    '',
    val('message')
  ];
  const subject = `Champollion · ${val('interet')} · ${val('nom')}`;
  location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;

  form.classList.add('is-sent');
  done.hidden = false;
  done.focus({ preventScroll: true });
});
