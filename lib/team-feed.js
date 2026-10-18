// lib/team-feed.js — v57 (Доп. 370): «Жизнь команды» на вкладке «Команда».
// Лента событий коллег своего заведения за две недели — из того, что приложение уже получает с сервера:
//   сданные тесты (team_scores, от 70%), мастера роли (mastery_list), рекорды тренажёров и печати Сборки
//   (team_achievements), «спасибо команде» сегодня (quest_today в day_brief).
// Новых таблиц и функций на сервере нет. Чистые функции — их проверяют тесты в Node.
import { isFemaleName } from "./utils.js";
import { ROLE_TITLE } from "./mastery.js";

export const FEED_DAYS = 14;       // за сколько дней события
export const FEED_PASS = 70;       // тест в ленту — от 70% (как «сдан»)
export const MASTER_BANNER_DAYS = 7;   // свежих мастеров уже показывает баннер «✦ Мастер роли» — в ленте их нет
const DAY = 86400000;

const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many;
};
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
// «Анна С.» — имя и первая буква фамилии
export const shortName = (name, surname) => clean(name) + (clean(surname) ? " " + clean(surname)[0].toUpperCase() + "." : "");
const splitWho = (who) => { const w = clean(who), i = w.indexOf(" "); return i < 0 ? [w, ""] : [w.slice(0, i), w.slice(i + 1)]; };
const quizName = (t) => { const q = clean(t).replace(/^Тест\s*[:·—-]\s*/i, ""); return q ? q[0].toUpperCase() + q.slice(1) : ""; };

// Тексты событий: глагол по полу (как баннер мастеров), без жаргона
const verb = (female, he, she) => (female ? she : he);

// Лента: [{ kind, at, who, text, me }], новые сверху, не больше limit.
//   me — { name, surname } (свои события — «Ты»); restaurant — своё заведение (тесты — только его);
//   titleOf(quizId) — название теста; now — «сейчас» (мс).
export function buildFeed({ now = Date.now(), me = null, restaurant = null, masters = [], scores = [], achievements = [],
  thanks = [], titleOf = () => "", limit = 15 } = {}) {
  const since = now - FEED_DAYS * DAY, ahead = now + DAY / 2;   // полдня вперёд — часы сервера
  const fresh = (t) => Number.isFinite(t) && t >= since && t <= ahead;
  const isMe = (name, surname) => !!me && clean(name) === clean(me.name) && clean(surname) === clean(me.surname);
  const out = [];
  // сданные тесты: по человеку и тесту — последний раз
  const tests = new Map();
  for (const s of Array.isArray(scores) ? scores : []) {
    if (!s || !s.name) continue;
    if (restaurant && s.restaurant && s.restaurant !== restaurant) continue;
    const at = Date.parse(s.updated_at);
    if (!fresh(at)) continue;
    const pct = Number(s.total) > 0 ? Math.round((Number(s.score) / Number(s.total)) * 100) : Number(s.pct) || 0;
    if (pct < FEED_PASS) continue;
    const title = quizName(titleOf(s.quiz_id));
    if (!title) continue;
    const key = clean(s.name) + "|" + clean(s.surname) + "|" + s.quiz_id;
    const mine = isMe(s.name, s.surname);
    const item = { kind: "test", at, me: mine, who: mine ? "Ты" : shortName(s.name, s.surname),
      text: (mine ? "сдал(а)" : verb(isFemaleName(s.name, s.surname), "сдал", "сдала")) + " тест «" + title + "» — " + pct + "%" };
    const prev = tests.get(key);
    if (!prev || at > prev.at) tests.set(key, item);
  }
  out.push(...tests.values());
  // мастера роли — кроме тех, кого уже показывает баннер (чужие за 7 дней)
  for (const r of Array.isArray(masters) ? masters : []) {
    if (!r) continue;
    const at = Date.parse(r.at);
    if (!fresh(at)) continue;
    if (!r.me && now - at <= MASTER_BANNER_DAYS * DAY) continue;
    const [name, surname] = splitWho(r.who || r.name);
    if (!name) continue;
    const title = ROLE_TITLE[r.role] || "";
    out.push({ kind: "master", at, me: !!r.me, who: r.me ? "Ты" : shortName(name, surname),
      text: (r.me ? "стал(а)" : verb(isFemaleName(name, surname), "стал", "стала")) + " мастером роли" + (title ? " «" + title + "»" : "") + " ✦" });
  }
  // рекорды тренажёров и печати Сборки
  for (const a of Array.isArray(achievements) ? achievements : []) {
    if (!a || !a.name) continue;
    const at = Date.parse(a.at);
    if (!fresh(at)) continue;
    const v = Number(a.value);
    if (!Number.isFinite(v) || v <= 0) continue;
    const mine = isMe(a.name, a.surname);
    const who = mine ? "Ты" : shortName(a.name, a.surname);
    let text = "";
    if (a.key === "rush_best") text = "— рекорд «Час пик»: 3 заказа за " + v + " с";
    else if (a.key === "sprint_best") text = "— рекорд «Аллергены на скорость»: " + v + " " + plural(v, "верный", "верных", "верных") + " за 30 с";
    else if (a.key === "stamps") text = "— " + v + " " + plural(v, "печать", "печати", "печатей") + " Сборки: коктейли по памяти";
    else if (a.key === "streak") text = "— серия карточек: " + v + " " + plural(v, "день", "дня", "дней") + " подряд";
    if (text) out.push({ kind: "record", at, me: mine, who, text });
  }
  // «спасибо команде» — сегодня (время сервер не отдаёт)
  for (const t of Array.isArray(thanks) ? thanks : []) {
    if (!t || !t.name) continue;
    out.push({ kind: "thanks", at: now - 1, me: !!t.me, who: t.me ? "Ты" : clean(t.name), text: "— спасибо команде ✦" });
  }
  out.sort((a, b) => b.at - a.at);
  return out.slice(0, Math.max(0, limit));
}

// Названия тестов: id → название из индекса программы (data/modules-index.js) и своих уроков
export function quizTitles(index, extra = []) {
  const m = new Map();
  for (const mods of Object.values(index || {})) for (const mod of mods || []) for (const l of mod.lessons || []) if (l && l.id) m.set(l.id, l.title || "");
  for (const mod of extra || []) for (const l of (mod && mod.lessons) || []) if (l && l.id) m.set(l.id, l.title || "");
  return (id) => m.get(id) || "";
}
