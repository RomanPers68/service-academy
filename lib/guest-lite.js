// lib/guest-lite.js — v79 (Доп. 392): то немногое из «Живого гостя», что нужно главной сразу: подпись плитки по роли и
// история разговоров (для «Чека недели» и итогов). Сами персонажи, сцены и разбор (lib/live-guest.js, ~56 КБ) грузятся
// вместе с экраном гостя. lib/live-guest.js переэкспортирует отсюда — имена и поведение прежние.
export const GUEST_RUNS_KEY = "sa_guest_runs";

// v42: место — по треку, который человек сейчас проходит (хостес на треке бара встречает гостя у стойки).
// Общие треки (новичок, ядро) — зал, но хостес и бармена по должности встречает их гость, как с v30.
// Трека нет — по должности.
const TRACK_PLACE = { spg: "door", bar: "bar", manager: "manager", service_manager: "manager" };
export const placeOf = (role, position) => {
  if (TRACK_PLACE[role]) return TRACK_PLACE[role];
  const pos = String(position || "");
  if (pos === "hostess" || pos === "spg") return "door";
  if (/bartender/.test(pos)) return "bar";
  if (!role && (pos === "manager" || pos === "senior")) return "manager";
  return "hall";
};

const GUEST_SUB = {
  hall: "Гость-ИИ из твоего меню · чек разбора",   // v110 (Доп. 423): подписи в строке — в одну строку
  door: "Гость-ИИ у входа · чек разбора",
  bar: "Гость-ИИ у барной стойки · чек разбора",
  manager: "Гость-ИИ позвал менеджера · чек разбора",
};
export const guestSub = (role, position) => GUEST_SUB[placeOf(role, position)] || GUEST_SUB.hall;

export function readGuestRuns(uk, storage) {
  try { const s = storage || localStorage; const v = JSON.parse(s.getItem(GUEST_RUNS_KEY + (uk || "")) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
