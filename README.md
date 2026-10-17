# Kiro VPN — лендинг kiroproject.online

Статический сайт без сборки и зависимостей.

```
index.html   — вся разметка (SVG-графика, карта, маскот встроены)
styles.css   — стили и анимации
app.js       — интерактив: выбор узла на карте, период тарифов, FAQ
favicon.svg  — иконка (мордочка Кицу)
```

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

- **FAQ**: ответы «Что вы храните о пользователях?» и «Можно ли вернуть деньги?» — заглушки в квадратных скобках (`index.html`, поиск по `[Опишите`).
- **Ссылки**: все кнопки ведут на `https://t.me/marmeladki_app_bot` — замените, если у бота новое имя.
- **Подвал**: «Политика конфиденциальности» и «Условия использования» пока ведут на `#top`.
- **Данные узлов и тарифов** продублированы в `window.KIRO` внизу `index.html` (их читает `app.js`) — при изменении цен/пинга правьте и разметку, и этот объект.
- Шрифты (Unbounded, Manrope, JetBrains Mono) грузятся с Google Fonts.
