// supabase/functions/menu-import/index.ts — v206 (Доп. 532): импорт меню из PDF через Supabase, а не через Vercel.
//
// Владелец (27.11, «Редактор меню», под кнопками красным — «Импорт не ответил (код 403). Нажми ещё раз»): «Ошибку
// выдает». Наш сервер (api/menu-import.js) кодом 403 не отвечает никогда, и в журнале Vercel той попытки нет: запрос
// с телефона остановили раньше, на входе в хостинг. Так отвечает защита Vercel «от ботов», когда запрос из приложения
// не может пройти её проверку сам (страница-проверка вместо ответа функции; с адресов из России такое бывает чаще).
// Наставник (ai-chat) и всё остальное приложение ходят в Supabase и у владельца работают — сюда же переехал импорт.
// Vercel остался запасным: приложение идёт туда, только если этой функции ещё нет (404).
//
// Разговор с моделью — тот же, что в api/menu-import.js (v204, Доп. 530): mode "names" — список позиций; "details" —
// подробности для 1…6 названий, по порядку запроса; без mode — всё сразу. Функция разворачивается одним файлом (как
// ai-chat), поэтому подсказки и разбор здесь — копия api/menu-import.js и lib/menu-import.js; совпадение копий проверяет
// tests/v206.test.js.
//
// v208 (Доп. 534): меню из Word (.docx) или текста — приложение присылает text вместо pdfBase64 (Word читается на
// телефоне), модель получает текст вместо файла; всё остальное — как у PDF.
//
// Секреты: OPENROUTER_API_KEY — тот же, что у ai-chat (уже задан). По желанию: OPENROUTER_MENU_MODEL — своя модель
// первой; MENU_AI_EACH_MS / MENU_AI_TOTAL_MS — сколько ждать модель (по умолчанию 40 и 50 с).
// Развернуть: supabase functions deploy menu-import (или в панели: Edge Functions → Deploy a new function → Via Editor →
// имя menu-import → вставить этот файл → Deploy).

export const MENU_IMPORT_V = 2;   // 2 — меню из Word или текста (v208, Доп. 534)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
// старые ключи — JWT (apikey + Bearer), новые sb_secret_… — только apikey (как в ai-chat)
const isJwt = (k: string) => /^eyJ/.test(k || "");
const keyHeaders = (k: string): Record<string, string> => (isJwt(k) ? { apikey: k, Authorization: "Bearer " + k } : { apikey: k });
const env = (k: string): string => String(Deno.env.get(k) ?? "").trim();

// ── Подсказки модели — слово в слово как в api/menu-import.js ────────────────
export const ALLERGENS = ["Глютен", "Рыба", "Моллюски и ракообразные", "Яйца", "Молоко", "Орехи", "Соя", "Кунжут"];

export const PROMPT = `Ты — методист ресторанной академии. В приложённом PDF — карточки блюд меню.
Верни ТОЛЬКО валидный JSON-массив (без markdown, без пояснений). Каждый элемент:
{
  "name": "название блюда",
  "cat": "раздел меню — выбери один: Холодные закуски | Закуски | Горячие закуски | Салаты | Супы | Горячие блюда | Стейки | Гриль | Паста | Роллы | Сашими | Морепродукты | Гарниры | Десерты | Напитки (если в PDF есть свой раздел — используй его название как есть)",
  "desc": "продающее описание для гостя из PDF, дословно, если есть",
  "ingredients": ["массив", "ингредиентов/компонентов"],
  "allergens": [только точные значения из списка: ${ALLERGENS.join(", ")}],
  "note": "выход блюда в граммах, аллергены вне списка (мёд, горчица, чеснок, кокос, цитрус и т.п.) и КРИТИЧНЫЕ предупреждения (свинина, куриный бульон, алкоголь) — всё одной строкой",
  "pairing": "рекомендация сочетания/подачи, если есть в PDF, иначе пустая строка"
}
Важно: в allergens клади только то, что реально есть в блюде; устричный/рыбный соус — это «Моллюски и ракообразные»/«Рыба»; майонез — «Молоко» и «Яйца». Ничего не выдумывай сверх PDF.`;

export const NAMES_PROMPT = `Ты — методист ресторанной академии. В приложённом PDF — меню ресторана.
Перечисли ВСЕ позиции меню по порядку, как в PDF: блюда, десерты, напитки, коктейли — ничего не пропускай.
Верни ТОЛЬКО валидный JSON-массив (без markdown, без пояснений), каждый элемент:
{"name": "название позиции, как в PDF", "cat": "раздел меню — выбери один: Холодные закуски | Закуски | Горячие закуски | Салаты | Супы | Горячие блюда | Стейки | Гриль | Паста | Роллы | Сашими | Морепродукты | Гарниры | Десерты | Напитки (если в PDF есть свой раздел — используй его название как есть)"}
Ничего не выдумывай сверх PDF.`;

export const detailsPrompt = (names: string[]) => PROMPT + "\nВерни записи ТОЛЬКО для этих позиций меню, в этом порядке: "
  + names.map((n) => "«" + n + "»").join(", ") + ". Название бери из PDF. Остальные позиции не включай.";

// v208 (Доп. 534): меню из Word (.docx) или текста — приложение присылает text вместо pdfBase64 (Word читается на
// телефоне, lib/docx-text.js). Подсказки те же; модели — пояснение, что вместо PDF — этот текст.
export const MAX_TEXT = 120000;
export const TEXT_HEAD = "Меню — текст из файла (Word или текст вместо PDF; всё, что сказано про PDF, относится к этому тексту):\n\n";
export const menuParts = (prompt: string, src: { pdf?: string; text?: string }) => (src && src.text
  ? [{ type: "text", text: prompt }, { type: "text", text: TEXT_HEAD + src.text }]
  : [{ type: "text", text: prompt }, { type: "file", file: { filename: "menu.pdf", file_data: "data:application/pdf;base64," + (src && src.pdf) } }]);

export const SLOW = "AI не успел прочитать меню за отведённое время. Нажми «Из файла» ещё раз; если повторится — раздели меню на части";
export const MAX_B64 = 4_300_000;   // PDF до 3 МБ (как в приложении: MENU_PDF_MAX) — в base64 на треть больше
const lim = () => ({ each: Number(env("MENU_AI_EACH_MS")) || 40000, total: Number(env("MENU_AI_TOTAL_MS")) || 50000 });
export const models = () => [env("OPENROUTER_MENU_MODEL"), "anthropic/claude-sonnet-4.6", "google/gemini-2.5-flash"].filter(Boolean);

// ── Общее с lib/menu-import.js — та же логика ────────────────────────────────
export const MENU_NAMES_MAX = 200;
export const MENU_DETAILS_MAX = 6;
export const normName = (s: unknown) => String(s == null ? "" : s).toLowerCase().replace(/ё/g, "е")
  .replace(/[«»"'“”„`]/g, "").replace(/\s+/g, " ").trim();

type Row = Record<string, unknown>;

export function cleanNames(arr: unknown): { name: string; cat: string }[] {
  const seen = new Set<string>(), out: { name: string; cat: string }[] = [];
  for (const x of Array.isArray(arr) ? arr : []) {
    const o = x && typeof x === "object" ? (x as Row) : null;
    const name = String((o ? o.name : x) || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const k = normName(name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ name, cat: String((o && o.cat) || "").trim().slice(0, 40) });
    if (out.length >= MENU_NAMES_MAX) break;
  }
  return out;
}

export function askNames(names: unknown): string[] | null {
  if (!Array.isArray(names) || !names.length || names.length > MENU_DETAILS_MAX) return null;
  const out = names.map((n) => String(n == null ? "" : n).replace(/\s+/g, " ").trim().slice(0, 120));
  return out.every((n) => normName(n)) ? out : null;
}

export function pickRequested(dishes: unknown, names: string[]): { dishes: Row[]; missing: string[] } {
  const list = (Array.isArray(dishes) ? dishes : []) as Row[];
  const used = new Set<number>(), out: Row[] = [], missing: string[] = [];
  const keyOf = (d: Row) => normName(d && d.name);
  for (const n of names) {
    const k = normName(n);
    let i = list.findIndex((d, j) => !used.has(j) && keyOf(d) === k);
    if (i < 0) i = list.findIndex((d, j) => { const dk = keyOf(d); return !used.has(j) && dk.length >= 3 && (dk.includes(k) || k.includes(dk)); });
    if (i < 0) { missing.push(n); continue; }
    used.add(i);
    out.push({ ...list[i], ask: n });
  }
  return { dishes: out, missing };
}

// ── Разбор ответа модели — как в api/menu-import.js ──────────────────────────
export function parseDishes(text: unknown): unknown {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); } catch (_e) { /* пробуем вырезать массив */ }
  const a = clean.indexOf("["), b = clean.lastIndexOf("]");
  if (a >= 0 && b > a) {
    try { return JSON.parse(clean.slice(a, b + 1)); } catch (_e) { /* ниже — 422 */ }
  }
  return null;
}

function openRouterText(data: Row | null): string {
  const ch = data && Array.isArray(data.choices) ? (data.choices[0] as Row | undefined) : undefined;
  const msg = ch && (ch.message as Row | undefined);
  const c = msg && msg.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => (p && (p as Row).text) || "").join("");
  return "";
}

export function sanitize(dishes: unknown[], max: number): Row[] {
  return dishes.slice(0, max).map((x) => {
    const d = (x && typeof x === "object" ? x : {}) as Row;
    return {
      name: String(d.name || "").slice(0, 120),
      cat: String(d.cat || "").slice(0, 40),
      desc: String(d.desc || "").slice(0, 1200),
      ingredients: Array.isArray(d.ingredients) ? d.ingredients.map((v) => String(v).slice(0, 160)).slice(0, 40) : [],
      allergens: Array.isArray(d.allergens) ? d.allergens.filter((a) => ALLERGENS.includes(String(a))) : [],
      note: String(d.note || "").slice(0, 600),
      pairing: String(d.pairing || "").slice(0, 300),
    };
  }).filter((d) => d.name);
}

// ── Лимит в памяти: импорт (список или «всё сразу») — 8 в час, подробности — 120 в час ──
const buckets = new Map<string, { start: number; n: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 500) for (const [k, b] of buckets) if (now - b.start > windowMs) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) { buckets.set(key, { start: now, n: 1 }); return true; }
  if (b.n >= limit) return false;
  b.n++;
  return true;
}

// ── Вход: только сотрудник с живой сессией (whoami, как у ai-chat) ──────────
async function whoami(token: string): Promise<Row | null> {
  if (!token || token.length > 200) return null;
  const url = env("SUPABASE_URL"), key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_ANON_KEY");
  try {
    const r = await fetch(url + "/rest/v1/rpc/whoami", {
      method: "POST",
      headers: { ...keyHeaders(key), "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.ok ? ((d.employee || {}) as Row) : null;
  } catch (_e) {
    return null;
  }
}

// ── OpenRouter: модели по очереди, каждой не больше each, всем вместе не больше total ──
type Out = { ok: true; text: string; model: string } | { ok: false; status: number; error: string };
async function viaOpenRouter(key: string, src: { pdf?: string; text?: string }, prompt: string, maxTokens: number): Promise<Out> {
  const headers: Record<string, string> = {
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    "X-Title": "Service Academy menu import",   // только латиница: HTTP-заголовок — ByteString
  };
  if (env("APP_URL")) headers["HTTP-Referer"] = env("APP_URL");
  const list = models(), L = lim(), t0 = Date.now();
  let lastErr = "ни одна модель не ответила", late = 0;
  for (let i = 0; i < list.length; i++) {
    const model = list[i];
    const left = L.total - (Date.now() - t0);
    if (left < 3000) break;
    const wait = i === list.length - 1 ? left : Math.min(L.each, left);
    const ac = new AbortController();
    const tm = setTimeout(() => ac.abort(), wait);
    let r: Response, data: Row | null;
    try {
      r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        signal: ac.signal,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: 0,
          messages: [{
            role: "user",
            content: menuParts(prompt, src),   // v208: PDF или текст из Word
          }],
        }),
      });
      data = await r.json();
    } catch (e) {
      clearTimeout(tm);
      if (ac.signal.aborted) { late++; lastErr = model + ": не ответила за " + Math.round(wait / 1000) + " с"; continue; }
      lastErr = model + ": сеть — " + (e && (e as Error).message ? (e as Error).message : "unknown");
      continue;
    }
    clearTimeout(tm);
    const ch = data && Array.isArray(data.choices) ? (data.choices[0] as Row | undefined) : undefined;
    const err = ((data && data.error) || (ch && ch.error)) as Row | undefined;
    if (r.ok && !err) {
      const text = openRouterText(data);
      if (text.trim()) return { ok: true, text, model: String((data && data.model) || model) };
      lastErr = model + ": пустой ответ";
      continue;
    }
    const status = r.status || Number(err && err.code) || 0;
    const msg = String((err && err.message) || "HTTP " + status);
    // ключ не принят или кончились кредиты — другая модель не поможет
    if (status === 401) return { ok: false, status: 502, error: "OpenRouter не принял ключ (401). Проверь секрет OPENROUTER_API_KEY: Supabase → Edge Functions → Secrets." };
    if (status === 402) return { ok: false, status: 502, error: "На OpenRouter закончились кредиты (402) — пополни баланс: openrouter.ai → Credits." };
    console.error("menu-import openrouter", model, status, msg.slice(0, 200));
    lastErr = model + ": " + msg;
  }
  if (late) { console.error("menu-import slow", lastErr); return { ok: false, status: 504, error: SLOW }; }
  return { ok: false, status: 502, error: "Ошибка OpenRouter — " + lastErr };
}

// ── Запрос ───────────────────────────────────────────────────────────────────
export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Только POST" }, 405);
  const started = Date.now();
  let mode = "full", info = "";
  // строка в журнале функции на каждый запрос: режим, ответ, время, сколько позиций или ошибка; у текста — пометка text
  let from = "";
  const done = (data: unknown, status = 200) => {
    console.log("menu-import", mode + from, status, (Date.now() - started) + "ms", info);
    return json(data, status);
  };

  const orKey = env("OPENROUTER_API_KEY");
  if (!orKey) { info = "no key"; return done({ error: "OPENROUTER_API_KEY не задан: Supabase → Edge Functions → Secrets (тот же ключ, что у ai-chat)." }, 500); }

  let body: Row = {};
  try { body = (await req.json()) as Row || {}; } catch (_e) { return done({ error: "Файл не получен" }, 400); }
  mode = body.mode === "names" || body.mode === "details" ? String(body.mode) : "full";
  if (typeof body.text === "string" && body.text.trim()) from = "/text";
  const token = typeof body.token === "string" ? body.token : "";
  const pdf = typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";   // v208: меню из Word или текста

  // проверки — до обращения к модели: чужой запрос не тратит ни одного токена
  const emp = await whoami(token);
  if (!emp) return done({ error: "Сессия не найдена — войди в приложение заново и повтори импорт" }, 401);
  if (!(mode === "details" ? rateLimit("menud:" + token, 120, 3600_000) : rateLimit("menu:" + token, 8, 3600_000))) {
    return done({ error: "Слишком много импортов подряд — попробуй через час" }, 429);
  }
  if (!pdf && !text) return done({ error: "Файл не получен" }, 400);
  if (!text && pdf.length > MAX_B64) return done({ error: "PDF больше 3 МБ: сожми файл или раздели меню на части" }, 413);
  if (text.length > MAX_TEXT) return done({ error: "Текст меню слишком длинный: раздели файл на части" }, 413);
  const want = mode === "details" ? askNames(body.names) : null;
  if (mode === "details" && !want) return done({ error: "Не понял, какие блюда читать: нажми «Из файла» ещё раз" }, 400);
  const src = text ? { text } : { pdf: pdf.replace(/^data:[^;]*;base64,/, "") };
  const prompt = mode === "names" ? NAMES_PROMPT : mode === "details" ? detailsPrompt(want || []) : PROMPT;
  const maxTokens = mode === "names" ? 3000 : mode === "details" ? 4000 : 8000;

  try {
    const out = await viaOpenRouter(orKey, src, prompt, maxTokens);
    if (!out.ok) { info = out.error.slice(0, 160); return done({ error: out.error }, out.status || 502); }
    const dishes = parseDishes(out.text);
    if (!dishes) return done({ error: "Модель вернула не-JSON, попробуй ещё раз" }, 422);
    if (!Array.isArray(dishes)) return done({ error: "Ожидался массив блюд" }, 422);
    if (mode === "names") {
      const names = cleanNames(dishes);
      if (!names.length) return done({ error: "В PDF не нашлось ни одного блюда — проверь файл и попробуй ещё раз" }, 422);
      info = "names=" + names.length + " " + out.model;
      return done({ names, model: out.model });
    }
    const safe = sanitize(dishes, mode === "details" ? 12 : 60);
    if (mode === "details") {
      const picked = pickRequested(safe, want || []);
      info = "dishes=" + picked.dishes.length + " missing=" + picked.missing.length + " " + out.model;
      return done({ dishes: picked.dishes, missing: picked.missing, model: out.model });
    }
    if (!safe.length) return done({ error: "В PDF не нашлось ни одного блюда — проверь файл и попробуй ещё раз" }, 422);
    info = "dishes=" + safe.length + " " + out.model;
    return done({ dishes: safe, model: out.model });
  } catch (e) {
    const m = e && (e as Error).message ? (e as Error).message : "unknown";
    info = "crash " + m.slice(0, 160);
    return done({ error: "Сбой импорта: " + m }, 500);
  }
}

Deno.serve(handle);
