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
