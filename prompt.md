We are changing the architecture of this project completely.

The previously generated backend (Node.js / Express / PostgreSQL) is no longer valid and must be removed.

---

# ❗ CRITICAL INSTRUCTION

DELETE the entire `backend/` folder from the project.

We are NOT using:

- Node.js backend
- Express API
- Local PostgreSQL
- JWT-based custom auth
- Axios API layer

This project will be **mobile-first with Supabase**.

---

# ✅ NEW ARCHITECTURE

The app must follow this architecture:

- React Native CLI app (main project)
- Supabase Auth (email/password)
- Supabase Postgres (remote database)
- Local SQLite (offline cache + sync queue)
- No REST API for core logic
- No backend server

AI / pose analysis runs on-device (TFLite), not on backend.

---

# 🎯 YOUR TASK

You have full read/write access to the repository.

Follow these steps carefully:

---

## 1️⃣ Analyze current project

- Inspect the current React Native structure
- Detect if TypeScript is used
- Detect navigation setup (if any)
- Understand existing folder organization

---

## 2️⃣ Remove old architecture

- Completely delete `backend/`
- Remove any references to:
  - axios API client
  - REST endpoints
  - JWT logic
- Clean up unused dependencies

---

## 3️⃣ Design new folder structure

Create a clean, scalable structure for this app.

Use a **feature-based + layered architecture**

Example target structure:
src/
├── config/
│ └── supabaseClient.ts
│
├── database/
│ ├── sqlite.ts
│ ├── migrations/
│ └── models/
│
├── services/
│ ├── auth.service.ts
│ ├── session.service.ts
│ └── stats.service.ts
│
├── repositories/
│ ├── session.repository.ts
│ └── stats.repository.ts
│
├── sync/
│ └── syncQueue.ts
│
├── features/
│ ├── auth/
│ ├── workout/
│ └── stats/
│
├── screens/
├── components/
├── hooks/
└── utils/

---

## 4️⃣ Supabase setup

- Install and configure `@supabase/supabase-js`
- Create `supabaseClient.ts`
- Use environment variables:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY

---

## 5️⃣ Authentication system

Implement Supabase Auth flow:

- register (email/password)
- login
- logout
- session persistence

---

## 6️⃣ Profile creation

After user registers:

- create profile record in `profiles` table
- link with `auth.users.id`

---

## 7️⃣ Local SQLite setup

- Set up SQLite database
- Create basic tables for:
  - cached sessions
  - sync queue

Do NOT over-engineer yet.

---

## 8️⃣ Sync system (basic version)

Implement a simple sync mechanism:

- store sessions locally first
- mark unsynced data
- push to Supabase when online

---

## 9️⃣ Session saving flow

When a workout is completed:

- save locally (SQLite)
- send to Supabase:
  - workout_sessions
  - session_errors

---

## 🔟 Stats data flow

- Fetch data from Supabase:
  - daily_stats
  - workout_sessions
- Prepare data for UI

---

# ⚠️ IMPORTANT RULES

- Do NOT reintroduce backend
- Do NOT use REST APIs
- Do NOT add unnecessary complexity
- Keep everything mobile-first
- Keep code clean and modular
- Prepare structure for future scalability

---

# OUTPUT FORMAT

1. Explain the new architecture briefly
2. Show final folder structure
3. List all created/updated files
4. Then apply changes directly to the repository

---

# GOAL

After your changes:

- Project has NO backend folder
- Supabase is fully integrated
- Auth works
- Local DB exists
- Basic sync logic is ready
- Project is ready for feature development