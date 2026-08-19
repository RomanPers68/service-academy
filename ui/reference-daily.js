// Ежедневное задание справочника — вынесено из ReferenceSection, чтобы
// главный экран не тянул за собой весь справочник с иллюстрациями.
import { REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE, REFERENCE_APP_COURSE } from "../data/reference";

export function referenceDailyTask(seed) {
  // Глава руководителей в «главу дня» не попадает: пул общий для всех ролей
  const ls = [...REFERENCE_COURSE.lessons, ...REFERENCE_WINE_COURSE.lessons, ...REFERENCE_COFFEE_COURSE.lessons, ...REFERENCE_BAR_COURSE.lessons, ...REFERENCE_APP_COURSE.lessons.filter(l => !l.leaderOnly)];
  return ls[((seed % ls.length) + ls.length) % ls.length];
}
