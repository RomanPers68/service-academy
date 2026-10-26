// lib/guest-thanks.js — v84 (Доп. 397): «Спасибо» от гостей по QR.
//
// У сотрудника — свой QR со ссылкой <приложение>/?thanks=<код>. Гость сканирует камерой и попадает на лёгкую страницу
// (ui/guest-thanks.jsx, без входа и без остального приложения): имя, заведение, «за что спасибо» и пара слов.
// Сотрудник видит свои спасибо и QR в «Я» → «Спасибо от гостей» (ui/thanks.jsx), руководитель — всю команду.
// Сервер — этап 34 (guest_thanks_card / guest_thanks_send / my_thanks / thanks_rotate / thanks_team / thanks_hide).

// за что спасибо — ключи как на сервере (_sa_thanks_tags)
export const THANKS_TAGS = [
  ["care", "Внимание к нам"],
  ["speed", "Быстро"],
  ["advice", "Отличный совет"],
  ["smile", "Улыбка и настроение"],
  ["special", "Помог(ла) с просьбой"],
];
export const tagLabel = (k) => (THANKS_TAGS.find((x) => x[0] === k) || [0, ""])[1];
export const THANKS_TEXT_MAX = 300;

// должность для гостя: как её называют в зале
const POS_RU = { waiter: "Официант", bartender: "Бармен", barman: "Бармен", bar: "Бармен", barback: "Барбек", host: "Хостес", hostess: "Хостес",
  manager: "Менеджер", senior: "Старший смены", runner: "Раннер", sommelier: "Сомелье", cook: "Повар", chef: "Шеф" };
export const posLabel = (p) => POS_RU[String(p || "").toLowerCase()] || "";

/** Код из адреса страницы (?thanks=…): 10 знаков a-z0-9, иначе "". */
export function thanksCode(search) {
  try { const c = new URLSearchParams(search || "").get("thanks") || ""; return /^[a-z0-9]{10}$/.test(c) ? c : ""; } catch (e) { return ""; }
}
/** Есть ли в адресе ?thanks= вообще: страница гостя открывается и с битым кодом (и честно говорит, что он не работает). */
export function isThanksLink(search) {
  try { return new URLSearchParams(search || "").has("thanks"); } catch (e) { return false; }
}
/** Ссылка для QR: адрес приложения + ?thanks=код. */
export const thanksUrl = (origin, code) => String(origin || "").replace(/\/+$/, "") + "/?thanks=" + code;

/** Случайный номер браузера гостя: от повторного «спасибо» с одного телефона (не личные данные). */
export function deviceId(ls) {
  const s = ls || (typeof localStorage !== "undefined" ? localStorage : null);
  try { const v = s && s.getItem("sa_guest_dev"); if (v && /^[A-Za-z0-9_-]{8,64}$/.test(v)) return v; } catch (e) {}
  let id = "";
  try {
    const a = new Uint8Array(12); (globalThis.crypto || {}).getRandomValues(a);
    id = Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
  } catch (e) { id = (Math.random().toString(36) + Math.random().toString(36)).replace(/[^a-z0-9]/g, "").slice(0, 20); }
  try { if (s) s.setItem("sa_guest_dev", id); } catch (e) {}
  return id;
}

const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };

/** Подпись пункта в «Я»: сколько за неделю, иначе — что это. */
export function thanksSub(st) {
  if (st && st.week) return st.week + " " + pl(st.week, "раз", "раза", "раз") + " за неделю гости сказали спасибо · твой QR";
  if (st && st.total) return "Всего спасибо от гостей: " + st.total + " · твой QR";
  return "Твой QR: гости говорят спасибо лично тебе";
}

/** v86: ссылки на отзывы о заведении (этап 36) — какие карты и как назвать кнопку гостю. Проверка — как на сервере
 *  (_sa_review_kind): только https и только страницы карт, гостю не уйдёт ссылка «куда угодно». */
export const REVIEW_KINDS = { yandex: "Отзыв на Яндекс Картах", "2gis": "Отзыв в 2ГИС", google: "Отзыв в Google Картах" };
export function reviewKind(url) {
  const u = String(url || "").trim();
  if (!u || u.length > 300 || /[\s<>"]/.test(u)) return "";
  if (/^https:\/\/(www\.)?(yandex\.(ru|com|kz|by|uz)|ya\.ru)\/(maps|profile)(\/|\?|$)/i.test(u)) return "yandex";
  if (/^https:\/\/(www\.)?(2gis\.(ru|com|kz|kg|ae)|go\.2gis\.com)\//i.test(u)) return "2gis";
  if (/^https:\/\/((www\.)?google\.[a-z.]{2,6}\/maps|maps\.google\.[a-z.]{2,6}\/|maps\.app\.goo\.gl\/|goo\.gl\/maps\/|g\.page\/|search\.google\.com\/local\/writereview)/i.test(u)) return "google";
  return "";
}
/** Ссылки для страницы гостя: только известные карты, по одной на вид, не больше двух. */
export function reviewButtons(links) {
  const seen = new Set();
  return (Array.isArray(links) ? links : []).map((l) => ({ url: String((l && l.url) || "").trim(), kind: reviewKind(l && l.url) }))
    .filter((l) => l.kind && !seen.has(l.kind) && seen.add(l.kind)).slice(0, 2).map((l) => ({ ...l, label: REVIEW_KINDS[l.kind] }));
}

/** Отметки по видам → «внимание 3 · совет 2» (для руководителя и брифинга), самые частые первыми. */
export function tagsLine(tags, max = 3) {
  return Object.entries(tags || {}).filter(([k, n]) => tagLabel(k) && Number(n) > 0).sort((a, b) => b[1] - a[1]).slice(0, max)
    .map(([k, n]) => tagLabel(k).toLowerCase() + " " + n).join(" · ");
}
