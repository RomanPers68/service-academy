// lib/push-text.js — v137 (Доп. 450, 451): как текст бота становится уведомлением на телефоне — то же, что на сервере
// (этап 48: _sa_push_text, _sa_push_cut, _sa_push_cap, _sa_push_go, _sa_push_acts, _sa_push_new). Нужно демо (сервер в
// странице) и проверкам.

const len = (s) => Array.from(s).length;

/** Не длиннее n знаков: по слову и «…» (как _sa_push_cut). */
export function pushCut(p, n) {
  const s = String(p == null ? "" : p), ch = Array.from(s);
  if (ch.length <= n) return s;
  const left = ch.slice(0, n - 1).join("");
  const cut = /\s/.test(ch[n - 1]) ? left : (left.replace(/\s+\S*$/, "") || left);
  return cut.replace(/[ ,.;:—–-]+$/, "") + "…";
}

const LOW = "абвгдеёжзийклмнопрстуфхцчшщъыьэюяabcdefghijklmnopqrstuvwxyz";
const UP = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** Первая буква — заглавная (кириллица и латиница, как _sa_push_cap). */
export function pushCap(p) {
  const s = String(p == null ? "" : p);
  if (!s) return s;
  const ch = Array.from(s), i = LOW.indexOf(ch[0]);
  return (i >= 0 ? UP[i] : ch[0]) + ch.slice(1).join("");
}

/**
 * Текст бота → { t — заголовок, b — текст, m — сообщение из переписки } или null (пусто). Без разметки HTML.
 * Как в мессенджере (Доп. 451): «Анна С. пишет тебе:» → «Анна С.» и текст; «Пётр О. отвечает тебе в «Вся команда»:» →
 * «Вся команда» и «Пётр О. отвечает тебе: …»; упоминание — «Пётр О.: …», «всем» — «Пётр О. всем: …»; длинная первая строка
 * «кто что: подробности» (опоздание, отдаю смену, ищем в смену) — заголовок до двоеточия, подробности с заглавной ниже.
 * Иначе первая строка — заголовок (до 80 знаков, что не вошло — в начало текста с «…»; двоеточие в конце над сообщением —
 * без него), остальные строки — текст одной строкой (до 240 знаков).
 */
export function pushTextOf(text) {
  let t = String(text == null ? "" : text).replace(/<[^>]*>/g, "");
  t = t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  const ls = t.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((x) => x !== "");
  if (!ls.length) return null;
  let ttl = ls[0], rest = ls.slice(1).join(" "), m = false;
  if (rest) {
    let mm = ttl.match(/^(.{1,60}) пишет тебе:$/u);
    if (mm) { ttl = mm[1]; m = true; }
    else {
      mm = ttl.match(/^(.{1,60}) (отвечает тебе|упоминает тебя|пишет всем) в «(.{1,60})»:$/u);
      if (mm) {
        ttl = mm[3];
        rest = mm[1] + (mm[2] === "отвечает тебе" ? " отвечает тебе: " : mm[2] === "пишет всем" ? " всем: " : ": ") + rest;
        m = true;
      }
    }
  }
  if (!m && len(ttl) > 45) {
    const p = ttl.indexOf(": ");
    const pc = p < 0 ? -1 : len(ttl.slice(0, p)) + 1;   // как position() в базе: с 1, в знаках
    if (pc >= 6 && pc <= 60) {
      let aft = Array.from(ttl).slice(pc + 1).join("").trim();
      aft = aft.replace(/\.?\s*(Забрать|Выйти) можно прямо здесь\.?$/u, "");
      aft = aft.replace(/ \(([^()]{1,40})\)\.?$/u, ", $1");
      aft = aft.replace(/\.$/, "").trim();
      if (aft) {
        ttl = Array.from(ttl).slice(0, pc - 1).join("");
        rest = pushCap(aft) + (rest ? " · " + rest : "");
      }
    }
  }
  if (len(ttl) > 80) {
    const pre = pushCut(ttl, 80);
    rest = "…" + Array.from(ttl).slice(len(pre) - 1).join("").replace(/^[ ,.;:]+/, "") + (rest ? " " + rest : "");
    ttl = pre;
  }
  const r = rest.trim();
  if (/:$/.test(ttl) && r) ttl = ttl.replace(/[: ]+$/, "");   // «Итог:» над сообщением — без двоеточия
  return { t: ttl, b: r ? pushCut(r, 240) : "", m };
}

/** «3 новых», «21 новое» (как _sa_push_new). */
export function pushNew(n) {
  return n + " " + (n % 10 === 1 && n % 100 !== 11 ? "новое" : "новых");
}

/** Какой экран открыть по касанию: go первой кнопки со ссылкой (?go=… или startapp=go_…), у «Вопроса дня» — qday. */
export function pushGoOf(rows) {
  if (!Array.isArray(rows)) return null;
  let qd = false;
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    for (const b of r) {
      if (!b || typeof b !== "object" || Array.isArray(b)) continue;
      if (/^qd:/.test(String(b.callback_data || ""))) qd = true;
      const u = String((b.web_app && b.web_app.url) || b.url || "");
      const m = u.match(/[?&]go=([A-Za-z0-9_.:-]{1,90})/) || u.match(/startapp=go_([A-Za-z0-9_.:-]{1,90})/);
      if (m) return m[1];
    }
  }
  return qd ? "qday" : null;
}

const ACT_T = { cl: "Принято", ct: "Забрать", cg: "Иду" };
/**
 * Кнопки уведомления (как _sa_push_acts): у сообщения из переписки — «Ответить» и «Прочитано»; иначе — кнопки бота
 * «Принято» (cl), «Забрать» / «Выйду» (ct), «Иду» (cg), не больше двух. → [{ a, t, id, c? }] или null.
 */
export function pushActsOf(rows, go, m) {
  const mm = String(go || "").match(/^chat_(\d{1,12})_(\d{1,15})$/);
  if (m && mm) {
    const c = Number(mm[1]), id = Number(mm[2]);
    return [{ a: "reply", t: "Ответить", id, c }, { a: "read", t: "Прочитано", id, c }];
  }
  if (!Array.isArray(rows)) return null;
  const out = [];
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    for (const b of r) {
      if (!b || typeof b !== "object" || Array.isArray(b) || out.length >= 2) continue;
      const d = String(b.callback_data || "").match(/^(cl|ct|cg):(\d{1,18})$/);
      if (!d) continue;
      out.push({ a: d[1], id: Number(d[2]), t: Array.from(String(b.text || "").trim()).slice(0, 24).join("") || ACT_T[d[1]] });
    }
  }
  return out.length ? out : null;
}
