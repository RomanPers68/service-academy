// lib/cases.js — v83 (Доп. 396): случаи из нашего зала.
//
// Сотрудник рассказывает случай со смены (что случилось, что сделал, чем закончилось), руководитель разбирает его в
// ситуацию для тренировки: сцена, вопрос, верный вариант и неверные, разбор и «как было на самом деле». Команда
// тренируется на опубликованных случаях своего заведения тем же «столом», что и практика (ui/table.jsx, режим cases).
// Здесь только расчёт: экран — ui/cases.jsx, сервер — этап 33 (case_submit / case_review / case_list).

export const CASE_OUTCOMES = [
  ["ok", "Гость доволен"],
  ["saved", "Обошлось"],
  ["bad", "Гость ушёл недовольным"],
  ["unsure", "Не знаю, как было надо"],
];
export const outcomeLabel = (k) => (CASE_OUTCOMES.find((x) => x[0] === k) || [0, ""])[1];
// как на сервере (этап 33): короче — «short», длиннее — не примет
export const CASE_LIMITS = { storyMin: 20, story: 1000, did: 800, scene: 1200, why: 1200, real: 1200, option: 300, question: 200, note: 500 };
export const CASES_TOPIC = "Случаи из нашего зала";

const t = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const low = (s) => t(s).toLowerCase().replace(/ё/g, "е");
const dot = (s) => (s && !/[.!?…][»)"]*$/.test(s) ? s + "." : s);   // «… шприц» → «… шприц».; «Так.» — как есть

/** Черновик разбора: сцена — из рассказа; то, что сделали, — неверным вариантом, если вышло плохо или «не знаю как». */
export function caseDraft(c) {
  const x = c || {};
  const did = t(x.did);
  const sit = x.sit && typeof x.sit === "object" ? x.sit : null;
  if (sit && Array.isArray(sit.options) && Number.isInteger(sit.correct)) {   // уже опубликован — правим как есть
    const opts = sit.options.map(t);
    return { scene: t(sit.scene), question: t(sit.question) || "Как поступить?", right: opts[sit.correct] || "",
      wrong: [...opts.filter((_, i) => i !== sit.correct), "", "", ""].slice(0, 3), why: t(sit.why), real: t(sit.real),
      showReal: !!t(sit.real), showAuthor: sit.show_author !== false && !x.anon };
  }
  const oc = outcomeLabel(x.outcome);
  const real = [did ? "Что сделали: " + dot(did) : "", oc ? "Итог: " + oc.toLowerCase() + "." : ""].filter(Boolean).join(" ");
  return { scene: t(x.story), question: "Как поступить?", right: "", wrong: [did && (x.outcome === "bad" || x.outcome === "unsure") ? did : "", "", ""],
    why: "", real, showReal: !!real, showAuthor: !x.anon };
}

/** Что мешает опубликовать (первая причина) или "". */
export function draftProblem(d) {
  if (!d) return "Нет разбора";
  if (t(d.scene).length < 10) return "Опиши ситуацию для команды: хотя бы одно предложение";
  if (!t(d.right)) return "Напиши, как правильно";
  const wrong = (d.wrong || []).map(t).filter(Boolean);
  if (!wrong.length) return "Добавь хотя бы один неверный вариант";
  const all = [t(d.right), ...wrong].map(low);
  if (new Set(all).size !== all.length) return "Варианты повторяются";
  if (all.some((o) => o.length > CASE_LIMITS.option)) return "Вариант длиннее " + CASE_LIMITS.option + " знаков";
  if (t(d.why).length < 5) return "Напиши разбор: почему так правильно";
  return "";
}

/** Форма разбора → ситуация для case_review: верный — первым (на тренировке варианты перемешиваются). */
export function draftToSit(d) {
  const wrong = (d.wrong || []).map(t).filter(Boolean).slice(0, 3);
  return { scene: t(d.scene).slice(0, CASE_LIMITS.scene), question: t(d.question).slice(0, CASE_LIMITS.question) || "Как поступить?",
    options: [t(d.right), ...wrong].map((o) => o.slice(0, CASE_LIMITS.option)), correct: 0,
    why: t(d.why).slice(0, CASE_LIMITS.why), real: d.showReal ? t(d.real).slice(0, CASE_LIMITS.real) : "", show_author: !!d.showAuthor };
}

const okSit = (s) => !!(s && t(s.scene) && Array.isArray(s.options) && s.options.length >= 2 && s.options.length <= 4 && Number.isInteger(s.correct) && s.correct >= 0 && s.correct < s.options.length);

/** Разбор после ответа: почему так, как было у нас и кто рассказал (одним абзацем — «стол» показывает его как есть). */
export function caseNote(item) {
  const s = (item && item.sit) || {};
  return [dot(t(s.why)), t(s.real) ? "Как было у нас: " + dot(t(s.real)) : "", item && item.author ? "Случай рассказал(а) " + t(item.author) + "." : ""].filter(Boolean).join(" ");
}

/** Опубликованные случаи → ситуации «стола» (режим cases): сначала ещё не разобранные тобой, свежие первыми; до max. */
export function casesToSits(team, played = {}, max = 8) {
  const list = (team || []).filter((x) => x && x.id != null && okSit(x.sit));
  const fresh = list.filter((x) => !played[x.id]), old = list.filter((x) => played[x.id]);
  return [...fresh, ...old].slice(0, max).map((x) => {
    const note = caseNote(x);
    return { id: "case-" + x.id, genre: "action", emoji: "", scene: t(x.sit.scene), question: t(x.sit.question) || "Как поступить?",
      options: x.sit.options.map(t), correct: x.sit.correct, win: note, fail: note,
      _from: "case-" + x.id, _fromTitle: CASES_TOPIC, _case: x.id };
  });
}

/** Ошибка из случая (lessonId case-…) живёт в «Работе над ошибками», пока не исправлена: программы у неё нет. */
export const isCaseMistake = (m) => /^case-\d+$/.test(String((m && m.lessonId) || ""));

// Что уже сыграно и когда последний раз смотрел случаи — на телефоне, у каждого своё
export const PLAYED_KEY = "sa_cases_played", SINCE_KEY = "sa_cases_since";
export function readPlayed(uk, ls) {
  try { const o = JSON.parse((ls || localStorage).getItem(PLAYED_KEY + uk) || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch (e) { return {}; }
}
export function markPlayed(uk, ids, ls) {
  const o = readPlayed(uk, ls);
  (ids || []).forEach((id) => { if (id != null) o[id] = 1; });
  const keys = Object.keys(o);
  if (keys.length > 300) keys.slice(0, keys.length - 300).forEach((k) => delete o[k]);
  try { (ls || localStorage).setItem(PLAYED_KEY + uk, JSON.stringify(o)); } catch (e) {}
  return o;
}
export function readSince(uk, ls) { try { return (ls || localStorage).getItem(SINCE_KEY + uk) || ""; } catch (e) { return ""; } }
export function markSince(uk, iso, ls) { try { (ls || localStorage).setItem(SINCE_KEY + uk, iso || new Date().toISOString()); } catch (e) {} }

/** Подпись пункта в «Смене»: ждут разбора (руководителю), новые случаи, ответ на свой. */
export function casesSub(counts, lead) {
  const c = counts || {};
  const parts = [];
  if (lead && c.inbox) parts.push(c.inbox + " " + pl(c.inbox, "ждёт", "ждут", "ждут") + " разбора");
  if (c.fresh) parts.push(c.fresh + " " + pl(c.fresh, "новый случай", "новых случая", "новых случаев"));
  if (c.mine_new) parts.push("ответ на твой случай");
  if (parts.length) return parts.join(" · ");
  return c.team ? c.team + " " + pl(c.team, "случай", "случая", "случаев") + " для тренировки. Расскажи свой" : "Живые истории смены: расскажи свой, команда потренируется";
}
function pl(n, a, b, c) { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; }
