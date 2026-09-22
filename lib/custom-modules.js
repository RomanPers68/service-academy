// lib/custom-modules.js — свои разделы из редактора контента → модули программы (правка 161).
//
// Раздел = все свои уроки одного трека с одним названием раздела. Порядок шагов — как у
// штатных модулей: сначала ВСЕ уроки раздела, потом общая практика (ситуации всех уроков),
// диалоги, сборки и ОДИН тест на весь раздел. Раньше каждый урок приносил свою цепочку
// «урок → практика → диалог → тест», и второй урок раздела вставал под тест первого.
//
// Номера шагов сохраняются: общая практика — по первому уроку раздела, где были ситуации
// (cms-p-<id>), общий тест — по первому, где были вопросы (cms-q-<id>); диалог и сборка —
// по своему уроку (cms-d-<id>, cms-b-<id>). Уже пройденное и звёзды не слетают.
//
// Хранение без изменений на сервере: у урока текст и список questions, где вопросы теста
// и, с пометкой kind, ситуации (situation), диалог (dialogue) и сборка (build). Редактор
// (правка 161) кладёт общие части раздела на первый урок раздела.

const DLG_TIP = "Разговор окончен — перечитай объяснения к ответам: в них суть урока.";

export const sectionName = (c) => ((c && c.module) || "").trim() || "Свой раздел";
// порядок уроков в разделе: sort, затем id
export const bySort = (a, b) => ((a.sort || 0) - (b.sort || 0)) || (Number(a.id) - Number(b.id)) || String(a.id).localeCompare(String(b.id));

// части урока: вопросы теста, ситуации, диалог, сборка
export function splitExtras(questions) {
  const all = Array.isArray(questions) ? questions : [];
  return {
    quiz: all.filter(q => !(q && ["situation", "dialogue", "build"].includes(q.kind))),
    sits: all.filter(q => q && q.kind === "situation").map(({ kind, ...x }) => x),
    dlg: all.find(q => q && q.kind === "dialogue") || null,
    bld: all.find(q => q && q.kind === "build") || null,
  };
}

// разделы трека: [{ name, records }] в порядке первого появления
export function sectionsOf(customLessons, role) {
  const groups = new Map();
  (customLessons || []).filter(c => c && c.role === role).forEach(c => {
    const k = sectionName(c); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c);
  });
  return [...groups.entries()].map(([name, records]) => ({ name, records: [...records].sort(bySort) }));
}

// шаги раздела в порядке программы
export function sectionSteps(name, records, role, color) {
  const parts = records.map(c => ({ c, ...splitExtras(c.questions) }));
  const steps = records.map(c => ({ id: "cms-l-" + c.id, title: c.title || "Урок", type: "lesson", content: c.content || "" }));
  const sits = parts.flatMap(p => p.sits);
  const pOwner = parts.find(p => p.sits.length);
  if (sits.length) steps.push({ id: "cms-p-" + pOwner.c.id, title: "Практика: " + name, type: "practice", situations: sits });
  const dlgs = parts.filter(p => p.dlg && Array.isArray(p.dlg.steps) && p.dlg.steps.length);
  dlgs.forEach(p => {
    const d = p.dlg, id = "cms-d-" + p.c.id;
    steps.push({ id, title: "Живой диалог: " + (dlgs.length === 1 ? name : (p.c.title || name)), type: "dialogue", dialogueId: id,
      dialogue: { id, title: p.c.title || name, icon: "💬", color, guest: d.guest || { name: "Гость", avatar: "🙂", context: "", mood: 3 },
        // итоговый шаг с главной мыслью — как у штатных диалогов
        steps: d.steps[d.steps.length - 1].type === "result" ? d.steps : [...d.steps, { type: "result", tip: "✦ " + ((d.tip || "").trim() || DLG_TIP) }] } });
  });
  parts.filter(p => p.bld && Array.isArray(p.bld.steps) && p.bld.steps.length).forEach(p => {
    const b = p.bld, id = "cms-b-" + p.c.id;
    steps.push({ id, title: "Сборка: " + (b.title || name), type: "build", role, buildId: id,
      build: { id, role, mod: "cms", vis: "vessel", title: b.title || name, glass: b.glass || "rocks", tint: b.tint || "#C8A96E",
        from: "Своё · " + name, win: b.win || "Собрано как надо — так и держи.", lose: b.lose || "Одна ошибка тянет за собой весь напиток.", steps: b.steps } });
  });
  const quiz = parts.flatMap(p => p.quiz);
  const qOwner = parts.find(p => p.quiz.length);
  if (quiz.length) steps.push({ id: "cms-q-" + qOwner.c.id, title: "Тест: " + name, type: "quiz", questions: quiz });
  return steps;
}

// Постоянный номер модуля — по названию раздела (правка 163). Раньше — по порядку раздела
// (cms-seasonal-0, -1…): новый раздел сдвигал номера, а к номеру модуля привязано то, что
// должно жить долго (страница книги отзывов, «прочитано», фокус книги).
export const sectionKey = (role, name) => {
  let h = 5381; const s = String(role) + "|" + String(name).trim().toLowerCase().replace(/ё/g, "е");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return "cms-" + role + "-" + h.toString(36);
};

// свои модули трека для программы сотрудника
export function buildCustomModules(customLessons, role, { color, icon } = {}) {
  if (!role) return [];
  return sectionsOf(customLessons, role).map(({ name, records }) => ({
    id: sectionKey(role, name), tag: "Своё", title: name, subtitle: "Раздел вашего ресторана",
    icon: icon ? icon(name) : "📘", color, custom: true,
    lessons: sectionSteps(name, records, role, color),
  }));
}

// номера шагов → названия (для аналитики): по всем трекам
export function cmsTitleMap(customLessons) {
  const m = {};
  const roles = [...new Set((customLessons || []).map(c => c && c.role).filter(Boolean))];
  roles.forEach(role => sectionsOf(customLessons, role).forEach(({ name, records }) =>
    sectionSteps(name, records, role, "").forEach(st => { m[st.id] = st.type === "lesson" ? st.title : st.title; })));
  return m;
}
