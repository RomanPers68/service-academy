// Ежедневное задание справочника — вынесено из ReferenceSection, чтобы
// главный экран не тянул за собой весь справочник с иллюстрациями.
// Лёгкий старт: теперь и сам текст справочника на старте не нужен — «глава дня»
// выбирается по индексу глав (data/reference-index.js, ~5 КБ вместо ~190 КБ).
// Индекс собирает scripts/gen-reference-index.mjs, тест сверяет его со справочником.
import { REFERENCE_DAILY_INDEX } from "../data/reference-index";

// Курс главы (правка 169) хранится в индексе: раньше у любой главы было «Курс: Сервировка»
const withCourse = (l) => (l ? { ...l, course: l.course || "Справочник" } : l);

export function referenceDailyTask(seed, mistakeTopics) {
  // Глава руководителей в «главу дня» не попадает: пул общий для всех ролей
  const ls = REFERENCE_DAILY_INDEX.filter(l => !l.leaderOnly);
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
      if (best && bestN > 0) return withCourse(best);
    }
  }
  return withCourse(ls[((seed % ls.length) + ls.length) % ls.length]);
}
