// lib/ical.js — v99 (Доп. 412): смены в календаре телефона. По личной ссылке /api/cal?k=<ключ> (api/cal.js на Vercel)
// календарь телефона раз в несколько часов забирает смены человека (этап 39, cal_feed: месяц назад и два вперёд) и сам
// обновляет их, когда меняется график. Здесь — файл календаря (iCalendar, RFC 5545) и страница «Подписаться» для
// браузера. Время — местное время заведения без пояса («плавающее»): в календаре телефона смена стоит в те же часы,
// что в графике. Без браузерных зависимостей: модуль читают и функция Vercel, и тесты.

const pad = (n) => String(n).padStart(2, "0");

/** Текст для поля календаря: «\», «;», «,» и перевод строки — по правилам RFC 5545. */
export const icsEscape = (s) => String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Длинная строка — по 75 байт (UTF-8), продолжение с пробела; кириллица — 2 байта на букву, буква не рвётся. */
export function icsFold(line) {
  const s = String(line || "");
  const out = [];
  let cur = "", bytes = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0), b = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    if (bytes + b > 75) { out.push(cur); cur = " "; bytes = 1; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n");
}

/** День «ГГГГ-ММ-ДД» и час графика (10, 18.5, 24, 26 — после полуночи) → «20261028T100000» (местное время). */
export function icsLocal(ymd, hours) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!m) return "";
  const mins = Math.round((Number(hours) || 0) * 60);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0, 0) + mins * 60000);
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + "00";
}
const utcStamp = (t) => { const d = t instanceof Date ? t : new Date(t); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z"; };
// часы графика словами: 16 → «16:00», 24 → «24:00» (как в графике), 26 → «02:00»
const hhmm = (h) => { const n = Number(h) || 0; if (n === 24) return "24:00"; const v = (n % 24 + 24) % 24, hh = Math.floor(v), mm = Math.round((v - hh) * 60); return pad(hh) + ":" + pad(mm); };
const POS = { "менеджер": "Менеджер", "хостес": "Хостес", "бар": "Бар", "официант": "Официант", "раннер": "Раннер", "барбек": "Барбек", "колл-центр": "Колл-центр" };

/**
 * Файл календаря. feed — ответ cal_feed: { id, name, rest, tz, shifts: [{ date, k, label, from, to, pos }], app }.
 * Смена — событие «Смена: вечер» с 16:00 до 24:00 в заведении; UID — человек и день (смена поменялась — то же событие
 * переезжает, отменили — исчезает). Напоминание за час (если календарь оставляет напоминания подписки).
 */
export function buildIcs(feed, now = new Date()) {
  const f = feed || {}, stamp = utcStamp(now), rest = String(f.rest || "");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Service Academy//Smeny//RU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:" + icsEscape("Смены" + (rest ? " · " + rest : "")), ...(f.tz ? ["X-WR-TIMEZONE:" + icsEscape(f.tz)] : []),
    "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"];
  for (const s of Array.isArray(f.shifts) ? f.shifts : []) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(String(s.date || ""))) continue;
    const from = Number(s.from), to0 = Number(s.to);
    if (!isFinite(from) || !isFinite(to0)) continue;
    const to = to0 > from ? to0 : to0 + 24;   // ночная смена: конец — на следующий день
    const label = String(s.label || "").trim(), pos = POS[String(s.pos || "")] || String(s.pos || "");
    L.push("BEGIN:VEVENT", "UID:" + icsEscape("sa-" + (f.id || "x") + "-" + s.date) + "@service-academy", "DTSTAMP:" + stamp,
      "DTSTART:" + icsLocal(s.date, from), "DTEND:" + icsLocal(s.date, to),
      "SUMMARY:" + icsEscape("Смена" + (label ? ": " + label.toLowerCase() : "")),
      ...(rest ? ["LOCATION:" + icsEscape(rest)] : []),
      "DESCRIPTION:" + icsEscape([pos, hhmm(from) + "–" + hhmm(to)].filter(Boolean).join(" · ") + (f.app ? "\nГрафик в приложении: " + String(f.app).replace(/\/+$/, "") + "/?go=schedule" : "")),
      "TRANSP:OPAQUE", "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEscape("Через час смена"), "TRIGGER:-PT1H", "END:VALARM", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(icsFold).join("\r\n") + "\r\n";
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Страница «Подписаться» (открывается в браузере телефона из приложения): кнопка с webcal-ссылкой (iPhone и компьютер
 * сразу предлагают подписаться), ссылка для копирования и как добавить в Google Календарь. https — адрес файла.
 */
export function calPage({ name = "", rest = "", https = "", next = [] } = {}) {
  const webcal = String(https).replace(/^https?:/, "webcal:");
  const nm = String(name).trim().split(/\s+/)[0] || "";
  const rows = (next || []).slice(0, 3).map((s) => "<li>" + esc(s) + "</li>").join("");
  return "<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>Смены в календаре</title><style>" +
    ":root{color-scheme:dark light}body{margin:0;background:#14110A;color:#EFE4C8;font:16px/1.5 Georgia,'PT Serif',serif}" +
    "main{max-width:460px;margin:0 auto;padding:28px 18px 40px}h1{font-size:23px;font-weight:700;margin:6px 0 6px;color:#F3E6C8}" +
    "p{margin:0 0 14px;color:#B9A47E;font-size:15px}.tag{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#C8A96E}" +
    ".btn{display:block;text-align:center;text-decoration:none;margin:18px 0 10px;padding:15px;border-radius:999px;font-weight:700;color:#1C150A;background:linear-gradient(180deg,#E4C88C,#C8A96E)}" +
    ".box{margin:14px 0;padding:12px 14px;border-radius:14px;border:1px solid rgba(214,178,102,0.35);background:rgba(255,250,238,0.04)}" +
    ".url{display:block;width:100%;box-sizing:border-box;margin:8px 0 0;padding:10px;border-radius:10px;border:1px solid rgba(214,178,102,0.35);background:#1C1509;color:#EFE4C8;font:13px/1.4 ui-monospace,Menlo,monospace}" +
    "ul{margin:6px 0 0;padding-left:18px;color:#EFE4C8}b{color:#F3E6C8}" +
    "@media (prefers-color-scheme: light){body{background:#EFE6D2;color:#2A1F0E}h1,b{color:#2A1F0E}p{color:#64523A}.url{background:#FFFDF7;color:#2A1F0E}ul{color:#2A1F0E}}" +
    "</style></head><body><main><div class=\"tag\">Service Academy</div>" +
    "<h1>Смены" + (nm ? " · " + esc(nm) : "") + " в календаре</h1>" +
    "<p>Смены" + (rest ? " в «" + esc(rest) + "»" : "") + " появятся в календаре телефона и будут обновляться сами, когда меняется график.</p>" +
    (rows ? "<div class=\"box\"><b>Ближайшие</b><ul>" + rows + "</ul></div>" : "") +
    "<a class=\"btn\" href=\"" + esc(webcal) + "\">Добавить в календарь</a>" +
    "<p>iPhone и компьютер спросят: «Подписаться на календарь?» Нажми «Подписаться».</p>" +
    "<div class=\"box\"><b>Android и Google Календарь</b><p style=\"margin:6px 0 0\">Скопируй ссылку. В Google Календаре на компьютере: «Другие календари» → «Добавить по URL» → вставь ссылку. На телефоне календарь появится сам.</p>" +
    "<input class=\"url\" readonly value=\"" + esc(https) + "\" onclick=\"this.select()\"></div>" +
    "<p style=\"font-size:13px\">Ссылка личная: по ней видны только твои смены. Если отдал её кому-то, сбрось её в приложении: «Смена» → «Смены в календаре телефона».</p>" +
    "</main></body></html>";
}
