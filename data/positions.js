// data/positions.js — v59 (Доп. 372): должности — один словарь на всё приложение.
// Раньше подписи должностей жили в пяти местах (отчёт, «Управление данными», «Аккаунт», карта обучения,
// «Команда») и расходились: старший был то «Руководящий состав», то «Руководитель». Теперь — здесь.
export const POSITION_LABEL = {
  waiter: "Официант", hostess: "Хостес", bartender: "Бармен", senior_bartender: "Старший бармен",
  manager: "Менеджер", senior: "Руководящий состав", service_manager: "Сервис-менеджер", chef: "Повар",
  owner: "Владелец", admin: "Владелец",
};
// Должности, которые выбирают при добавлении сотрудника в «Команде»
export const POSITIONS = ["waiter", "hostess", "bartender", "senior_bartender", "manager", "senior"];
export const POS_LABELS = Object.fromEntries(POSITIONS.map((id) => [id, POSITION_LABEL[id]]));
export const positionLabel = (id) => POSITION_LABEL[id] || id || "";
