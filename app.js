(function () {
  'use strict';
  var D = window.KIRO || {};
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Локации: карта + список + карточка «Подключено» ---------- */
  function selectLoc(id) {
    var loc = (D.locs || []).filter(function (l) { return l.id === id; })[0];
    if (!loc || loc.soon) return;
    (D.locs || []).forEach(function (l) {
      var on = l.id === id;
      $$('.node[data-loc="' + l.id + '"]').forEach(function (el) {
        el.className = l.soon ? 'node soon' : (on ? 'node on' : 'node');
      });
      $$('.loc[data-loc="' + l.id + '"]').forEach(function (el) {
        el.className = l.soon ? 'loc soon' : (on ? 'loc on' : 'loc');
        if (!l.soon) el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      $$('[data-route="' + l.id + '"]').forEach(function (el) {
        el.setAttribute('class', l.soon ? 'route soon' : (on ? 'route on' : 'route'));
      });
      $$('[data-pkt="' + l.id + '"]').forEach(function (el) {
        el.setAttribute('class', l.soon ? 'pkt off' : (on ? 'pkt on' : 'pkt'));
      });
    });
    $$('[data-bind="loc-name"]').forEach(function (el) { el.textContent = loc.name; });
    $$('[data-bind="loc-ping"]').forEach(function (el) { el.textContent = loc.ping; });
  }
  $$('[data-loc]').forEach(function (el) {
    el.addEventListener('click', function () { selectLoc(el.getAttribute('data-loc')); });
  });

  /* ---------- Тарифы: переключатель периода ---------- */
  var planEls = $$('.plan');
  function selectPeriod(m) {
    var def = (D.periods || []).filter(function (p) { return p.m === m; })[0];
    if (!def) return;
    $$('[data-period]').forEach(function (b) {
      var on = +b.getAttribute('data-period') === m;
      b.className = on ? 'seg on' : 'seg';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    planEls.forEach(function (card, i) {
      var plan = (D.plans || [])[i];
      if (!plan) return;
      var v = plan.p[String(m)];
      var has = typeof v === 'number';
      var price = card.querySelector('[data-plan-price]');
      var per = card.querySelector('[data-plan-per]');
      var note = card.querySelector('[data-plan-note]');
      if (price) price.textContent = has ? v + ' ₽' : '—';
      if (per) per.textContent = has ? def.per : '';
      if (note) note.textContent = has ? (m > 1 ? '≈ ' + Math.round(v / m) + ' ₽ в месяц' : '') : 'нет периода 6 мес';
    });
  }
  $$('[data-period]').forEach(function (b) {
    b.addEventListener('click', function () { selectPeriod(+b.getAttribute('data-period')); });
  });

  /* ---------- FAQ-аккордеон ---------- */
  $$('[data-faq]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var i = btn.getAttribute('data-faq');
      var willOpen = btn.getAttribute('aria-expanded') !== 'true';
      $$('[data-faq]').forEach(function (b) {
        var j = b.getAttribute('data-faq');
        var open = willOpen && j === i;
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        var plus = b.querySelector('.plus');
        if (plus) plus.className = open ? 'plus on' : 'plus';
        var a = document.querySelector('[data-faq-a="' + j + '"]');
        if (a) a.hidden = !open;
      });
    });
  });
})();
