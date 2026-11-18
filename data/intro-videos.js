// data/intro-videos.js — v174 (Доп. 499): видео-знакомство в первом уроке каждой роли.
//
// Около минуты: аватар владельца в одежде роли на фоне зала «Двух морей» рассказывает, в чём суть роли. Ролики
// вертикальные (720×1280), титры вшиты в кадр: крупная плашка, звучащее слово подсвечено золотом, главная мысль — на
// золотой плашке. Файлы — public/video/intro-<роль>.mp4, обложка — intro-<роль>.jpg (кадр на «Привет!»).
// Урок при этом не меняется: видео стоит над текстом, поиск, «Подсмотреть в уроке» и «Радио в дорогу» работают по тексту.
// Обложка и плеер — ui/intro-video.jsx.
// v175 (Доп. 500): cues — начала предложений в секундах (из привязки слов к звуку: tools/video/fa.py, cues.py): по ним
// плеер перематывает «назад на фразу» и «вперёд на фразу», как радио. face — где на обложке лицо, доли высоты кадра: макушка,
// глаза, подбородок (сняты с intro-<роль>.jpg); по ним обложка урока и раздела ставит кадр так, чтобы лицо было видно
// (lib/intro-video.js, coverPos и sectionPos). Аватар в ролике сезонного сотрудника и ядра крупнее — лицо ниже.

export const INTRO_VIDEOS = {
  "spg-0-1": { role: "spg", src: "/video/intro-spg.mp4", poster: "/video/intro-spg.jpg", dur: 54, face: { top: 0.03, eyes: 0.2, chin: 0.33 },
    cues: [1.05, 2.12, 4.82, 9.09, 11.99, 17.99, 20.64, 22.13, 24.06, 26.61, 30.8, 36.21, 38.6, 45.62, 46.93, 50.03, 53.57] },
  "s0-1": { role: "seasonal", src: "/video/intro-seasonal.mp4", poster: "/video/intro-seasonal.jpg", dur: 47, face: { top: 0.07, eyes: 0.3, chin: 0.5 },
    cues: [1.03, 1.95, 3.07, 7.73, 10.56, 13.85, 18.36, 20.15, 22.62, 24.87, 26.91, 30.28, 32.87, 37.66, 40.52, 41.88, 43.75, 46.16] },
  "c0-1": { role: "core", src: "/video/intro-core.mp4", poster: "/video/intro-core.jpg", dur: 49, face: { top: 0.07, eyes: 0.3, chin: 0.5 },
    cues: [1.04, 1.94, 4.59, 6.29, 9.18, 11.06, 14.18, 17.13, 19.83, 22.41, 25.25, 29.23, 33.8, 39.06, 42.74, 43.94, 47.83] },
  "m0-1": { role: "manager", src: "/video/intro-manager.mp4", poster: "/video/intro-manager.jpg", dur: 52, face: { top: 0.05, eyes: 0.22, chin: 0.35 },
    cues: [1.03, 1.96, 5.11, 7.09, 9.82, 12.77, 17.74, 20.74, 24.66, 27.25, 30.98, 35.16, 39.41, 44.86, 45.64, 48.76, 51.34] },
  "sm0-1": { role: "service_manager", src: "/video/intro-service_manager.mp4", poster: "/video/intro-service_manager.jpg", dur: 53, face: { top: 0.06, eyes: 0.19, chin: 0.31 },
    cues: [1.04, 1.97, 5.02, 6.9, 9.13, 12.82, 18.94, 22.86, 27.04, 30.9, 33.01, 36.6, 39.32, 41.73, 44.55, 46.09, 48.32, 50.7, 52.39] },
  "bar0-1": { role: "bar", src: "/video/intro-bar.mp4", poster: "/video/intro-bar.jpg", dur: 48, face: { top: 0.04, eyes: 0.16, chin: 0.28 },
    cues: [1.05, 1.94, 4.44, 6.25, 11.07, 18.01, 19.75, 23.53, 27.75, 31.72, 39, 42.94, 47.1] },
};

/** Видео урока или null */
export const introVideoOf = (lessonId) =>
  (typeof lessonId === "string" && Object.prototype.hasOwnProperty.call(INTRO_VIDEOS, lessonId) ? INTRO_VIDEOS[lessonId] : null);

/** 54 → «0:54», 75 → «1:15» */
export function fmtDur(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

/** Для подписи кнопки: 54 → «54 секунды», 61 → «1 минута 1 секунда» */
export function durWords(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  };
  const m = Math.floor(s / 60), r = s % 60;
  const parts = [];
  if (m) parts.push(m + " " + plural(m, "минута", "минуты", "минут"));
  if (r || !m) parts.push(r + " " + plural(r, "секунда", "секунды", "секунд"));
  return parts.join(" ");
}
