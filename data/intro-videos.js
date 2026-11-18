// data/intro-videos.js — v174 (Доп. 499): видео-знакомство в первом уроке каждой роли.
//
// Около минуты: аватар владельца в одежде роли на фоне зала «Двух морей» рассказывает, в чём суть роли. Ролики
// вертикальные (720×1280), титры вшиты в кадр: крупная плашка, звучащее слово подсвечено золотом, главная мысль — на
// золотой плашке. Файлы — public/video/intro-<роль>.mp4, обложка — intro-<роль>.jpg (кадр на «Привет!»).
// Урок при этом не меняется: видео стоит над текстом, поиск, «Подсмотреть в уроке» и «Радио в дорогу» работают по тексту.
// Обложка и плеер — ui/intro-video.jsx.

export const INTRO_VIDEOS = {
  "spg-0-1": { role: "spg", src: "/video/intro-spg.mp4", poster: "/video/intro-spg.jpg", dur: 54 },
  "s0-1": { role: "seasonal", src: "/video/intro-seasonal.mp4", poster: "/video/intro-seasonal.jpg", dur: 47 },
  "c0-1": { role: "core", src: "/video/intro-core.mp4", poster: "/video/intro-core.jpg", dur: 49 },
  "m0-1": { role: "manager", src: "/video/intro-manager.mp4", poster: "/video/intro-manager.jpg", dur: 52 },
  "sm0-1": { role: "service_manager", src: "/video/intro-service_manager.mp4", poster: "/video/intro-service_manager.jpg", dur: 53 },
  "bar0-1": { role: "bar", src: "/video/intro-bar.mp4", poster: "/video/intro-bar.jpg", dur: 48 },
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
