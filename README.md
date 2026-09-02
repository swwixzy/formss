# KINDORF — backend для форм

Простой сервер на Node.js (Express + Nodemailer), который принимает данные
из трёх форм сайта (`submit-form`, `join-form`, `partner-form`) и отправляет
их письмом на Gmail через SMTP. Никаких сторонних форм-сервисов — только
Gmail и ваш собственный код.

## 1. Получить App Password в Google

Обычный пароль от Gmail для SMTP не подойдёт, нужен отдельный "пароль приложения":

1. Зайдите на https://myaccount.google.com/security
2. Включите двухфакторную аутентификацию (2-Step Verification), если ещё не включена — без неё App Password не создать.
3. Откройте https://myaccount.google.com/apppasswords
4. Создайте новый пароль (название можно любое, например "kindorf-backend").
5. Google покажет 16-значный пароль вида `abcd efgh ijkl mnop` — скопируйте его **без пробелов**.

Этот пароль никому не показывайте, он даёт доступ к отправке писем с вашего аккаунта.

## 2. Деплой на Railway

1. Загрузите содержимое этой папки (`forms/`) в отдельный GitHub-репозиторий (или подпапку — тогда при создании сервиса в Railway укажите Root Directory = `forms`).
2. В Railway: New Project → Deploy from GitHub repo → выберите репозиторий.
3. В настройках сервиса откройте вкладку **Variables** и добавьте:
   - `GMAIL_USER` = pinp6390@gmail.com
   - `GMAIL_APP_PASSWORD` = ваш App Password из шага 1 (без пробелов)
   - `TO_EMAIL` = pinp6390@gmail.com
   - `ALLOWED_ORIGINS` = `https://swwixzy.github.io`
4. Railway сам определит Node.js проект и выполнит `npm install` + `npm start`.
5. После деплоя Railway выдаст публичный URL вида `https://<ваш-сервис>.up.railway.app`.
6. Проверьте, что сервер жив: откройте `https://<ваш-сервис>.up.railway.app/health` — должно вернуться `{"ok":true}`.

## 3. Подключить к сайту

В `script.js` на сайте уже есть переменная:

```js
const BACKEND_URL = "https://forms-production-5b2a.up.railway.app/api/submit-form";
```

Замените её на реальный URL вашего сервиса из Railway (с `/api/submit-form` на конце) и запушьте изменения в репозиторий сайта на GitHub Pages.

## 4. Как это работает

- Каждая форма на сайте (`submit-form`, `join-form`, `partner-form`) при отправке шлёт POST-запрос на `/api/submit-form` с JSON `{ formId, data }`.
- Сервер проверяет, что `formId` известен и все обязательные поля заполнены.
- Собирает аккуратное HTML- и текстовое письмо и отправляет его через Gmail SMTP на `TO_EMAIL`.
- В поле "Ответить" (Reply-To) письма подставляется email отправителя формы — можно сразу нажать "Ответить" в почте.
- CORS настроен так, что запросы принимаются только с доменов из `ALLOWED_ORIGINS` — это защищает API от использования посторонними сайтами.

## 5. Локальный запуск (по желанию, для проверки)

```bash
cd forms
cp .env.example .env   # впишите свои значения в .env
npm install
npm start
```

Сервер поднимется на `http://localhost:3000`.
