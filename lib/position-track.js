// lib/position-track.js — v58 (Доп. 371): трек обучения по должности из профиля.
// Новичку не нужно выбирать роль самой, если в профиле уже «Официант»: трек подставляется, «сменить» — рядом.
// Тот же словарь — у отчёта по сотруднику (lib/report-model.js: основной трек, если ничего не начато).
export const POS_TRACK = { waiter: "seasonal", hostess: "spg", bartender: "bar", senior_bartender: "bar", manager: "manager", senior: "service_manager" };

// profile — { position, ... } → id трека или null (должность без своего трека: владелец, повар — выбирают сами)
export function trackForPosition(profile) {
  if (!profile || typeof profile !== "object") return null;
  const t = POS_TRACK[profile.position];
  return typeof t === "string" ? t : null;
}
