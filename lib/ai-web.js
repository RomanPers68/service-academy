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
