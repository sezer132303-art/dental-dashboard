# Supabase Migrations

## Как да изпълниш миграциите

### Стъпка 1: Отвори Supabase SQL Editor
1. Отиди на https://iqzcuacvhyoarioltrkl.supabase.co
2. Влез в проекта
3. Кликни на **SQL Editor** в менюто вляво

### Стъпка 2: Изпълни миграциите по ред

1. **001_initial_schema.sql** - Създава таблиците
   - Копирай съдържанието на файла
   - Постави в SQL Editor
   - Кликни "Run"

2. **002_seed_data.sql** - Добавя тестови данни
   - Копирай съдържанието
   - **ВАЖНО:** Промени телефонните номера с реални
   - Кликни "Run"

### Стъпка 3: Вземи API ключовете

1. Отиди на **Settings** → **API**
2. Копирай:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

3. Обнови `.env.local` с реалните стойности

## Миграции

| Файл | Описание |
|------|----------|
| 001_initial_schema.sql | Създава clinics, users, auth_tokens таблици |
| 002_seed_data.sql | Добавя тестови потребители |

## Таблици

| Таблица | Описание |
|---------|----------|
| clinics | Клиники (multi-tenant support) |
| users | Потребители на дашборда (доктори, админи) |
| auth_tokens | Magic link токени |
| clients | Пациенти (съществуваща) |
| appointments | Часове (съществуваща) |
