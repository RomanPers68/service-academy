// lib/now-card.js — v56 (Доп. 369): «что сейчас». Главная подсказывает одно действие по времени, смене
// и перерыву в занятиях:
//   до смены (за 4 часа и меньше)  — разминка на 2 минуты;
//   на смене                       — в перерыв повторить ошибки, а если их нет — шпаргалка SOS;
//   после смены (до 4 часов)       — «как прошла смена?» одним касанием и разбор с Наставником;
//   вернулся после 3+ дней без занятий — «С возвращением»: освежить пройденное за 2 минуты.
// Иначе — как было: карточка трека («Дальше»). Чистые функции: время, смена и состояние дня — снаружи (App).
// «.js» в путях — модуль читают и тесты в Node.

export const NOW_BEFORE_H = 4;     // за сколько часов до смены зовём на разминку
export const NOW_AFTER_H = 4;      // сколько часов после смены спрашиваем «как прошла»
export const NOW_AWAY_DAYS = 3;    // перерыв в занятиях, после которого — «С возвращением»

// Разница в днях между датами «ГГГГ-ММ-ДД» (b − a)
export function dayDiff(a, b) {
  const pa = String(a).split("-").map(Number), pb = String(b).split("-").map(Number);
  if (pa.length !== 3 || pb.length !== 3 || pa.some(isNaN) || pb.some(isNaN)) return 0;
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

// Сколько дней прошло с последнего занятия до сегодня (журнал sa_activity, lib/activity.js).
// Занятий ещё не было — 0 (это новичок, а не «вернувшийся»).
export function daysAway(act, today) {
  const keys = Object.keys(act || {}).filter((k) => k < today && act[k] && (Number(act[k].st) > 0 || Object.keys(act[k]).length > 0));
  if (!keys.length) return 0;
  keys.sort();
  return Math.max(0, dayDiff(keys[keys.length - 1], today));
}

// Что показать сейчас. null — обычная карточка трека.
//   now — время; shift — смена сегодня ({ off } | { off:false, from, to } в часах, lib/streak.js myShiftOn);
//   started — в треке уже есть пройденные шаги; warmReady — разминка собрана (2+ ситуации);
//   warmDone — разминку сегодня уже сделали; due — вопросов на повтор; away — дней без занятий;
//   openAway — дней с прошлого захода в приложение (99 — неизвестно); stepsToday — шагов сегодня;
//   mood — «как прошла смена» сегодня уже отмечено.
export function nowMode({ now = new Date(), shift = null, started = true, warmReady = false, warmDone = false, due = 0,
  away = 0, openAway = 99, stepsToday = 0, mood = null } = {}) {
  if (!started) return null;   // первый день: главное действие одно — первый урок
  const h = now.getHours() + now.getMinutes() / 60;
  if (shift && !shift.off && typeof shift.from === "number" && typeof shift.to === "number") {
    const from = shift.from, to = shift.to > shift.from ? shift.to : 24;
    if (h < from) {
      if (from - h <= NOW_BEFORE_H && warmReady && !warmDone) return { mode: "before", mins: Math.max(1, Math.round((from - h) * 60)), from, to };
    } else if (h < to) {
      return { mode: "during", to, due: Math.max(0, due | 0) };
    } else if (h - to < NOW_AFTER_H && !mood) {
      return { mode: "after", to };
    }
  }
  if (away >= NOW_AWAY_DAYS && openAway >= NOW_AWAY_DAYS && warmReady && !warmDone && !stepsToday) return { mode: "back", away };
  return null;
}

const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many;
};

// «1 ч 40 мин», «35 мин», «2 ч»
export function untilText(mins) {
  const m = Math.max(0, Math.round(mins)), h = Math.floor(m / 60), r = m % 60;
  if (!h) return r + " мин";
  return h + " ч" + (r ? " " + r + " мин" : "");
}

// «20:00»; конец вечерней смены — «24:00», как в графике («16:00–24:00»)
export function hhmm(h) {
  const hh = Math.floor(h) === 24 ? 24 : Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60);
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

// «Как прошла смена» — та же шкала из пяти лиц, что «Как настрой сегодня?» (ui/mood-cards.jsx: sa_mood_<дата>,
// save_mood на сервер — пульс команды у руководителя). 1–2 — тяжело, 3 — ровно, 4–5 — хорошо.
export const moodTier = (lvl) => (Number(lvl) >= 4 ? "good" : Number(lvl) === 3 ? "ok" : "hard");

// Ответ на «как прошла смена» и вопрос Наставнику — разбор начинается сразу, без пустого чата
export const MOOD_REPLY = {
  good: { text: "Отлично! Расскажи Наставнику, что сработало, и закрепим это.", cta: "Рассказать",
    ask: "Сегодня была хорошая смена. Помоги коротко разобрать, что сработало, чтобы это повторялось и дальше." },
  ok: { text: "Ровная смена тоже хороша. Разберём с Наставником одну ситуацию?", cta: "Разобрать",
    ask: "Помоги коротко разобрать одну ситуацию из сегодняшней смены: что получилось и что можно сделать лучше." },
  hard: { text: "Бывает. Расскажи Наставнику, что было, и разберём спокойно, по шагам.", cta: "Разобрать",
    ask: "Сегодня была тяжёлая смена. Помоги спокойно разобрать одну трудную ситуацию и что делать в следующий раз." },
};

// Тексты карточки. action: warmup | mistakes | sos | mood — App даёт обработчики.
//   warmN / warmWhat — сколько в разминке и чего («ситуации» / «вопроса»).
export function nowCardText(m, { warmN = 3, warmWhat = "ситуации" } = {}) {
  if (!m) return null;
  if (m.mode === "before") return { tag: "ДО СМЕНЫ · " + untilText(m.mins).toUpperCase(), title: "Разминка перед сменой",
    sub: `${warmN} ${warmWhat} · 2 мин, освежишь главное`, cta: "Начать", action: "warmup", icon: "clock" };
  if (m.mode === "during") return m.due > 0
    ? { tag: "НА СМЕНЕ · ДО " + hhmm(m.to), title: "В перерыв повтори ошибки",
        sub: `${m.due} ${plural(m.due, "вопрос ждёт", "вопроса ждут", "вопросов ждут")} · хватит минуты`, cta: "Ответить", action: "mistakes", icon: "target" }
    : { tag: "НА СМЕНЕ · ДО " + hhmm(m.to), title: "Если в зале жарко, есть SOS",
        sub: "шпаргалка на трудный случай за секунду", cta: "Открыть", action: "sos", icon: "bulb" };
  if (m.mode === "after") return { tag: "СМЕНА ПОЗАДИ", title: "Как прошла смена?", sub: "отметь одним касанием", cta: null, action: "mood", icon: "moon" };
  if (m.mode === "back") return { tag: "С ВОЗВРАЩЕНИЕМ", title: "Освежим за 2 минуты",
    sub: `${warmN} ${warmWhat} из пройденного, вспомнишь главное`, cta: "Начать", action: "warmup", icon: "sparkle" };
  return null;
}
