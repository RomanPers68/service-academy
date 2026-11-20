// Service Academy — floor-scan: схема зала по фото плана (v179, Доп. 504).
//
// Владелец (20.11): «Может добавим добавление плана зала по фото или что-то вроде этого?»
// POST { token, image } → { ok: true, v, plan, box, tables: [{ b, shape, seats, n }], bars, doors, note, model, remaining }
//   или { ok: false, error }.
// image — data:image/jpeg;base64,… Телефон присылает фото плана до 1568 точек по длинной стороне с сеткой поверх: линии
// через каждые 10% ширины и высоты с подписями, по ним модель точнее называет места столов. Координаты в ответе —
// проценты фото: b = [лево, верх, право, низ]. На сетку схемы (8 клеток) столы раскладывает приложение (lib/floor-scan.js).
//
// Права: живая сессия (whoami) и руководитель: менеджер, старший, владелец, админ — как у редактора схемы зала.
// Модель: секрет FLOOR_MODEL, иначе OPENROUTER_MODEL (anthropic/claude-haiku-5.5 фото понимает); не задано — бесплатные
// модели OpenRouter, которые принимают фото. Модель из секрета фото не принимает — пробуем бесплатные с фото.
// Лимит — 20 распознаваний в день на сотрудника (админ — без лимита), счётчик — таблица ai_usage (как у Наставника).
//
// Деплой: Supabase → Edge Functions → Deploy a new function → Via Editor → имя floor-scan → вставить этот файл → Deploy
// (или `supabase functions deploy floor-scan`). Секреты новые не нужны: OPENROUTER_API_KEY и OPENROUTER_MODEL общие для
// всех функций проекта, адрес базы и сервисный ключ функция получает сама.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
// у Supabase два формата ключей: старые JWT (eyJ…) — apikey и Bearer; новые (sb_secret_…) — только apikey (Доп. 191)
const isJwt = (k: string) => /^eyJ/.test(k || "");
const keyHeaders = (k: string): Record<string, string> => (isJwt(k) ? { apikey: k, Authorization: "Bearer " + k } : { apikey: k });

export const FLOOR_SCAN_V = 1;
export const LEAD_POS = ["manager", "senior", "owner", "head", "admin", "service_manager"];
export const DAILY_SCANS = 20;
export const MAX_IMAGE = 4_000_000;   // знаков data: URL (~3 МБ фото); телефон шлёт 0,2–0,6 МБ

// ── модели Claude новее 4.6 (копия из ai-chat: файлы функций разворачиваются по отдельности) ──
export function claudeVer(m: string): { major: number; minor: number } | null {
  const s = String(m || "").toLowerCase();
  if (!s.includes("claude")) return null;
  if (/claude-[a-z]+-latest/.test(s)) return { major: 99, minor: 0 };
  const x = /claude-(?:[a-z]+-)?(\d+)(?:[.-](\d{1,2})(?!\d))?/.exec(s);
  return x ? { major: Number(x[1]), minor: Number(x[2] || 0) } : null;
}
export function isNewClaude(m: string) {
  const v = claudeVer(m);
  return !!v && (v.major > 4 || (v.major === 4 && v.minor >= 7));
}
export type Think = "off" | "low" | "medium";
export function genOpts(m: string, maxTokens: number, temperature: number, think: Think = "off"): Record<string, unknown> {
  if (!isNewClaude(m)) return { max_tokens: maxTokens, temperature };
  const mt = Math.ceil(maxTokens * 1.35);
  if (think === "off" && /claude-haiku|claude-[\d.]+-haiku/i.test(m)) return { max_tokens: mt, reasoning: { enabled: false } };
  const effort = think === "medium" ? "medium" : "low";
  return { max_tokens: mt + (effort === "medium" ? 8000 : 4000), reasoning: { effort, exclude: true } };
}

// ── подсказка ──
export const SCAN_SYSTEM = [
  "Ты переносишь схему зала ресторана с фотографии в приложение для хостес.",
  "На фото план зала, вид сверху: чертёж, план эвакуации, схема из программы бронирования или рисунок от руки. Фото может быть снято под углом, с бликами, с лишним по краям.",
  "Поверх фото нанесена сетка: тонкие линии через каждые 10% ширины и высоты, у линий подписи 10…90 (проценты). Координаты отсчитывай от левого верхнего угла фото: x — процент ширины слева направо, y — процент высоты сверху вниз, от 0 до 100, можно с десятыми.",
  "Найди все столы для гостей. Для каждого стола:",
  "- b — рамка стола без стульев: [лево, верх, право, низ] в процентах; сверяйся с сеткой, точность важна;",
  '- shape — "round" (круглый или овальный), "square" (квадратный) или "rect" (прямоугольный, вытянутый);',
  "- seats — сколько мест: по нарисованным стульям или по подписи («4», «4 места», «×4», «4p»); не видно — null;",
  '- n — номер стола, если он подписан («5», «№5», «Стол 5», «В3»); нет — "".',
  "Если есть, ещё:",
  "- box — рамка самого зала по внешним стенам: [лево, верх, право, низ];",
  "- bars — барные стойки, рамки [лево, верх, право, низ];",
  "- doors — входы в зал, точки [x, y].",
  "Не считай столами отдельные стулья, диваны без стола, барные стулья, кухонное и другое оборудование, колонны, подписи, легенду и штамп чертежа.",
  'Если на фото не план зала (фото самого зала, людей, меню, документа), ответь "plan": false и пустым списком столов.',
  "Ответ — только JSON, без пояснений и без разметки:",
  '{"plan":true,"box":[0,0,100,100],"tables":[{"b":[10.5,20,18,27.5],"shape":"square","seats":4,"n":"1"}],"bars":[],"doors":[],"note":""}',
  "note — коротко, что мешало (размыто, обрезано, часть зала не видна), или пустая строка.",
].join("\n");
export const SCAN_USER = "Распознай план зала на фото. Перечисли все столы, даже если их много.";
export function scanRequest(m: string, image: string) {
  return {
    model: m,
    messages: [
      { role: "system", content: SCAN_SYSTEM },
      { role: "user", content: [{ type: "text", text: SCAN_USER }, { type: "image_url", image_url: { url: image } }] },
    ],
    ...genOpts(m, 3000, 0.2, "low"),
  };
}

// ── ответ модели ──
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN);
const pct = (v: number) => Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
function box4(a: unknown): number[] | null {
  if (!Array.isArray(a) || a.length < 4) return null;
  const v = a.slice(0, 4).map(num);
  if (v.some((x) => !Number.isFinite(x))) return null;
  let [x1, y1, x2, y2] = v.map(pct);
  if (x2 < x1) [x1, x2] = [x2, x1];
  if (y2 < y1) [y1, y2] = [y2, y1];
  return x2 - x1 < 0.3 || y2 - y1 < 0.3 ? null : [x1, y1, x2, y2];
}
/** Текст модели → объект JSON: без ```-разметки, от первой «{» до последней «}»; не JSON — null */
export function extractJson(text: string): Record<string, unknown> | null {
  const s = String(text || "").replace(/```(?:json)?/gi, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { const o = JSON.parse(s.slice(a, b + 1)); return o && typeof o === "object" && !Array.isArray(o) ? o : null; } catch (_e) { return null; }
}
/** Ответ модели → то, что уйдёт приложению: числа в пределах, лишнее отброшено */
export function cleanReply(o: Record<string, unknown>) {
  const tables = (Array.isArray(o.tables) ? o.tables : []).slice(0, 150).map((t: any) => {
    const b = box4(t && t.b);
    if (!b) return null;
    const sh = String((t && t.shape) || "").toLowerCase();
    const shape = /round|circle|oval|кругл|овал/.test(sh) ? "round" : /rect|long|прямоуг|длин/.test(sh) ? "rect" : "square";
    const s = Math.round(num(t.seats));
    return { b, shape, seats: s >= 1 && s <= 20 ? s : null, n: String(t.n == null ? "" : t.n).trim().slice(0, 12) };
  }).filter(Boolean);
  const bars = (Array.isArray(o.bars) ? o.bars : []).map(box4).filter(Boolean).slice(0, 4);
  const doors = (Array.isArray(o.doors) ? o.doors : []).map((d: any) => {
    if (!Array.isArray(d) || d.length < 2) return null;
    const x = num(d[0]), y = num(d[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? [pct(x), pct(y)] : null;
  }).filter(Boolean).slice(0, 4);
  return { plan: o.plan !== false, box: box4(o.box), tables, bars, doors, note: String(o.note || "").replace(/\s+/g, " ").trim().slice(0, 200) };
}
const textOf = (content: unknown) => (typeof content === "string" ? content
  : Array.isArray(content) ? content.map((p: any) => (p && typeof p.text === "string" ? p.text : "")).join("") : "");

// ── бесплатные модели, которые принимают фото (живой список OpenRouter, кэш на час) ──
let visionCache: { ids: string[]; at: number } | null = null;
export async function visionFree(): Promise<string[]> {
  if (visionCache && Date.now() - visionCache.at < 3600_000) return visionCache.ids;
  try {
    const j = await fetch("https://openrouter.ai/api/v1/models").then((r) => r.json());
    const rank = (id: string) => (/gemini/.test(id) ? 0 : /qwen.*vl|vl.*qwen/.test(id) ? 1 : /llama-4/.test(id) ? 2 : /mistral-small|pixtral/.test(id) ? 3 : /gemma/.test(id) ? 4 : 5);
    const ids = (Array.isArray(j?.data) ? j.data : [])
      .filter((m: any) => String(m?.id || "").endsWith(":free") && Array.isArray(m?.architecture?.input_modalities) && m.architecture.input_modalities.includes("image"))
      .map((m: any) => String(m.id))
      .sort((a: string, b: string) => rank(a) - rank(b));
    if (ids.length) visionCache = { ids, at: Date.now() };
    return ids;
  } catch (_e) { return []; }
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  try {
    const body = await req.json().catch(() => null);
    const token = String(body?.token || "");
    const image = String(body?.image || "");
    if (!token || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]/.test(image) || image.length < 200) return json({ ok: false, error: "bad_request" }, 400);
    if (image.length > MAX_IMAGE) return json({ ok: false, error: "too_large" }, 413);

    const URL_ = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const who = await fetch(`${URL_}/rest/v1/rpc/whoami`, {
      method: "POST", headers: { ...keyHeaders(SERVICE), "Content-Type": "application/json" }, body: JSON.stringify({ p_token: token }),
    }).then((r) => r.json()).catch(() => null);
    const emp = who && who.ok ? who.employee || {} : null;
    if (!emp) return json({ ok: false, error: "auth" }, 401);
    if (!emp.is_admin && !LEAD_POS.includes(String(emp.position || "").toLowerCase())) return json({ ok: false, error: "forbidden" }, 403);

    const API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!API_KEY) return json({ ok: false, error: "not_configured" });

    // ── лимит в день (админ — без лимита) ──
    let remaining = -1;
    if (!emp.is_admin && emp.id) {
      try {
        const day = new Date().toISOString().slice(0, 10);
        const key = `${emp.id}_${day}_f`;
        const rows = await fetch(`${URL_}/rest/v1/ai_usage?id=eq.${encodeURIComponent(key)}&select=count`, { headers: keyHeaders(SERVICE) }).then((r) => r.json()).catch(() => []);
        const used = Array.isArray(rows) && rows[0] ? Number(rows[0].count) || 0 : 0;
        if (used >= DAILY_SCANS) return json({ ok: false, error: "daily_limit", limit: DAILY_SCANS });
        await fetch(`${URL_}/rest/v1/ai_usage`, {
          method: "POST", headers: { ...keyHeaders(SERVICE), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ id: key, user_id: emp.id, day, count: used + 1 }),
        }).catch(() => {});
        remaining = Math.max(0, DAILY_SCANS - (used + 1));
      } catch (_e) { /* счётчик недоступен — не мешаем работе */ }
    }

    // ── модели: из секретов; не принимают фото — бесплатные с фото ──
    const own = [Deno.env.get("FLOOR_MODEL"), Deno.env.get("OPENROUTER_MODEL")].map((x) => String(x || "").trim()).filter(Boolean);
    const mine = [...new Set(own)];
    let queue = mine.length ? mine : (await visionFree()).slice(0, 3);
    let lastErr = queue.length ? "" : "no_vision", triedFree = !mine.length, detail = "";
    for (let i = 0; i < queue.length; i++) {
      const m = queue[i];
      let resp: Response;
      try {
        resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://service-academy.app", "X-Title": "Service Academy" },
          body: JSON.stringify(scanRequest(m, image)),
        });
      } catch (_e) { lastErr = "provider"; continue; }
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        console.error("floor-scan openrouter", m, resp.status, t.slice(0, 240));
        detail = t.slice(0, 160);
        lastErr = /image|vision|modalit/i.test(t) && (resp.status === 400 || resp.status === 404) ? "no_vision" : resp.status === 429 || resp.status === 402 ? "rate_limit" : "provider";
      } else {
        const data = await resp.json().catch(() => null);
        const o = extractJson(textOf(data?.choices?.[0]?.message?.content));
        if (o) {
          const out = cleanReply(o);
          console.log("floor-scan", m, "tables", out.tables.length, out.plan ? "" : "not_plan");
          return json({ ok: true, v: FLOOR_SCAN_V, ...out, model: data?.model || m, remaining });
        }
        console.error("floor-scan", m, "no_json");
        lastErr = "parse";
      }
      // модели из секретов фото не принимают — дальше бесплатные с фото (одна попытка списка)
      if (i === queue.length - 1 && !triedFree && lastErr === "no_vision") {
        triedFree = true;
        queue = [...queue, ...(await visionFree()).filter((x) => !queue.includes(x)).slice(0, 2)];
      }
    }
    return json({ ok: false, error: lastErr || "provider", detail });
  } catch (e) {
    console.error("floor-scan", e);
    return json({ ok: false, error: "server" }, 500);
  }
}

Deno.serve(handle);
