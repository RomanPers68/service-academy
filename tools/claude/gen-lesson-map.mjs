// gen-lesson-map.mjs — карта уроков для ассистента («Наставник», supabase/functions/ai-chat).
//
//   node tools/claude/gen-lesson-map.mjs [корень проекта]
//
// Собирает карту из data/modules-*.js: для каждого урока — [id], заголовок и суть
// (первые содержательные фразы, до 190 знаков); тесты, живые диалоги и сборки — одной
// строкой. Вставляет в ai-chat/index.ts между метками <LESSON_MAP:BEGIN/END>, а если
// меток ещё нет — вместо прежнего литерала const LESSON_MAP = `…`.
// После любых правок в уроках — запустить заново и переразвернуть функцию ai-chat.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(process.argv[2] || process.cwd());
const FN = join(ROOT, "supabase/functions/ai-chat/index.ts");
// Порядок и подписи треков — как их видит сотрудник («Треки обучения» на «Учусь»)
const TRACKS = [
  ["seasonal", "Официант · ступень 1"],
  ["core", "Официант · ступень 2"],
  ["spg", "Хостес · служба приёма гостей"],
  ["bar", "Бар"],
  ["manager", "Менеджер"],
  ["service_manager", "Сервис-менеджер"],
];
const MAX = 190;

const clean = (t) => String(t || "")
  .replace(/\[\[[^\]]*\]\]/g, "")          // служебные вставки
  .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "")   // эмодзи из текста урока — в карте только шум
  .replace(/\*\*|__|`|~~/g, "")            // разметка
  .replace(/^#+\s*/gm, "")
  .replace(/^\s*[-•*▸→]\s+/gm, "")
  .replace(/\s+/g, " ").trim();
const summary = (content) => {
  const t = clean(content);
  if (t.length <= MAX) return t;
  const cut = t.slice(0, MAX);
  const i = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf("… "));
  return i > 90 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, "") + "…";
};
// в шаблонную строку TypeScript: без обратных кавычек и ${
const safe = (s) => s.replace(/`/g, "'").replace(/\$\{/g, "$ {").replace(/\\/g, "/");

const lines = []; let lessons = 0, full = 0;
for (const [role, label] of TRACKS) {
  const m = await import(pathToFileURL(join(ROOT, `data/modules-${role}.js`)).href);
  const seen = new Set();
  const mods = Object.values(m).flat().filter(x => x && Array.isArray(x.lessons) && !seen.has(x.id) && seen.add(x.id));
  for (const md of mods) {
    lines.push(`【${label} · ${md.title}】`);
    for (const l of md.lessons) {
      lessons++;
      const t = String(l.title || "").trim();
      if (l.type === "quiz") lines.push(`· [${l.id}] ${/^тест/i.test(t) ? t : "Тест: " + t}`);
      else if (l.type === "dialogue") lines.push(`· [${l.id}] ${/^живой диалог/i.test(t) ? t : "Живой диалог: " + t}`);
      else if (l.type === "build") lines.push(`· [${l.id}] ${/^сборка/i.test(t) ? t : "Сборка: " + t}`);
      else { full++; const s = summary(l.content); lines.push(`· [${l.id}] ${t}${s ? ": " + s : ""}`); }
    }
  }
}
const map = safe(lines.join("\n"));
const block = "// <LESSON_MAP:BEGIN> — собрано tools/claude/gen-lesson-map.mjs из data/modules-*.js; руками не править\n"
  + "const LESSON_MAP = `\n" + map + "\n`;\n// <LESSON_MAP:END>";

let src = readFileSync(FN, "utf8");
const a = src.indexOf("// <LESSON_MAP:BEGIN>");
if (a >= 0) {
  const b = src.indexOf("// <LESSON_MAP:END>", a);
  src = src.slice(0, a) + block + src.slice(b + "// <LESSON_MAP:END>".length);
} else {
  const a2 = src.indexOf("const LESSON_MAP = `");
  if (a2 < 0) throw new Error("в ai-chat/index.ts нет const LESSON_MAP");
  const b2 = src.indexOf("`;", a2 + 20);
  src = src.slice(0, a2) + block + src.slice(b2 + 2);
}
writeFileSync(FN, src);
console.log(`карта уроков: ${lessons} (с сутью — ${full}), ${map.length} знаков ≈ ${Math.round(map.length / 3)} токенов; функция ai-chat — ${src.length} знаков`);
