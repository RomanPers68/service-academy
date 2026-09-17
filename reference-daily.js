// Ежедневное задание справочника — вынесено из ReferenceSection, чтобы
// главный экран не тянул за собой весь справочник с иллюстрациями.
import { REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE, REFERENCE_APP_COURSE } from "../data/reference";

export function referenceDailyTask(seed, mistakeTopics) {
  // Глава руководителей в «главу дня» не попадает: пул общий для всех ролей
  const ls = [...REFERENCE_COURSE.lessons, ...REFERENCE_WINE_COURSE.lessons, ...REFERENCE_COFFEE_COURSE.lessons, ...REFERENCE_BAR_COURSE.lessons, ...REFERENCE_APP_COURSE.lessons.filter(l => !l.leaderOnly)];
  // Прицел в слабые места: если в банке ошибок есть темы — глава дня
  // выбирается по пересечению слов с их названиями (детерминированно).
  // Нет совпадений или ошибок — прежняя ротация по кругу.
  if (Array.isArray(mistakeTopics) && mistakeTopics.length) {
    const norm = (x) => String(x || "").toLowerCase().replace(/ё/g, "е");
    const toks = (x) => new Set(norm(x).split(/[^а-яa-z0-9]+/).filter(w => w.length > 3));
    const want = new Set();
    mistakeTopics.forEach(t => toks(t).forEach(w => want.add(w)));
    if (want.size) {
      let best = null, bestN = 0;
      ls.forEach((l, i) => {
        let n = 0; toks(l.title).forEach(w => { if (want.has(w)) n++; });
        if (n > bestN || (n === bestN && n > 0 && best !== null && (i % ls.length) === ((seed % ls.length) + ls.length) % ls.length)) { best = l; bestN = n; }
      });
      if (best && bestN > 0) return best;
    }
  }
  return ls[((seed % ls.length) + ls.length) % ls.length];
}
