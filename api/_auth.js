// api/_auth.js — общая защита серверных AI-функций (/api/assistant, /api/menu-import).
// Файлы с «_» в начале имени Vercel НЕ превращает в маршруты — это внутренний хелпер.
//
// Две линии обороны:
//   1. verifySession(token) — сессия проверяется через тот же RPC whoami, что и в
//      приложении. Без валидного sa_session_token функция отвечает 401 и не тратит
//      ни одного токена Anthropic.
//   2. rateLimit(key, limit, windowMs) — простой лимит в памяти инстанса.
//      Честно: serverless-инстансы перезапускаются, поэтому это мягкая первая
//      линия против случайного зацикливания и грубого абуза, а не крепость.
//      Жёсткий лимит при желании добавляется на стороне Supabase (как в ai-chat).

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://gvxhgdynjuaisswplroh.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eGhnZHluanVhaXNzd3Bscm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjA1ODgsImV4cCI6MjA5NjQzNjU4OH0._4aLd4eb7cSfcqS9EvSwChJR-SixW2tsgn4ksCM5S3g";

/**
 * Проверка сессии сотрудника. Возвращает employee или null.
 * Fail closed: если Supabase недоступен — доступа нет (лучше повторить запрос,
 * чем оставить дорогой эндпоинт открытым).
 */
export async function verifySession(token) {
  if (!token || typeof token !== "string" || token.length > 200) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/whoami`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token: token }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.ok ? d.employee || {} : null;
  } catch (e) {
    return null;
  }
}

// ── Rate-limit в памяти инстанса ─────────────────────────────────────────────
const _buckets = new Map();

/** true — запрос разрешён; false — лимит исчерпан (вызвавший отвечает 429). */
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  // лёгкая уборка, чтобы Map не рос бесконечно на долгоживущем инстансе
  if (_buckets.size > 500) {
    for (const [k, b] of _buckets) if (now - b.start > windowMs) _buckets.delete(k);
  }
  const b = _buckets.get(key);
  if (!b || now - b.start > windowMs) {
    _buckets.set(key, { start: now, n: 1 });
    return true;
  }
  if (b.n >= limit) return false;
  b.n += 1;
  return true;
}
