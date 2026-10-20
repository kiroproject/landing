# Kiro VPN — лендинг kiroproject.online

Статический сайт без сборки и зависимостей.

```
index.html   — вся разметка (SVG-графика, карта, маскот встроены)
styles.css   — стили и анимации
app.js       — интерактив: выбор узла, период тарифов, FAQ
globe.js     — интерактивный глобус (canvas, без библиотек): вращение мышью/пальцем, выбор узла кликом
land.js      — точки суши для глобуса
favicon.svg  — иконка (мордочка Кицу)
```

## Определение IP и города посетителя

Над глобусом показывается IP-адрес посетителя, а точка «ВЫ» ставится в его город. Это делает `app.js` прямо в браузере: по очереди пробует бесплатные сервисы геолокации (`ipwho.is` → `get.geojs.io` → `ipapi.co`), берёт первый ответивший. Если ни один не ответил — пишет «не удалось определить», а точка остаётся в Москве.

Важно: при таком способе IP посетителей видят эти сторонние сервисы, а у бесплатных есть лимиты запросов. Лучше отдавать геоданные со своего сервера — тогда сторонние сервисы не нужны. Пример для nginx с модулем GeoIP2 (базы GeoLite2 от MaxMind):

```nginx
# http { ... }
geoip2 /etc/nginx/GeoLite2-City.mmdb {
    $geoip2_city    city names ru;
    $geoip2_country country names ru;
    $geoip2_lat     location latitude;
    $geoip2_lon     location longitude;
}
# server { ... }
location = /geo {
    default_type application/json;
    add_header Cache-Control "no-store";
    return 200 '{"ip":"$remote_addr","city":"$geoip2_city","country":"$geoip2_country","lat":$geoip2_lat,"lon":$geoip2_lon}';
}
```

И в `index.html` перед `<script src="app.js">` добавьте:

```html
<script>window.KIRO_GEO_URL = '/geo';</script>
```

Свой эндпоинт пробуется первым; сторонние сервисы останутся запасным вариантом (их можно убрать из списка `sources` в `app.js`).

## Примерный пинг от города посетителя

Адреса узлов в браузер не попадают. После определения города по IP `app.js` пересчитывает средний пинг каждого узла (в `window.KIRO.locs`, поле `ping`) под город посетителя:

- средние значения считаются измеренными из `window.KIRO.pingRef` (сейчас Уфа);
- к среднему прибавляется разница расстояний «посетитель → узел» и «Уфа → узел» × 0,016 мс/км (свет в оптоволокне ≈ 200 км/мс, туда-обратно, маршрут ~1,6× длиннее прямой); нижняя граница — 8 мс + 0,016 мс/км;
- узлы без среднего (US) считаются через ближайший европейский узел — трафик из РФ в США идёт через Европу.

Коэффициенты — `PING_K` и `PING_BASE` в `app.js`. Если город не определился, показываются средние значения. Значения подписаны «≈», в подсказке — «оценка по расстоянию».

## Живой пинг до узлов (необязательно)

Если когда-нибудь будет нужен реальный замер, модуль уже есть; он включается, только если у узла задан `pingUrl`, и раскрывает этот адрес посетителю.

Сайт может мерить пинг от посетителя до каждого узла прямо в браузере. ICMP браузеру недоступен, поэтому меряется время HTTPS-запроса: один прогревочный (DNS + TLS), затем 5 запросов по открытому соединению, берётся минимум. Результат почти совпадает с обычным `ping`, обычно на 1–5 мс больше. Пока узел не ответил или адрес не задан, показывается средний пинг.

На каждом узле нужен маленький эндпоинт по HTTPS с валидным сертификатом. Лучше на отдельном поддомене (например `fi1.kiroproject.online`), не на порту VPN:

```nginx
server {
    listen 443 ssl http2;
    server_name fi1.kiroproject.online;
    # ssl_certificate ... (Let's Encrypt)
    location = /ping {
        add_header Access-Control-Allow-Origin "*" always;
        add_header Timing-Allow-Origin "*" always;   # для точного замера
        add_header Cache-Control "no-store" always;
        access_log off;
        return 204;
    }
    location / { return 404; }
}
```

Адреса прописываются в `window.KIRO.locs` (поле `pingUrl`, например `"pingUrl": "https://fi1.kiroproject.online/ping"`) внизу `index.html`.

## Запуск локально

Просто откройте `index.html` в браузере или:

```
python3 -m http.server 8080
```

## Деплой (nginx)

```
scp -r kiro-site/* user@server:/var/www/kiroproject.online/
```

```nginx
server {
    listen 443 ssl http2;
    server_name kiroproject.online www.kiroproject.online;
    root /var/www/kiroproject.online;
    index index.html;

    location / { try_files $uri $uri/ =404; }
    location ~* \.(css|js|svg)$ { expires 7d; add_header Cache-Control "public"; }

    gzip on;
    gzip_types text/css application/javascript image/svg+xml;
}
```

Подойдёт и любой статический хостинг (Cloudflare Pages, Netlify, GitHub Pages) — просто загрузите папку.

## Что поправить перед запуском

- **FAQ** составлен по оферте, правилам и политике конфиденциальности (ред. от 08.10.2026). Если документы изменятся — сверьте ответы.
- **Ссылки**: все кнопки ведут на `https://t.me/marmeladki_app_bot` — замените, если у бота новое имя.
- **Подвал**: «Политика конфиденциальности» и «Условия использования» пока ведут на `#top`.
- **Данные узлов и тарифов** продублированы в `window.KIRO` внизу `index.html` (их читают `app.js` и `globe.js`; координаты узлов — поля `lat`/`lon`) — при изменении цен/пинга правьте и разметку, и этот объект.
- **Точка «ВЫ»** на глобусе стоит в Москве (`HUB` в начале `globe.js`).
- Шрифты (Unbounded, Manrope, JetBrains Mono) грузятся с Google Fonts.
