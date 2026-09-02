// data/modules.js — реестр уроков по ролям (Дополнение 132: ленивая загрузка).
//
// Было: один файл на 1 МБ со всеми ролями, грузился при каждом первом запуске.
// Стало: уроки каждой роли лежат в своём файле (modules-core.js, modules-bar.js…)
// и приезжают только когда нужны. MODULES остаётся тем же объектом { роль: [модули] },
// все экраны читают его как раньше; пока роль не загружена — там пустой массив.
//
// Порядок загрузки (App.jsx): роль сотрудника — сразу; остальные — фоном после
// первой отрисовки. Всё, что должно знать обо всех ролях ДО загрузки (id уроков
// для сверки прогресса, роль по id урока), берёт MODULES_INDEX из modules-index.js.
import { MODULES_INDEX } from "./modules-index";
export { MODULES_INDEX };

export const MODULES = {
  spg: [],
  seasonal: [],
  core: [],
  manager: [],
  service_manager: [],
  bar: [],
};

const LOADERS = {
  spg: () => import("./modules-spg").then(m => m.SPG_MODULES),
  seasonal: () => import("./modules-seasonal").then(m => m.SEASONAL_MODULES),
  core: () => import("./modules-core").then(m => m.CORE_MODULES),
  manager: () => import("./modules-manager").then(m => m.MANAGER_MODULES),
  service_manager: () => import("./modules-service_manager").then(m => m.SERVICE_MANAGER_MODULES),
  bar: () => import("./modules-bar").then(m => m.BAR_MODULES),
};

const pending = {};
let version = 0;
const listeners = new Set();

/** Версия контента: растёт при каждой догрузке роли. Для зависимостей useMemo. */
export function contentVersion() { return version; }
/** Подписка на догрузку (lib/use-content.js оборачивает это в хук). */
export function onContentChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }

/** Загрузить уроки одной роли (повторный вызов — тот же промис). */
export function loadRoleModules(role) {
  const loader = LOADERS[role];
  if (!loader) return Promise.resolve([]);
  if (!pending[role]) {
    pending[role] = loader().then(arr => {
      MODULES[role] = Array.isArray(arr) ? arr : [];
      version++;
      listeners.forEach(cb => { try { cb(version); } catch (e) {} });
      return MODULES[role];
    }).catch(e => { delete pending[role]; throw e; });
  }
  return pending[role];
}

/** Загрузить все роли (фоном после старта; для поиска и статистики по всем ролям). */
export function loadAllModules() {
  return Promise.all(Object.keys(LOADERS).map(r => loadRoleModules(r).catch(() => [])));
}

/** Совместимость: старые вызовы loadSpgModules() продолжают работать. */
export function loadSpgModules() { return loadRoleModules("spg"); }

/** Все id уроков всех ролей — из индекса, доступно мгновенно. */
export function allLessonIds() {
  return Object.values(MODULES_INDEX).flatMap(mods => mods.flatMap(m => (m.lessons || []).map(l => l.id)));
}

/** Роль по id урока — из индекса, не требует загрузки. */
export function roleOfLessonId(lid) {
  for (const [rk, mods] of Object.entries(MODULES_INDEX)) {
    if (mods.some(m => (m.lessons || []).some(l => l.id === lid))) return rk;
  }
  return null;
}
