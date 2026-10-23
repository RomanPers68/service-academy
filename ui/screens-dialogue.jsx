// ui/screens-dialogue.jsx
// Живой диалог с гостем.
// Вынесено из ui/screens.jsx БЕЗ изменения кода (barrel-разбиение);
// публичный API остался в ui/screens.jsx — App.jsx не менялся.
//
// v37 (Доп. 348): диалог — переписка в мессенджере, на весь экран.
// • Шапка как в Telegram: «назад», аватарка гостя в кольце цвета настроения, имя и строка
//   «печатает…» или настроение словами («🙂 в хорошем настроении»).
// • Первая «реплика» — карточка гостя: кто он и где мы (контекст гостя раньше нигде не
//   показывался). Сцена — серыми служебными плашками, как «Анна вошла в чат».
// • Гость слева, ты — справа золотом; у реплик время и ✓ / ✓✓ «прочитано»; на твою реплику
//   гость ставит реакцию (👍, 🤔, 😕…). Наставник — третий в чате: шёпотом, ✓ или ✗ и разбор,
//   в уроке при ошибке — «Лучше так».
// • Ответы — как клавиатура бота внизу: крупный вопрос, «N из M» с точками ✓/✗, кнопки
//   со стрелкой «отправить». Выбрал — кнопки уходят вниз, реплика улетает в чат.
// • Финал — тоже в чате: отзыв гостя (звёзды в уроке) и итог наставника (один ✦ — раньше
//   было «✦✦»), внизу «Ещё раз» и «Дальше».
// • Гость «печатает» тем дольше, чем длиннее реплика; нажми на переписку — ответит сразу.
//   Тихие звуки отправки и ответа (выключатель общий с уроком «у стола»), по желанию —
//   голос гостя (голос телефона). Ушёл вверх по переписке — кнопка «вниз».
// Сценарии, баллы, звёзды, уход гостя, «Ещё раз» и что получает onClose — как были.

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import React from "react";
import { createPortal } from "react-dom";
import { SUPABASE_URL, SUPABASE_KEY, rpc, saToken, rpcSync, flushQueue, supabase } from "../api/supabase";
import { MODULES } from "../data/modules";
import { ROLES, RESTAURANTS } from "../data/roles";
import { GLOSSARY } from "../data/glossary";
import { DIALOGUES_DATA, MOOD_EMOJI_D, MOOD_COLORS_D, loadDialogues } from "../data/dialogues-lazy";
import { LOGO_SRC, LOGO_SRC_DARK } from "../assets/logo";
import { normSurname, shuffleArray, dedupeBestScores, pickRandom, shuffleSituationOptions, vibrate, onActivate, shuffleQuizOptions, encodeStartParam, decodeStartParam } from "../lib/utils";
import { MM, Mm, ROLE_SVG, UI_SVG, POS_SVG, MOD_SVG, MARKER_RE, GAME_SVG, NAV_ICONS } from "./icons";
import { S, A, ACCENT_SERIF } from "./styles";
import { referenceDailyTask } from "./reference-daily";
import { bookStats, countNewDishes } from "../data/reviews";
import { countUnreadPages } from "./guestbook-lite";
import { Confetti, TimerBar, SayAloud, LiquidSegment, useHintOnce, HintBubble } from "./widgets";
import { hintsFor } from "../data/hints";
import { crownIcon, flameIcon, trophyIcon, faceIcon } from "./icons-extra";
import { StreakCard, MoodCheckCard, TeamMoodCard, moodPalette } from "./mood-cards";
import { BROWN, BROWN_GOLD, CREAM, GOLD, GOLD_SOFT, GREEN, GREEN_DARK, INK, MUTED_2, RED, RED_DARK, LABEL_CSS } from "./tokens";
// v37: переписка — звуки, голос гостя, род имени
import { isFemaleName } from "../lib/utils";
import { sfx, sfxOn, setSfx } from "../lib/sfx";
import { canSpeak, speakText, stopSpeech } from "../lib/speech";

const dlgLastByTerm = {};

// ── v37: настроение, ритм и слова переписки ─────────────────────────────────
// Палитра настроения — запасная: свой диалог из редактора открывается раньше, чем
// подгрузились данные диалогов (там MOOD_EMOJI_D / MOOD_COLORS_D пока пустые).
const MOOD_E = ["😞", "😕", "😐", "🙂", "😊"];
const MOOD_C = ["#E07878", "#C8905A", "#C8A96E", "#8FB890", "#5DBB8A"];
// Настроение словами — без рода и числа: подходит и «Михаилу», и «Паре», и «Гостям»
export const DLG_MOOD_WORDS = ["на взводе", "не в духе", "в порядке", "в хорошем настроении", "в восторге"];
// Настроение 1…5. Не число — 3. Ноль — это 1 (ревью v37: «0 || 3» поднимал гостя до «в порядке»,
// и после резкого ответа он не уходил)
const clampMood = (m) => { const n = Math.round(Number(m)); return Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 3; };
// Настроение после ответа — как раньше: прибавить moodDelta и удержать в 1…5
export const dlgNextMood = (mood, delta) => clampMood(clampMood(mood) + (Number(delta) || 0));
const moodEmoji = (m) => (MOOD_EMOJI_D && MOOD_EMOJI_D[m - 1]) || MOOD_E[m - 1];
const moodColor = (m) => (MOOD_COLORS_D && MOOD_COLORS_D[m - 1]) || MOOD_C[m - 1];

// «Печатает» тем дольше, чем длиннее реплика (0,75–1,8 с); сколько дать прочитать
export const dlgTypingMs = (t) => Math.round(Math.max(750, Math.min(1800, 500 + String(t || "").length * 14)));
const readMs = (t) => Math.round(Math.max(380, Math.min(1100, 260 + String(t || "").length * 7)));
const sceneMs = (t) => Math.round(Math.max(650, Math.min(1500, 420 + String(t || "").length * 9)));
const coachMs = (t) => Math.round(Math.max(900, Math.min(2200, 600 + String(t || "").length * 14)));

// Реакция гостя на твою реплику — по тому, как она сдвинула его настроение
export function dlgReaction(opt) {
  const d = Number(opt && opt.moodDelta) || 0;
  if (d >= 2) return "❤️";
  if (d === 1) return opt.correct ? "👍" : "🙂";
  if (d === 0) return opt.correct ? "👌" : "🤔";
  if (d === -1) return "😕";
  return "😠";
}

// Род и число гостя для «ушёл / ушла / ушли»: «Гости» — множественное, «Пара», «Семья
// Петровых», «Ольга» — женский род, остальные — мужской (как было)
// Множественное — по известным словам (и всё на -ы): своё имя «Наоми», «Мари», «Тони» — не «ушли»
const DLG_PLURAL = new Set(["гости", "люди", "друзья", "ребята", "коллеги", "родители", "соседи", "подруги", "супруги",
  "посетители", "дети", "девушки", "парни", "сотрудники", "старики", "молодые", "двое", "трое", "четверо"]);
export function dlgGram(name) {
  const w = String(name || "").trim().toLowerCase().replace(/ё/g, "е").split(/[\s(,]/)[0];
  if (DLG_PLURAL.has(w) || /ы$/.test(w)) return "pl";
  return isFemaleName(name) ? "f" : "m";
}
export function dlgWalkText(name) {
  const n = String(name || "Гость");
  const g = dlgGram(n);
  if (g === "pl") return n + " не выдержали и уходят, не дождавшись хорошего приёма.";
  if (g === "f") return n + " не выдержала и уходит, не дождавшись хорошего приёма.";
  return n + " не выдержал и уходит, не дождавшись хорошего приёма.";
}
// Уход: у сценария может быть своя фраза и заголовок отзыва (guest.walk / guest.walkTitle) — стажёр,
// смена, зал при эвакуации — не гости ресторана, «не дождавшись хорошего приёма» о них звучало странно
export function dlgWalkLine(guest) {
  const own = guest && typeof guest.walk === "string" ? guest.walk.trim() : "";
  return own || dlgWalkText(guest && guest.name);
}
// Итог наставника: в данных он уже начинается с «✦» — второй не добавляем (было «✦✦»)
export const dlgTip = (tip) => String(tip || "").replace(/^\s*✦\s*/, "").trim();
// Сколько выборов впереди по пути верных ответов (верный → его goto или следующий шаг), начиная с шага from.
// Ветки «спасения» после ошибки заранее в счётчик не входят: «N из M» не обещает вопрос, которого не будет
// (ревью v37: в «громкой претензии» последний вопрос был «4 из 5»). Свернул в ветку — M вырастет.
export function dlgPathChoices(steps, from = 0) {
  const list = Array.isArray(steps) ? steps : [];
  const at = (sid) => (sid === "result" ? list.findIndex((s) => s && s.type === "result") : list.findIndex((s) => s && s.id === sid));
  const seen = new Set();
  let i = from, n = 0;
  for (let guard = 0; guard < 300; guard++) {
    const s = list[i];
    if (!s || s.type === "result" || seen.has(i)) break;
    seen.add(i);
    if (s.type === "choice" && Array.isArray(s.options) && s.options.length) {
      n += 1;
      const ok = s.options.find((o) => o && o.correct);
      i = ok && ok.goto ? at(ok.goto) : i + 1;
      continue;
    }
    i = s.type !== "choice" && s.next ? at(s.next) : i + 1;
  }
  return n;
}
// «Лучше так: «…»» — без двойных ёлочек, если в ответе уже есть свои
export const dlgQuote = (t) => { const x = String(t || "").trim(); return /[«»]/.test(x) ? x : "«" + x + "»"; };
// Звёзды (урок) — та же формула, что и раньше
export function dlgStars({ walkedOut, score, den, mood }) {
  if (walkedOut) return 0;
  if (score === den && mood >= 4) return 3;
  if (score >= Math.ceil(den * 0.6) && mood >= 3) return 2;
  return score > 0 ? 1 : 0;
}
const plural = (n, a, b, c) => { const n10 = n % 10, n100 = n % 100; return n10 === 1 && n100 !== 11 ? a : n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20) ? b : c; };
const hhmm = (t) => { try { const d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); } catch (e) { return ""; } };

// Голос гостя: женский — чуть выше. «Пара», «Семья», «Компания» — не женщина, хоть и «она»
const voiceFemale = (guest) => {
  const n = String((guest && guest.name) || "");
  if (/^(пара|семья|компания|смена|большая|группа|гости|зал)/i.test(n.trim())) return false;
  return isFemaleName(n) || /👩|👵|💁‍♀️|🙋‍♀️/.test(String((guest && guest.avatar) || ""));
};
const VOICE_KEY = "sa_dlg_voice";
const voicePref = () => { try { return localStorage.getItem(VOICE_KEY) === "1"; } catch (e) { return false; } };
const setVoicePref = (on) => { try { localStorage.setItem(VOICE_KEY, on ? "1" : "0"); } catch (e) {} };
// iPhone даёт голосу телефона заговорить только по нажатию: первое нажатие в диалоге его «будит»
let speechWoken = false;
const wakeSpeech = () => {
  if (speechWoken || !canSpeak()) return;
  speechWoken = true;
  try { speakText(" ", { volume: 0, guard: false }); } catch (e) {}
};

// Сдвиг элемента по вертикали прямо сейчас (идущая анимация transform) и «меньше движения»
const shiftNow = (el) => {
  try {
    const t = getComputedStyle(el).transform;
    if (!t || t === "none") return 0;
    const m = t.match(/^matrix(3d)?\((.+)\)$/);
    if (!m) return 0;
    const v = m[2].split(",").map(parseFloat);
    return (m[1] ? v[13] : v[5]) || 0;
  } catch (e) { return 0; }
};
const reducedMotion = () => { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
const SLIDE_MS = 300, PANE_MS = 400, SLIDE_EASE = "cubic-bezier(.32,.72,0,1)";   // как шторки iOS; панель ответов — PANE_MS (CSS .dc-pane)

// ── значки ──
const svg = (body, s) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{body}</svg>
);
const IC = {
  back: svg(<path d="M15 5l-7 7 7 7" />, 26),
  speaker: svg(<><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>, 18),
  mute: svg(<><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>, 18),
  voice: svg(<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />, 18),
  send: svg(<path d="M5 12h12M12 6l6 6-6 6" />, 16),
  down: svg(<path d="M6 9l6 6 6-6" />, 20),
};
const TICKS = (
  <svg className="dc-ticks" viewBox="0 0 18 10" width="17" height="10" aria-hidden="true">
    <path className="t1" d="M1.5 5.4l2.9 2.8L10.6 1.8" /><path className="t2" d="M6.6 6.2l2 2L14.8 1.8" />
  </svg>
);

// Обои переписки: тонкие рисунки ресторана (бокал, чашка, приборы, тарелка, лист, звонок)
const wallSvg = (c, o) => `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240' fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>` +
  "<g transform='rotate(-10 34 36)'><path d='M25 20h18l-1.5 10.5a7.5 7.5 0 0 1-15 0z'/><path d='M34 38v12M28 50h12'/></g>" +
  "<g transform='rotate(8 160 42)'><path d='M148 34h22v8a11 11 0 0 1-22 0z'/><path d='M170 37h3a4 4 0 0 1 0 8h-3'/><path d='M145 55h28'/><path d='M154 28c-1.5-2 1.5-3.5 0-6M161 28c-1.5-2 1.5-3.5 0-6'/></g>" +
  "<g transform='rotate(-18 100 118)'><path d='M93 100v11a4.5 4.5 0 0 0 9 0v-11M97.5 100v36'/><path d='M110 100c4.5 5 4.5 14 0 19v17'/></g>" +
  "<circle cx='200' cy='128' r='15'/><circle cx='200' cy='128' r='9'/>" +
  "<path d='M52 150v12M46 156h12'/><path d='M214 206v8M210 210h8'/><path d='M128 30v6M125 33h6'/>" +
  "<g transform='rotate(12 128 198)'><path d='M114 206c0-13 10-21 24-21 0 13-10 21-24 21z'/><path d='M114 206l14-12'/></g>" +
  "<path d='M24 222a12 12 0 0 1 24 0z'/><path d='M20 222h32'/><path d='M36 208v2'/>" +
  "<g transform='rotate(14 70 92)'><path d='M67 66h6v8l3 5v26a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V79l3-5z'/><path d='M64 88h12'/></g>" +
  "</svg>";
const wallUrl = (c, o) => `url("data:image/svg+xml,${encodeURIComponent(wallSvg(c, o))}")`;
const TAIL = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 11 16'><path d='M6 0C6 7.5 4.6 12.6 0 16h11v-5H6z'/></svg>")}")`;

const LIGHT = `--bg:#E8DEC8;--bg-2:#EFE6D3;--glow:rgba(255,251,240,0.85);
  --text:#2A1F0E;--sub:#64523A;--faint:#7E6E52;
  --gold:#A8843F;--gold-hi:#D9B978;--gold-ink:#76561C;--on-gold:#1A1008;
  --ok:#3E9A6A;--ok-ink:#25643F;--ok-wash:rgba(62,154,106,0.10);--ok-edge:rgba(62,154,106,0.45);
  --bad:#D2685A;--bad-ink:#8B3020;--bad-wash:rgba(201,89,74,0.09);--bad-edge:rgba(201,89,74,0.45);
  --edge:rgba(139,106,48,0.22);--edge-gold:rgba(139,106,48,0.5);
  --head:rgba(246,239,224,0.97);--head-line:rgba(139,106,48,0.22);
  --in:#FFFDF7;--in-text:#2A1F0E;--in-meta:rgba(42,31,14,0.5);--in-shadow:0 1px 2px rgba(120,85,25,0.18);
  --out-a:#E6C987;--out-b:#D2AE66;--out-text:#22170A;--out-meta:rgba(34,23,10,0.6);--out-shadow:0 1px 2px rgba(120,85,25,0.22);
  --svc:rgba(120,90,40,0.16);--svc-text:#4F3F22;
  --card:rgba(255,252,244,0.94);--coach:rgba(255,252,244,0.96);--react-bg:#FFFDF7;
  --pane:linear-gradient(180deg,#F8F1E2,#F1E7D2);--pane-line:rgba(139,106,48,0.3);--pane-shadow:0 -8px 22px rgba(120,85,25,0.14);
  --opt:rgba(255,255,255,0.66);--opt-edge:rgba(139,106,48,0.3);--opt-hover:rgba(255,255,255,0.95);
  --track:rgba(120,90,30,0.18);--fs:17px;--wall:${wallUrl("#7A5D2A", 0.085)}`;

// Корень — «.sa-dlg.dc», не голый «.dc»: класс «dc» есть и у клеток недели в «Свече на двоих»
// (ui/together.jsx) — ревью v37: стиль экрана диалога делал их fixed на весь экран, и лист не нажимался
const DLG_CSS = `
.sa-dlg.dc{--bg:#14110A;--bg-2:#1C1509;--glow:rgba(214,170,80,0.10);
  --text:#EFE4C8;--sub:#AA9D80;--faint:#8A7E66;
  --gold:#C8A96E;--gold-hi:#E4C88C;--gold-ink:#D9B87C;--on-gold:#1A1008;
  --ok:#5DBB8A;--ok-ink:#8AD8AF;--ok-wash:rgba(93,187,138,0.09);--ok-edge:rgba(93,187,138,0.4);
  --bad:#E07878;--bad-ink:#F3A8A8;--bad-wash:rgba(224,120,120,0.09);--bad-edge:rgba(224,120,120,0.4);
  --edge:rgba(255,255,255,0.10);--edge-gold:rgba(214,178,102,0.42);
  --head:rgba(22,17,9,0.97);--head-line:rgba(214,178,102,0.16);
  --in:#2C2419;--in-text:#F1E8D6;--in-meta:rgba(241,232,214,0.48);--in-shadow:0 1px 2px rgba(0,0,0,0.3);
  --out-a:#E6CB92;--out-b:#C9A96B;--out-text:#1E1408;--out-meta:rgba(30,20,8,0.6);--out-shadow:0 1px 2px rgba(0,0,0,0.32);
  --svc:rgba(8,6,3,0.62);--svc-text:#DACEB4;
  --card:rgba(33,26,15,0.94);--coach:rgba(31,25,15,0.95);--react-bg:#2C2419;
  --pane:linear-gradient(180deg,#271E10,#1B150B);--pane-line:rgba(215,170,68,0.4);--pane-shadow:0 -10px 28px rgba(0,0,0,0.34);
  --opt:rgba(255,250,238,0.05);--opt-edge:rgba(214,178,102,0.28);--opt-hover:rgba(255,250,238,0.09);
  --track:rgba(255,255,255,0.13);--fs:15.5px;--wall:${wallUrl("#D6B266", 0.07)};
  --tail:${TAIL};
  position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;overflow:hidden;
  color:var(--text);font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;text-size-adjust:100%;
  background-color:var(--bg);
  background-image:var(--wall),radial-gradient(130% 70% at 50% 0%,var(--glow),transparent 60%),linear-gradient(160deg,var(--bg),var(--bg-2) 50%,var(--bg));
  background-size:240px 240px,auto,auto;
  opacity:0;transform:translateY(14px);transition:opacity .26s ease,transform .36s cubic-bezier(.32,.72,0,1)}
.sa-dlg.dc.on{opacity:1;transform:none}
html.sa-light .sa-dlg.dc,.sa-dlg.dc.lt{${LIGHT}}
.sa-dlg.dc *{box-sizing:border-box}
:where(.sa-dlg.dc) button{font:inherit;color:inherit;-webkit-tap-highlight-color:transparent;margin:0}
/* v73 (Доп. 386): надзаголовки, шапка наставника и плашка «верно» — курсивом, обычными буквами; «3 из 5» — моноширинным */
.dc-ey{${LABEL_CSS};font-size:13.5px;color:var(--gold-ink)}

/* шапка */
.dc-head{flex:0 0 auto;position:relative;z-index:4;padding:max(6px,var(--sa-st,env(safe-area-inset-top,0px))) 8px 6px;background:var(--head);border-bottom:1px solid var(--head-line)}
.dc-head-in{display:flex;align-items:center;gap:6px;max-width:640px;margin:0 auto;min-height:50px}
.dc-back{width:40px;height:40px;flex:0 0 auto;border:0;background:none;color:var(--gold-ink);display:grid;place-items:center;border-radius:50%;padding:0;cursor:pointer}
.dc-back:active{background:var(--opt-hover)}
.dc-who{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.dc-ava{position:relative;width:42px;height:42px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;font-size:22px;line-height:1;
  background:radial-gradient(circle at 50% 30%,rgba(255,236,196,0.2),rgba(255,236,196,0.05));
  box-shadow:0 0 0 2px var(--mc),0 0 16px -3px var(--mc);transition:box-shadow .6s ease}
.dc-ava::after{content:"";position:absolute;inset:-2px;border-radius:50%;border:2px solid var(--mc);opacity:0;pointer-events:none}
.dc-ava.bump::after{animation:dcRing .95s ease-out}
.dc-ava.big{width:62px;height:62px;font-size:32px;margin:0 auto 8px;box-shadow:0 0 0 2.5px var(--mc),0 0 26px -4px var(--mc)}
.dc-id{min-width:0;display:flex;flex-direction:column;gap:1px}
.dc-name{font-family:'Piazzolla',Georgia,serif;font-size:16.5px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dc-st{font-size:14px;line-height:1.3;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dc-st.ty{color:var(--gold-ink);font-style:italic}
.dc-st-e{display:inline-block;animation:dcFade .4s ease}
.dc-dots{display:inline-flex;gap:2px;margin-left:3px;vertical-align:middle}
.dc-dots i{width:3.5px;height:3.5px;border-radius:50%;background:currentColor;animation:dcBlink 1.2s infinite}
.dc-dots i:nth-child(2){animation-delay:.2s}.dc-dots i:nth-child(3){animation-delay:.4s}
.dc-tools{display:flex;gap:6px;flex:0 0 auto}
.dc-tool{width:36px;height:36px;border-radius:50%;border:1px solid var(--edge);background:var(--opt);color:var(--faint);display:grid;place-items:center;padding:0;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.dc-tool.on{color:var(--gold-ink);border-color:var(--edge-gold);background:rgba(214,178,102,0.13)}
.dc-hint{flex:0 0 auto;position:relative;z-index:2;padding:6px 10px 0}

/* переписка */
.dc-chatwrap{position:relative;flex:1 1 auto;min-height:0;overflow:hidden}
.dc-chat{position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;overflow-anchor:none;display:flex;flex-direction:column}
.dc-feed{position:relative;width:100%;max-width:640px;margin:auto auto 0;padding:14px 12px calc(18px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;flex:0 0 auto;will-change:transform}
.dc-spacer{flex:0 0 auto;height:0;pointer-events:none}
.dc-row{display:flex;margin-top:10px}
.dc-row.same{margin-top:3px}
.dc-row.in{justify-content:flex-start;padding:0 13% 0 6px}
.dc-row.out{justify-content:flex-end;padding:0 6px 0 13%;margin-bottom:12px}
.dc-row.mid{justify-content:center}
.dc-b{position:relative;max-width:100%;padding:7px 11px 7px 12px;border-radius:18px;font-size:var(--fs);line-height:1.42;overflow-wrap:anywhere}
.dc-in{background:var(--in);color:var(--in-text);box-shadow:var(--in-shadow)}
.dc-out{background:linear-gradient(180deg,var(--out-a),var(--out-b));color:var(--out-text);box-shadow:var(--out-shadow)}
.dc-row.same .dc-in{border-top-left-radius:6px}.dc-row.same .dc-out{border-top-right-radius:6px}
.dc-row.cont .dc-in{border-bottom-left-radius:6px}.dc-row.cont .dc-out{border-bottom-right-radius:6px}
.dc-row.tail .dc-in{border-bottom-left-radius:4px}.dc-row.tail .dc-out{border-bottom-right-radius:4px}
.dc-row.tail .dc-b::before{content:"";position:absolute;bottom:0;width:11px;height:16px;-webkit-mask:var(--tail) no-repeat 0 0/100% 100%;mask:var(--tail) no-repeat 0 0/100% 100%}
.dc-row.tail .dc-in::before{left:-6px;background:var(--in)}
.dc-row.tail .dc-out::before{right:-6px;background:var(--out-b);transform:scaleX(-1)}
.dc-tx{white-space:pre-wrap;animation:dcTx .24s ease-out both}
.dc-sp{display:inline-block;width:40px;height:1px}
.dc-out .dc-sp{width:62px}
.dc-meta{position:absolute;right:10px;bottom:5px;display:inline-flex;align-items:center;gap:3px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  font-size:11px;line-height:1;color:var(--in-meta);font-variant-numeric:tabular-nums;font-style:normal;letter-spacing:0}
.dc-out .dc-meta{color:var(--out-meta)}
.dc-ticks{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;margin-right:-2px}
.dc-ticks .t2{opacity:0;transition:opacity .3s}
.dc-out.read .dc-ticks .t2{opacity:1}
.dc-out.read .dc-meta{color:rgba(30,20,8,0.78)}
.dc-react{position:absolute;left:-9px;bottom:-13px;min-width:28px;height:28px;padding:0 4px;border-radius:14px;display:grid;place-items:center;font-size:15px;line-height:1;
  background:var(--react-bg);box-shadow:0 0 0 2px var(--ok),0 3px 8px rgba(0,0,0,0.3);animation:dcPop .42s cubic-bezier(.3,1.5,.5,1) both}
.dc-out.miss .dc-react{box-shadow:0 0 0 2px var(--bad),0 3px 8px rgba(0,0,0,0.3)}
.dc-typing{display:flex;gap:4px;align-items:center;padding:13px 15px}
.dc-typing i{width:7px;height:7px;border-radius:50%;background:var(--in-meta);animation:dcBounce 1.2s infinite ease-in-out}
.dc-typing i:nth-child(2){animation-delay:.15s}.dc-typing i:nth-child(3){animation-delay:.3s}
.dc-svc{max-width:92%;padding:5px 12px 6px;border-radius:14px;background:var(--svc);color:var(--svc-text);font-size:15px;line-height:1.38;font-style:italic;text-align:center;text-wrap:pretty}
.dc-svc.bad{color:var(--bad-ink);background:var(--bad-wash);box-shadow:inset 0 0 0 1px var(--bad-edge);font-style:normal}
.dc-intro{width:100%;max-width:360px;margin:2px auto 6px;padding:16px 14px 13px;border-radius:22px;text-align:center;background:var(--card);border:1px solid var(--edge);
  box-shadow:0 8px 24px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.06)}
/* v40: карточка гостя и реплики рассказчика крупнее (в обеих темах): описание 16 px, плашки 13,5,
   подсказка «как отвечать» — цветом подписи, а не бледным. Аватар меньше (62 px) и поля карточки уже —
   она выросла лишь на ~13 px и с панелью ответов не уходит под шапку (e2e-v40-visual, DL) */
.dc-intro-n{margin:4px 0 5px;font-family:'Piazzolla',Georgia,serif;font-size:21px;line-height:1.2;font-weight:700}
.dc-intro-p{margin:0 0 10px;font-size:16px;line-height:1.42;color:var(--sub);font-style:italic;text-wrap:pretty}
.dc-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
.dc-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;border:1px solid var(--edge-gold);font-size:13.5px;line-height:1.3;color:var(--gold-ink);white-space:nowrap}
.dc-howto{margin:9px 0 0;font-size:13.5px;line-height:1.38;color:var(--sub)}
.dc-coach{width:100%;max-width:520px;margin:0 4px;padding:9px 12px 10px;border-radius:16px;background:var(--coach);border:1px solid var(--edge);
  box-shadow:0 3px 12px rgba(0,0,0,0.18);font-size:calc(var(--fs) - 1px);line-height:1.45}
.dc-coach.ok{border-color:var(--ok-edge);background-image:linear-gradient(var(--ok-wash),var(--ok-wash))}
.dc-coach.bad{border-color:var(--bad-edge);background-image:linear-gradient(var(--bad-wash),var(--bad-wash))}
.dc-coach.tip{border-color:var(--edge-gold)}
.dc-coach-h{display:flex;align-items:center;gap:7px;margin-bottom:5px;${LABEL_CSS};font-size:13px;color:var(--gold-ink)}
.dc-coach-av{width:20px;height:20px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;background:linear-gradient(180deg,var(--gold-hi),var(--gold));color:var(--on-gold);font-size:11px;font-style:normal;letter-spacing:0}
.dc-coach-h i{font-family:Georgia,serif;font-style:italic;text-transform:none;letter-spacing:0;font-size:12px;color:var(--faint)}
.dc-verdict{margin-left:auto;padding:1px 8px;border-radius:999px;font-size:13px;white-space:nowrap}
.dc-coach.ok .dc-verdict{color:var(--ok-ink);background:var(--ok-wash);box-shadow:inset 0 0 0 1px var(--ok-edge)}
.dc-coach.bad .dc-verdict{color:var(--bad-ink);background:var(--bad-wash);box-shadow:inset 0 0 0 1px var(--bad-edge)}
.dc-coach p{margin:0;color:var(--text)}
.dc-coach p.dc-best{margin-top:8px;padding-top:8px;border-top:1px dashed var(--edge);color:var(--sub)}
.dc-best b{font-weight:400;font-style:italic;color:var(--gold-ink)}
.dc-review{position:relative;width:100%;max-width:320px;margin:4px auto 0;padding:15px 16px 14px;border-radius:18px;text-align:center;
  background:#F7EEDB;color:#3A2A14;box-shadow:0 10px 28px rgba(0,0,0,0.34)}
html.sa-light .dc-review,.sa-dlg.dc.lt .dc-review{box-shadow:0 0 0 1px rgba(139,106,48,0.3),0 8px 22px rgba(120,85,25,0.2);background:#FFFBF1}
.dc-review .dc-ey{color:#8A6A2E}
.dc-rv-face{font-size:40px;line-height:1;margin:8px 0 6px}
.dc-rv-t{display:block;font-family:'Piazzolla',Georgia,serif;font-size:19px;line-height:1.25}
.dc-stars{font-size:22px;letter-spacing:4px;margin:6px 0 0;line-height:1.2}
.dc-stars .on{color:#C2923A}.dc-stars .off{color:rgba(58,42,20,0.16)}
.dc-rv-s{margin-top:5px;font-size:13.5px;color:#7A6446}
.dc-down{position:absolute;right:12px;bottom:calc(var(--dc-padb,18px) + 4px);z-index:2;width:42px;height:42px;padding:0;border-radius:50%;border:1px solid var(--edge-gold);background:var(--card);color:var(--gold-ink);
  display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,0.3);cursor:pointer;animation:dcPop .3s both}

/* клавиатура ответов и финал */
.dc-pane{position:absolute;left:0;right:0;bottom:0;z-index:3;transform:translateY(100%);transition:transform .4s cubic-bezier(.32,.72,0,1);will-change:transform;pointer-events:none}
.dc-pane.on{transform:translateY(0);pointer-events:auto}
.dc-pane-box{max-width:640px;margin:0 auto;padding:11px 12px calc(12px + env(safe-area-inset-bottom,0px));background:var(--pane);border-radius:22px 22px 0 0;
  box-shadow:inset 0 1px 0 var(--pane-line),var(--pane-shadow)}
.dc-kb{display:flex;flex-direction:column;max-height:min(62vh,540px)}
.dc-kb-top{display:flex;align-items:center;gap:8px;margin:2px 4px 6px}
.dc-beads{display:flex;gap:5px;margin-left:auto}
.dc-beads i{width:7px;height:7px;border-radius:50%;background:var(--track)}
.dc-beads i.ok{background:var(--ok)}.dc-beads i.bad{background:var(--bad)}
.dc-beads i.cur{background:none;box-shadow:inset 0 0 0 1.5px var(--gold)}
.dc-kb-n{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:12.5px;color:var(--sub);letter-spacing:.6px;white-space:nowrap}
.dc-q{margin:0 4px 10px;font-family:'Piazzolla',Georgia,serif;font-size:calc(var(--fs) + 2px);font-weight:700;line-height:1.3;color:var(--text)}
.dc-opts{display:flex;flex-direction:column;gap:8px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:1px 0 2px}
.dc-opt{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:11px 9px 11px 14px;border-radius:16px;border:1px solid var(--opt-edge);background:var(--opt);
  font-size:var(--fs);line-height:1.4;color:var(--text);cursor:pointer;transition:transform .15s,background .2s,border-color .2s,opacity .25s;animation:dcOptIn .32s ease-out both}
.dc-opt:active{transform:scale(.985);background:var(--opt-hover)}
.dc-opt:disabled{cursor:default}
.dc-opt:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.dc-opt-t{flex:1;min-width:0}
.dc-send{flex:0 0 auto;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--edge-gold);color:var(--gold-ink);transition:background .2s,color .2s,border-color .2s}
.dc-opt.pick{border-color:var(--gold);background:rgba(214,178,102,0.16)}
.dc-opt.pick .dc-send{background:linear-gradient(180deg,var(--gold-hi),var(--gold));color:var(--on-gold);border-color:transparent}
.dc-opts.picked .dc-opt:not(.pick){opacity:.3}
.dc-end{display:flex;gap:10px;padding-top:3px}
.dc-again,.dc-next{flex:1;min-height:52px;border-radius:999px;font-size:16px;font-weight:700;letter-spacing:.2px;cursor:pointer;transition:transform .1s}
.dc-again{border:1px solid var(--edge-gold);background:transparent;color:var(--gold-ink)}
.dc-next{border:0;background:linear-gradient(180deg,var(--gold-hi),var(--gold));color:var(--on-gold);box-shadow:0 4px 14px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.35)}
.dc-again:active,.dc-next:active{transform:scale(.98)}
.dc-load{margin:auto;max-width:300px;padding:18px 20px;border-radius:18px;text-align:center;background:var(--card);border:1px solid var(--edge-gold)}

/* появление */
/* реплика только проявляется и чуть «дорастает» — вверх её везёт сама лента (см. layoutChat) */
.dc-row.in>.dc-b{animation:dcIn .28s ease-out both;transform-origin:0 100%}
.dc-row.out>.dc-b{animation:dcIn .28s ease-out both;transform-origin:100% 100%}
.dc-row.mid>*{animation:dcMid .3s ease-out both}
@keyframes dcIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:none}}
@keyframes dcMid{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:none}}
@keyframes dcTx{from{opacity:0}to{opacity:1}}
@keyframes dcOptIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes dcPop{0%{transform:scale(0)}70%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes dcRing{0%{opacity:.95;transform:scale(1)}100%{opacity:0;transform:scale(1.6)}}
@keyframes dcFade{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
@keyframes dcBlink{0%,80%,100%{opacity:.25}40%{opacity:1}}
@keyframes dcBounce{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-4px);opacity:1}}
@media (prefers-reduced-motion: reduce){.sa-dlg.dc,.sa-dlg.dc *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
/* v50 (Доп. 363): телефон лёжа — переписка слева, ответы справа во всю высоту. Снизу панель ответов закрывала
   бы почти весь низкий экран вместе с репликами гостя. Панель стоит на месте всегда (между вопросами — пустая),
   чтобы переписка не меняла ширину на каждом ответе; запасное поле под панель ленте не нужно (layoutChat). */
@media (min-width:700px) and (max-height:540px){
  .sa-dlg.dc .dc-chat{right:min(44%,400px)}
  .sa-dlg.dc .dc-down{right:calc(min(44%,400px) + 12px)}
  .sa-dlg.dc .dc-feed{padding-left:max(12px,var(--sa-sl,env(safe-area-inset-left,0px)))}
  .sa-dlg.dc .dc-pane{top:0;left:auto;width:min(44%,400px);transform:none}
  .sa-dlg.dc .dc-pane-box{height:100%;max-width:none;margin:0;border-radius:0;display:flex;flex-direction:column;justify-content:flex-end;
    padding:10px max(12px,var(--sa-sr,env(safe-area-inset-right,0px))) calc(10px + var(--sa-sb,env(safe-area-inset-bottom,0px))) 12px;box-shadow:inset 1px 0 0 var(--pane-line)}
  .sa-dlg.dc .dc-kb{max-height:none;flex:1 1 auto;min-height:0}
  .sa-dlg.dc .dc-opts{flex:1 1 auto;min-height:0}
}
`;

// Прежние ключевые кадры — их по-прежнему берут Наставник (.dlg-in) и награды (achIconPulse),
// пока диалог открыт. Оставлены как были.
const LEGACY_DLG_CSS = `@keyframes achIconPulse { 0%,100%{box-shadow:0 0 24px rgba(200,160,80,0.4)} 50%{box-shadow:0 0 40px rgba(200,160,80,0.7)} }
    @keyframes dlgPulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
    @keyframes dlgOverlayIn { from{opacity:0} to{opacity:1;transition-duration:0.8s} }
    @keyframes dlgSheetIn { from{transform:translateY(100%)} to{transform:translateY(0)} }
    @keyframes dlgMsgIn { from{opacity:0; transform:translateY(12px) scale(0.97)} to{opacity:1; transform:translateY(0) scale(1)} }
    @keyframes dlgFadeIn { from{opacity:0} to{opacity:1} }
    .dlg-fade { animation: dlgFadeIn 0.5s ease both; }
    @keyframes dlgMsgInL { from{opacity:0; transform:translateX(-14px) translateY(6px)} to{opacity:1; transform:translateX(0) translateY(0)} }
    @keyframes dlgMsgInR { from{opacity:0; transform:translateX(14px) translateY(6px)} to{opacity:1; transform:translateX(0) translateY(0)} }
    .dlg-in { animation: dlgMsgIn 0.4s cubic-bezier(0.22,1,0.36,1) both; will-change: transform, opacity; }
    .dlg-in-left { animation-name: dlgMsgInL; }
    .dlg-in-right { animation-name: dlgMsgInR; }
    .dlg-opt:active { transform: scale(0.975); background: rgba(255,255,255,0.08) !important; transition-delay: 70ms; }
    .dlg-opt-out { opacity: 0; transform: translateY(-6px) scale(0.97); pointer-events: none; }
    .dlg-opt-picked { transform: scale(1.02); pointer-events: none; }
    @media (prefers-reduced-motion: reduce) { .dlg-in { animation-duration: 0.01s; } }`;

const CSS_ID = "sa-dlg-css";
function ensureDlgCss() {
  try {
    if (typeof document === "undefined" || typeof document.getElementById !== "function" || !document.head) return;
    if (document.getElementById(CSS_ID)) return;
    const el = document.createElement("style");
    el.id = CSS_ID;
    el.textContent = DLG_CSS;
    document.head.appendChild(el);
  } catch (e) {}
}

export function LiveDialogue({ dialogueId, inline, T, onClose, color, pro, hintKey }) {
  ensureDlgCss();
  // Свой диалог из редактора контента приходит прямо в уроке (inline, правка 159) и
  // становится единственным вариантом своей темы. Источник запоминается один раз:
  // иначе при каждой перерисовке варианты ответов перемешивались бы заново.
  const SRC = React.useMemo(() => inline ? [{ termKey: "cms:" + inline.id, ...inline }] : null, [inline]);
  const src = SRC || DIALOGUES_DATA;
  const initial = src.find(d => d.id === (inline ? inline.id : dialogueId));
  // Группа = все сценарии одной темы (один termKey). Позволяет ротацию вариантов.
  const group = React.useMemo(
    () => initial ? src.filter(d => d.termKey === initial.termKey) : [],
    [initial]
  );
  // Страховка: диалоги грузятся лениво. Если сценария ещё нет (чанк едет
  // по медленной сети или не загрузился) — дотягиваем и перерисовываемся.
  const [, dataTick] = React.useState(0);
  React.useEffect(() => {
    if (initial) return;
    let alive = true;
    loadDialogues().then(() => { if (alive) dataTick(x => x + 1); }).catch(() => {});
    return () => { alive = false; };
  }, [initial]);
  // При каждом открытии — случайный сценарий из группы (пока вариант один — он же и откроется)
  const [currentId, setCurrentId] = React.useState(() => {
    if (!initial) return dialogueId;
    const grp = src.filter(d => d.termKey === initial.termKey);
    if (!grp.length) return dialogueId;
    let pick = grp[Math.floor(Math.random() * grp.length)].id;
    if (grp.length > 1 && pick === dlgLastByTerm[initial.termKey]) {
      const others = grp.filter(d => d.id !== dlgLastByTerm[initial.termKey]);
      pick = others[Math.floor(Math.random() * others.length)].id;
    }
    dlgLastByTerm[initial.termKey] = pick;
    return pick;
  });
  // Перемешивание вариантов: правильный ответ больше не стоит первым.
  // Пересобирается при каждом запуске сценария и при «Ещё раз» (shuffleKey).
  // v37: по номеру сценария, а не по объекту — свой диалог, пришедший заново тем же
  // (обновился список уроков), больше не перезапускает переписку посреди разговора.
  const [shuffleKey, setShuffleKey] = React.useState(0);
  const base = group.find(d => d.id === currentId) || initial;
  const baseId = base ? base.id : null;
  const dialogue = React.useMemo(() => {
    if (!base) return base;
    return { ...base, steps: (base.steps || []).map(s =>
      (s.type === "choice" && Array.isArray(s.options)) ? { ...s, options: shuffleArray([...s.options]) } : s
    )};
  }, [baseId, shuffleKey]);

  const a11y = !!(T && T.a11y);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    // Двойной requestAnimationFrame: браузер успевает нарисовать стартовое положение
    // экрана до перехода — иначе на занятом главном потоке вход выглядел телепортом.
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setVisible(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  const [msgs, setMsgs] = React.useState([]);
  const [typing, setTyping] = React.useState(false);
  const [pane, setPane] = React.useState(null);      // { kind: "ask", idx } | { kind: "end" } — что внизу
  const [paneOn, setPaneOn] = React.useState(false); // открыта ли панель (содержимое живёт, пока она уезжает)
  const [picked, setPicked] = React.useState(null);
  const [score, setScore] = React.useState(0);
  const [faced, setFaced] = React.useState(0);
  const [marks, setMarks] = React.useState([]);      // ✓/✗ по каждому ответу — точки над вопросом
  const [mood, setMood] = React.useState(() => clampMood((dialogue && dialogue.guest && dialogue.guest.mood) || 3));
  const [bump, setBump] = React.useState(0);         // настроение сдвинулось — кольцо вспыхивает
  const [done, setDone] = React.useState(false);
  const [walkedOut, setWalkedOut] = React.useState(false);
  const [sound, setSound] = React.useState(sfxOn);
  const canVoice = canSpeak();
  const [voice, setVoice] = React.useState(() => canVoice && voicePref());
  const [away, setAway] = React.useState(false);     // ушёл вверх по переписке — кнопка «вниз»
  // Подсказка — только если App передал ключ (сейчас это «Гость недели»):
  // экран общий для всех диалогов, в обычных она не нужна. Хук вызывается
  // всегда — правило хуков, — но без ключа не включается.
  const [dHint, dHintDone] = useHintOnce(hintKey || "dialogue", !!hintKey);
  const [dStep, setDStep] = React.useState(0);
  const dSteps = hintKey ? hintsFor(hintKey) : [];

  const genRef = React.useRef(0);           // номер прогона: «Ещё раз» и уход с экрана гасят старый
  const waitersRef = React.useRef(new Set());
  const busyRef = React.useRef(false);
  const facedRef = React.useRef(0);         // сколько выборов уже сделано — номер вопроса «N из M»
  const moodRef = React.useRef(mood);
  const idRef = React.useRef(0);
  const dlgRef = React.useRef(dialogue); dlgRef.current = dialogue;
  const voiceRef = React.useRef(voice); voiceRef.current = voice;
  const chatRef = React.useRef(null);
  const feedRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  const paneBoxRef = React.useRef(null);
  const spacerRef = React.useRef(null);
  const stickRef = React.useRef(true);
  const touchAtRef = React.useRef(0);

  // Паузы переписки. hurry() — нажали на переписку: все текущие паузы кончаются сразу
  const wait = (ms) => new Promise((res) => {
    const w = { res, t: 0 };
    w.t = setTimeout(() => { waitersRef.current.delete(w); res(); }, ms);
    waitersRef.current.add(w);
  });
  const hurry = () => {
    const ws = [...waitersRef.current];
    waitersRef.current.clear();
    ws.forEach((w) => { clearTimeout(w.t); w.res(); });
  };
  const halt = () => { waitersRef.current.forEach((w) => clearTimeout(w.t)); waitersRef.current.clear(); };
  const push = (m) => { const id = ++idRef.current; setMsgs((p) => [...p, { ...m, id, t: Date.now() }]); return id; };
  const patch = (id, f) => setMsgs((p) => p.map((m) => (m.id === id ? { ...m, ...f } : m)));

  const female = React.useMemo(() => voiceFemale(dialogue && dialogue.guest), [dialogue]);
  const say = (text) => { try { speakText(text, { cancelBefore: true, rate: 1.02, pitch: female ? 1.1 : 0.95 }); } catch (e) {} };
  // Реплика гостя пришла: голос (если включён) или тихий звук сообщения
  const guestLine = (text) => { if (voiceRef.current) say(text); else sfx("recv"); };

  // Итог: отзыв гостя, итог наставника, внизу «Ещё раз» и «Дальше»
  const finish = async (D, g, walked) => {
    if (g !== genRef.current) return;
    busyRef.current = false;
    setTyping(false); setPaneOn(false); setDone(true);
    if (walked) setWalkedOut(true);
    await wait(walked ? 520 : 420); if (g !== genRef.current) return;
    push({ type: "review" });
    vibrate(walked ? "error" : (moodRef.current >= 4 ? "success" : "light")); // тактильный аккорд финала
    if (!voiceRef.current) sfx(walked ? "bad" : moodRef.current >= 4 ? "done" : "recv");
    await wait(650); if (g !== genRef.current) return;
    const tip = dlgTip((D.steps.find((s) => s.type === "result") || {}).tip);
    if (tip) push({ type: "tip", text: tip });
    await wait(tip ? 380 : 120); if (g !== genRef.current) return;
    setPane({ kind: "end" }); setPaneOn(true);
  };

  // Сцена до следующего выбора: гость печатает и отвечает, служебные плашки, переходы next
  const play = async (D, i, g) => {
    const steps = D.steps;
    const at = (sid) => sid === "result" ? steps.findIndex((s) => s.type === "result") : steps.findIndex((s) => s.id === sid);
    for (let guard = 0; guard < 300; guard++) {
      if (g !== genRef.current) return;
      const s = steps[i];
      // Нет следующего шага — разговор окончен (правка 159: иначе диалог без итогового
      // шага result зависал после последней реплики — у своих и у 3 из 53 штатных)
      if (!s || s.type === "result") { finish(D, g, false); return; }
      if (s.type === "choice") {
        if (Array.isArray(s.options) && s.options.length) { setPicked(null); setPane({ kind: "ask", idx: i, n: facedRef.current + 1 }); setPaneOn(true); return; }
        i = i + 1; continue;   // выбор без вариантов — пропускаем, а не замираем
      }
      if (s.type === "guest") {
        setTyping(true);
        await wait(dlgTypingMs(s.text)); if (g !== genRef.current) return;
        setTyping(false);
        push({ type: "guest", text: s.text });
        guestLine(s.text);
        await wait(readMs(s.text));
      } else {
        await wait(220); if (g !== genRef.current) return;
        if (s.type === "action" && s.text) push({ type: "action", text: s.text });
        await wait(s.type === "action" ? sceneMs(s.text) : 120);
      }
      if (g !== genRef.current) return;
      i = s.next ? at(s.next) : i + 1;
    }
    finish(D, g, false);
  };

  // Новый прогон: при открытии и по «Ещё раз» (новый сценарий группы / новое перемешивание)
  React.useEffect(() => {
    if (!dialogue) return;
    const g = ++genRef.current;
    halt();
    busyRef.current = false; facedRef.current = 0;
    const m0 = clampMood((dialogue.guest && dialogue.guest.mood) || 3);
    moodRef.current = m0;
    setMsgs([{ id: "intro", type: "intro", t: Date.now() }]);
    setTyping(false); setPane(null); setPaneOn(false); setPicked(null);
    setScore(0); setFaced(0); setMarks([]); setMood(m0); setDone(false); setWalkedOut(false);
    stickRef.current = true; setAway(false);
    (async () => { await wait(650); if (g === genRef.current) play(dialogue, 0, g); })();
    return () => { genRef.current++; halt(); };
  }, [dialogue]);

  // Ушли с экрана — голос гостя замолкает
  React.useEffect(() => () => { if (voiceRef.current) { try { stopSpeech(); } catch (e) {} } }, []);

  const choose = async (oi) => {
    const D = dlgRef.current;
    if (!D || busyRef.current || done || !paneOn || !pane || pane.kind !== "ask") return;
    const i = pane.idx;
    const step = D.steps[i];
    const opt = step && Array.isArray(step.options) ? step.options[oi] : null;
    if (!opt) return;
    busyRef.current = true;
    const g = genRef.current;
    // 1. Выбранная кнопка светится, остальные гаснут
    setPicked(oi);
    vibrate(opt.correct ? "light" : "error");
    if (voiceRef.current) wakeSpeech(); else sfx("send");
    await wait(220); if (g !== genRef.current) return;
    // 2. Клавиатура уезжает, реплика улетает в чат
    setPaneOn(false);
    const id = push({ type: "me", text: opt.text, correct: !!opt.correct, read: false, react: null });
    const nm = dlgNextMood(moodRef.current, opt.moodDelta);
    if (opt.correct) setScore((s) => s + 1);
    facedRef.current += 1;
    setFaced((c) => c + 1);
    setMarks((m) => [...m, !!opt.correct]);
    // 3. Прочитано, реакция гостя, настроение
    await wait(700); if (g !== genRef.current) return;
    patch(id, { read: true, react: dlgReaction(opt) });
    if (nm !== moodRef.current) { moodRef.current = nm; setMood(nm); setBump((b) => b + 1); }
    // 4. Наставник шепчет: верно или нет и почему; в уроке при ошибке — как лучше
    await wait(520); if (g !== genRef.current) return;
    const best = pro && !opt.correct ? (step.options.find((o) => o.correct) || {}).text : null;
    push({ type: "coach", correct: !!opt.correct, text: opt.feedback || "", best: best || null });
    await wait(coachMs(opt.feedback)); if (g !== genRef.current) return;
    // 5. Гость отвечает на твою реплику
    if (opt.reaction) {
      setTyping(true);
      await wait(dlgTypingMs(opt.reaction)); if (g !== genRef.current) return;
      setTyping(false);
      push({ type: "guest", text: opt.reaction });
      guestLine(opt.reaction);
      await wait(readMs(opt.reaction) + 300); if (g !== genRef.current) return;
    }
    // 6. В уроке гость на пределе после ошибки — уходит
    if (pro && nm <= 1 && !opt.correct && !opt.goto) {
      push({ type: "action", text: dlgWalkLine(D.guest), walk: true });
      finish(D, g, true);
      return;
    }
    busyRef.current = false;
    const steps = D.steps;
    const next = opt.goto ? (opt.goto === "result" ? steps.findIndex((s) => s.type === "result") : steps.findIndex((s) => s.id === opt.goto)) : i + 1;
    if (next < 0 || !steps[next] || steps[next].type === "result") { finish(D, g, false); return; }
    play(D, next, g);
  };

  const again = () => {
    const D = dlgRef.current;
    let nextId = currentId;
    if (group.length > 1) {
      const others = group.filter(d => d.id !== currentId);
      nextId = others[Math.floor(Math.random() * others.length)].id;
    }
    setCurrentId(nextId); if (D) dlgLastByTerm[D.termKey] = nextId;
    setShuffleKey((k) => k + 1);
    if (voiceRef.current) { try { stopSpeech(); } catch (e) {} }
  };

  const toggleSound = () => { const v = !sound; setSfx(v); setSound(v); if (v && !voiceRef.current) sfx("recv"); };
  const toggleVoice = () => {
    const v = !voice;
    setVoice(v); voiceRef.current = v; setVoicePref(v);
    if (v) {
      // прямо по нажатию: iPhone «будит» голос только так — и сразу слышно, как звучит гость
      speechWoken = true;
      const last = [...msgs].reverse().find((m) => m.type === "guest");
      say(last ? last.text : "Голос гостя включён.");
    } else { try { stopSpeech(); } catch (e) {} }
  };

  // ── Движение переписки (v37, по видео владельца: «анимация дёрганная», «можно ещё плавнее») ──
  // 1. Панель ответов лежит ПОВЕРХ переписки и ездит только transform — раскладка экрана на
  //    каждом кадре не пересчитывается (раньше панель меняла высоту экрана, и телефон не успевал).
  // 2. Запасное поле: ответил — панель уезжает, а её место остаётся свободным, и новые реплики
  //    (твоя, шёпот наставника, «печатает…», ответ гостя) встают в него одна под другой — ничего
  //    не едет ни вверх, ни вниз. Лента сдвигается, только когда поле кончилось или пришла панель.
  // 3. Любой сдвиг — одно скольжение всей ленты (FLIP): лента встаёт на новое место, transform'ом
  //    возвращается туда, где была, и за 0,3–0,4 с едет на место — на видеокарте. Пришла панель —
  //    лента едет вместе с ней, в одном темпе. Пролистал вверх — лента стоит, новое ждёт внизу.
  // 4. «Печатает…» превращается в саму реплику (тот же пузырь), а не исчезает и появляется заново.
  const geoRef = React.useRef({ top: 0, feedTop: 0, ready: false, first: null, len: 0, ch: 0, bh: -1, open: false, inner: 0, extra: 0, reserve: 0 });
  const animRef = React.useRef(null);
  const paneOnRef = React.useRef(paneOn); paneOnRef.current = paneOn;
  const layoutChat = (slide) => {
    const el = chatRef.current, feed = feedRef.current, sp = spacerRef.current;
    if (!el || !feed || !sp) return;
    const g = geoRef.current;
    const box = paneBoxRef.current;
    const open = !!(paneOnRef.current && box);
    const bh = box ? box.offsetHeight : 0;
    // где лента видна сейчас — с учётом скольжения, которое ещё не доехало
    const told = animRef.current ? shiftNow(feed) : 0;
    if (animRef.current) { try { animRef.current.cancel(); } catch (e) {} animRef.current = null; }
    // высота самих реплик — без нижнего отступа ленты и без запасного поля
    const base = parseFloat(getComputedStyle(feed).paddingBottom) || 18;
    const inner = feed.getBoundingClientRect().height - base - (parseFloat(sp.style.height) || 0);
    let reserve = g.reserve || 0;
    if (open) reserve = 0;
    else if (g.ready) {
      if (g.open) reserve = g.extra;                             // панель ушла — её место остаётся полем
      reserve = Math.max(0, reserve - (inner - g.inner));        // новые реплики занимают поле
    }
    // v50: телефон лёжа — панель стоит сбоку от ленты и не закрывает реплики: запасное поле под неё не нужно
    const covers = !!(box && box.getBoundingClientRect().left < el.getBoundingClientRect().right - 1);
    const extra = open && covers ? Math.max(0, bh + 14 - base) : open ? 0 : reserve;
    sp.style.height = extra + "px";
    if (wrapRef.current) wrapRef.current.style.setProperty("--dc-padb", (base + extra) + "px");
    if (stickRef.current) el.scrollTop = el.scrollHeight;   // к последней реплике (браузер сам ограничит)
    // положения — дробные, по прямоугольникам: offsetTop округляет, и лента вздрагивала на пиксель
    const top = el.scrollTop;
    const vis = feed.getBoundingClientRect().top - el.getBoundingClientRect().top;   // где лента на экране сейчас
    const dy = g.ready ? (g.feedTop - g.top + told) - vis : 0;
    // панель пришла или ушла — лента едет вместе с ней (та же длительность), реплика — чуть быстрее
    const withPane = open !== g.open;
    Object.assign(g, { top, feedTop: vis + top, ch: el.clientHeight, bh, ready: true, open, inner, extra, reserve });
    if (slide && Math.abs(dy) >= 1 && typeof feed.animate === "function" && !reducedMotion()) {
      try {
        const a = feed.animate([{ transform: "translateY(" + dy + "px)" }, { transform: "translateY(0px)" }], { duration: withPane ? PANE_MS : SLIDE_MS, easing: SLIDE_EASE });
        a.onfinish = () => { if (animRef.current === a) animRef.current = null; };
        animRef.current = a;
      } catch (e) {}
    }
  };
  const layoutRef = React.useRef(layoutChat); layoutRef.current = layoutChat;
  React.useLayoutEffect(() => {
    const g = geoRef.current;
    const first = msgs.length ? msgs[0].id : null;
    const reset = g.first !== first || msgs.length < g.len;   // открыли или «Ещё раз» — без скольжения
    g.first = first; g.len = msgs.length;
    if (reset) { stickRef.current = true; Object.assign(g, { ready: false, reserve: 0, extra: 0, open: false, inner: 0 }); }
    layoutChat(!reset);
  }, [msgs, typing, paneOn, pane]);
  React.useEffect(() => {
    const el = chatRef.current;
    if (!el || typeof ResizeObserver !== "function") return;
    // экран повернули, ушла подсказка, у панели сменилась высота — тоже плавно
    const ro = new ResizeObserver(() => {
      const g = geoRef.current, box = paneBoxRef.current;
      if (el.clientHeight === g.ch && (box ? box.offsetHeight : 0) === g.bh) return;
      layoutRef.current(true);
    });
    ro.observe(el); if (paneBoxRef.current) ro.observe(paneBoxRef.current);
    return () => ro.disconnect();
  }, [!!dialogue]);
  React.useEffect(() => () => { if (animRef.current) { try { animRef.current.cancel(); } catch (e) {} } }, []);
  const toBottom = (smooth) => {
    const el = chatRef.current;
    if (!el) return;
    const top = el.scrollHeight - el.clientHeight;
    if (smooth && typeof el.scrollTo === "function") el.scrollTo({ top, behavior: "smooth" }); else el.scrollTop = top;
  };
  const onScroll = () => {
    const el = chatRef.current;
    if (!el) return;
    geoRef.current.top = el.scrollTop;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (gap < 80) { if (!stickRef.current) stickRef.current = true; if (away) setAway(false); }
    else if (Date.now() - touchAtRef.current < 1500) { stickRef.current = false; if (!away && gap > 220) setAway(true); }
  };
  const markTouch = () => { touchAtRef.current = Date.now(); };

  if (!dialogue) return (
    <div className={"sa-dlg dc" + (visible ? " on" : "") + (a11y ? " lt" : "")} data-dlg="" role="dialog" aria-modal="true" aria-label="Живой диалог" onClick={() => onClose(false, { done: false, walkedOut: false })}>
      <div className="dc-load" onClick={e => e.stopPropagation()}>
        <div className="sa-pulse" style={{ color: "var(--gold-ink)", fontFamily: "Georgia, serif", fontWeight: "bold", marginBottom: 6 }}>Диалог загружается…</div>
        <div style={{ color: "var(--sub)", fontSize: 12.5, lineHeight: 1.55, marginBottom: 12 }}>
          Подтягиваем сценарий. Если сеть медленная — секунду-другую.
        </div>
        <button type="button" className="dc-again" data-sa-back="" onClick={() => onClose(false, { done: false, walkedOut: false })} style={{ flex: "none", minHeight: 40, padding: "0 20px", fontSize: 13 }}>
          Закрыть
        </button>
      </div>
    </div>
  );

  const D = dialogue;
  const guest = D.guest || {};
  const name = String(guest.name || "Гость");
  const avatar = guest.avatar || name.trim().charAt(0).toUpperCase() || "?";
  const m = clampMood(mood);
  const m0 = clampMood(guest.mood || 3);
  const totalChoices = D.steps.filter(s => s.type === "choice").length;
  const den = faced || totalChoices;
  const stars = dlgStars({ walkedOut, score, den, mood: m });
  const askStep = pane && pane.kind === "ask" ? D.steps[pane.idx] : null;
  const ask = askStep && Array.isArray(askStep.options) && askStep.options.length ? askStep : null;
  const askN = ask ? Math.max(1, pane.n || 1) : 0;
  const askM = ask ? Math.max(askN, askN - 1 + dlgPathChoices(D.steps, pane.idx)) : 0;   // сколько всего, если дальше верно
  const startChoices = dlgPathChoices(D.steps, 0);
  const gram = dlgGram(name);
  const side = (x) => (x && x.type === "guest" ? "in" : x && x.type === "me" ? "out" : "");
  // «печатает…» — элемент того же списка с номером будущей реплики гостя: пришла реплика — React
  // оставляет тот же пузырь и меняет в нём точки на текст (без мигания)
  const list = typing ? msgs.concat([{ type: "guest", typing: true, id: idRef.current + 1 }]) : msgs;

  const renderMsg = (mm, k) => {
    if (mm.type === "intro") return (
      <div key="intro" className="dc-row mid" data-dlg-msg="intro">
        <div className="dc-intro">
          <div className="dc-ava big" style={{ "--mc": moodColor(m0) }} aria-hidden="true">{avatar}</div>
          <div className="dc-ey">Живой диалог{D.title ? " · " + D.title : ""}</div>
          <div className="dc-intro-n">{name}</div>
          {guest.context ? <p className="dc-intro-p">{guest.context}</p> : null}
          <div className="dc-chips">
            <span className="dc-chip">{moodEmoji(m0)} {DLG_MOOD_WORDS[m0 - 1]}</span>
            {startChoices ? <span className="dc-chip">{startChoices} {plural(startChoices, "выбор", "выбора", "выборов")}</span> : null}
            {pro ? <span className="dc-chip">★ до 3 звёзд</span> : null}
          </div>
          <p className="dc-howto">Отвечай кнопками внизу. Нажми на переписку — гость ответит без паузы.</p>
        </div>
      </div>
    );
    if (mm.type === "action") return (
      <div key={"m" + mm.id} className="dc-row mid" data-dlg-msg={mm.walk ? "walk" : "action"}>
        <div className={"dc-svc" + (mm.walk ? " bad" : "")}>{mm.walk ? "🚪 " : ""}{mm.text}</div>
      </div>
    );
    if (mm.type === "guest" || mm.type === "me") {
      const s = side(mm), prev = side(list[k - 1]), next = side(list[k + 1]);
      const cls = "dc-row " + s + (prev === s ? " same" : "") + (next === s ? " cont" : " tail");
      if (mm.typing) return (
        <div key={"m" + mm.id} className={cls} data-dlg-typing="">
          <div className="dc-b dc-in dc-typing" role="img" aria-label={name + " печатает"}><i /><i /><i /></div>
        </div>
      );
      if (mm.type === "guest") return (
        <div key={"m" + mm.id} className={cls} data-dlg-msg="guest">
          <div className="dc-b dc-in">
            <span className="dc-tx">{mm.text}<i className="dc-sp" aria-hidden="true" /></span>
            <span className="dc-meta" aria-hidden="true">{hhmm(mm.t)}</span>
          </div>
        </div>
      );
      return (
        <div key={"m" + mm.id} className={cls} data-dlg-msg="me">
          <div className={"dc-b dc-out" + (mm.read ? " read" : "") + (mm.correct ? "" : " miss")}>
            <span className="dc-tx">{mm.text}<i className="dc-sp" aria-hidden="true" /></span>
            <span className="dc-meta" aria-hidden="true">{hhmm(mm.t)}{TICKS}</span>
            {mm.react ? <span className="dc-react" data-dlg-react={mm.react} role="img" aria-label={"Реакция гостя: " + mm.react}>{mm.react}</span> : null}
          </div>
        </div>
      );
    }
    if (mm.type === "coach") return (
      <div key={"m" + mm.id} className="dc-row mid" data-dlg-msg="coach" data-dlg-mentor={mm.correct ? "ok" : "bad"}>
        <div className={"dc-coach " + (mm.correct ? "ok" : "bad")}>
          <div className="dc-coach-h"><span className="dc-coach-av" aria-hidden="true">✦</span><span>Наставник</span><i>шёпотом</i><em className="dc-verdict">{mm.correct ? "✓ верно" : "✗ неверно"}</em></div>
          <p>{mm.text}</p>
          {mm.best ? <p className="dc-best">Лучше так: <b>{dlgQuote(mm.best)}</b></p> : null}
        </div>
      </div>
    );
    if (mm.type === "review") {
      // те же слова, что в шапке: 5 — «в восторге», 4 — «в хорошем настроении» (раньше и 4, и 5 были «в восторге»)
      const ownGone = typeof guest.walkTitle === "string" ? guest.walkTitle.trim() : "";
      const title = walkedOut ? (ownGone || `${name} ${gram === "pl" ? "ушли" : gram === "f" ? "ушла" : "ушёл"}`)
        : `${name} ${DLG_MOOD_WORDS[m - 1]}`;
      const tc = walkedOut ? "#B4382A" : m >= 4 ? "#2E7D52" : m === 3 ? "#8A6A2E" : "#B4543F";
      return (
        <div key={"m" + mm.id} className="dc-row mid" data-dlg-review={walkedOut ? "walked" : String(m)}>
          <div className="dc-review">
            <div className="dc-ey">{walkedOut ? "Без отзыва" : "Отзыв гостя"}</div>
            <div className="dc-rv-face" aria-hidden="true">{walkedOut ? "🚪" : moodEmoji(m)}</div>
            <b className="dc-rv-t" style={{ color: tc }}>{title}</b>
            {pro ? (
              <div className="dc-stars" role="img" aria-label={stars + " из 3 звёзд"}><span className="on">{"★".repeat(stars)}</span><span className="off">{"★".repeat(3 - stars)}</span></div>
            ) : null}
            <div className="dc-rv-s">{score} из {den} правильных ответов</div>
          </div>
        </div>
      );
    }
    if (mm.type === "tip") return (
      <div key={"m" + mm.id} className="dc-row mid" data-dlg-msg="tip">
        <div className="dc-coach tip">
          <div className="dc-coach-h"><span className="dc-coach-av" aria-hidden="true">✦</span><span>Наставник</span><i>итог</i></div>
          <p>{mm.text}</p>
        </div>
      </div>
    );
    return null;
  };

  return (
    <div className={"sa-dlg dc" + (visible ? " on" : "") + (a11y ? " lt" : "")} data-dlg={D.id || ""}
      role="dialog" aria-modal="true" aria-label={"Живой диалог: " + (D.title || name)} style={{ "--mc": moodColor(m) }}>
      <style>{LEGACY_DLG_CSS}</style>
      <header className="dc-head">
        <div className="dc-head-in">
          <button type="button" className="dc-back" data-sa-back="" aria-label="Назад" onClick={() => onClose(done && !walkedOut, { done, walkedOut })}>{IC.back}</button>
          <div className="dc-who">
            <div key={"ava" + bump} className={"dc-ava" + (bump ? " bump" : "")} aria-hidden="true">{avatar}</div>
            <div className="dc-id">
              <b className="dc-name">{name}</b>
              <span className={"dc-st" + (typing ? " ty" : "")} data-dlg-status={typing ? "typing" : String(m)}>
                {typing
                  ? <>печатает<span className="dc-dots" aria-hidden="true"><i /><i /><i /></span></>
                  : <><span key={"e" + m} className="dc-st-e">{moodEmoji(m)}</span> {DLG_MOOD_WORDS[m - 1]}</>}
              </span>
            </div>
          </div>
          <div className="dc-tools">
            {canVoice ? (
              <button type="button" className={"dc-tool" + (voice ? " on" : "")} data-dlg-voice={voice ? "on" : "off"} aria-pressed={voice}
                aria-label={voice ? "Выключить голос гостя" : "Включить голос гостя"} onClick={toggleVoice}>{IC.voice}</button>
            ) : null}
            <button type="button" className={"dc-tool" + (sound ? " on" : "")} data-dlg-sound={sound ? "on" : "off"} aria-pressed={sound}
              aria-label={sound ? "Выключить звук" : "Включить звук"} onClick={toggleSound}>{sound ? IC.speaker : IC.mute}</button>
          </div>
        </div>
      </header>

      {dHint && dSteps.length && !done ? (
        <div className="dc-hint">
          <HintBubble a11y={a11y} text={dSteps[dStep]} arrow="up"
            step={dStep + 1} total={dSteps.length}
            onNext={dStep >= dSteps.length - 1 ? null : () => setDStep(v => v + 1)}
            onClose={dHintDone} />
        </div>
      ) : null}

      <div ref={wrapRef} className="dc-chatwrap sa-dlgpath">
        <div ref={chatRef} className="dc-chat sa-dlgscroll" role="log" aria-live="polite" aria-relevant="additions"
          onScroll={onScroll} onTouchStart={markTouch} onTouchMove={markTouch} onWheel={markTouch}
          onClick={() => { hurry(); if (voiceRef.current) wakeSpeech(); }}>
          <div ref={feedRef} className="dc-feed">
            {list.map(renderMsg)}
            <div ref={spacerRef} className="dc-spacer" aria-hidden="true" />
          </div>
        </div>
        {away ? (
          <button type="button" className="dc-down" aria-label="К последним сообщениям"
            onClick={() => { stickRef.current = true; setAway(false); toBottom(true); }}>{IC.down}</button>
        ) : null}

        <div className={"dc-pane sa-dlgpath" + (paneOn ? " on" : "")} aria-hidden={!paneOn}>
          <div ref={paneBoxRef} className="dc-pane-box sa-dlgpath">
            {ask ? (
              <div className="dc-kb sa-dlgpath" data-dlg-kb={pane.idx}>
                <div className="dc-kb-top">
                  <span className="dc-ey">Твой ответ</span>
                  <span className="dc-beads" aria-hidden="true">
                    {Array.from({ length: askM }, (_, j) => <i key={j} className={j < marks.length ? (marks[j] ? "ok" : "bad") : j === askN - 1 ? "cur" : ""} />)}
                  </span>
                  <span className="dc-kb-n">{askN} из {askM}</span>
                </div>
                {ask.prompt ? <div className="dc-q" data-dlg-q="">{ask.prompt}</div> : null}
                <div className={"dc-opts sa-dlgscroll" + (picked !== null ? " picked" : "")} role="group" aria-label={ask.prompt || "Варианты ответа"}>
                  {ask.options.map((o, j) => (
                    <button key={pane.idx + ":" + j} type="button" className={"dc-opt" + (picked === j ? " pick" : "")} data-dlg-reply={j}
                      style={{ animationDelay: (j * 55) + "ms" }} disabled={!paneOn || picked !== null} onClick={() => choose(j)}>
                      <span className="dc-opt-t">{o.text}</span>
                      <span className="dc-send" aria-hidden="true">{IC.send}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {pane && pane.kind === "end" ? (
              <div className="dc-end">
                <button type="button" className="dc-again" data-dlg-again="" onClick={again}>↺ Ещё раз</button>
                <button type="button" className="dc-next" data-dlg-next="" onClick={() => onClose(!walkedOut, { done: true, walkedOut })}>{walkedOut ? "Закрыть" : "Дальше"}</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// #2 — Экзамен на роль и сертификат.
// Вопросы собираются прямо из квизов уроков роли (MODULES), поэтому новый
// контент автоматически попадает в экзамен — ничего захардкоженного.
// ─────────────────────────────────────────────────────────────────────────────
