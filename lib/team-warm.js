// lib/team-warm.js — v108 (Доп. 421): тепло в команде. «Спасибо коллеге» — карточка в «Вся команда» («Пётр Орлов:
// выручил на банкете»), к ней можно присоединиться; такие «спасибо» копятся у человека в «Я» → «Спасибо от коллег»
// рядом с благодарностями гостей и добавляют очки в «Сотруднике недели». Дни рождения и годовщины: в день, с 9:00 по
// часам заведения, в «Вся команда» карточка «У Ильи сегодня день рождения» или «Вера год с нами» с «Поздравить».
// Даты — из графика: «Д.р.» (дд.мм) и «В команде с» (дд.мм.гггг) у сотрудника; кто пришёл через «Новички» (v107),
// у того годовщина — от дня прихода.
// Здесь слова карточек, сообщения бота и подписи; сервер (этап 42, _sa_ty_*) пишет те же сводки и сообщения, демо —
// отсюда же.
import { plural, nm, upFirst } from "./morning.js";
import { MONTH_GEN } from "./dates.js";
import { isFemaleName } from "./utils.js";
import { posWord } from "./newbie.js";

export const THX_MAX = 140;       // «за что» — до 140 знаков
export const THX_PTS = 5;         // «спасибо» от коллеги в «Сотруднике недели» — 5 очков (тест — очко за верный ответ)
export const THX_DAY_MAX = 15;    // одному человеку в день — не больше 15 «спасибо» от себя
export const THX_AGAIN_H = 12;    // тому же коллеге второй раз — через 12 часов
export const CHEER_FROM = 9, CHEER_TO = 21;   // карточки дня рождения и годовщины: с 9:00 до 21:00 по часам заведения
export const BOT_NAME = "Академия";

const str = (v, n = 200) => (typeof v === "string" || typeof v === "number" ? String(v).replace(/\s+/g, " ").trim().slice(0, n) : "");
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
const arr = (v) => (Array.isArray(v) ? v : []);
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const firstOf = (name) => str(name, 80).split(" ")[0] || "";

/** Как сервер (_sa_chat_cut): пробелы в один, длиннее n — обрезать с «…». */
export function cutText(s, n) {
  const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  return [...t].length > n ? [...t].slice(0, Math.max(n - 1, 0)).join("").replace(/\s+$/, "") + "…" : t;
}

// ── слова ──
/** «год», «2 года», «5 лет» */
export const yearsWord = (n) => (n === 1 ? "год" : n + " " + plural(n, "год", "года", "лет"));
/** «29 октября 2025» */
export const dateWord = (iso) => (isIso(iso) ? Number(iso.slice(8)) + " " + MONTH_GEN[Number(iso.slice(5, 7)) - 1] + " " + iso.slice(0, 4) : "");

// имя в родительном падеже — у кого день рождения: Илья → Ильи, Анна → Анны, Ольга → Ольги, Мария → Марии,
// Пётр → Петра, Роман → Романа, Андрей → Андрея, Игорь → Игоря, Любовь → Любови; несклоняемые — как есть
const GEN_EXC = { "пётр": "Петра", "петр": "Петра", "павел": "Павла", "лев": "Льва" };
const FEM_SOFT = new Set(["любовь", "нинель", "адель", "ассоль", "рахиль", "эсфирь", "юдифь"]);
export function genName(name, female = null) {
  const n = str(name, 40);
  if (!n) return "";
  const l = n.toLowerCase();
  if (GEN_EXC[l]) return GEN_EXC[l];
  const fem = female == null ? isFemaleName(n, "") : !!female;
  if (/ия$/.test(l)) return n.slice(0, -1) + "и";
  if (/[гкхжшщч]а$/.test(l)) return n.slice(0, -1) + "и";
  if (/а$/.test(l)) return n.slice(0, -1) + "ы";
  if (/я$/.test(l)) return n.slice(0, -1) + "и";
  if (/й$/.test(l)) return n.slice(0, -1) + "я";
  if (/ь$/.test(l)) return n.slice(0, -1) + (FEM_SOFT.has(l) || fem ? "и" : "я");
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(l)) return fem ? n : n + "а";
  return n;
}

/** Подсказки «за что» — под того, кому спасибо. */
export function thxChips(female) {
  const v = (m, f) => (female ? f : m);
  return [v("выручил на смене", "выручила на смене"), v("подменил", "подменила"), v("помог с гостем", "помогла с гостем"),
    v("научил новому", "научила новому"), v("поддержал", "поддержала")];
}

/** Из строки ввода (подсказка «Спасибо карточкой»): за что — без «спасибо», «благодарю», «большое»; кому — по «@Имя», если
 *  такой один в чате. → { text, to | null } */
export function thxFromText(text, members = []) {
  let t = String(text == null ? "" : text), to = null;
  const at = /@([А-Яа-яЁёA-Za-z-]+)/.exec(t);
  if (at) {
    const k = at[1].toLowerCase().replace(/ё/g, "е");
    const hits = arr(members).filter((p) => p && String(p.name || "").trim().split(/\s+/)[0].toLowerCase().replace(/ё/g, "е") === k);
    if (hits.length === 1) { to = { id: hits[0].id, name: hits[0].name, pos: hits[0].pos }; t = t.replace(at[0], " "); }
  }
  t = t.replace(/(^|[\s,.!])(огромное|большое|спасибо|благодарю|благодарим|спс)(?=$|[\s,.!])/gi, "$1 ");
  t = t.replace(/\s+/g, " ").replace(/([,.!])(\s*[,.!])+/g, "$1").replace(/^[\s,.!:;-]+|[\s,.!:;-]+$/g, "").trim();
  return { text: cutText(t, THX_MAX), to };
}

// ── карточки в чате ──
const peopleOf = (list, meId) => arr(list).map((g) => obj(g)).filter((g) => g && g.id != null)
  .map((g) => (String(g.id) === meId ? "ты" : nm(g.n || "")));

/** «Спасибо»: кому (title), за что (sub), кто присоединился; «Тоже спасибо» — раз; ни автор, ни тот, кому спасибо, — нет.
 *  author — id автора сообщения. */
export function thxView(card, me, author = "") {
  const c = obj(card) || {}, to = obj(c.to) || {};
  const meId = me && me.id != null ? String(me.id) : "";
  const self = !!meId && String(to.id) === meId, own = !!meId && String(author == null ? "" : author) === meId;
  const plus = arr(c.plus).map((g) => obj(g)).filter((g) => g && g.id != null);
  const mine = plus.some((g) => String(g.id) === meId);
  const names = peopleOf(plus, meId);
  return { title: str(to.name, 80), sub: upFirst(str(c.text, THX_MAX + 5)), self, own, mine, n: 1 + plus.length,
    line: names.length ? (self ? "Ещё спасибо тебе: " : "Ещё спасибо: ") + names.join(", ")
      : self ? "Сохранилось в «Я» → «Спасибо от коллег»" : own ? "Карточку видит вся команда" : "",
    act: self || own || mine ? null : "plus", btn: "Тоже спасибо" };
}

/** «День рождения» и «годовщина»: «У Ильи сегодня день рождения», «Вера год с нами»; самому — «У тебя…»,
 *  «Сегодня год, как ты с нами»; «Поздравить» — раз, себя — нет. */
export function cheerView(card, me) {
  const c = obj(card) || {};
  const meId = me && me.id != null ? String(me.id) : "";
  const self = !!meId && String(c.emp) === meId;
  const greet = arr(c.greet).map((g) => obj(g)).filter((g) => g && g.id != null);
  const mine = greet.some((g) => String(g.id) === meId);
  const names = peopleOf(greet, meId);
  const full = str(c.name, 80), parts = full.split(" "), first = parts[0] || "";
  const female = isFemaleName(first, parts[1] || "");
  const anniv = c.t === "anniv", years = Math.max(1, Math.round(num(c.years)));
  const title = anniv ? (self ? "Сегодня " + yearsWord(years) + ", как ты с нами" : first + " " + yearsWord(years) + " с нами")
    : self ? "У тебя сегодня день рождения" : "У " + genName(first, female) + " сегодня день рождения";
  const sub = [upFirst(posWord(c.pos)), anniv && isIso(c.since) ? "в команде с " + dateWord(c.since) : ""].filter(Boolean).join(" · ");
  return { title, sub, self, mine, n: greet.length, years: anniv ? years : 0,
    line: names.length ? (self ? "Тебя поздравили: " : "Поздравили: ") + names.join(", ") : self ? "Карточку видит вся команда" : "Пока никто не поздравил",
    act: self || mine ? null : "cheer", btn: "Поздравить" };
}

/** Коротко о карточке — для списка чатов и поиска (как _sa_ty_sum на сервере). */
export function warmCardSum(card) {
  const c = obj(card) || {};
  if (c.t === "thx") { const to = obj(c.to) || {}, t = str(c.text, THX_MAX + 5); return "Спасибо: " + str(to.name, 80) + (t ? ", " + t : ""); }
  if (c.t === "bday") return "День рождения: " + str(c.name, 80);
  if (c.t === "anniv") return str(c.name, 80) + ": " + yearsWord(Math.max(1, Math.round(num(c.years)))) + " с нами";
  return "";
}

// ── бот (Telegram, обычный текст — как _sa_ty_ping и _sa_ty_dm) ──
/** Тому, кому сказали спасибо: «Анна С. говорит тебе спасибо: «выручил на банкете»» */
export const thxPing = (from, text) => { const t = str(text, THX_MAX + 5); return nm(from) + " говорит тебе спасибо" + (t ? ": «" + t + "»" : ""); };
/** Тому, у кого праздник: «Илья, с днём рождения» / «Вера, сегодня год, как ты с нами» + «В «Вся команда» тебя поздравляют.» */
export function cheerDm(card) {
  const c = obj(card) || {}, first = firstOf(c.name);
  const head = c.t === "anniv" ? first + ", сегодня " + yearsWord(Math.max(1, Math.round(num(c.years)))) + ", как ты с нами" : first + ", с днём рождения";
  return head + "\nВ «Вся команда» тебя поздравляют.";
}

// ── даты из графика ──
const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const realDay = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
/** «Д.р.» из графика: «15.03» (можно «15.3», «15.03.1990») → { d, m } или null */
export function bdayOf(v) {
  const x = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/.exec(str(v, 12));
  if (!x) return null;
  const d = Number(x[1]), m = Number(x[2]);
  return realDay(2000, m, d) ? { d, m } : null;
}
/** «В команде с»: «29.10.2025» или «2025-10-29» → «2025-10-29» или null */
export function joinedOf(v) {
  const s = str(v, 12);
  let x = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (x) return realDay(+x[3], +x[2], +x[1]) ? x[3] + "-" + String(x[2]).padStart(2, "0") + "-" + String(x[1]).padStart(2, "0") : null;
  x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return x && realDay(+x[1], +x[2], +x[3]) ? s : null;
}
// тот же день в году; 29 февраля в невисокосный год — 28-го
function sameDay(m, d, iso) {
  const y = +iso.slice(0, 4), mo = +iso.slice(5, 7), dd = +iso.slice(8, 10);
  return (mo === m && dd === d) || (m === 2 && d === 29 && !leap(y) && mo === 2 && dd === 28);
}
/** Что праздновать в день day («ГГГГ-ММ-ДД»): [{ kind: "bday" }, { kind: "anniv", years, since }] */
export function cheersDue(day, { bday = null, joined = null } = {}) {
  if (!isIso(day)) return [];
  const out = [], b = bdayOf(bday), j = joinedOf(joined);
  if (b && sameDay(b.m, b.d, day)) out.push({ kind: "bday" });
  if (j) {
    const years = +day.slice(0, 4) - +j.slice(0, 4);
    if (years >= 1 && sameDay(+j.slice(5, 7), +j.slice(8, 10), day)) out.push({ kind: "anniv", years, since: j });
  }
  return out;
}

// ── «Я» и «Сотрудник недели» ──
/** Подпись пункта «Спасибо от коллег» (ответ thanks_peer) */
export function peerSub(st) {
  if (st && st.week) return st.week + " " + plural(st.week, "раз", "раза", "раз") + " за неделю коллеги сказали спасибо";
  if (st && st.total) return "Всего спасибо от коллег: " + st.total;
  return "Коллеги говорят спасибо карточкой в «Вся команда»";
}
/** «Спасибо» за неделю по людям (ответ thanks_week; at — когда, уже без повторов от того же человека в тот же день):
 *  ключ «Имя|Фамилия» → { name, surname, restaurant, position, n } — n с начала недели (weekStart, мс) */
export function weekThanks(raw, weekStart) {
  const out = {};
  for (const r of arr(raw && raw.list).map((x) => obj(x)).filter(Boolean)) {
    const n = arr(r.at).filter((a) => { const t = Date.parse(a); return Number.isFinite(t) && t >= weekStart; }).length;
    if (!n) continue;
    const k = str(r.name, 60) + "|" + str(r.surname, 60);
    const cur = out[k] || { name: str(r.name, 60), surname: str(r.surname, 60), restaurant: str(r.restaurant, 80), position: str(r.position, 30) || "waiter", n: 0 };
    cur.n += n;
    out[k] = cur;
  }
  return out;
}
/** «Сотрудник недели»: очки тестов с начала недели (как раньше) и «спасибо» коллег — по THX_PTS очков; tab — должность,
 *  rest — только своё заведение (null — сеть). → три лучших: [{ name, surname, restaurant, pts, thx }] */
export function weekStars(scores, thx, { weekStart, tab, rest = null }) {
  const map = {}, sur = (x) => (!x || x === "EMPTY" ? "" : x);   // «EMPTY» — нет фамилии (как normSurname)
  for (const s of arr(scores)) {
    if (!s || !s.updated_at || new Date(s.updated_at).getTime() < weekStart) continue;
    if ((s.position || "waiter") !== tab) continue;
    if (rest != null && (s.restaurant || "") !== rest) continue;
    const k = s.name + "|" + sur(s.surname);
    if (!map[k]) map[k] = { name: s.name, surname: sur(s.surname), restaurant: s.restaurant, pts: 0, thx: 0 };
    map[k].pts += s.score || 0;
  }
  for (const [k, t] of Object.entries(thx || {})) {
    if ((t.position || "waiter") !== tab) continue;
    if (rest != null && (t.restaurant || "") !== rest) continue;
    if (!map[k]) map[k] = { name: t.name, surname: t.surname, restaurant: t.restaurant, pts: 0, thx: 0 };
    map[k].thx += t.n;
    map[k].pts += t.n * THX_PTS;
  }
  return Object.values(map).filter((p) => p.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 3);
}
