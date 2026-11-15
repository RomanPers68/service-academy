// lib/ru-num.js — v165 (Доп. 490): слово при числе. До этого в части экранов слово стояло в одной форме на все числа:
// «1 тестов», «31 дней», «22 смен», «Сборка · 3 шагов». Здесь — общий счёт для экранов; в lib/*.js у отчётов и сводок
// свои такие же помощники (plural), их не трогаем.

const whole = (n) => Math.abs(Math.trunc(Number(n) || 0));

/** Счёт в именительном: plural(1, "шаг", "шага", "шагов") → "шаг"; 3 → "шага"; 5, 11, 20 → "шагов"; 21 → "шаг" */
export function plural(n, one, few, many) {
  const k = whole(n), m10 = k % 10, m100 = k % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/**
 * Счёт в родительном — после «из», «до», «не хватит»: pluralGen(21, "смены", "смен") → "смены" («из 21 смены»);
 * 2, 5, 11, 22 → "смен" («из 22 смен»).
 */
export function pluralGen(n, one, many) {
  const k = whole(n);
  return k % 10 === 1 && k % 100 !== 11 ? one : many;
}

/** Число со словом: counted(3, "шаг", "шага", "шагов") → "3 шага" */
export const counted = (n, one, few, many) => n + " " + plural(n, one, few, many);
