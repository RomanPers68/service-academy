// lib/home-look.js — v101 (Доп. 414): вид главной «Линза» — общий элемент на весь экран. Владелец (29.10) про новую главную
// (сеть одним экраном, лига, сетка инструментов): «твой вариант мне не понравился. Если это будет приближенно к тому, что
// есть, но более красиво, с каким-то общим элементом, который будет роднить весь экран, и будет радовать глаз, то
// возможно». Раскладка и содержимое прежние, меняется только вид. Из показанных вариантов («Линза», «Строчка», «Меню»,
// потом ещё «Хрусталь» и «Оправа») выбрана «Линза»: всё круглое на главной (медальоны дня, инструменты, SOS, треки,
// «Начать» в приглашении) — одно матовое золотистое стекло с золотым ободком и тонким кольцом, как кнопка AI; карточки —
// тем же стеклом с той же кромкой и тёплым светом слева сверху. Стили — ui/home-look.jsx.
// «Как сейчас» (now) остаётся запасным видом: localStorage sa_home_look = "now" — прежний вид главной (в демо —
// переключатель «Вид»). Подгонка главной под экран (lib/home-fit.js) — в обоих видах.
export const LOOKS = ["now", "lens"];
export const LOOK_NAMES = { now: "как сейчас", lens: "Линза" };
export const LOOK_KEY = "sa_home_look";
export const LOOK_DEFAULT = "lens";
export const LOOK_EVENT = "sa:home-look";

const store = (s) => s || (typeof localStorage !== "undefined" ? localStorage : null);

/** Вид главной: один из LOOKS; неизвестное или пустое — LOOK_DEFAULT. */
export function homeLook(storage) {
  try { const v = store(storage) ? store(storage).getItem(LOOK_KEY) : null; return LOOKS.includes(v) ? v : LOOK_DEFAULT; }
  catch (e) { return LOOK_DEFAULT; }
}
export function setHomeLook(v, storage) {
  const x = LOOKS.includes(v) ? v : LOOK_DEFAULT;
  try { const s = store(storage); if (s) s.setItem(LOOK_KEY, x); } catch (e) {}
  try { if (typeof window !== "undefined" && window.dispatchEvent) window.dispatchEvent(new Event(LOOK_EVENT)); } catch (e) {}
  return x;
}
/** Следующий вид по кругу. */
export const nextLook = (v) => LOOKS[(LOOKS.indexOf(LOOKS.includes(v) ? v : LOOK_DEFAULT) + 1) % LOOKS.length];
/** Классы на корне главной: «Линза» — sa-look sa-look-lens; «как сейчас» — без класса (прежний вид). */
export const lookClass = (v) => (v === "lens" ? " sa-look sa-look-lens" : "");
