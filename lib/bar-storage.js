// lib/bar-storage.js — v142 (Доп. 461): «Хранение» на карточке вина и крепкого в «Барной карте». Без React.
//
// Владелец (07.11), на предложение по теме «Приём и хранение»: «Ок». Карточка позиции показывает условия хранения и срок
// вскрытой бутылки по стандарту холдинга («Стандарты холдинга», модули 07 и 17), как в уроке «Хранение: лицензия, условия,
// вскрытые бутылки» (bar7-5, m8-5). Тип берём из карточки: у вина — цвет (lib/wine.js), у крепкого — вид (lib/spirit.js).

export const KEEP = {
  wine: "10–14 °C, бутылки с пробкой лёжа, без света, вибрации и посторонних запахов",
  spirit: "15–20 °C, стоя, без прямого солнца и отопления",
};

/** Срок вскрытой бутылки по стандарту холдинга (модуль 07): тихое, игристое, креплёное и десертное. */
export const OPEN_LIFE = {
  still: "3 суток с вакуумной пробкой, в холодильнике при 4–6 °C",
  sparkling: "1 сутки с пробкой для игристого, в холодильнике",
  fortified: "14 суток с плотной пробкой",
  liqueur: "срок после вскрытия по маркировке",
};

export const STICKER = "Стикер на бутылке: дата и время вскрытия, «годен до», подпись";

const STILL = ["white", "rose", "orange", "red"];

/** Тип вскрытой бутылки для срока: still | sparkling | fortified | liqueur | null (крепкое без стикера). */
export function openKind(kind, w) {
  if (!w) return null;
  if (kind === "wine") {
    if (w.color === "sparkling") return "sparkling";
    if (w.color === "dessert" || w.color === "fortified") return "fortified";
    if (STILL.includes(w.color)) return "still";
    return null;   // цвет не указан или «другое»: срок не угадываем, стикер всё равно нужен
  }
  if (kind === "spirit") return w.cat === "liqueur" ? "liqueur" : null;
  return null;
}

/** Что показать в карточке: { keep, open, sticker } или null (не вино и не крепкое). */
export function storeOf(kind, w) {
  if (!w || (kind !== "wine" && kind !== "spirit")) return null;
  const ok = openKind(kind, w);
  const sticker = kind === "wine" || ok === "liqueur";
  return { keep: KEEP[kind], open: ok ? OPEN_LIFE[ok] : null, sticker: sticker ? STICKER : null };
}
