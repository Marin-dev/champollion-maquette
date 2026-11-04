// ---------- Navigation mobile ----------
const nav = document.getElementById('nav');
const burger = nav.querySelector('.nav__burger');
burger.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  burger.setAttribute('aria-expanded', open);
});

// ---------- Formulaire : validation puis e-mail pré-rempli ----------
// Maquette statique : pas de back-end, la demande part par la messagerie du visiteur.
const form = document.getElementById('contactForm');
const done = document.getElementById('formDone');
const TO = 'contact@champollion.art';

const check = el => {
  const ok = el.type === 'checkbox' ? el.checked : el.value.trim() !== '' && el.checkValidity();
  const field = el.type === 'checkbox' ? form : el.closest('.cform__field');
  field.classList.toggle(el.type === 'checkbox' ? 'consent-invalid' : 'is-invalid', !ok);
  el.setAttribute('aria-invalid', !ok);
  return ok;
};

form.querySelectorAll('[required]').forEach(el =>
  el.addEventListener(el.type === 'checkbox' ? 'change' : 'blur', () => check(el))
);

form.addEventListener('submit', e => {
  e.preventDefault();
  const required = [...form.querySelectorAll('[required]')];
  const invalid = required.filter(el => !check(el));
  if (invalid.length) { invalid[0].focus(); return; }

  const d = new FormData(form);
  const opt = (label, key) => (d.get(key) || '').trim() ? [`${label} : ${d.get(key).trim()}`] : [];
  const lines = [
    `Profil : ${d.get('profil')}`,
    `Nom : ${d.get('nom').trim()}`,
    ...opt('Société', 'societe'),
    `E-mail : ${d.get('email').trim()}`,
    ...opt('Téléphone', 'tel'),
    ...opt('Lieu du projet', 'lieu'),
    '',
    d.get('message').trim()
  ];
  const subject = `${d.get('objet')} — ${d.get('nom')}`;
  window.location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;

  form.classList.add('is-sent');
  done.hidden = false;
  done.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
