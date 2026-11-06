// Лёгкий индекс уроков всех ролей (data/modules-index.js) — собирается из данных ролей:
//   node scripts/gen-modules-index.mjs
// Тест tests/modules-index.test.js сверяет индекс с данными: добавил урок или раздел — перезапусти скрипт.
// v140 (Доп. 455): раньше индекс правили руками; формат и порядок ролей — прежние (файл не меняется, если уроки те же).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROLES = [["bar", "modules-bar.js", "BAR_MODULES"], ["seasonal", "modules-seasonal.js", "SEASONAL_MODULES"], ["core", "modules-core.js", "CORE_MODULES"],
  ["manager", "modules-manager.js", "MANAGER_MODULES"], ["service_manager", "modules-service_manager.js", "SERVICE_MANAGER_MODULES"], ["spg", "modules-spg.js", "SPG_MODULES"]];
const index = {};
for (const [role, file, name] of ROLES) {
  const mods = (await import(join(root, "data", file)))[name];
  index[role] = mods.map((m) => ({ id: m.id, title: m.title, lessons: (m.lessons || []).map((l) => ({ id: l.id, title: l.title, type: l.type })) }));
}
const path = join(root, "data/modules-index.js");
const src = readFileSync(path, "utf8");
const head = src.slice(0, src.indexOf("export const MODULES_INDEX = "));
writeFileSync(path, head + "export const MODULES_INDEX = " + JSON.stringify(index) + ";\n");
console.log("data/modules-index.js:", Object.entries(index).map(([r, m]) => r + " " + m.length).join(", "));
