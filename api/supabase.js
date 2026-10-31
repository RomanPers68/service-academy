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
const _rawRpc = (fn, params) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
  method: "POST",
  headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify(params || {})
}).then(r => r.json());

// ── v64 (Доп. 377): старт одним запросом ──────────────────────────────────────────────────────────────
// При открытии приложение звало 10–12 функций (whoami, my_state, day_brief, team_scores…), причём все, кроме whoami, —
// только после ответа whoami: на 3G это два круга по секунде и больше. Теперь App при старте зовёт startBoot(token):
// одна функция app_bootstrap (этап 27) собирает ответы всех этих функций разом. Остальной код не меняется:
// rpc(fn) для функции из списка берёт её ответ из общего — один раз и только в первые полминуты (дальше — по сети,
// как обычно, чтобы не отдать устаревшее). Нет этапа 27 на сервере — всё как раньше, и сутки мы его не спрашиваем
// (sa_boot_missing). Часть с ошибкой (error: "boot") или без ответа тоже дозапрашивается сама.
// Незаписанное с прошлого раза (офлайн-очередь) уходит раньше бутстрапа: my_state в ответе должен уже знать про него.
// Только то, что главная спрашивает при каждом открытии. mastery_list и team_achievements — нет: их зовут «Команда» и
// «Путь мастера», когда человек туда заходит, — считать их на сервере при каждом старте было бы впустую.
export const BOOT_FNS = ["whoami", "my_state", "my_reset_at", "my_mentors", "quiz_key_rank", "team_profiles", "team_scores", "pair_status", "day_brief", "cms_list_lessons"];
export const BOOT_TTL_MS = 30 * 1000;
const BOOT_SKIP_KEY = "sa_boot_missing";
let _boot = null;   // { token, at, promise: Promise<parts|null>, used: Set<fn> }
export const bootParts = (res) => (res && res.ok && res.parts && typeof res.parts === "object" && !Array.isArray(res.parts) ? res.parts : null);
export const bootPart = (parts, fn) => { const v = parts ? parts[fn] : undefined; return v === undefined || v === null || (typeof v === "object" && v.error === "boot") ? undefined : v; };
export const startBoot = (token, now = Date.now()) => {
  if (!token) return null;
  // повторный запуск с тем же токеном в первые секунды (StrictMode в dev, вход сразу после старта) — тот же запрос
  if (_boot && _boot.token === token && now - _boot.at < 3000) return _boot.promise;
  try { const t = Number(localStorage.getItem(BOOT_SKIP_KEY) || 0); if (t && now - t < 86400000) return null; } catch (e) {}
  const go = () => _rawRpc("app_bootstrap", { p_token: token }).then((res) => {
    if (rpcMissing(res)) { try { localStorage.setItem(BOOT_SKIP_KEY, String(Date.now())); } catch (e) {} return null; }
    return bootParts(res);
  });
  const first = queueLength() ? Promise.resolve(flushQueue()).catch(() => {}) : Promise.resolve();
  const promise = first.then(go).catch(() => null);
  _boot = { token, at: now, promise, used: new Set() };
  return promise;
};
export const bootActive = (fn, params, now = Date.now()) => {
  const b = _boot;
  return !!(b && params && params.p_token === b.token && now - b.at < BOOT_TTL_MS && BOOT_FNS.includes(fn) && !b.used.has(fn));
};
export const rpc = (fn, params) => {
  if (bootActive(fn, params)) {
    const b = _boot; b.used.add(fn);
    return b.promise.then((parts) => { const v = bootPart(parts, fn); return v !== undefined ? v : _rawRpc(fn, params); });
  }
  return _rawRpc(fn, params);
};
export const _resetBoot = () => { _boot = null; };   // для тестов

// Текущий токен сессии — серверные функции записи берут из него личность пользователя
export const saToken = () => { try { return localStorage.getItem("sa_session_token"); } catch(e) { return null; } };

// Этап 21: функции, которых на сервере ещё нет. PostgREST отвечает 404 с кодом
// PGRST202 (или 42883 — нет функции с такими параметрами). По этому признаку
// приложение читает данные по-старому, пока владелец не выполнил новый SQL-этап, —
// так новую версию можно выкладывать в любом порядке с базой.
export const rpcMissing = (res) => !!(res && typeof res === "object" && !Array.isArray(res)
  && (res.code === "PGRST202" || res.code === "42883"));

// ── Офлайн-очередь записи: при сбое сети сохранения не теряются ──────────────
const SYNC_KEY = "sa_sync_queue";
const _loadQueue = () => { try { return JSON.parse(localStorage.getItem(SYNC_KEY) || "[]"); } catch(e) { return []; } };
export const queueLength = () => _loadQueue().length;   // v64: бутстрап ждёт, пока очередь не уйдёт
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
// v64: повторный вызов во время прогона получает тот же promise (бутстрап ждёт именно его), а не пустой.
let _flushing = null;
export const flushQueue = () => {
  if (_flushing) return _flushing;
  _flushing = (async () => {
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
    } finally { _flushing = null; }
  })();
  return _flushing;
};

// Запись с гарантией доставки: пробуем сразу, при сбое — в очередь. v126: отвечает, чем кончилось: "ok", "retry" (нет
// сети — запись в очереди, уйдёт позже) или "drop" (сервер отверг: нет функции, отказ).
export const rpcSync = (fn, params) =>
  _sendRpc({ fn, params }).then((res) => {
    if (res === "retry") { const q = _loadQueue(); q.push({ fn, params, ts: Date.now() }); _saveQueue(q); }
    else if (res === "ok") { flushQueue(); }
    return res;
  });

export const supabase = {
  from: (table) => ({
    select: (cols) => fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols||"*"}`, { headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY } }).then(r => r.json()).then(data => ({ data, error: null })).catch(error => ({ data: null, error })),
    insert: (row) => fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" }, body: JSON.stringify(row) }).then(r => r.ok ? { data: null, error: null } : r.json().then(e => ({ data: null, error: e }))).catch(error => ({ data: null, error }))
  })
};
