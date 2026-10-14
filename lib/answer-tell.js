// lib/answer-tell.js — v37 (Доп. 349): верный ответ угадывается по длине?
// В штатных диалогах верный вариант был самым длинным в 92% выборов (в тестах — 79%, в практиках — 97%):
// проходили «по длине», не вчитываясь. Редактор контента подсказывает, если в своём уроке так же.
// options — строки (тест) или объекты { text, correct } (диалог); correctIdx — для строк.
export function answerTell(options, correctIdx) {
  const list = Array.isArray(options) ? options : [];
  const L = list.map((o) => String(typeof o === "string" ? o : (o && o.text) || "").trim().length);
  const ci = Number.isInteger(correctIdx) ? correctIdx : list.findIndex((o) => o && typeof o === "object" && o.correct);
  if (ci < 0 || ci >= L.length || L.length < 2) return false;
  const others = L.filter((_, i) => i !== ci);
  const mx = Math.max(...others);
  return L[ci] >= 30 && mx > 0 && L[ci] >= mx * 1.25;
}
