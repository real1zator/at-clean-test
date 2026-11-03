/* ====== НАСТРОЙКИ — меняйте здесь ====== */
const CONFIG = {
  company: '[Название]',
  phone: '+70000000000',          // только цифры с +7, без пробелов
  phoneText: '+7 000 000-00-00',  // как показывать на сайте
  whatsapp: '70000000000',        // номер для WhatsApp без +
  prices: {
    gazelHour: 1000,  // газель, ₽/час
    moverHour: 600,   // один грузчик, ₽/час
    minHours: 2,      // минимальный заказ, часов
    perKm: 50         // по области, ₽/км от границы Калининграда (в одну сторону)
  }
};

/* Сколько часов и грузчиков для каждого объёма */
const PRESETS = {
  gazel:  { small: { h: 2, m: 0 }, medium: { h: 3, m: 0 }, large: { h: 5, m: 0 } },
  move:   { small: { h: 2, m: 1 }, medium: { h: 3, m: 2 }, large: { h: 5, m: 3 } },
  movers: { small: { h: 2, m: 2 }, medium: { h: 3, m: 2 }, large: { h: 4, m: 3 } }
};

/* Примерное расстояние по дороге от границы Калининграда, км.
   0 — сам Калининград. Уточните под свои маршруты. */
const PLACES = {
  'Калининград': 0,
  'Гурьевск': 2, 'Большое Исаково': 2, 'Малое Исаково': 3, 'Васильково': 3, 'Константиновка': 4,
  'Луговое': 5, 'Холмогоровка': 10, 'Петрово': 12, 'Ушаково': 15, 'Храброво': 18,
  'Светлый': 25, 'Зеленоградск': 25, 'Ладушкин': 25, 'Багратионовск': 30,
  'Светлогорск': 35, 'Пионерский': 35, 'Отрадное': 35, 'Приморск': 35, 'Гвардейск': 35,
  'Мамоново': 40, 'Балтийск': 45, 'Янтарный': 45, 'Донское': 45, 'Полесск': 45,
  'Знаменск': 50, 'Рыбачий': 55, 'Лесной': 60, 'Правдинск': 60,
  'Железнодорожный': 75, 'Морское': 80, 'Черняховск': 80,
  'Гусев': 105, 'Советск': 110, 'Озёрск': 115, 'Славск': 115, 'Неман': 120,
  'Нестеров': 140, 'Краснознаменск': 140
};
/* ====================================== */

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';
  const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  // Контакты
  $$('[data-company]').forEach((el) => { el.textContent = CONFIG.company; });
  $$('[data-phone-text]').forEach((el) => { el.textContent = CONFIG.phoneText; });
  $$('[data-phone-link]').forEach((el) => { el.href = 'tel:' + CONFIG.phone; });
  $$('[data-wa-link]').forEach((el) => {
    el.href = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent('Здравствуйте! Нужна перевозка по Калининграду / области.');
  });
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  // Населённые пункты: подсказки и поиск
  const places = Object.keys(PLACES).filter((n) => PLACES[n] >= 0 && /[а-яё]/i.test(n));
  $('#places').innerHTML = places.map((n) => '<option value="' + n + ', "></option>').join('');
  const placeIndex = places.map((n) => ({ name: n, key: norm(n), km: PLACES[n] }))
    .sort((a, b) => b.key.length - a.key.length); // длинные названия первыми («Большое Исаково» раньше «Исаково»)

  function findPlace(text) {
    const t = ' ' + norm(text) + ' ';
    if (t.trim() === '') return null;
    for (const p of placeIndex) {
      if (t.includes(' ' + p.key + ' ')) return p;
    }
    // «калининград» склоняется: «в калининграде», «калининградская»
    if (/ калинингр/.test(t)) return placeIndex.find((p) => p.km === 0);
    return null;
  }

  // Состояние калькулятора
  const state = { service: 'move', size: 'medium', area: 'city' };
  const form = $('#order');
  const kmField = $('.km', form);
  const kmInput = $('input[name="km"]', form);
  const fromInput = $('input[name="from"]', form);
  const toInput = $('input[name="to"]', form);
  const hint = $('[data-route-hint]');

  // Дата по умолчанию — завтра (по местному времени)
  const dateInput = $('input[name="date"]', form);
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  dateInput.min = iso(today);
  dateInput.value = iso(tomorrow);

  function press(group, attr, value) {
    $$('[' + attr + ']', group).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)));
  }
  function setArea(area) {
    state.area = area;
    press(form, 'data-area', area);
    kmField.hidden = area !== 'region';
  }

  // Адрес → направление и километры
  function applyRoute() {
    const a = findPlace(fromInput.value);
    const b = findPlace(toInput.value);
    const known = [a, b].filter(Boolean);
    if (!known.length) {
      hint.textContent = 'Начните вводить город или посёлок — расстояние подставится само';
      hint.classList.remove('is-found');
      return;
    }
    const far = known.reduce((x, y) => (y.km > x.km ? y : x));
    if (far.km === 0) {
      setArea('city');
      hint.textContent = 'По Калининграду — без доплаты за километры';
    } else {
      setArea('region');
      kmInput.value = far.km; // новый адрес всегда пересчитывает км
      hint.textContent = far.name + ' — около ' + far.km + ' км от границы Калининграда';
    }
    hint.classList.add('is-found');
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function calc() {
    const p = PRESETS[state.service][state.size];
    const P = CONFIG.prices;
    const hours = Math.max(p.h, P.minHours);
    const withCar = state.service !== 'movers';
    const perHour = (withCar ? P.gazelHour : 0) + p.m * P.moverHour;
    let km = 0;
    if (state.area === 'region') {
      km = Math.min(300, Math.max(0, parseInt(kmInput.value, 10) || 0));
    }
    const kmCost = withCar ? km * P.perKm : 0;
    const total = hours * perHour + kmCost;

    const movers = p.m + ' ' + plural(p.m, 'грузчик', 'грузчика', 'грузчиков');
    const what = state.service === 'gazel' ? 'Газель'
      : state.service === 'movers' ? movers
      : 'Газель + ' + movers;
    let detail = what + ', ~' + hours + ' ' + plural(hours, 'час', 'часа', 'часов') + ' × ' + fmt(perHour);
    if (kmCost) detail += ' + ' + km + ' км × ' + P.perKm + ' ₽';

    $('[data-total]').textContent = 'от ' + fmt(total);
    $('[data-calc-detail]').textContent = detail;
    return { total, detail, km: withCar ? km : 0 };
  }

  // Кнопки внутри формы
  form.addEventListener('click', (e) => {
    const b = e.target.closest('button[type="button"]');
    if (!b) return;
    if (b.dataset.service) { state.service = b.dataset.service; press(form, 'data-service', state.service); }
    if (b.dataset.size) { state.size = b.dataset.size; press(form, 'data-size', state.size); }
    if (b.dataset.area) {
      setArea(b.dataset.area);
      if (state.area === 'region' && !(parseInt(kmInput.value, 10) > 0)) kmInput.value = 30;
    }
    calc();
  });

  // Пересчёт при вводе адреса и километров
  [fromInput, toInput].forEach((inp) => {
    inp.addEventListener('input', () => { applyRoute(); calc(); });
    inp.addEventListener('change', () => { applyRoute(); calc(); });
  });
  kmInput.addEventListener('input', calc);

  // Плитки услуг заполняют форму
  $$('[data-pick-service]').forEach((a) => a.addEventListener('click', () => {
    state.service = a.dataset.pickService; state.size = a.dataset.pickSize;
    press(form, 'data-service', state.service); press(form, 'data-size', state.size);
    calc();
    setTimeout(() => fromInput.focus({ preventScroll: true }), 400);
  }));

  // Маска телефона
  const phone = $('input[name="phone"]', form);
  phone.addEventListener('input', () => {
    let d = phone.value.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (d && !d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    const p = d.slice(1);
    let out = d ? '+7' : '';
    if (p.length) out += ' ' + p.slice(0, 3);
    if (p.length > 3) out += ' ' + p.slice(3, 6);
    if (p.length > 6) out += '-' + p.slice(6, 8);
    if (p.length > 8) out += '-' + p.slice(8, 10);
    phone.value = out;
    phone.closest('.field').classList.remove('is-error');
  });

  // Отправка заявки в WhatsApp
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const note = $('[data-order-note]');
    const digits = phone.value.replace(/\D/g, '');
    const field = phone.closest('.field');
    if (digits.length !== 11) {
      field.classList.add('is-error'); phone.focus();
      note.classList.remove('is-ok');
      note.textContent = 'Укажите телефон полностью, чтобы мы могли перезвонить';
      return;
    }
    field.classList.remove('is-error');
    const r = calc();
    const v = (n) => ($('[name="' + n + '"]', form).value || '—').trim();
    const serviceName = { gazel: 'Газель', move: 'Переезд', movers: 'Грузчики' }[state.service];
    const sizeName = { small: 'немного вещей', medium: '1–2 комнаты', large: '3+ комнаты' }[state.size];
    const d = dateInput.value ? dateInput.value.split('-').reverse().join('.') : '—';
    const text = [
      'Заявка с сайта',
      'Услуга: ' + serviceName + ', ' + sizeName,
      'Откуда: ' + v('from'),
      'Куда: ' + v('to') + (r.km ? ' (по области, ~' + r.km + ' км от границы)' : ''),
      'Когда: ' + d + ' в ' + v('time'),
      'Что везём: ' + v('comment'),
      'Расчёт: ' + r.detail + ' = от ' + fmt(r.total),
      'Имя: ' + v('name'),
      'Телефон: ' + phone.value
    ].join('\n');
    window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    note.textContent = 'Заявка готова — отправьте сообщение в WhatsApp. Или позвоните: ' + CONFIG.phoneText;
    note.classList.add('is-ok');
  });

  // Подсветка вкладок нижнего меню
  const tabs = $$('.tabbar__item[href^="#"]').filter((a) => a.getAttribute('href').length > 1);
  const sections = tabs.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        tabs.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));
  }

  calc();

  // Установка на главный экран (PWA)
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
