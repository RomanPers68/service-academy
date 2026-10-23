// lib/reply-clean.js — v76 (Доп. 389): ответ ИИ на экране без примет чат-бота. Без React — проверяют тесты.
// Модели, особенно бесплатные, присылают Markdown-заголовки «###», маркеры «-», цифры-эмодзи «1️⃣» и эмодзи,
// начинают с «Отличный вопрос!» и заканчивают «Надеюсь, помог». Правила стиля стоят в подсказке ai-chat,
// а здесь страховка на экране: чат Наставника понимает только **жирный** и переносы строк.

// Видимые эмодзи — как в проверках v75: знаки с эмодзи-видом по умолчанию и любые пиктограммы с FE0F,
// вместе с оттенками кожи и склейками через ZWJ. Типографские ✓ ✕ ★ › · не трогаем.
const EMOJI_RE = /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️)(?:\p{Emoji_Modifier}|️|‍(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})️?)*/gu;
const KEYCAP_RE = /([0-9])️?⃣/gu;                       // «1️⃣» → «1.»
const LEAD_EMOJI_RE = new RegExp("^[ \\t]*(?:" + EMOJI_RE.source + ")[ \\t]*(?=\\S)", "gmu");   // эмодзи вместо маркера

export function stripEmoji(text) {
  return String(text || "").replace(KEYCAP_RE, "$1.").replace(EMOJI_RE, "").replace(/[ \t]{2,}/g, " ");
}

// Похвала вопросу в начале ответа — отдельной фразой («Отличный вопрос!», «Хороший вопрос, Анна.»)
const PRAISE_RE = /^\s*(?:Отличн|Хорош|Прекрасн|Замечательн|Классн|Интересн|Важн|Правильн|Крут|Супер)[а-яё]*\s+вопрос[^.!?\n]{0,40}[.!]+\s*/iu;
const SURE_RE = /^\s*(?:Конечно|Разумеется|Безусловно)\s*!\s*/iu;
// Дежурная концовка последней строкой: «Надеюсь, помог!», «Если остались вопросы — спрашивай», «Обращайся!»
const TAIL_RE = /(?:^|\n)[ \t]*(?:Надеюсь,[^\n]{0,90}|Если (?:у тебя )?(?:ещё )?(?:остались|будут|появятся|возникнут) (?:ещё )?вопросы[^\n]{0,90}|Обращайся[^\n]{0,60})[ \t]*$/iu;

export function cleanReply(text) {
  let t = String(text || "").replace(/\r\n?/g, "\n");
  t = t.replace(KEYCAP_RE, "$1.");
  t = t.replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "");                         // «---», «* * *»
  t = t.replace(/^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, (_, h) => (/\*\*/.test(h) ? h : `**${h}**`));   // заголовок → жирная строка
  t = t.replace(LEAD_EMOJI_RE, "• ");                                                  // «✅ Сделай» → «• Сделай»
  t = t.replace(/^[ \t]*[-*+][ \t]+/gm, "• ");                                          // «- пункт», «* пункт» → «• пункт»
  t = t.replace(/(^|[^*\p{L}\p{N}])\*(?![\s*])([^*\n]+?)(?<!\s)\*(?!\*)/gu, "$1$2");    // *курсив* — без звёздочек
  t = t.replace(EMOJI_RE, "");
  t = t.replace(PRAISE_RE, "").replace(SURE_RE, "");
  for (let i = 0; i < 2 && TAIL_RE.test(t); i++) t = t.replace(TAIL_RE, "");
  return t.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/gm, "").replace(/^[ \t]+/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

// Реплика живого гостя: «*смотрит на часы* Простите, горячее скоро?» → действие отдельно, без звёздочек.
// Незакрытая звёздочка в конце — действие, которое ещё печатается (ответ идёт потоком).
export function splitActions(text) {
  const s = String(text || "");
  const out = [];
  const re = /\*([^*\n]+)\*|\*([^*\n]*)$/g;
  let last = 0, m;
  const push = (t, act) => { const v = act ? t.trim() : stripEmoji(t).trim(); if (v) out.push({ t: v, act }); };
  while ((m = re.exec(s))) {
    push(s.slice(last, m.index), false);
    push(m[1] != null ? m[1] : m[2], true);
    last = m.index + m[0].length;
    if (!m[0].length) re.lastIndex++;
  }
  push(s.slice(last), false);
  return out;
}
