// Лёгкий индекс глав справочника для «главы дня» (Доп.: лёгкий старт).
// Главный экран раньше тянул весь справочник (data/reference.js, ~190 КБ), хотя для
// «главы дня» нужны только id, название, тип и курс главы. Индекс собирается отсюда:
//   node scripts/gen-reference-index.mjs
// Тест tests/reference-index.test.js сверяет индекс со справочником — если правишь
// главы, перезапусти скрипт, иначе тест покажет, что индекс устарел.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildReferenceIndex } from "../lib/reference-index-build.js";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ref = await import(join(root, "data/reference.js"));
const index = buildReferenceIndex(ref);
const body = "// СГЕНЕРИРОВАНО scripts/gen-reference-index.mjs — руками не править.\n" +
  "// Главы справочника для «главы дня»: id, название, тип, курс, только для руководителей.\n" +
  "export const REFERENCE_DAILY_INDEX = " + JSON.stringify(index, null, 1) + ";\n";
writeFileSync(join(root, "data/reference-index.js"), body);
console.log("data/reference-index.js:", index.length, "глав");
