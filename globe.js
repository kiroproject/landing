/* Kiro — интерактивный глобус узлов (canvas 2D, без библиотек) */
(function () {
  'use strict';
  var canvas = document.getElementById('globe');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var D = window.KIRO || {};
  var LAND = window.KIRO_LAND || [];
  var HUB = { lat: 55.75, lon: 37.62 };
  var ACC = '#FF5A1F';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RAD = Math.PI / 180;

  var land = [];
  for (var i = 0; i < LAND.length; i += 2) land.push(vec(LAND[i] / 10, LAND[i + 1] / 10));

  var nodes = (D.locs || []).filter(function (l) { return typeof l.lat === 'number'; }).map(function (l) {
    return { id: l.id, cc: l.cc, ping: l.ping, soon: !!l.soon, v: vec(l.lat, l.lon), lat: l.lat, lon: l.lon };
  });
  var hubV = vec(HUB.lat, HUB.lon), hubLabel = 'ВЫ';

  // view state
  var lon0 = 25, lat0 = 32, vLon = 0, vLat = 0;
  var target = null, dragging = false, lastX = 0, lastY = 0, lastInteract = 0;
  var selected = (nodes.filter(function (n) { return !n.soon; })[0] || {}).id;
  var W = 0, H = 0, R = 0, R0 = 0, CX = 0, CY = 0, dpr = 1, t0 = performance.now();
  var zoom = 1, zoomT = 1, ZMIN = 1, ZMAX = 4.5;

  function vec(lat, lon) {
    var p = lat * RAD, l = lon * RAD;
    return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  }
  function project(v) {
    var l0 = lon0 * RAD, p0 = lat0 * RAD;
    var cl = Math.cos(l0), sl = Math.sin(l0);
    var x1 = v[0] * cl + v[1] * sl, y1 = -v[0] * sl + v[1] * cl, z1 = v[2];
    var cp = Math.cos(p0), sp = Math.sin(p0);
    var depth = x1 * cp + z1 * sp;
    var up = -x1 * sp + z1 * cp;
    return { x: CX + R * y1, y: CY - R * up, d: depth, r2: y1 * y1 + up * up };
  }
  function slerp(a, b, t) {
    var dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    var om = Math.acos(dot); if (om < 1e-6) return a.slice();
    var s = Math.sin(om), k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
  }
  function arcPoints(a, b, n) {
    var dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    var h = 0.06 + Math.acos(Math.max(-1, Math.min(1, dot))) * 0.18;
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, p = slerp(a, b, t), s = 1 + h * Math.sin(Math.PI * t);
      out.push([p[0] * s, p[1] * s, p[2] * s]);
    }
    return out;
  }
  var arcs = {};
  function buildArcs() { nodes.forEach(function (n) { arcs[n.id] = arcPoints(hubV, n.v, 64); }); }
  buildArcs();

  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R0 = Math.min(W, H) * (W < 520 ? 0.42 : 0.46); R = R0 * zoom; CX = W / 2; CY = H / 2;
  }

  function visible(p) { return p.d > 0 || p.r2 > 1.0001; }

  function draw(now) {
    var t = (now - t0) / 1000;
    // motion
    if (target) {
      var dl = ((target.lon - lon0 + 540) % 360) - 180;
      lon0 += dl * 0.08; lat0 += (target.lat - lat0) * 0.08;
      if (Math.abs(dl) < 0.05 && Math.abs(target.lat - lat0) < 0.05) target = null;
    } else if (!dragging) {
      lon0 += vLon; lat0 += vLat; vLon *= 0.94; vLat *= 0.94;
      if (!reduce && now - lastInteract > 3500 && Math.abs(vLon) < 0.02) lon0 += 0.06;
    }
    lat0 = Math.max(-70, Math.min(70, lat0));

    zoom += (zoomT - zoom) * 0.16; if (Math.abs(zoomT - zoom) < 0.001) zoom = zoomT; R = R0 * zoom;
    ctx.clearRect(0, 0, W, H);
    // atmosphere
    var g = ctx.createRadialGradient(CX, CY, R * 0.9, CX, CY, R * 1.25);
    g.addColorStop(0, 'rgba(255,90,31,0.16)'); g.addColorStop(1, 'rgba(255,90,31,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(CX, CY, R * 1.25, 0, Math.PI * 2); ctx.fill();
    // sphere
    var sg = ctx.createRadialGradient(CX - R * 0.35, CY - R * 0.4, R * 0.1, CX, CY, R);
    sg.addColorStop(0, '#1d1f24'); sg.addColorStop(1, '#0b0c0e');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,31,0.35)'; ctx.lineWidth = 1; ctx.stroke();

    // graticule
    ctx.strokeStyle = 'rgba(232,236,241,0.06)'; ctx.lineWidth = 1;
    for (var la = -60; la <= 60; la += 30) line(function (k) { return vec(la, -180 + k * 5); }, 72);
    for (var lo = -180; lo < 180; lo += 30) line(function (k) { return vec(-90 + k * 2.5, lo); }, 72);

    // land dots
    var s = Math.min(3, Math.max(1.1, R / 260));
    for (var i = 0; i < land.length; i++) {
      var p = project(land[i]);
      if (p.d <= 0) continue;
      ctx.fillStyle = 'rgba(232,236,241,' + (0.12 + 0.4 * p.d).toFixed(3) + ')';
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }

    // arcs
    nodes.forEach(function (n) {
      var pts = arcs[n.id], on = n.id === selected;
      ctx.beginPath(); var started = false;
      for (var i = 0; i < pts.length; i++) {
        var p = project(pts[i]);
        if (!visible(p)) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.setLineDash(n.soon ? [2, 6] : [4, 6]);
      ctx.lineDashOffset = -t * 20;
      ctx.strokeStyle = n.soon ? 'rgba(232,236,241,0.14)' : (on ? ACC : 'rgba(255,90,31,0.4)');
      ctx.lineWidth = on ? 2 : 1.3; ctx.stroke(); ctx.setLineDash([]);
      if (!n.soon) {
        var k = ((t * (on ? 0.45 : 0.3) + (n.id.charCodeAt(0) % 7) / 7) % 1);
        var pp = project(pts[Math.floor(k * (pts.length - 1))]);
        if (visible(pp)) {
          ctx.fillStyle = on ? '#FFFFFF' : 'rgba(255,200,170,0.8)';
          ctx.beginPath(); ctx.arc(pp.x, pp.y, on ? 3 : 2, 0, Math.PI * 2); ctx.fill();
        }
      }
    });

    var queue = [];
    // hub
    var hp = project(hubV);
    if (hp.d > 0) {
      // точка «ВЫ»: мягкое свечение, две волны, белая точка с тёмной обводкой
      var halo = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, 34);
      halo.addColorStop(0, 'rgba(255,255,255,0.35)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(hp.x, hp.y, 34, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.5;
      for (var w = 0; w < 2; w++) {
        var pr = ((t + w) % 2) / 2;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.75 * (1 - pr)) + ')';
        ctx.beginPath(); ctx.arc(hp.x, hp.y, 8 + pr * 22, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(hp.x, hp.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0E0F11'; ctx.beginPath(); ctx.arc(hp.x, hp.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(hp.x, hp.y, 3, 0, Math.PI * 2); ctx.fill();
      queue.push({ x: hp.x, y: hp.y, text: hubLabel, kind: 'you', pr: 5, gap: 14 });
    }

    // nodes
    var act = [];
    nodes.forEach(function (n) {
      var p = project(n.v); n._p = p;
      if (p.d <= 0) return;
      var on = n.id === selected;
      if (n.soon) {
        ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(232,236,241,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        queue.push({ x: p.x, y: p.y, text: n.cc + ' · скоро', kind: 'dim', pr: 0, gap: 10 });
        return;
      }
      if (on) {
        var pr2 = (t % 1.6) / 1.6;
        ctx.strokeStyle = 'rgba(255,90,31,' + (0.8 * (1 - pr2)) + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 7 + pr2 * 18, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.shadowColor = ACC; ctx.shadowBlur = on ? 18 : 10;
      ctx.fillStyle = on ? ACC : '#2a1309'; ctx.strokeStyle = ACC; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, on ? 7 : 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      act.push({ n: n, p: p, on: on });
    });
    // узлы в одном городе (FI-1 и FI-2 в Хельсинки, ближе ~100 км) получают одну общую подпись
    var used = {};
    act.forEach(function (a) {
      if (used[a.n.id]) return;
      var grp = act.filter(function (b) { return !used[b.n.id] && near(a.n, b.n); });
      grp.forEach(function (b) { used[b.n.id] = true; });
      var on = grp.some(function (b) { return b.on; });
      var pings = grp.map(function (b) { return b.n.ping; }).filter(Boolean);
      var text = grp.map(function (b) { return b.n.cc; }).join(' / ') + (pings.length ? ' · ' + pings.join('/') + ' мс' : '');
      queue.push({ x: a.p.x, y: a.p.y, text: text, kind: on ? 'on' : 'pill', pr: on ? 3 : 1, gap: 12 });
    });
    placeLabels(queue);
    requestAnimationFrame(draw);
  }

  function line(fn, n) {
    ctx.beginPath(); var started = false;
    for (var k = 0; k <= n; k++) {
      var p = project(fn(k));
      if (p.d <= 0) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  function placeLabels(q) {
    ctx.font = '600 12px "JetBrains Mono", ui-monospace, monospace';
    var placed = [];
    q.sort(function (a, b) { return b.pr - a.pr; });
    q.forEach(function (l) {
      var w = ctx.measureText(l.text).width + (l.kind === 'plain' || l.kind === 'dim' ? 0 : 18), h = 22;
      var opts = [[l.gap, -h / 2], [-l.gap - w, -h / 2], [-w / 2, -h - 8], [-w / 2, 8]];
      for (var i = 0; i < opts.length; i++) {
        var r = { x: l.x + opts[i][0], y: l.y + opts[i][1], w: w, h: h };
        var clash = placed.some(function (o) { return r.x < o.x + o.w + 4 && r.x + r.w + 4 > o.x && r.y < o.y + o.h + 2 && r.y + r.h + 2 > o.y; });
        if (!clash) { placed.push(r); label(r.x, r.y + h / 2, l.text, l.kind === 'on', l.kind === 'plain', l.kind === 'dim', l.kind === 'you'); return; }
      }
    });
  }
  function label(x, y, text, on, plain, dim, you) {
    ctx.font = '600 12px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    var w = ctx.measureText(text).width;
    if (you) {
      roundRect(x, y - 11, w + 18, 22, 11);
      ctx.shadowColor = 'rgba(255,255,255,0.45)'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#0E0F11'; ctx.fillText(text, x + 9, y + 0.5); return;
    }
    if (plain || dim) {
      ctx.fillStyle = dim ? 'rgba(232,236,241,0.45)' : '#E8ECF1';
      ctx.fillText(text, x, y); return;
    }
    var h = 22, px = 9;
    roundRect(x, y - h / 2, w + px * 2, h, 11);
    ctx.fillStyle = on ? ACC : 'rgba(10,11,12,0.88)'; ctx.fill();
    ctx.strokeStyle = on ? ACC : 'rgba(255,90,31,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = on ? '#0A0D07' : '#E8ECF1'; ctx.fillText(text, x + px, y + 0.5);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---- interaction ----
  function near(a, b) { return a.v[0] * b.v[0] + a.v[1] * b.v[1] + a.v[2] * b.v[2] > 0.99988; }
  function hit(ev) {
    var rect = canvas.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top, best = null, bd = 16;
    nodes.forEach(function (n) {
      if (!n._p || n._p.d <= 0 || n.soon) return;
      var d = Math.hypot(n._p.x - x, n._p.y - y); if (d < bd) { bd = d; best = n; }
    });
    // повторный клик по совпадающим узлам переключает между ними
    if (best && best.id === selected) {
      var twins = nodes.filter(function (n) { return n !== best && n._p && n._p.d > 0 && !n.soon && near(n, best); });
      if (twins.length) best = twins[0];
    }
    return best;
  }
  var downX = 0, downY = 0, pts = {}, pinch0 = 0, pinchZ = 1;
  function setZoom(z) { zoomT = Math.max(ZMIN, Math.min(ZMAX, z)); lastInteract = performance.now(); }
  function pinchDist() { var a = Object.keys(pts).map(function (k) { return pts[k]; }); return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    setZoom(zoomT * Math.exp(-d * 0.0016));
  }, { passive: false });
  canvas.addEventListener('dblclick', function (e) { e.preventDefault(); setZoom(zoomT > 2.4 ? 1 : zoomT * 1.8); });
  var zbtns = canvas.parentElement ? canvas.parentElement.querySelectorAll('[data-zoom]') : [];
  Array.prototype.forEach.call(zbtns, function (b) {
    b.addEventListener('click', function () { var v = b.getAttribute('data-zoom'); setZoom(v === 'reset' ? 1 : zoomT * (v === 'in' ? 1.5 : 1 / 1.5)); });
  });
  canvas.addEventListener('pointerdown', function (e) {
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(pts).length === 2) { pinch0 = pinchDist(); pinchZ = zoomT; dragging = false; canvas.setPointerCapture(e.pointerId); return; }
    dragging = true; target = null; lastX = downX = e.clientX; lastY = downY = e.clientY;
    vLon = vLat = 0; lastInteract = performance.now();
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('grabbing');
  });
  canvas.addEventListener('pointermove', function (e) {
    if (pts[e.pointerId]) pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(pts).length >= 2) { var pd = pinchDist(); if (pinch0 > 0) setZoom(pinchZ * pd / pinch0); return; }
    if (!dragging) { canvas.style.cursor = hit(e) ? 'pointer' : 'grab'; return; }
    var k = 180 / (Math.PI * R);
    var dx = (e.clientX - lastX) * k, dy = (e.clientY - lastY) * k;
    lon0 -= dx; lat0 += dy; vLon = -dx; vLat = dy;
    lastX = e.clientX; lastY = e.clientY; lastInteract = performance.now();
  });
  function end(e) {
    delete pts[e.pointerId];
    if (Object.keys(pts).length < 2) pinch0 = 0;
    if (!dragging) return;
    dragging = false; canvas.classList.remove('grabbing'); lastInteract = performance.now();
    if (Math.hypot(e.clientX - downX, e.clientY - downY) < 5) {
      var n = hit(e);
      if (n && window.KIRO_selectLoc) window.KIRO_selectLoc(n.id);
    }
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  window.KIRO_globeFocus = function (id) {
    selected = id;
    var n = nodes.filter(function (x) { return x.id === id; })[0];
    if (n) {
      // смотрим на середину маршрута «вы → узел»
      var mid = slerp(hubV, n.v, 0.5);
      var lat = Math.asin(mid[2]) / RAD, lon = Math.atan2(mid[1], mid[0]) / RAD;
      target = { lon: lon, lat: Math.max(-50, Math.min(55, lat)) };
      lastInteract = performance.now();
    }
  };
  // перенос точки «ВЫ» в город пользователя (по геолокации IP)
  var setHub = function (lat, lon, label) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return;
    hubV = vec(lat, lon); if (label) hubLabel = label;
    buildArcs(); window.KIRO_globeFocus(selected);
  };

  window.KIRO_globeSetHub = setHub;
  // живой пинг из браузера посетителя (см. app.js)
  window.KIRO_globeSetPing = function (id, ms) {
    nodes.forEach(function (n) { if (n.id === id) n.ping = ms; });
  };
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  resize();
  window.KIRO_globeFocus(selected);
  requestAnimationFrame(draw);
})();
