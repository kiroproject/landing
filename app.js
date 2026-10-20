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
    if (window.KIRO_globeFocus) window.KIRO_globeFocus(id);
    $$('[data-bind="loc-ping"]').forEach(function (el) { el.textContent = loc.ping ? (loc.pingPrefix !== undefined ? loc.pingPrefix : '≈ ') + loc.ping + ' мс' : '—'; });
  }
  window.KIRO_selectLoc = selectLoc;

  /* вывод пинга узла в список, карточку «Подключено» и подписи на глобусе */
  function setPing(loc, ms, prefix, title) {
    loc.ping = ms; loc.pingPrefix = prefix;
    $$('.loc[data-loc="' + loc.id + '"] > .mono:last-child').forEach(function (el) {
      var dot = el.querySelector('.live');
      el.textContent = ''; if (dot) el.appendChild(dot);
      el.appendChild(document.createTextNode(prefix + ms + ' мс'));
      el.title = title || '';
    });
    if (document.querySelector('.loc.on[data-loc="' + loc.id + '"]'))
      $$('[data-bind="loc-ping"]').forEach(function (el) { el.textContent = prefix + ms + ' мс'; });
    if (window.KIRO_globeSetPing) window.KIRO_globeSetPing(loc.id, ms);
  }

  /* ---------- Расчётный пинг по расстоянию ----------
     Средние значения (loc.ping) измерены из города D.pingRef. Для посетителя из другого города
     пинг сдвигается на разницу расстояний до узла: ~0,016 мс на км (свет в оптоволокне ≈ 200 км/мс,
     туда-обратно, маршрут в ~1,6 раза длиннее прямой). Для узлов без среднего — base + k·d. */
  var PING_K = 0.016, PING_BASE = 8;
  function distKm(aLat, aLon, bLat, bLon) {
    var r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function estimatePing(lat, lon, city) {
    var ref = D.pingRef, est = {};
    var locs = (D.locs || []).filter(function (l) { return !l.soon && typeof l.lat === 'number'; });
    locs.forEach(function (l) { if (l.ping0 === undefined) l.ping0 = l.ping || 0; });
    // 1) узлы со средним пингом: сдвиг на разницу расстояний
    locs.forEach(function (l) {
      if (!l.ping0 || !ref) return;
      var d = distKm(lat, lon, l.lat, l.lon);
      est[l.id] = Math.max(PING_BASE + PING_K * d, l.ping0 + PING_K * (d - distKm(ref.lat, ref.lon, l.lat, l.lon)));
    });
    // 2) узлы без среднего (US): трафик из РФ идёт через Европу — через ближайший к узлу узел из п.1
    locs.forEach(function (l) {
      if (est[l.id] !== undefined) return;
      var best = PING_BASE + PING_K * distKm(lat, lon, l.lat, l.lon);
      var via = locs.filter(function (h) { return est[h.id] !== undefined; });
      if (via.length) best = Math.min.apply(null, via.map(function (h) { return est[h.id] + PING_K * distKm(h.lat, h.lon, l.lat, l.lon); }));
      est[l.id] = best;
    });
    locs.forEach(function (l) {
      if (l.measured) return;
      setPing(l, Math.round(est[l.id]), '≈ ', 'Примерный пинг' + (city ? ' из города ' + city : '') + ': оценка по расстоянию до узла');
    });
  }

  $$('[data-loc]').forEach(function (el) {
    el.addEventListener('click', function () { selectLoc(el.getAttribute('data-loc')); });
  });

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tween(el, from, to) {
    var t0 = performance.now(), dur = 550;
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e) + ' ₽';
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
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
      if (price) {
        var from = parseInt(price.textContent, 10);
        if (has && !isNaN(from) && from !== v && !reduceMotion) tween(price, from, v); else price.textContent = has ? v + ' ₽' : '—';
        price.classList.remove('price-flip'); void price.offsetWidth; price.classList.add('price-flip');
      }
      if (per) per.textContent = has ? def.per : '';
      if (note) note.textContent = has ? (m > 1 ? '≈ ' + Math.round(v / m) + ' ₽ в месяц' : '') : 'нет периода 6 мес';
    });
  }
  $$('[data-period]').forEach(function (b) {
    b.addEventListener('click', function () { selectPeriod(+b.getAttribute('data-period')); moveInd(); });
  });

  /* скользящая плашка переключателя */
  var segFirst = document.querySelector('[data-period]');
  var segWrap = segFirst && segFirst.parentElement, ind;
  if (segWrap) {
    segWrap.classList.add('seg-wrap');
    ind = document.createElement('span'); ind.className = 'seg-ind'; ind.setAttribute('aria-hidden', 'true');
    segWrap.insertBefore(ind, segWrap.firstChild);
  }
  function moveInd() {
    if (!ind) return;
    var on = segWrap.querySelector('.seg.on'); if (!on) return;
    ind.style.left = on.offsetLeft + 'px'; ind.style.width = on.offsetWidth + 'px';
    ind.style.top = on.offsetTop + 'px'; ind.style.height = on.offsetHeight + 'px';
  }
  moveInd(); window.addEventListener('resize', moveInd);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInd);

  /* ---------- Появление при прокрутке ---------- */
  if ('IntersectionObserver' in window && !reduceMotion) {
    var groups = [['.plan', 'rv'], ['#pricing h2, #pricing .seg-wrap', 'rv-up'], ['section h2', 'rv-up'], ['.card', 'rv-up'], ['.loc', 'rv-up'], ['.faq-q', 'rv-up']];
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { var t = e.target; t.classList.add('in'); io.unobserve(t); if (t.classList.contains('rv')) setTimeout(function () { t.classList.add('done'); }, 1800); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    groups.forEach(function (g) {
      var parents = new Map();
      $$(g[0]).forEach(function (el) {
        if (el.classList.contains('rv') || el.classList.contains('rv-up')) return;
        var i = parents.get(el.parentElement) || 0; parents.set(el.parentElement, i + 1);
        el.style.setProperty('--i', Math.min(i, 6)); el.classList.add(g[1]); io.observe(el);
      });
    });
    // trial-плашка под тарифами
    var trial = $$('#pricing a.btn').filter(function (x) { return !x.closest('.plan'); })[0];
    if (trial && trial.parentElement) { trial.parentElement.classList.add('rv-up'); io.observe(trial.parentElement); }
  }

  /* ---------- Карточки тарифов: 3D-наклон, подсветка, магнитная кнопка ---------- */
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine && !reduceMotion) {
    planEls.forEach(function (card) {
      var btn = card.querySelector('.btn'), raf = 0;
      card.addEventListener('pointermove', function (e) {
        if (!card.classList.contains('in') && card.classList.contains('rv')) return;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          card.classList.add('tilting');
          card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
          card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
          card.style.setProperty('--ry', ((x - 0.5) * 10).toFixed(2) + 'deg');
          card.style.setProperty('--rx', ((0.5 - y) * 8).toFixed(2) + 'deg');
        });
      });
      card.addEventListener('pointerleave', function () {
        cancelAnimationFrame(raf);
        card.classList.remove('tilting');
        card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
      });
    });
  }


  /* ---------- Геолокация по IP: адрес над глобусом и точка «ВЫ» в городе пользователя ---------- */
  (function () {
    var ipEl = document.querySelector('[data-ip]'), cityEl = document.querySelector('[data-ip-city]');
    if (!ipEl) return;
    var bar = ipEl.closest('.ipbar');
    // свой эндпоинт можно задать через window.KIRO_GEO_URL (см. README) — он пробуется первым
    var sources = [
      window.KIRO_GEO_URL && { url: window.KIRO_GEO_URL, map: function (d) { return d; } },
      { url: 'https://ipwho.is/?lang=ru', map: function (d) { return d && d.success !== false ? { ip: d.ip, city: d.city, country: d.country, lat: d.latitude, lon: d.longitude } : null; } },
      { url: 'https://get.geojs.io/v1/ip/geo.json', map: function (d) { return d && d.ip ? { ip: d.ip, city: d.city, country: d.country, lat: parseFloat(d.latitude), lon: parseFloat(d.longitude) } : null; } },
      { url: 'https://ipapi.co/json/', map: function (d) { return d && d.ip && !d.error ? { ip: d.ip, city: d.city, country: d.country_name, lat: d.latitude, lon: d.longitude } : null; } }
    ].filter(Boolean);
    function get(src) {
      var ctrl = window.AbortController ? new AbortController() : null;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4500);
      return fetch(src.url, { signal: ctrl ? ctrl.signal : undefined, credentials: 'omit', cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { clearTimeout(to); var g = src.map(d); if (!g || !g.ip) throw new Error('bad'); return g; });
    }
    function tryNext(i) {
      if (i >= sources.length) return Promise.reject(new Error('geo failed'));
      return get(sources[i]).catch(function () { return tryNext(i + 1); });
    }
    tryNext(0).then(function (g) {
      ipEl.textContent = g.ip;
      var place = [g.city, g.country].filter(Boolean).join(', ');
      if (cityEl) cityEl.textContent = place;
      if (window.KIRO_globeSetHub && typeof g.lat === 'number' && !isNaN(g.lat)) {
        window.KIRO_globeSetHub(g.lat, g.lon, g.city ? 'ВЫ · ' + g.city : 'ВЫ');
      }
      if (typeof g.lat === 'number' && !isNaN(g.lat) && typeof g.lon === 'number') estimatePing(g.lat, g.lon, g.city);
    }).catch(function () {
      ipEl.textContent = 'не удалось определить';
      if (bar) bar.classList.add('err');
    });
  })();

  /* ---------- Живой пинг до узлов из браузера посетителя ----------
     Браузер не умеет ICMP, поэтому меряем время HTTPS-запроса к /ping на узле:
     1 прогревочный запрос (DNS + TLS), затем несколько замеров по уже открытому соединению, берём минимум.
     Адреса — поле pingUrl у локаций в window.KIRO (задаются в build.py → PING_URLS). Без адреса остаётся средний пинг. */
  (function () {
    var targets = (D.locs || []).filter(function (l) { return l.pingUrl && !l.soon; });
    if (!targets.length || !window.fetch || !window.performance) return;
    var SAMPLES = 5, TIMEOUT = 3000;

    function once(url) {
      var ctrl = window.AbortController ? new AbortController() : null;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT);
      var u = url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now() + Math.random().toString(36).slice(2, 6);
      var t0 = performance.now();
      return fetch(u, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })
        .then(function () {
          clearTimeout(to);
          var dt = performance.now() - t0;
          // точнее — по Resource Timing (если узел отдаёт Timing-Allow-Origin): только запрос → первый байт
          var e = performance.getEntriesByName ? performance.getEntriesByName(u).pop() : null;
          if (e && e.responseStart > 0 && e.requestStart > 0) dt = e.responseStart - e.requestStart;
          return dt;
        }, function (err) { clearTimeout(to); throw err; });
    }
    function measure(loc) {
      var best = Infinity, n = 0;
      return once(loc.pingUrl).then(function step() {
        if (n++ >= SAMPLES) return best;
        return once(loc.pingUrl).then(function (dt) { best = Math.min(best, dt); return step(); });
      });
    }
    var started = false;
    function run() {
      if (started) return; started = true;
      targets.forEach(function (loc) {
        measure(loc).then(function (ms) {
          if (!isFinite(ms)) return;
          loc.measured = true;
          setPing(loc, Math.max(1, Math.round(ms)), '', 'Измерено из вашего браузера');
        }).catch(function () { /* узел не ответил — остаётся среднее значение */ });
      });
    }
    // меряем, когда блок с локациями попал в экран (или сразу, если наблюдателя нет)
    var anchor = document.querySelector('.loc') || document.getElementById('globe');
    if (anchor && 'IntersectionObserver' in window) {
      var pio = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { pio.disconnect(); run(); } }, { rootMargin: '200px' });
      pio.observe(anchor);
    } else run();
  })();

  /* ---------- Туннель: «Без VPN / С Kiro» ---------- */
  (function () {
    var pv = document.querySelector('.pv'); if (!pv) return;
    var btns = $$('[data-pv]', pv), manual = false, timer = 0, visible = false;
    function set(on) {
      pv.className = on ? 'pv on' : 'pv off';
      btns.forEach(function (b) { b.setAttribute('aria-pressed', (b.getAttribute('data-pv') === '1') === on ? 'true' : 'false'); });
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { manual = true; clearTimeout(timer); set(b.getAttribute('data-pv') === '1'); }); });
    // автопереключение, пока блок на экране и посетитель сам не нажал
    function cycle() {
      clearTimeout(timer);
      if (manual || !visible || reduceMotion) return;
      var on = pv.classList.contains('on');
      timer = setTimeout(function () { set(!on); cycle(); }, on ? 7000 : 5000);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) cycle(); else clearTimeout(timer); }, { threshold: 0.3 }).observe(pv);
    }
  })();

  /* ---------- Плавная прокрутка к разделам по якорю ---------- */
  function smoothScrollTo(targetY, duration) {
    var startY = window.pageYOffset, distance = targetY - startY, startTime = null;
    function step(now) {
      if (startTime === null) startTime = now;
      var t = Math.min((now - startTime) / duration, 1);
      var eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo({ top: startY + distance * eased, behavior: 'instant' });
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var offset = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      var maxY = document.documentElement.scrollHeight - window.innerHeight;
      var y = Math.max(0, Math.min(target.getBoundingClientRect().top + window.pageYOffset - offset, maxY));
      history.pushState(null, '', id);
      if (reduceMotion) window.scrollTo(0, y); else smoothScrollTo(y, 900);
    });
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
        if (a) { a.classList.toggle('on', open); a.setAttribute('aria-hidden', open ? 'false' : 'true'); }
      });
    });
  });
})();
