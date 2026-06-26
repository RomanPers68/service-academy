// data/roles.js
// Рестораны и роли пользователей. Из App.jsx (строки 77–84).

export const RESTAURANTS = ["Два моря, Океан","Марико","Мясник","Порт","Камчадал"];

export const ROLES = [
  { id: "spg", mm: "wave", label: "Хостес", sublabel: "Служба приёма гостей", icon: "🛎️", color: "#C8917A", dark: "#2e211a", desc: "От хостес до амбассадора гостеприимства" },
  { id: "seasonal", mm: "wave", label: "Новичок", sublabel: "Сезонный сотрудник", icon: "🌱", color: "#7C9E87", dark: "#1a2e20", desc: "Базовые стандарты сервиса для новых сотрудников" },
  { id: "core", mm: "thumbs_up2", label: "Ядро", sublabel: "Постоянная команда", icon: "⭐", color: "#C8A96E", dark: "#3e3020", desc: "Углублённые стандарты и роль наставника" },
  { id: "manager", mm: "serious", label: "Менеджер", sublabel: "Руководитель зала", icon: "🎯", color: "#8B7BAB", dark: "#1e1a2e", desc: "Управление командой, конфликты, финансы" },
  { id: "service_manager", mm: "idea", label: "Сервис-менеджер", sublabel: "Следующая ступень", icon: "🏛️", color: "#7B8FAB", dark: "#1a1e2e", desc: "Архитектор сервиса — школа, методика, культура, развитие" },
];
