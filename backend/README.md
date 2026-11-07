# Backend

Небольшой самостоятельный API на Express + TypeScript + MongoDB. Angular остаётся
в корневом `src/`; его SSR-сервер `src/server.ts` обслуживает сайт и не является этим API.
У бэкенда собственные зависимости, конфигурация TypeScript и порт (3000).

## Первый запуск

Требуются Node.js 24, pnpm 11 и MongoDB. Из корня репозитория:

```bash
pnpm install
cp backend/.env.example backend/.env
# Локальная MongoDB (Docker Desktop должен быть запущен):
docker compose -f backend/compose.yaml up -d --wait
pnpm backend:seed
pnpm backend:dev
```

Вместо Docker можно указать URI MongoDB Atlas в `backend/.env`.
`MONGODB_DB` задаёт базу. Строку подключения не коммитить.
Docker-конфигурация предназначена только для локальной разработки: база без
авторизации доступна на 127.0.0.1, данные сохраняются в Docker volume.

Seed переносит текущие демонстрационные данные сайта в коллекции `projects` и
`specialists`. Запускать последовательно и только для нужной базы. Повторный запуск
не изменяет существующие записи: проекты сопоставляются по `title`, специалисты по
`email`. Это начальное наполнение, а не синхронизация данных с фронтендом.

## API

| Метод | URL                | Ответ                                                 |
| ----- | ------------------ | ----------------------------------------------------- |
| GET   | `/api/health`      | `{ "status": "ok" }`, либо 503 при недоступности базы |
| GET   | `/api/projects`    | `[{ id, title, description, imageUrl? }]`             |
| GET   | `/api/specialists` | `[{ id, name, skill, email, portfolioUrl? }]`         |

Списки отсортированы по `sortOrder`, затем `_id`; максимум 200 записей.
В базе `sortOrder` — число, остальные поля — строки. Возвращаются только явно
разрешённые поля. При пустой коллекции ответ — `[]`.

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/projects
curl http://localhost:3000/api/specialists
```

## Структура

- `src/server.ts` — подключение MongoDB, HTTP-сервер, завершение работы.
- `src/app.ts` — маршруты и обработка ошибок.
- `src/config.ts` — проверка переменных окружения.
- `src/modules/content.ts` — типы документов и чтение коллекций.
- `src/seed.ts`, `src/seed-data.ts` — начальное наполнение.
- `test/api.test.mjs` — HTTP-тесты с подменой слоя базы и проверка конфигурации.

## Проверки и production-запуск

```bash
pnpm backend:test
pnpm backend:build
pnpm backend:start
```

`backend:start` использует скомпилированный `backend/dist`, а `backend:dev` —
встроенную поддержку TypeScript в Node.js 24 и перезапуск при изменении файлов.
На хостинге переменные можно задавать напрямую вместо `.env`.

Страницы «Проєкти», «Послуги» и «Звітність» загружают данные из API в браузере.
При `pnpm start` Angular проксирует `/api/**` и `/media/**` на порт 3000.
При деплое направь эти пути на API через reverse proxy того же домена.

Фото проектов хранятся в `backend/uploads/projects/` по умолчанию. Папка
создаётся при запуске API и исключена из Git. Положи туда, например,
`workshop.webp`, а в MongoDB укажи `imageUrl: "/media/projects/workshop.webp"`.
Локально файл доступен на `http://localhost:3000/media/projects/workshop.webp`.
API раздаёт JPG, PNG, WebP и AVIF. Проекты без `imageUrl` сохраняют заглушку.

На хостинге задай `PROJECT_IMAGES_DIR` абсолютным путём к постоянному диску
и проксируй `/media/projects/` на бэкенд вместе с `/api`. Храни резервные
копии файлов вместе с базой. Публичной загрузки пока нет: админка сможет
писать в эту папку через защищённый маршрут после добавления авторизации.

Портфолио специалистов хранятся в `backend/uploads/specialists/`.
Пример поля в MongoDB: `portfolioUrl: "/media/specialists/portfolio.pdf"`.
PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, ODT и ZIP отдаются для скачивания.
Для деплоя задай `SPECIALIST_PORTFOLIOS_DIR` на постоянном диске и проксируй
`/media/specialists/` на API. Размещай здесь только файлы для публичного доступа.

## PDF-отчёты

Положи PDF в `backend/uploads/reports/` и добавь в коллекцию `reports` документ
`{ year: 2025, pdfUrl: "/media/reports/2025.pdf" }`.
`GET /api/reports` возвращает записи с `id`, `year` и `pdfUrl`, новые годы первыми.
На хостинге задай `REPORTS_DIR` на постоянном диске. Без записей раздел покажет пустое состояние.
