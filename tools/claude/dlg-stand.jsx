// Стенд «Живого диалога» (v37) — только экран переписки, для tools/claude/dlg-sweep.mjs.
// Не часть приложения: Vite собирает лишь то, что подключено из main.jsx.
// Адрес: ?id=<диалог>&pro=1|0&theme=dark|light&seed=<число>&inline=1|0&hint=<ключ>&strict=1
//   inline=1 (по умолчанию) — ровно этот сценарий (как свой диалог из редактора, без ротации темы);
//   inline=0 — как в приложении: случайный вариант из той же темы (termKey).
import React from "react";
import { createRoot } from "react-dom/client";
import { injectStyles } from "@sa/ui/css.js";
import { S, A } from "@sa/ui/styles.js";
import { LiveDialogue, dlgReaction, dlgStars, dlgTip, dlgWalkText, dlgWalkLine, dlgGram, dlgTypingMs, DLG_MOOD_WORDS } from "@sa/ui/screens-dialogue.jsx";
import { loadDialogues, DIALOGUES_DATA } from "@sa/data/dialogues-lazy.js";

const q = new URLSearchParams(location.search);
// повторяемое перемешивание вариантов: тот же seed — тот же порядок кнопок
let seed = Number(q.get("seed") || 7) >>> 0;
Math.random = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const light = q.get("theme") === "light";
document.documentElement.classList.toggle("sa-light", light);
document.body.style.background = light ? "#E8DEC8" : "#14110A";
document.body.style.margin = "0";
injectStyles();
const id = q.get("id") || "spg-b0-1";
const pro = q.get("pro") !== "0";
const inl = q.get("inline") !== "0";
window.__dlg = { dlgReaction, dlgStars, dlgTip, dlgWalkText, dlgWalkLine, dlgGram, dlgTypingMs, DLG_MOOD_WORDS };
window.__closed = undefined;

function Stand() {
  const [ready, setReady] = React.useState(false);
  const [k, setK] = React.useState(0);
  const [closed, setClosed] = React.useState(null);
  React.useEffect(() => { loadDialogues().then(() => setReady(true)); }, []);
  if (!ready) return null;
  const d = DIALOGUES_DATA.find((x) => x.id === id);
  if (closed !== null) return <div id="closed" style={{ color: "#C8A96E", padding: 40, fontFamily: "Georgia" }}>closed:{String(closed)} <button onClick={() => { setClosed(null); setK(k + 1); }}>open</button></div>;
  return <LiveDialogue key={k} dialogueId={id} inline={inl ? d : undefined} T={light ? A : S} pro={pro} color="#C8A96E"
    hintKey={q.get("hint") || undefined} onClose={(f, st) => { window.__closed = f; window.__closeInfo = st || null; setClosed(f); }} />;
}
createRoot(document.getElementById("root")).render(q.get("strict") === "1" ? <React.StrictMode><Stand /></React.StrictMode> : <Stand />);
