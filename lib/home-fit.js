// lib/home-fit.js — v101 (Доп. 414): главная целиком на экране. Владелец (29.10, запись с iPhone): «стоит ли сжать немного
// элементы и закрепить экран? В основном на больших экранах… чтобы было видно девиз академии, ну и все элементы были видны
// без того, чтобы скролить… чтобы при входе не встречали элементы, которые накладываются друг на друга (ряд треков и
// девиз — под нижним меню). Ну и естественно, чтобы учитывались открытые уроки, тогда уже может работать скрол».
// Если главная (от логотипа до девиза) влезает над нижним меню, когда логотип и отступы немного меньше, — сжимаем ровно
// настолько, насколько не хватает: все размеры ниже — пропорционально одной доле k (0 — как было, 1 — меньше всего).
// Не влезает и при k = 1 (небольшой телефон) — вид прежний, прокрутка как была. Девиз над меню — экран стоит: места под
// девизом (fitTail) не больше, чем осталось до низа главной при её минимальной высоте (экран без верхней строки и
// отступа под меню, ui/styles.js screen), и страница ровно в экран. Здесь только расчёт; мерит и применяет
// ui/screens-roleselect.jsx (RoleSelect).
// Первая сборка срезала хвост отрицательным полем снизу: в браузере iPhone высота прокрутки от этого не уменьшалась,
// срез рос без конца, и главная падала (React #185, снимок владельца из демо). Теперь всё считается от замеров, которые
// от самой подгонки не зависят, а число подгонок подряд ограничено (fitBudget).

// размер: [как было, меньше всего]; все — выше низа девиза (двигают девиз вверх)
export const FIT_ITEMS = {
  logoPadTop: [16, 4], logoPadBottom: [8, 2], logoH: [121, 72],
  greetPb: [8, 5], stripPb: [8, 5], cardPb: [9, 6], tilesPb: [8, 5], toolsMb: [8, 5],
  divH: [19, 9], divPb: [10, 3], titlePb: [8, 4], quoteMt: [4, 0], quotePt: [8, 4], quotePb: [8, 4],
};
/** На сколько px поднимается низ девиза при k = 1. */
export const FIT_ABOVE = Object.values(FIT_ITEMS).reduce((s, [a, b]) => s + a - b, 0);
export const FIT_GAP = 8;   // между девизом и нижним меню
/** Место под девизом: поле девиза снизу и пустой хвост главной — как было (12 + 20). */
export const FIT_TAIL = 32;
/** Без подгонки: k = 0, место под девизом прежнее (tail — null). */
export const FIT_NONE = Object.freeze({ k: 0, tail: null });

/** Размеры при доле k: { logoPadTop, …, logoW } (логотип — в прежних пропорциях 152 × 121). */
export function fitValues(k) {
  const t = Math.max(0, Math.min(1, Number(k) || 0)), out = { k: t };
  for (const [key, [a, b]] of Object.entries(FIT_ITEMS)) out[key] = +(a + (b - a) * t).toFixed(2);
  out.logoW = +((out.logoH * 152) / 121).toFixed(2);
  return out;
}

/**
 * Насколько px девиз не помещается (> 0 — не влезает, < 0 — есть место), всё при прокрутке 0. quoteBottom — низ девиза,
 * tabTop — верх нижнего меню (девиз выше на FIT_GAP); quoteRel — низ девиза от верха главной, minH — минимальная высота
 * главной: пока quoteRel ≤ minH, при пустом хвосте страница не листается. minH неизвестна — только меню.
 */
export function fitOver(quoteBottom, tabTop, quoteRel, minH) {
  const a = quoteBottom + FIT_GAP - tabTop;
  const b = Number.isFinite(minH) && minH > 0 && Number.isFinite(quoteRel) ? quoteRel - minH : -Infinity;
  return Math.max(a, b);
}

/**
 * Следующая доля k по замеру over (fitOver). Не хватает — сжимаем ещё; не влезет и при k = 1 — 0 (вид прежний);
 * места с запасом больше 6 px — отпускаем (оставляя 3 px); между — как есть (без дрожания на полпикселя). Шаг не больше
 * нехватки: размеры двигают девиз не дальше FIT_ABOVE на всю долю, поэтому к месту подходит без качелей.
 */
export function fitNext(k, over) {
  const cur = Math.max(0, Math.min(1, Number(k) || 0));
  if (!Number.isFinite(over)) return cur;
  if (over > 0.5) { const n = cur + over / FIT_ABOVE; return n > 1.0001 ? 0 : +n.toFixed(4); }
  if (over <= -6 && cur > 0) return +Math.max(0, cur + (over + 3) / FIT_ABOVE).toFixed(4);
  return cur;
}

/**
 * Место под девизом, когда девиз над меню: сколько осталось до минимальной высоты главной (minH − quoteRel), не больше
 * прежних 32 px; null — как было. От места под девизом сам девиз не двигается — замер от подгонки не зависит. Раскрыли
 * трек — внизу прокрутки девиз всё равно над меню: места под ним столько же, сколько было до меню при входе.
 */
export function fitTailFor(quoteRel, minH) {
  if (!Number.isFinite(minH) || minH <= 0 || !Number.isFinite(quoteRel)) return null;
  const t = Math.floor(minH - quoteRel);
  return t >= FIT_TAIL ? null : Math.max(0, t);
}
/** Поле девиза снизу и хвост главной при месте tail (null — 12 и 20, как было): сначала уходит хвост. */
export function fitTail(tail) {
  if (tail === null || tail === undefined || !Number.isFinite(tail)) return { quoteMb: 12, tailPb: 20 };
  const t = Math.max(0, Math.min(FIT_TAIL, tail));
  return { quoteMb: Math.min(12, t), tailPb: Math.max(0, t - 12) };
}

/**
 * Предохранитель: не больше max подгонок за секунду для одного размера окна. Сверх — для этого размера подгонка стоит
 * (что успели — остаётся), пока размер окна не сменится; окно меняет размер (Telegram раскрывается) — счёт заново.
 * memo — общий объект ({ bw, bh, t0, n, frozen }).
 */
export function fitBudget(memo, now, w, h, max = 20) {
  if (memo.frozen && memo.frozen.w === w && memo.frozen.h === h) return false;
  if (memo.bw !== w || memo.bh !== h || !memo.t0 || now - memo.t0 > 1000) { memo.bw = w; memo.bh = h; memo.t0 = now; memo.n = 0; }
  memo.n += 1;
  if (memo.n > max) { memo.frozen = { w, h }; return false; }
  return true;
}
