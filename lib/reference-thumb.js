// lib/reference-thumb.js — v158 (Доп. 483): чем показать главу Справочника в списке глав.
//
// Владелец (14.11): «Давай все пять». Третье из пяти: в разделе Справочника главы шли строками с номером и словом
// «Глава». Теперь у строки плитка: своё фото главы (руководитель ставит его в самой главе, тот же лист и тот же этап 51,
// что у фото уроков), а нет — первое фото из главы, а нет — маленький рисунок из её иллюстраций, а нет — номер.
// Готовые фото есть только в четырёх главах («Школы сервировки мира» и три главы «Вин»), в двенадцати — рисунки.
import { REFERENCE_PHOTOS } from "../data/reference-photos";

/** Картинки главы по порядку: ключи из строк «[img:ключ]» и «[img:ключ1,ключ2]» */
export function chapterImages(lesson) {
  const out = [];
  for (const ln of String((lesson && lesson.content) || "").split("\n")) {
    const m = ln.trim().match(/^\[img:(.+)\]$/);
    if (m) for (const k of m[1].split(",")) { const key = k.trim(); if (key) out.push(key); }
  }
  return out;
}

/**
 * Плитка главы: { kind: "photo", key, src } — первое фото главы; { kind: "art", key } — первый рисунок, для которого
 * есть миниатюра (hasMini); null — показывать нечего (в плитке останется номер главы).
 */
export function chapterThumb(lesson, hasMini = () => true) {
  const keys = chapterImages(lesson);
  const ph = keys.find((k) => !!REFERENCE_PHOTOS[k]);
  if (ph) return { kind: "photo", key: ph, src: REFERENCE_PHOTOS[ph] };
  const art = keys.find((k) => !REFERENCE_PHOTOS[k] && hasMini(k));
  return art ? { kind: "art", key: art } : null;
}
