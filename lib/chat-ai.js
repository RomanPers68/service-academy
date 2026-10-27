// lib/chat-ai.js — v93 (Доп. 406): Наставник в переписке. «@Наставник …» — вопрос уходит в ai-chat (как в экране
// «Наставник»: со справочником, меню и коктейлями заведения), ответ — коротко, для всей команды, с карточками блюд,
// коктейлей и уроков. Грузится отдельно, только когда Наставника позвали (App.jsx → chatApi({ ai })).
import { SUPABASE_URL, SUPABASE_KEY, saToken } from "../api/supabase";
import { withRefContext } from "./reference-context";
import { cleanReply } from "./reply-clean";
import { aiReply, lessonTitles } from "./chat-app";
import { menuDishesFromStorage, barCocktails, sharedOf } from "./menu-dishes";

// подсказка модели (в переписку не попадает): ответ увидят все в чате
const CHAT_HINT = "\n\n[Вопрос задан в общем чате смены, ответ увидит вся команда: отвечай коротко, 2–5 предложений, без заголовков и списков.]";

/** → { text, cards } или { text: "", error }. */
export async function chatAi(question, profile, learner) {
  const q = String(question || "").trim();
  if (!q) return { text: "", error: "bad_request" };
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
  const rest = (profile && profile.restaurant) || "";
  return aiReply(cleanReply(d.reply), { dishes: menuDishesFromStorage(rest), cocktails: barCocktails(sharedOf(rest)), lessons: lessonTitles(), question: q });   // v94: карточка — о чём спросили
}
