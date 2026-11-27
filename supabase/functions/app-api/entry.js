// supabase/functions/app-api/entry.js — v207 (Доп. 533): серверные AI-функции приложения в Supabase, а не в Vercel.
//
// Владелец (27.11, после v206 — импорт меню через Supabase заработал): «Да, давай исправим». У него Vercel уже
// останавливал запросы кодом 403 до наших функций: импорт меню (v206) и поиск в интернете (v155, Доп. 479). Здесь —
// остальные три: импорт винной карты, помощник уроков и справочника, ответы из интернета. Код обработчиков не
// копируется: это те же файлы api/wine-import.js, api/lesson-assist.js, api/web-answer.js. Здесь — переходник: запрос
// Supabase (Request) → привычные им req/res, ответ → Response.
//
// Адрес: /functions/v1/app-api/<имя> — wine-import, lesson-assist, web-answer. Приложение идёт сюда через apiFetch
// (lib/api-fetch.js); функции нет (404) — туда же, куда раньше, /api/<имя> в Vercel.
//
// Разворачивается одним файлом: tools/claude/edge-build.mjs собирает этот файл со всем, что он подключает, в
// supabase/functions/app-api/index.ts (собранный файл руками не правят). Секреты — те же, что у ai-chat
// (OPENROUTER_API_KEY); модели и время — те же переменные, что были в Vercel (OPENROUTER_WINE_MODEL и др.), по желанию.
import "./shim.js";
import wineImport from "../../../api/wine-import.js";
import lessonAssist from "../../../api/lesson-assist.js";
import webAnswer from "../../../api/web-answer.js";

export const APP_API_V = 1;
export const ROUTES = { "wine-import": wineImport, "lesson-assist": lessonAssist, "web-answer": webAnswer };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Имя функции из адреса: …/app-api/wine-import → wine-import. */
export const routeOf = (url) => {
  try { return new URL(url).pathname.split("/").filter(Boolean).pop() || ""; } catch (e) { return ""; }
};

/** res в духе Vercel: status(), json(), setHeader(), send(), end(); что записали — то и уйдёт ответом. */
export function makeRes() {
  const out = { status: 200, headers: {}, body: "" };
  const res = {
    statusCode: 200,
    status(c) { res.statusCode = Number(c) || 200; return res; },
    setHeader(k, v) { out.headers[k] = String(v); return res; },
    json(o) { out.body = JSON.stringify(o); out.headers["Content-Type"] = "application/json"; return res; },
    send(x) { out.body = typeof x === "string" ? x : JSON.stringify(x); return res; },
    end(x) { if (x != null) out.body = String(x); return res; },
    on() { return res; },
  };
  return { res, out };
}

export async function handle(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const name = routeOf(req.url);
  const fn = Object.prototype.hasOwnProperty.call(ROUTES, name) ? ROUTES[name] : null;
  if (!fn) return json({ error: "Нет такой функции: " + name.slice(0, 40) }, 404);
  let body = {};
  if (req.method === "POST") { try { body = (await req.json()) || {}; } catch (e) { body = {}; } }
  const { res, out } = makeRes();
  const started = Date.now();
  try {
    let query = {};
    try { query = Object.fromEntries(new URL(req.url).searchParams); } catch (e) { /* без параметров */ }
    await fn({ method: req.method, body, query, headers: Object.fromEntries(req.headers) }, res);
  } catch (e) {
    const m = e && e.message ? String(e.message) : "unknown";
    console.error("app-api", name, "crash", m.slice(0, 200));
    return json({ error: "Сбой функции " + name + ": " + m.slice(0, 200) }, 500);
  }
  // строка в журнале функции на каждый запрос: какая функция, ответ, время
  console.log("app-api", name, res.statusCode, (Date.now() - started) + "ms");
  return new Response(out.body, { status: res.statusCode, headers: { ...CORS, ...out.headers } });
}

Deno.serve(handle);
