// Ленивая обёртка над живыми диалогами: сами данные (≈270 КБ) подгружаются
// после первой отрисовки и не блокируют старт приложения.
// Экспорты — «живые» ESM-биндинги: после loadDialogues() все импортёры видят
// заполненные данные (App делает state-тик, чтобы интерфейс перерисовался).
export let DIALOGUES_DATA = [];
export let MOOD_EMOJI_D = {};
export let MOOD_COLORS_D = {};

let promise = null;
export function loadDialogues() {
  if (!promise) {
    promise = import("./dialogues").then(m => {
      DIALOGUES_DATA = m.DIALOGUES_DATA;
      MOOD_EMOJI_D = m.MOOD_EMOJI_D;
      MOOD_COLORS_D = m.MOOD_COLORS_D;
    });
  }
  return promise;
}
