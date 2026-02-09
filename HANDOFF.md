# Dental Dashboard - Handoff Document

**Дата:** 2026-02-04
**Статус:** В разработка

---

## Как да се върнеш към този проект

1. Отвори VS Code в папката:
   ```
   /Users/sezerdurmush/Documents/CLAUDE CODE/agentic workflows/dental-dashboard
   ```

2. Стартирай Claude Code и кажи:
   ```
   Продължавам работа по dental dashboard. Прочети HANDOFF.md за контекст.
   ```

---

## Какво е направено

### 1. 21st.dev Magic MCP Server
- **Статус:** Конфигуриран
- **Файл:** `~/.claude/mcp_config.json`
- **API Key:** `5ecaa17cd85a5cd04cc477b550b8eb1ac9732f1908c56e6035dbd42a325035cc`
- **След рестарт:** Използвай `/ui` команда за генериране на компоненти

### 2. Next.js Проект
- **Статус:** Създаден и build-ва успешно
- **Път:** `/Users/sezerdurmush/Documents/CLAUDE CODE/agentic workflows/dental-dashboard`
- **Tech Stack:**
  - Next.js 16 + App Router
  - TypeScript
  - Tailwind CSS
  - Recharts (графики)
  - Supabase (база данни)
  - Lucide React (икони)

### 3. Страници

| Страница | Път | Статус |
|----------|-----|--------|
| Login | `/login` | Готова |
| Magic Link Verify | `/auth/verify` | Готова |
| Dashboard (Табло) | `/` | Готова с sample data |
| Appointments (Часове) | `/appointments` | Готова с sample data |
| Patients (Пациенти) | `/patients` | Готова с sample data |
| Calendar (Календар) | `/calendar` | Готова |
| Settings (Настройки) | `/settings` | Готова |
| Admin: Clinics | `/admin/clinics` | Готова с sample data |
| Admin: Users | `/admin/users` | Готова с sample data |

### 4. API Routes

| Endpoint | Метод | Статус |
|----------|-------|--------|
| `/api/auth/send-magic-link` | POST | Готов |
| `/api/auth/verify` | POST | Готов |

### 5. Authentication
- Magic Link през WhatsApp
- Middleware за защита на routes
- Admin-only routes проверка

---

## Какво остава да се направи

### 1. Database Migrations (Приоритет: ВИСОК)
Трябва да се създадат таблици в Supabase:

```sql
-- users таблица
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  role VARCHAR(50) DEFAULT 'doctor',
  clinic_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- clinics таблица
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  whatsapp_instance VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- auth_tokens таблица
CREATE TABLE auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ALTER existing tables
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS cancelled_appointments INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_appointments INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS no_show_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clinic_id UUID;

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS clinic_id UUID;
```

### 2. Environment Variables (Приоритет: ВИСОК)
Актуализирай `.env.local` с реални стойности:

```env
NEXT_PUBLIC_SUPABASE_URL=https://iqzcuacvhyoarioltrkl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<РЕАЛЕН_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<РЕАЛЕН_SERVICE_ROLE_KEY>
N8N_WEBHOOK_URL=https://mwqopo2p.rpcld.net/webhook
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. n8n Workflow за Magic Link (Приоритет: ВИСОК)
Създай workflow с:
- Webhook trigger: POST `/send-magic-link`
- Input: `{ phone, token, magicLink, userName }`
- Action: Изпрати WhatsApp съобщение

### 4. API Routes за Metrics (Приоритет: СРЕДЕН)
- `/api/metrics` - Dashboard метрики от Supabase
- Свържи dashboard page с реални данни

### 5. Vercel Deploy (Приоритет: СРЕДЕН)
```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## Команди

```bash
# Стартирай dev server
cd "/Users/sezerdurmush/Documents/CLAUDE CODE/agentic workflows/dental-dashboard"
npm run dev

# Build за production
npm run build

# Deploy на Vercel
vercel --prod
```

---

## Файлова структура

```
dental-dashboard/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── auth/verify/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── appointments/page.tsx
│   │   │   ├── patients/page.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── admin/
│   │   │   ├── layout.tsx
│   │   │   ├── clinics/page.tsx
│   │   │   └── users/page.tsx
│   │   └── api/
│   │       └── auth/
│   │           ├── send-magic-link/route.ts
│   │           └── verify/route.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── utils.ts
│   │   └── auth.ts
│   ├── types/
│   │   ├── index.ts
│   │   └── database.ts
│   └── middleware.ts
├── .env.local
├── .env.example
└── HANDOFF.md (този файл)
```

---

## Връзки

- **Supabase Project:** https://iqzcuacvhyoarioltrkl.supabase.co
- **n8n Instance:** https://mwqopo2p.rpcld.net
- **21st.dev Console:** https://21st.dev/magic/console
- **План файл:** `~/.claude/plans/typed-jumping-seal.md`

---

## Контекст от съществуващата система

Dental clinic WhatsApp chatbot системата вече има:
- `appointments` таблица с reminder флагове
- `clients` таблица
- Google Calendar интеграция за 4 лекари
- Reminder workflow (24h и 3h)

Calendar IDs:
- д-р Иванов: `6b17f0fc84662aac383078dbca7390aaa68fe56ecacf3c3cea09d82eff16f11d@group.calendar.google.com`
- д-р Стефанов: `40754e0a142dac46e4492be2c088cbe297b3ad8350a7ccec3cad6e7da164a26a@group.calendar.google.com`
- д-р Недялков: `b5c7dd9ffdd1f6d833042d9d0a74e81cb106940140f7ae832adbd55f74b5da11@group.calendar.google.com`
- д-р Чакъров: `9f1afdb8020735f5507852ffa490d918935b2f7824d8e8cbe97e0fc781e70223@group.calendar.google.com`

---

*Последна актуализация: 2026-02-04 22:30*
