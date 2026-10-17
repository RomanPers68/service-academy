// Обход всех экранов с подсказками: подсказка не видена → должна появиться, без ошибок.
import { writeFileSync } from "node:fs";
const theme = process.argv[2] || "dark";
const mistakes = [
  { q: "Какую температуру подачи держат у красного вина средней полнотелости?", options: ["8–10 °C", "14–16 °C", "20–22 °C", "Комнатную, какая есть"], correct: 1, explanation: "Слишком тёплое вино звучит спиртом, слишком холодное — теряет аромат.", lessonTitle: "Вино: подача", stage: 0, due: 0 },
  { q: "Гость говорит об аллергии на орехи. Что делаешь первым?", options: ["Советую блюдо без орехов по памяти", "Уточняю у кухни состав и отмечаю в заказе", "Предлагаю десерт", "Прошу гостя выбрать самому"], correct: 1, explanation: "Состав проверяет кухня, отметка в заказе — для всей цепочки.", lessonTitle: "Аллергены", stage: 1, due: 0 },
  { q: "Через сколько после подачи основного подходят к столу?", options: ["Сразу", "2 минуты или два укуса", "10 минут", "Когда позовут"], correct: 1, explanation: "Стандарт — «два укуса»: гость уже понял вкус.", lessonTitle: "Стандарты гостеприимства", stage: 0, due: 0 },
];
const S = (name, who, role, screen, hint, extra = {}) => ({
  name: `${theme}-${name}`, who, theme, role, hints: [hint],
  storage: { "sa_mistakes{uk}": mistakes, ...(extra.storage || {}) },
  steps: [{ nav: screen, after: 1600 }, { expectHint: true }, { shot: "1" }],
});
const list = [
  S("home-staff", "staff", "seasonal", "roleSelect", "home_staff"),
  S("shift-staff", "staff", "seasonal", "shift", "shift_staff"),
  S("team-staff", "staff", "seasonal", "teamHub", "team_staff"),
  S("me", "staff", "seasonal", "me", "me"),
  S("reference", "staff", "seasonal", "reference", "reference"),
  S("menu-staff", "staff", "seasonal", "menuTrainer", "menu_staff"),
  S("glossary", "staff", "seasonal", "glossary", "glossary"),
  S("sos", "staff", "seasonal", "sos", "sos"),
  S("mentor", "staff", "seasonal", "assistant", "mentor"),
  S("mistakes", "staff", "seasonal", "mistakes", "mistakes"),
  S("guestbook", "staff", "seasonal", "guestbook", "guestbook"),
  S("daily", "staff", "seasonal", "daily", "daily"),
  S("leaderboard", "staff", "seasonal", "leaderboard", "leaderboard"),
  S("home-admin", "admin", "manager", "roleSelect", "home_admin"),
  S("shift-admin", "admin", "manager", "shift", "shift_admin"),
  S("team-admin", "admin", "manager", "teamHub", "team_admin"),
  S("menu-admin", "admin", "manager", "menuTrainer", "menu_admin"),
  S("checklist-staff", "staff", "seasonal", "checklist", "checklist_staff"),
  S("checklist-admin", "admin", "manager", "checklist", "checklist_admin"),
  S("cocktails-staff", "staff", "bar", "cocktails", "cocktails_staff"),
  S("cocktails-admin", "admin", "bar", "cocktails", "cocktails_admin"),
  S("barlab", "staff", "bar", "barLab", "barlab"),
  S("stats", "staff", "seasonal", "stats", "stats"),
  S("profile", "staff", "seasonal", "profile", "profile"),
  S("certificates", "staff", "seasonal", "certificates", "certificates"),
  S("weeklyGuest", "staff", "seasonal", "weeklyGuest", "weeklyGuest"),
];
writeFileSync(`sweep-${theme}.json`, JSON.stringify(list, null, 1));
console.log(list.length, "сценариев");
