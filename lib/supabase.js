// lib/supabase.js
// ─────────────────────────────────────────────────────────────────────────────
// Весь сетевой слой работы с Supabase: ключи, RPC-вызовы и офлайн-очередь записи.
// Вынесено из App.jsx без изменений логики — только добавлены export.
// v205 (Доп. 531): переехал из api/ в lib/ — Vercel превращал каждый файл api/ в серверную функцию,
// и этот клиентский модуль висел пустой функцией /api/supabase. В api/ теперь только сервер.
// ─────────────────────────────────────────────────────────────────────────────

// Supabase клиент через fetch
// Ключи можно задать через переменные окружения (Vercel → Settings → Environment Variables):
//   VITE_SUPABASE_URL и VITE_SUPABASE_KEY
// Если переменные не заданы — используется встроенный публичный anon-ключ (рабочий по умолчанию),
// поэтому сборка не сломается, даже если ты ничего не настроишь.
const _ENV = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};
// v223 (Доп. 549): база — через свой сайт. В России провайдеры режут соединения с Supabase (он за Cloudflare: после
// первых ~16 КБ соединение замирает), а сайт на Vercel открывается. На своём адресе (*.vercel.app) приложение ходит к
// базе через сайт: /sb/… → Supabase (rewrites в vercel.json), телефон говорит только с Vercel. Локально, в проверках и
// с другим проектом в VITE_SUPABASE_URL — напрямую, как раньше. SUPABASE_DIRECT — настоящий адрес Supabase: его
// отдаём серверу (push_status, server_check), там он нужен для вызовов «база → функции».
const SB_DEFAULT = "https://gvxhgdynjuaisswplroh.supabase.co";
export const SUPABASE_DIRECT = _ENV.VITE_SUPABASE_URL || SB_DEFAULT;
export const sbBase = (host, origin, direct = SUPABASE_DIRECT) =>
  (direct === SB_DEFAULT && /\.vercel\.app$/i.test(String(host || "")) && /^https:\/\/[^/]+$/.test(String(origin || "")) ? origin + "/sb" : direct);
const _loc = (() => { try { return typeof location !== "undefined" && location ? location : null; } catch (e) { return null; } })();
export const SUPABASE_URL = sbBase(_loc && _loc.hostname, _loc && _loc.origin);
export const SUPABASE_KEY = _ENV.VITE_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eGhnZHluanVhaXNzd3Bscm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjA1ODgsImV4cCI6MjA5NjQzNjU4OH0._4aLd4eb7cSfcqS9EvSwChJR-SixW2tsgn4ksCM5S3g";

// v223: запрос к базе через сайт; сайт не ответил (нет связи до Vercel) — тот же запрос напрямую. Vercel отказал сам
// (заголовки x-vercel-error или x-vercel-mitigated: например, не пускает адрес VPN), а напрямую ответило — дальше до
// перезапуска напрямую. Ответ самой базы (и с ошибкой) отдаём как есть.
const _vercelNo = (r) => !!(r && r.headers && typeof r.headers.get === "function" && (r.headers.get("x-vercel-error") || r.headers.get("x-vercel-mitigated")));
// v224 (Доп. 550): запрос не ждёт вечно. Если SB_WAIT мс не пришло ни байта (ни заголовков, ни следующего куска ответа),
// запрос обрываем: через сайт — пробуем напрямую, напрямую — ошибка, и экран показывает своё «не вышло», а не крутится
// без конца. Раньше зависший ответ (провайдер душит соединение после первых килобайт) держал загрузку до бесконечности, а
// запасной путь срабатывал только на явную ошибку. Ответ читаем целиком здесь же, под тем же сторожем: медленный, но
// живой ответ (каждый кусок взводит сторожа заново) доходит, замерший на середине — нет.
export const SB_WAIT = 20000;
export const sbTimed = (f, url, init, ms) => {
  if (!(ms > 0) || typeof AbortController === "undefined") return f(url, init);
  const ac = new AbortController();
  const outer = init && init.signal;
  if (outer) { if (outer.aborted) ac.abort(); else outer.addEventListener("abort", () => ac.abort(), { once: true }); }
  let t = 0, dead = null;
  const fail = new Promise((_, bad) => { dead = bad; });
  const arm = () => {
    clearTimeout(t);
    t = setTimeout(() => { const e = new Error("timeout"); e.name = "TimeoutError"; try { ac.abort(); } catch (x) { /* */ } dead(e); }, ms);
  };
  arm();
  const run = Promise.resolve(f(url, { ...(init || {}), signal: ac.signal })).then(async (r) => {
    arm();
    if (!r || !r.body || typeof r.body.getReader !== "function" || typeof Response === "undefined") return r;
    const rd = r.body.getReader(), parts = [];
    let n = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; arm(); parts.push(value); n += value.byteLength; }
    const all = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { all.set(p, o); o += p.byteLength; }
    const empty = [101, 204, 205, 304].includes(r.status);
    return new Response(empty ? null : all, { status: r.status, statusText: r.statusText, headers: r.headers });
  });
  return Promise.race([run, fail]).finally(() => clearTimeout(t));
};
export const makeSbFetch = ({ base, direct, fetchFn, wait = SB_WAIT } = {}) => {
  const f0 = fetchFn || ((u, o) => fetch(u, o));
  const f = (u, o) => sbTimed(f0, u, o, wait);
  let cur = base;
  const sb = (path, init) => {
    if (!cur || cur === direct) return f(direct + path, init);
    return f(cur + path, init).then(
      (r) => (_vercelNo(r) ? f(direct + path, init).then((d) => { cur = direct; return d; }, () => r) : r),
      (err) => f(direct + path, init).catch(() => { throw err; }));
  };
  sb.base = () => cur;
  return sb;
};
export const sbFetch = makeSbFetch({ base: SUPABASE_URL, direct: SUPABASE_DIRECT });

// v223: фото и записи голоса из базы — тоже через сайт. Ссылки хранилища лежат в базе полными адресами Supabase (их
// пишут photo-upload, voice-upload, radio-tts). Сервис-воркер такие ссылки переводит сам, но его нет в Telegram на
// айфоне и до первого обновления: там картинка пошла бы напрямую и замерла. Поэтому в ответах базы ссылки хранилища
// меняем на адрес через сайт (sbIn), а в запросах к базе — обратно на настоящие (sbOut): в базе всё как было.
const STORE = "/storage/v1/object/public/";
const _swap = (v, a, b) => {
  if (typeof v === "string") return v.indexOf(a) >= 0 ? v.split(a).join(b) : v;
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = _swap(v[i], a, b); return v; }
  if (v && typeof v === "object") { for (const k of Object.keys(v)) v[k] = _swap(v[k], a, b); return v; }
  return v;
};
export const sbIn = (v, base = sbFetch.base(), direct = SUPABASE_DIRECT) => (base && base !== direct ? _swap(v, direct + STORE, base + STORE) : v);
export const sbOut = (text, site = SUPABASE_URL, direct = SUPABASE_DIRECT) => (site && site !== direct ? _swap(text, site + STORE, direct + STORE) : text);

// Вызов серверных функций авторизации (этап 1 в Supabase)
const _rawRpc = (fn, params) => sbFetch(`/rest/v1/rpc/${fn}`, {
  method: "POST",
  headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
  body: sbOut(JSON.stringify(params || {}))
}).then(r => r.json()).then((j) => sbIn(j));

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
  sbFetch(`/rest/v1/rpc/${item.fn}`, {
    method: "POST",
    headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
    body: sbOut(JSON.stringify(item.params || {}))
  }).then(async (r) => {
    if (!r.ok) return (r.status >= 400 && r.status < 500) ? "drop" : "retry";
    let body = null; try { body = await r.json(); } catch(e) {}
    return (body && body.ok === false) ? "drop" : "ok";
  }).catch(() => "retry");

// Прогон очереди по одному с головы. Безопасно к параллельным записям во время await.
// v64: повторный вызов во время прогона получает тот же promise (бутстрап ждёт именно его), а не пустой.
// v194 (Доп. 519): метка «идёт прогон» снимается после того, как поставлена. Раньше при пустой очереди прогон
// кончался сразу, метку снимал раньше, чем её ставили, и она оставалась навсегда: после первого же такого вызова
// (при старте приложения очередь обычно пуста) очередь в этот запуск больше не уходила — ни по сети, ни раз в минуту,
// ни после удачной записи, только при следующем запуске.
let _flushing = null;
const _flushRun = async () => {
  while (true) {
    const q = _loadQueue();
    if (!q.length) break;
    const item = q[0];
    if (Date.now() - (item.ts || 0) > 7 * 24 * 3600 * 1000) { _saveQueue(q.slice(1)); continue; } // старше 7 дней
    const res = await _sendRpc(item);
    if (res === "retry") break;            // нет сети — оставляем всё на потом
    _saveQueue(_loadQueue().slice(1));      // ok/drop — убираем обработанный (перечитываем на случай новых)
  }
};
export const flushQueue = () => {
  if (_flushing) return _flushing;
  const p = _flushRun().finally(() => { if (_flushing === p) _flushing = null; });   // finally — всегда позже присваивания
  _flushing = p;
  return p;
};

// Запись с гарантией доставки: пробуем сразу, при сбое — в очередь. v126: отвечает, чем кончилось: "ok", "retry" (нет
// сети — запись в очереди, уйдёт позже) или "drop" (сервер отверг: нет функции, отказ).
export const rpcSync = (fn, params) =>
  _sendRpc({ fn, params }).then((res) => {
    if (res === "retry") { const q = _loadQueue(); q.push({ fn, params, ts: Date.now() }); _saveQueue(q); }
    else if (res === "ok") { flushQueue(); }
    return res;
  });

// v194 (Доп. 519): записи, где следующая дописывается к предыдущей, — строго по очереди. Следующая уходит, только
// когда предыдущая записана; нет сети — эта и все следующие встают в офлайн-очередь в том же порядке (очередь шлёт
// по одному); сервер отверг — следующие не шлём: им не к чему пристроиться. Раньше ответ в тесте (log_quiz_answer) и
// «что выбрал» (log_quiz_pick) уходили разом, и «что выбрал» мог прийти первым и лечь в прошлую попытку: у ошибки
// в «Аналитике → Люди» стоял верный ответ. calls — [[fn, params], …]; ответ — как у rpcSync, по последнему шагу.
export const rpcSyncSeq = (calls) => {
  const list = (calls || []).filter((c) => Array.isArray(c) && c[0]);
  const step = (i) => {
    if (i >= list.length) return Promise.resolve("ok");
    return _sendRpc({ fn: list[i][0], params: list[i][1] }).then((res) => {
      if (res === "retry") {
        const q = _loadQueue(), ts = Date.now();
        list.slice(i).forEach(([fn, params]) => q.push({ fn, params, ts }));
        _saveQueue(q);
        return "retry";
      }
      return res === "ok" ? step(i + 1) : res;
    });
  };
  return step(0).then((res) => { if (res === "ok" && list.length) flushQueue(); return res; });
};

export const supabase = {
  from: (table) => ({
    select: (cols) => sbFetch(`/rest/v1/${table}?select=${cols||"*"}`, { headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY } }).then(r => r.json()).then(data => ({ data: sbIn(data), error: null })).catch(error => ({ data: null, error })),
    insert: (row) => sbFetch(`/rest/v1/${table}`, { method: "POST", headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" }, body: sbOut(JSON.stringify(row)) }).then(r => r.ok ? { data: null, error: null } : r.json().then(e => ({ data: null, error: e }))).catch(error => ({ data: null, error }))
  })
};
