// api/web-answer.js — v152 (Доп. 476): ассистент с выходом в интернет. Vercel превращает файл в функцию POST /api/web-answer.
//
// Владелец (13.11): «Мы можем дать моему ассистенту выход в интернет, что бы он мог просмотреть или найти инфу которую он
// к примеру не знает? И сколько это будет стоить?» — «Да, давай сделаем😉. И то есть, к примеру ассистент может после этого
// сам проверить инфу по алкоголю в сети, и оттуда взять, верно?»
//
// Обычные вопросы ассистент по-прежнему решает сам (Supabase, функция ai-chat, бесплатные модели). Сюда приложение шлёт
// (ui/assistant.jsx, lib/reference-context.js: webAsked) вопрос о напитке, которого в «Барной карте» нет, вопрос «найди в
// интернете…» и «Проверить в интернете» под ответом. Модель отвечает по данным приложения, а если не уверена — ищет
// (api/_web.js: openrouter:web_search, не больше 3 поисков) и отдаёт ссылки. Ответ — { ok, reply, sources: [{ url, title }],
// searched }; ошибки — { ok: false, error: not_configured | auth | rate_limit | server, message }.
// Модели: OPENROUTER_WEB_MODEL, потом Gemini Flash и Claude Sonnet. Лимит — 20 вопросов в час на сотрудника.
//
// v153 (Доп. 477): chat: true — вопрос «@Наставник …» из переписки (lib/chat-ai.js): ответ увидит вся команда. mode "desc" —
// варианты «вкусного описания» блюда для редактора меню (lib/dish-desc.js): пять углов за нажатие, идеи и факты из
// интернета, ингредиенты — только из состава; ответ — { ok, variants: [{ angle, label, text }], sources }. Лимит — 60
// нажатий в час. Владелец (13.11): «будет полезно ассистенту, который дописывает варианты вкусного описания блюд, что бы
// было больше и разнообразнее описаний😉».

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

import { verifySession, rateLimit } from "./_auth.js";
import { webCall } from "./_web.js";
import { DESC_SYSTEM, descPrompt, descParse } from "../lib/dish-desc.js";   // v153: варианты описания блюда

export const WEB_MODELS = () => [process.env.OPENROUTER_WEB_MODEL, "google/gemini-2.5-flash", "anthropic/claude-sonnet-4.6"].filter(Boolean);
export const SYSTEM = `Ты — «Наставник» академии сервиса ресторанной группы: помогаешь официантам, барменам, хостес и менеджерам прямо
в смене. У тебя есть поиск в интернете. Правила:
1. Сначала — «Данные приложения», если они есть: карта ресторана, стандарты. Они верны, держись их.
2. Если уверенно знаешь ответ — отвечай без поиска. Не уверен (редкая марка, конкретная бутылка, производитель, новинка,
   факт, который легко перепутать) — найди в интернете: сайт производителя, импортёра, винные и барные справочники.
3. Пиши только то, что подтверждают данные приложения или найденные страницы. Не нашёл — так и скажи, без догадок.
4. Цены, наличие, скидки и правила ресторана называй только из данных приложения. Аллергены — только по карточкам блюд,
   иначе: «уточни у шефа».
5. По-русски, коротко и практично, как старший коллега в зале: 2–5 предложений. Без заголовков, таблиц и списка ссылок —
   ссылки приложение покажет само.`;

const s = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
/** Сообщение модели: данные приложения, вопрос и (для «Проверить в интернете») прошлый ответ, который надо проверить. */
export function webPrompt({ question, context, check, chat }) {
  return (context ? "Данные приложения:\n" + String(context).slice(0, 4000) + "\n\n" : "")
    + "Вопрос сотрудника: " + s(question, 1200)
    + (check ? "\n\nПроверь в интернете ответ, который ты дал раньше, и поправь, если в нём ошибка: «" + s(check, 1500) + "»." : "")
    + (chat ? "\n\n[Вопрос задан в общем чате смены, ответ увидит вся команда: коротко, 2–4 предложения, без списков.]" : "");
}
const lim = () => ({ each: Number(process.env.WEB_ANSWER_EACH_MS) || 40000, total: Number(process.env.WEB_ANSWER_TOTAL_MS) || 50000 });

// v153: «Пять вариантов описания» в редакторе меню — с идеями из интернета
async function desc(b, res, orKey, anKey) {
  const dish = b.dish && typeof b.dish === "object" ? b.dish : {};
  if (!s(dish.name, 120)) return res.status(400).json({ ok: false, error: "server", message: "Нет названия блюда" });
  const emp = await verifySession(b.token);
  if (!emp) return res.status(401).json({ ok: false, error: "auth", message: "Сессия не найдена: войди в приложение заново" });
  if (!rateLimit("webdesc:" + b.token, 60, 3600_000)) return res.status(429).json({ ok: false, error: "rate_limit", message: "Слишком много запросов подряд: попробуй через час" });
  const round = Math.max(0, Math.floor(Number(b.round) || 0)), seen = (Array.isArray(b.seen) ? b.seen : []).map((x) => s(x, 300)).filter(Boolean).slice(-15);
  try {
    const out = await webCall({ orKey, anKey, models: WEB_MODELS(), system: DESC_SYSTEM, user: descPrompt({ restaurant: s(b.restaurant, 80), dish, seen, round, web: true }),
      maxTokens: 1500, lim: lim(), maxSearches: 2 });
    if (!out.ok) return res.status(200).json({ ok: false, error: out.status === 504 ? "timeout" : "server", message: out.error });
    const variants = descParse(out.text, round, seen);
    if (!variants.length) return res.status(200).json({ ok: false, error: "server", message: "AI ответил не по формату" });
    return res.status(200).json({ ok: true, variants, sources: out.sources || [], searched: out.searches || 0, model: out.model });
  } catch (e) {
    return res.status(200).json({ ok: false, error: "server", message: "Сбой: " + (e && e.message ? e.message : "unknown") });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "server", message: "Только POST" });
  const orKey = process.env.OPENROUTER_API_KEY, anKey = process.env.ANTHROPIC_API_KEY;
  if (!orKey && !anKey) return res.status(200).json({ ok: false, error: "not_configured", message: "OPENROUTER_API_KEY не задан в Vercel" });
  const b = req.body || {};
  if (b.mode === "desc") return desc(b, res, orKey, anKey);   // v153
  const question = s(b.question, 1200);
  if (!question) return res.status(400).json({ ok: false, error: "server", message: "Пустой вопрос" });
  const emp = await verifySession(b.token);
  if (!emp) return res.status(401).json({ ok: false, error: "auth", message: "Сессия не найдена: войди в приложение заново" });
  if (!rateLimit("web:" + b.token, 20, 3600_000)) return res.status(429).json({ ok: false, error: "rate_limit", message: "Слишком много поисков подряд: попробуй через час" });
  const history = (Array.isArray(b.history) ? b.history : []).slice(-6).map((m) => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: s(m && m.content, 1500) })).filter((m) => m.content);
  try {
    const out = await webCall({ orKey, anKey, models: WEB_MODELS(), system: SYSTEM, user: webPrompt({ question, context: b.context, check: b.check, chat: b.chat === true }), history, maxTokens: 900,
      lim: lim() });
    if (!out.ok) return res.status(200).json({ ok: false, error: out.status === 504 ? "timeout" : "server", message: out.error });
    const reply = String(out.text || "").trim();
    if (!reply) return res.status(200).json({ ok: false, error: "server", message: "AI ответил пусто" });
    return res.status(200).json({ ok: true, reply, sources: out.sources || [], searched: out.searches || 0, model: out.model });
  } catch (e) {
    return res.status(200).json({ ok: false, error: "server", message: "Сбой: " + (e && e.message ? e.message : "unknown") });
  }
}
