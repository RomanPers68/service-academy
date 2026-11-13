// lib/ai-web.js — v152 (Доп. 476): что «Поискать в интернете» нашло для позиции барной карты — когда и откуда (ссылки
// видно при проверке). Без React; общее для вин (lib/wine.js) и крепкого (lib/spirit.js).
const s = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const okUrl = (u) => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || "")) && String(u).length <= 400;
/** { at, src: [{ url, title }] } — до 3 ссылок (объекты или строки-адреса); нет времени — нет и записи. */
export function aiWebOf(x) {
  if (!x || typeof x !== "object" || !(Number(x.at) > 0)) return null;
  const src = (Array.isArray(x.src) ? x.src : []).map((v) => (typeof v === "string" ? { url: v.trim() } : v))
    .filter((v) => v && okUrl(v.url)).slice(0, 3).map((v) => ({ url: s(v.url, 400), title: s(v.title, 100) }));
  return { at: Number(x.at), src };
}
/** Короткое имя сайта для ссылки: «vivino.com» из https://www.vivino.com/… */
export const siteOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return s(url, 40); } };
/** v155: в строке ссылок — по одной на сайт (владелец прислал «aif.ru · aif.ru»: две статьи одного сайта). */
export const oneSite = (src) => { const seen = new Set(); return (Array.isArray(src) ? src : []).filter((x) => { const k = x && x.url ? siteOf(x.url) : ""; if (!k || seen.has(k)) return false; seen.add(k); return true; }); };

// ── v153 (Доп. 477): «@Наставник» в переписке ищет в интернете. Сервер чата хранит у ответа только текст (и карточки
// известных видов), поэтому ссылки — последней строкой текста: «Нашёл в интернете: адрес · адрес». Приложение показывает
// её именами сайтов (ui/chat-cards.jsx: AiMsg), старое — как есть, адресами.
export const WEB_LINE = "Нашёл в интернете:";
/** Строка ссылок для текста ответа: до 3 адресов http(s) не длиннее 300 знаков; нет ссылок — пусто. */
export function webLineText(src) {
  const urls = (Array.isArray(src) ? src : []).map((v) => String((typeof v === "string" ? v : v && v.url) || "").trim())
    .filter((u, i, a) => okUrl(u) && u.length <= 300 && a.indexOf(u) === i).slice(0, 3);
  return urls.length ? WEB_LINE + " " + urls.join(" · ") : "";
}
/** Текст ответа → { text, src: [{ url }] }: последняя строка «Нашёл в интернете: …» — ссылками, остальное — текстом. */
export function splitWebLine(body) {
  const t = String(body == null ? "" : body), i = t.lastIndexOf("\n" + WEB_LINE), at = i >= 0 ? i + 1 : t.startsWith(WEB_LINE) ? 0 : -1;
  if (at < 0) return { text: t, src: [] };
  const line = t.slice(at);
  if (line.includes("\n")) return { text: t, src: [] };
  const urls = line.slice(WEB_LINE.length).split(/[\s·]+/).filter((u) => okUrl(u)).slice(0, 3);
  return urls.length ? { text: t.slice(0, at).replace(/\s+$/, ""), src: urls.map((url) => ({ url })) } : { text: t, src: [] };
}
/** Открыть страницу: в Telegram — его браузером, иначе — новой вкладкой. */
export function openOut(url) {
  try { const tg = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp; if (tg && tg.initData && typeof tg.openLink === "function") { tg.openLink(url); return; } } catch (e) { /* */ }
  try { window.open(url, "_blank", "noopener"); } catch (e) { /* */ }
}

// ── v154 (Доп. 478): владелец прислал снимок «Не получилось поискать в интернете. Попробуй ещё раз» — причины видно не было.
// Теперь текст ошибки — с причиной: что ответил сервер (ключ, баланс OpenRouter, модель, срок) или код ответа.
export const WEB_ERR = { rate_limit: "Поиск в интернете: лимит на час исчерпан, попробуй позже", not_configured: "Поиск в интернете ещё не подключён на сервере (OPENROUTER_API_KEY в Vercel)",
  auth: "Сессия устарела: войди в приложение заново", timeout: "Интернет отвечал слишком долго. Попробуй ещё раз", net: "Нет связи с сервером: проверь интернет и нажми ещё раз" };
/** Ответ /api/web-answer с ошибкой → текст для человека: известная ошибка — своими словами, иначе — с причиной. */
export function webErrText(w) {
  const known = WEB_ERR[w && w.error];
  if (known) return known;
  const why = w && w.message ? String(w.message).replace(/\s+/g, " ").trim().slice(0, 240)
    : w && w.status ? "сервер ответил кодом " + w.status + (w.why ? " (" + String(w.why).slice(0, 140) + ")" : "") + (w.alt ? ", запасной путь — кодом " + w.alt : "") : "";   // v155: кто отказал
  return "Не получилось поискать в интернете" + (why ? ": " + why.replace(/[.\s]+$/, "") : "") + ". Попробуй ещё раз";
}

// ── v155 (Доп. 479): владелец прислал снимок «Не получилось поискать в интернете: сервер ответил кодом 403». 403 наша
// функция не отвечает никогда: запрос отказал хостинг (Vercel) или что-то перед ним, а не OpenRouter. Теперь: ответ не от
// нашей функции (не JSON) — тот же запрос через /api/wine-import (via: "web-answer"): этот маршрут давно работает у
// барной карты и передаёт запрос той же функции. Не помогло — в ошибке видно, кто отказал: заголовки Vercel
// (x-vercel-error, x-vercel-mitigated), server и первые слова страницы.
const HTTP_WHY_HEADERS = ["x-vercel-error", "x-vercel-mitigated", "server"];
/** Кто ответил вместо нашей функции: «x-vercel-mitigated: deny; server: Vercel; „Forbidden“». */
export function httpWhy(headers, text) {
  const get = (k) => { try { return headers && typeof headers.get === "function" ? headers.get(k) : headers && headers[k]; } catch (e) { return null; } };
  const hs = HTTP_WHY_HEADERS.map((k) => (get(k) ? k + ": " + String(get(k)).slice(0, 60) : "")).filter(Boolean);
  const title = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(String(text || ""));
  const words = (title ? title[1] : String(text || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return [...hs, words ? "«" + words + "»" : ""].filter(Boolean).join("; ");
}
async function postJson(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text();
  try { const j = JSON.parse(t); if (j && typeof j === "object") return j; } catch (e) { /* не JSON */ }
  return { ok: false, error: "http", status: r.status, why: httpWhy(r.headers, t) };
}
// v155: владелец — «В меню и в справочнике работает. А вот наставник выдает ошибку 403»: описания блюд и «Поискать в
// интернете» в барной карте ищут, а запросы Наставника хостинг отклоняет. Они отличались содержимым: история чата со
// служебными метками ([[go:…]], [[lesson:…|…]]), данные карты, длинный текст. Теперь запрос упакован: { token, z } — сжатый
// (deflate-raw) JSON в base64; без CompressionStream — { token, p } без сжатия. Фильтр видит только буквы и цифры, тело —
// в 2–3 раза меньше. Сервер распаковывает (api/web-answer.js: unpack), старый вид (открытый JSON) тоже принимает.
const b64 = (bytes) => { let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const unb64 = (str) => { const bin = atob(str), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
/** { token, …поля } → { token, z } (сжато) или { token, p }. */
export async function packWeb(body) {
  const { token, via, ...rest } = body || {};
  const json = JSON.stringify(rest);
  try {
    if (typeof CompressionStream === "function" && typeof Blob === "function" && typeof Response === "function") {
      const buf = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
      return { token, z: b64(buf) };
    }
  } catch (e) { /* без сжатия */ }
  return { token, p: b64(new TextEncoder().encode(json)) };
}
/** Обратно (демо и проверки; на сервере — api/web-answer.js: unpack): { token, z | p, via } → { …поля, token, via }. */
export async function unpackWeb(b) {
  if (!b || typeof b !== "object") return {};
  const keep = { token: b.token, ...(b.via ? { via: b.via } : {}) };
  try {
    if (typeof b.z === "string") return { ...JSON.parse(await new Response(new Blob([unb64(b.z)]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text()), ...keep };
    if (typeof b.p === "string") return { ...JSON.parse(new TextDecoder().decode(unb64(b.p))), ...keep };
  } catch (e) { return { ...keep, bad: true }; }
  return b;
}
/** История для вопроса с поиском: последние n реплик, без служебных меток, коротко. */
export const slimHistory = (msgs, n = 4, max = 400) => (Array.isArray(msgs) ? msgs : []).slice(-n)
  .map((m) => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: String((m && m.content) || "").replace(/\[\[[^\]]*\]\]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) }))
  .filter((m) => m.content);
/**
 * Запрос к /api/web-answer (body — с token), упакованный (packWeb). Ответ не от нашей функции — ещё раз через
 * /api/wine-import (via: "web-answer"). → JSON функции или { ok: false, error: "http" | "net", status, why, alt }.
 */
export async function webPost(body) {
  let w, packed;
  try { packed = await packWeb(body); } catch (e) { packed = body; }
  try { w = await postJson("/api/web-answer", packed); } catch (e) { w = { ok: false, error: "net" }; }
  if (!w || w.error !== "http") return w;
  try {
    const w2 = await postJson("/api/wine-import", { ...packed, via: "web-answer" });
    if (w2 && w2.error !== "http") return w2;
    return { ...w, alt: w2 ? w2.status : 0, altWhy: w2 ? w2.why : "" };
  } catch (e) { return w; }
}
