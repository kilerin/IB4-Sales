# IB4 Sales Dashboard

Дашборд по данным из Excel-файлов: загрузка, история, графики.

## Стек

- Next.js 16, React 19
- PostgreSQL
- xlsx (парсинг Excel)
- Recharts (графики)

## Установка (локально)

```bash
npm install
```

## База данных

1. Создайте БД PostgreSQL:

```bash
createdb ib4sales
```

2. Настройте `.env`:

```
DATABASE_URL=postgres://user:password@localhost:5432/ib4sales
NEXTAUTH_SECRET=ваш-секрет-минимум-32-символа
NEXTAUTH_URL=http://localhost:3000
```

Сгенерировать секрет: `openssl rand -base64 32`

3. Примените схему и миграции:

```bash
npm run db:init
npm run db:migrate
```

4. Создайте первого пользователя:

```bash
npm run db:create-user admin ваш_пароль
```

## Запуск

```bash
npm run dev
```

Откройте http://localhost:3000

## Функции

- **Загрузка Excel** — выберите файл вручную (формат CFOD: листы DEALS, CLIENTS)
- **История** — список загруженных файлов, выбор для просмотра графиков
- **Графики:**
  1. **IMPORT** — бары по дням (Side=Import, STATUS≠cancelled, AMOUNT TO BE RECEIVED USD)
  2. **SALES PERFORMANCE** — по каждому продавцу: сделок за день, суммы (Payed, Received, Margin)
  3. **Динамика по продавцу** — то же для выбранного продавца

## Деплой на Vercel

1. Подключите репозиторий к Vercel
2. Добавьте переменную `DATABASE_URL` (Postgres от Vercel, Neon, Supabase и т.п.)
3. Хранение файлов: на Vercel `uploads` — временное. Для продакшена используйте S3/Vercel Blob.
