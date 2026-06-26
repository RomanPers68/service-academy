// api/supabase.js
// ─────────────────────────────────────────────────────────────────────────────
// Весь сетевой слой работы с Supabase: ключи, RPC-вызовы и офлайн-очередь записи.
// Вынесено из App.jsx без изменений логики — только добавлены export.
// ─────────────────────────────────────────────────────────────────────────────

// Supabase клиент через fetch
// Ключи можно задать через переменные окружения (Vercel → Settings → Environment Variables):
//   VITE_SUPABASE_URL и VITE_SUPABASE_KEY
// Если переменные не заданы — используется встроенный публичный anon-ключ (рабочий по умолчанию),
// поэтому сборка не сломается, даже если ты ничего не настроишь.
const _ENV = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};
export const SUPABASE_URL = _ENV.VITE_SUPABASE_URL || "https://gvxhgdynjuaisswplroh.supabase.co";
export const SUPABASE_KEY = _ENV.VITE_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eGhnZHluanVhaXNzd3Bscm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjA1ODgsImV4cCI6MjA5NjQzNjU4OH0._4aLd4eb7cSfcqS9EvSwChJR-SixW2tsgn4ksCM5S3g";

// Вызов серверных функций авторизации (этап 1 в Supabase)
export const rpc = (fn, params) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
  method: "POST",
  headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify(params || {})
}).then(r => r.json());

// Текущий токен сессии — серверные функции записи берут из него личность пользователя
export const saToken = () => { try { return localStorage.getItem("sa_session_token"); } catch(e) { return null; } };

// ── Офлайн-очередь записи: при сбое сети сохранения не теряются ──────────────
const SYNC_KEY = "sa_sync_queue";
const _loadQueue = () => { try { return JSON.parse(localStorage.getItem(SYNC_KEY) || "[]"); } catch(e) { return []; } };
const _saveQueue = (q) => { try { localStorage.setItem(SYNC_KEY, JSON.stringify((q || []).slice(-200))); } catch(e) {} };

// Отправить один вызов: "ok" (успех) | "drop" (сервер отверг, повтор не поможет) | "retry" (нет сети)
const _sendRpc = (item) =>
  fetch(`${SUPABASE_URL}/rest/v1/rpc/${item.fn}`, {
    method: "POST",
    headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(item.params || {})
  }).then(async (r) => {
    if (!r.ok) return (r.status >= 400 && r.status < 500) ? "drop" : "retry";
    let body = null; try { body = await r.json(); } catch(e) {}
    return (body && body.ok === false) ? "drop" : "ok";
  }).catch(() => "retry");

// Прогон очереди по одному с головы. Безопасно к параллельным записям во время await.
let _flushing = false;
export const flushQueue = async () => {
  if (_flushing) return;
  _flushing = true;
  try {
    while (true) {
      const q = _loadQueue();
      if (!q.length) break;
      const item = q[0];
      if (Date.now() - (item.ts || 0) > 7 * 24 * 3600 * 1000) { _saveQueue(q.slice(1)); continue; } // старше 7 дней
      const res = await _sendRpc(item);
      if (res === "retry") break;            // нет сети — оставляем всё на потом
      _saveQueue(_loadQueue().slice(1));      // ok/drop — убираем обработанный (перечитываем на случай новых)
    }
  } finally { _flushing = false; }
};

// Запись с гарантией доставки: пробуем сразу, при сбое — в очередь.
export const rpcSync = (fn, params) =>
  _sendRpc({ fn, params }).then((res) => {
    if (res === "retry") { const q = _loadQueue(); q.push({ fn, params, ts: Date.now() }); _saveQueue(q); }
    else if (res === "ok") { flushQueue(); }
  });

export const supabase = {
  from: (table) => ({
    select: (cols) => fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols||"*"}`, { headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY } }).then(r => r.json()).then(data => ({ data, error: null })).catch(error => ({ data: null, error })),
    insert: (row) => fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" }, body: JSON.stringify(row) }).then(r => r.ok ? { data: null, error: null } : r.json().then(e => ({ data: null, error: e }))).catch(error => ({ data: null, error }))
  })
};
