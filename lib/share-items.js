// lib/share-items.js — v97 (Доп. 410): что уходит в чат по «Поделиться в чат» из приложения (Колода меню, Колода
// бармена, Справочник, урок). Тот же вид, что у «Поделиться» внутри чата (lib/chat-app.js): сервер берёт вид, id,
// название, подпись, минуты и картинку (только https; фото-текст data: в чат не уходит).
const https = (s) => (/^https:\/\/[^\s"<>]+$/.test(String(s || "")) && String(s).length <= 600 ? String(s) : "");
// «Паштет из осьминога (осьминог, лук, сливки)» → «Паштет из осьминога»: в подписи — названия, без состава в скобках
const bare = (s) => String(s || "").replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/[\s,·]+\S*$/, "") + "…" : s);

export const dishShareItem = (d) => ({ kind: "dish", id: String(d.id), title: String(d.name || ""),
  sub: cut([d.cat, (d.ingredients || []).map(bare).filter(Boolean).slice(0, 3).join(", ")].filter(Boolean).join(" · "), 110), img: https(d.img) });

export const cocktailShareItem = (c) => ({ kind: "cocktail", id: String(c.id), title: String(c.name || ""),
  sub: cut((c.ing || []).slice(0, 3).map((i) => bare(Array.isArray(i) ? i[0] : i)).filter(Boolean).join(", "), 110) });

export const refShareItem = (ch, course = "") => ({ kind: "ref", id: String(ch.id), title: String(ch.title || ""), sub: String(course || "") });

export const lessonShareItem = (l, mod = null) => ({ kind: l && l.type === "quiz" ? "quiz" : "lesson", id: String(l.id), title: String(l.title || ""),
  sub: mod && mod.title ? String(mod.title) : "", ...(Number(l && (l.minutes || l.mins)) > 0 ? { mins: Math.min(999, Math.round(Number(l.minutes || l.mins))) } : {}) });
