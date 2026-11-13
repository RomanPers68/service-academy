// lib/chat-ai.js — v93 (Доп. 406): Наставник в переписке. «@Наставник …» — вопрос уходит в ai-chat (как в экране
// «Наставник»: со справочником, меню и коктейлями заведения), ответ — коротко, для всей команды, с карточками блюд,
// коктейлей и уроков. Грузится отдельно, только когда Наставника позвали (App.jsx → chatApi({ ai })).
// v153 (Доп. 477): как на экране «Наставник» (v152) — вопрос о марке напитка, которой нет в «Барной карте», и «найди в
// интернете…» идут в /api/web-answer (поиск в интернете); ссылки — последней строкой ответа («Нашёл в интернете: …»,
// lib/ai-web.js). Интернет не ответил — обычный ответ, как раньше. Владелец (13.11): на «Пригодился бы интернет только
// Наставнику в переписке команды… Сделать?» — «Да, давай😉».
import { SUPABASE_URL, SUPABASE_KEY, saToken } from "../api/supabase";
import { withRefContext, barDrinksOf, webAsked, drinkAssistantContext } from "./reference-context";
import { cleanReply } from "./reply-clean";
import { aiReply, lessonTitles } from "./chat-app";
import { menuDishesFromStorage, barCocktails, sharedOf } from "./menu-dishes";
import { webLineText } from "./ai-web";

// подсказка модели (в переписку не попадает): ответ увидят все в чате
const CHAT_HINT = "\n\n[Вопрос задан в общем чате смены, ответ увидит вся команда: отвечай коротко, 2–5 предложений, без заголовков и списков.]";
const BODY_MAX = 1990;   // сервер чата хранит до 2000 знаков: строка ссылок не должна обрезаться

// v153: ответ с поиском в интернете (как ui/assistant.jsx): данные приложения — ресторан и позиции карты рядом с вопросом
async function viaWeb(q, rest) {
  const context = [rest ? "Ресторан: " + rest + "." : "", drinkAssistantContext(q, rest) || ""].filter(Boolean).join("\n");
  try {
    const r = await fetch("/api/web-answer", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: saToken(), question: q, context, chat: true }) });
    const w = await r.json();
    return w && w.ok && String(w.reply || "").trim() ? w : null;
  } catch (e) { return null; }
}
/** Текст ответа и строка ссылок вместе — не длиннее BODY_MAX (лишнее обрезается у текста, не у ссылок). */
export function withWebLine(text, sources) {
  const line = webLineText(sources), t = String(text || "").trim();
  if (!line) return t;
  const room = BODY_MAX - line.length - 2;
  const cut = t.length > room ? t.slice(0, Math.max(0, room - 1)).replace(/\s+\S*$/, "") + "…" : t;
  return cut + "\n\n" + line;
}

/** → { text, cards } или { text: "", error }. */
export async function chatAi(question, profile, learner) {
  const q = String(question || "").trim();
  if (!q) return { text: "", error: "bad_request" };
  const rest = (profile && profile.restaurant) || "";
  const kit = () => ({ dishes: menuDishesFromStorage(rest), cocktails: barCocktails(sharedOf(rest)), drinks: barDrinksOf(rest), lessons: lessonTitles(), question: q });   // v94: карточка — о чём спросили; v130: и вина с крепким
  if (webAsked(q, rest)) {
    const w = await viaWeb(q, rest);
    if (w) { const a = aiReply(cleanReply(w.reply), kit()); return { ...a, text: withWebLine(a.text, w.sources) }; }
  }
  const msgs = withRefContext([{ role: "user", content: q }], profile, learner);
  const li = msgs.length - 1;
  if (li >= 0 && msgs[li].role === "user") msgs[li] = { ...msgs[li], content: msgs[li].content + CHAT_HINT };
  let d = null;
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
      body: JSON.stringify({ token: saToken(), messages: msgs }),
    });
    d = await r.json();
  } catch (e) { return { text: "", error: "net" }; }
  if (!d || !d.ok || !d.reply) return { text: "", error: d && /limit/.test(String(d.error || "")) ? "limit" : "ai" };
  return aiReply(cleanReply(d.reply), kit());
}
