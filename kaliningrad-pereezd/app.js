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
    perKm: 50         // по области, ₽/км от границы Калининграда
  }
};

/* Пресеты: сколько часов и грузчиков для каждого объёма */
const PRESETS = {
  gazel:  { small: { h: 2, m: 0 }, medium: { h: 3, m: 0 }, large: { h: 5, m: 0 } },
  move:   { small: { h: 2, m: 1 }, medium: { h: 3, m: 2 }, large: { h: 5, m: 3 } },
  movers: { small: { h: 2, m: 2 }, medium: { h: 3, m: 2 }, large: { h: 4, m: 3 } }
};
/* ====================================== */

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = (n) => n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';

  // Контакты
  $$('[data-company]').forEach((el) => { el.textContent = CONFIG.company; });
  $$('[data-phone-text]').forEach((el) => { el.textContent = CONFIG.phoneText; });
  $$('[data-phone-link]').forEach((el) => { el.href = 'tel:' + CONFIG.phone; });
  $$('[data-wa-link]').forEach((el) => {
    el.href = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent('Здравствуйте! Нужна перевозка.');
  });
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  // Состояние калькулятора
  const state = { service: 'move', size: 'medium', area: 'city' };
  const form = $('#order');
  const kmField = $('.km', form);
  const kmInput = $('input[name="km"]', form);

  // Дата по умолчанию — завтра
  const dateInput = $('input[name="date"]', form);
  const t = new Date(); t.setDate(t.getDate() + 1);
  dateInput.value = t.toISOString().slice(0, 10);
  dateInput.min = new Date().toISOString().slice(0, 10);

  function press(group, attr, value) {
    $$('[' + attr + ']', group).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)));
  }

  function calc() {
    const p = PRESETS[state.service][state.size];
    const P = CONFIG.prices;
    const hours = Math.max(p.h, P.minHours);
    const perHour = (state.service === 'movers' ? 0 : P.gazelHour) + p.m * P.moverHour;
    let total = hours * perHour;
    const km = state.area === 'region' ? Math.max(0, parseInt(kmInput.value, 10) || 0) : 0;
    total += km * P.perKm;

    const what = state.service === 'gazel' ? 'Газель'
      : state.service === 'movers' ? p.m + ' ' + plural(p.m, 'грузчик', 'грузчика', 'грузчиков')
      : 'Газель + ' + p.m + ' ' + plural(p.m, 'грузчик', 'грузчика', 'грузчиков');
    let detail = what + ', ~' + hours + ' ' + plural(hours, 'час', 'часа', 'часов') + ' × ' + fmt(perHour);
    if (km) detail += ' + ' + km + ' км × ' + P.perKm + ' ₽';

    $('[data-total]').textContent = 'от ' + fmt(total);
    $('[data-calc-detail]').textContent = detail;
    return { total, detail, km };
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  form.addEventListener('click', (e) => {
    const b = e.target.closest('button[type="button"]');
    if (!b) return;
    if (b.dataset.service) { state.service = b.dataset.service; press(b.parentElement, 'data-service', state.service); }
    if (b.dataset.size) { state.size = b.dataset.size; press(b.parentElement, 'data-size', state.size); }
    if (b.dataset.area) {
      state.area = b.dataset.area; press(b.parentElement, 'data-area', state.area);
      kmField.hidden = state.area !== 'region';
    }
    calc();
  });
  kmInput.addEventListener('input', calc);

  // Карточки услуг заполняют форму
  $$('[data-pick-service]').forEach((a) => a.addEventListener('click', () => {
    state.service = a.dataset.pickService; state.size = a.dataset.pickSize;
    press(form, 'data-service', state.service); press(form, 'data-size', state.size);
    calc();
  }));

  // Отправка заявки в WhatsApp
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const phone = $('input[name="phone"]', form);
    const digits = phone.value.replace(/\D/g, '');
    const field = phone.closest('.field');
    if (digits.length < 10) {
      field.classList.add('is-error'); phone.focus();
      $('[data-order-note]').textContent = 'Укажите телефон, чтобы мы могли перезвонить';
      return;
    }
    field.classList.remove('is-error');
    const r = calc();
    const v = (n) => ($('[name="' + n + '"]', form).value || '—').trim();
    const serviceName = { gazel: 'Газель', move: 'Переезд', movers: 'Грузчики' }[state.service];
    const sizeName = { small: 'немного вещей', medium: '1–2 комнаты', large: '3+ комнаты' }[state.size];
    const text = [
      'Заявка с сайта',
      'Услуга: ' + serviceName + ', ' + sizeName,
      'Откуда: ' + v('from'),
      'Куда: ' + v('to') + (state.area === 'region' ? ' (область, ~' + r.km + ' км)' : ''),
      'Когда: ' + v('date') + ' ' + v('time'),
      'Расчёт: ' + r.detail + ' = от ' + fmt(r.total),
      'Имя: ' + v('name'),
      'Телефон: ' + phone.value
    ].join('\n');
    window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    const note = $('[data-order-note]');
    note.textContent = 'Заявка готова — отправьте сообщение в WhatsApp. Или позвоните: ' + CONFIG.phoneText;
    note.classList.add('is-ok');
  });

  // Подсветка вкладок нижнего меню
  const tabs = $$('.tabbar__item[href^="#"]');
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
