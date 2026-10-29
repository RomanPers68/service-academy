// ui/chat.jsx — v90 (Доп. 403): чат смены, «свой телеграм» внутри приложения.
//
// ChatScreen — на весь экран, как «Живой диалог» (те же пузыри, хвостики, ✓✓ и обои с рисунками ресторана):
//   • список: «Вся команда», «Старшие» (руководителям и старшим) и личные переписки; у каждой — последнее сообщение,
//     время и непрочитанные; «Написать» — личное сообщение коллеге своего заведения;
//   • переписка: пузыри (свои — справа золотом, у группы — имя над первым пузырём), разделители дней, ✓ — отправлено,
//     ✓✓ — прочитано; под своим последним сообщением в группе — «прочитали 3 из 7»;
//   • ответ с цитатой — свайп по сообщению вбок или «Ответить»; нажатие на цитату — к тому сообщению;
//   • правка своего (сутки, у сообщения — «изменено»); реакции значками: Принято, Класс, Сердце, Смешно, Ого, Огонь;
//   • закреплённое сообщение в группе — полоска под шапкой (закрепляют руководитель и старший, в «Старших» — каждый);
//   • фото: сжимается на телефоне, в ленте — превью, нажатие — на весь экран (щипок и двойное касание — крупнее);
//   • нажатие на сообщение — реакции, «Ответить», «Изменить», «Закрепить», «Скопировать», кто прочитал, «Удалить»;
//   • «Позвать» (в «Вся команда»): кого (менеджера, хостес, бар, официанта или человека) и зачем (к столу N, нужна
//     помощь, подойди, гость ждёт, своими словами) — карточка вызова у всех, у тех, кого зовут, кнопка «Иду»;
//   • строка ввода с микрофоном (надиктовать, как в «Случаях»); новое — раз в 4 секунды, пока открыто.
// CallBanner — вызов, адресованный мне, поверх любого экрана: «Ольга зовёт тебя: к столу 5» и «Иду».
// Сеть — через api (lib/chat-api.js в приложении, демо-сервер в tools/claude/chat-demo). Расчёт — lib/chat.js,
// сжатие фото — lib/chat-photo.js.
// v91 (Доп. 404): низ — с вырезом из Telegram (--sa-sb: в полноэкранном Telegram env() снизу пустой, и строка ввода
// уходила под скруглённые углы экрана); клавиатура — по низу самого слоя (окно Telegram сжимается, а innerHeight
// прежний); «Написать» отличает «не загрузилось» от «пусто»; корзина в шапке — «Очистить чат» (lib/chat.js, canClear);
// удалённое исчезает целиком; открытая переписка не закрывается опросом списка.
// v93 (Доп. 406): умный чат — «+» в строке ввода (смена, задание, поделиться, опрос, стоп-лист, брифинг, Наставник),
// карточки, которые делают дело в приложении (ui/chat-cards.jsx), Наставник в переписке, подсказки по тексту.
// v92 (Доп. 405): свои чаты — руководитель и старший заводят чат с названием и выбранными коллегами («Написать» →
// «Новый чат»); нажатие на шапку своего чата — участники, переименовать, добавить, убрать, выйти, удалить.
import React from "react";
import { createPortal } from "react-dom";
import { vibrate, onActivate } from "../lib/utils";
import { LABEL_CSS } from "./tokens";
import { MicButton } from "./mic";
import { CHAT_MAX, CALL_WHO, CALL_WHY, CALL_OWN_MAX, POLL_OPEN_MS, POLL_HOT_MS, REACTS, chatInitials, bubbleName, hhmm, listTime, feedRows, previewText, callLine,
  isCallForMe, callState, callProblem, cleanBody, readBy, readLine, badge, peopleWord, quoteText, replyOf, canEdit, canPin, canDelOthers, pinnable, reactGroups, myReact,
  withReact, reactName, photoBox, restShort, canClear, clearedChanged, canGroup, canManage, groupTitle, GROUP_TITLE_MAX } from "../lib/chat";
import { compressPhoto } from "../lib/chat-photo";
import { IC, ric, posName, stop } from "./chat-kit";   // v93: значки и помощники — общие с умными карточками
import { CARDS_CSS, CardMsg, AiMsg, AiTyping, ActSheet, Suggest, ShiftSheet, SwapSheet, TaskSheet, PollSheet, StopSheet, BriefSheet, ShareSheet, LateSheet, smartErr } from "./chat-cards";
import { askAi, aiQuestion, intents, withVote, AI_NAME, personShiftLine } from "../lib/chat-smart";
import { makeChatApp } from "../lib/chat-app";   // v93: уроки, меню, коктейли, справочник — для карточек
import { useKeyboardLift, usePinBottom } from "./keyboard";   // v94: клавиатура вместе с Telegram на iPhone
import { mentionNames, mentionQuery, mentionSuggest, mentionInsert, mentionParts, mentionsMe, isLeadPos } from "../lib/chat-mention";   // v99 (Доп. 412): «@Имя»
import { draftGet, draftSet, draftClear, draftLine } from "../lib/chat-draft";   // v99: черновик не пропадает
import { searchQuery, searchSnippet } from "../lib/chat-search";   // v99: поиск по переписке
import { mentorLine } from "../lib/newbie";   // v107 (Доп. 420): «Наставник новичков» в карточке коллеги

// ── вид: та же палитра, что у «Живого диалога» (ui/screens-dialogue.jsx), свой корень .sa-dlg.ch ──
const wallSvg = (c, o) => `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240' fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>` +
  "<g transform='rotate(-10 34 36)'><path d='M25 20h18l-1.5 10.5a7.5 7.5 0 0 1-15 0z'/><path d='M34 38v12M28 50h12'/></g>" +
  "<g transform='rotate(8 160 42)'><path d='M148 34h22v8a11 11 0 0 1-22 0z'/><path d='M170 37h3a4 4 0 0 1 0 8h-3'/><path d='M145 55h28'/><path d='M154 28c-1.5-2 1.5-3.5 0-6M161 28c-1.5-2 1.5-3.5 0-6'/></g>" +
  "<g transform='rotate(-18 100 118)'><path d='M93 100v11a4.5 4.5 0 0 0 9 0v-11M97.5 100v36'/><path d='M110 100c4.5 5 4.5 14 0 19v17'/></g>" +
  "<circle cx='200' cy='128' r='15'/><circle cx='200' cy='128' r='9'/>" +
  "<path d='M52 150v12M46 156h12'/><path d='M214 206v8M210 210h8'/><path d='M128 30v6M125 33h6'/>" +
  "<g transform='rotate(12 128 198)'><path d='M114 206c0-13 10-21 24-21 0 13-10 21-24 21z'/><path d='M114 206l14-12'/></g>" +
  "<path d='M24 222a12 12 0 0 1 24 0z'/><path d='M20 222h32'/><path d='M36 208v2'/>" +
  "</svg>";
const wallUrl = (c, o) => `url("data:image/svg+xml,${encodeURIComponent(wallSvg(c, o))}")`;
const TAIL = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 11 16'><path d='M6 0C6 7.5 4.6 12.6 0 16h11v-5H6z'/></svg>")}")`;

const DARK = `--bg:#14110A;--bg-2:#1C1509;--glow:rgba(214,170,80,0.10);--text:#EFE4C8;--sub:#AA9D80;--faint:#8A7E66;
  --gold:#C8A96E;--gold-hi:#E4C88C;--gold-ink:#D9B87C;--on-gold:#1A1008;--bad:#E07878;--bad-ink:#F3A8A8;--ok-ink:#8AD8AF;
  --edge:rgba(255,255,255,0.10);--edge-gold:rgba(214,178,102,0.42);--head:rgba(22,17,9,0.97);--head-line:rgba(214,178,102,0.16);
  --in:#2C2419;--in-text:#F1E8D6;--in-meta:rgba(241,232,214,0.48);--in-shadow:0 1px 2px rgba(0,0,0,0.3);
  --out-a:#E6CB92;--out-b:#C9A96B;--out-text:#1E1408;--out-meta:rgba(30,20,8,0.6);--out-shadow:0 1px 2px rgba(0,0,0,0.32);
  --svc:rgba(8,6,3,0.62);--svc-text:#DACEB4;--card:rgba(33,26,15,0.96);--row-hover:rgba(255,250,238,0.05);
  --pane:linear-gradient(180deg,#271E10,#1B150B);--pane-line:rgba(215,170,68,0.4);--pane-shadow:0 -10px 28px rgba(0,0,0,0.34);
  --field:rgba(255,250,238,0.06);--opt:rgba(255,250,238,0.05);--opt-edge:rgba(214,178,102,0.28);--fs:15.5px;--wall:${wallUrl("#D6B266", 0.07)}`;
const LIGHT = `--bg:#E8DEC8;--bg-2:#EFE6D3;--glow:rgba(255,251,240,0.85);--text:#2A1F0E;--sub:#64523A;--faint:#7E6E52;
  --gold:#A8843F;--gold-hi:#D9B978;--gold-ink:#76561C;--on-gold:#1A1008;--bad:#C2503F;--bad-ink:#8B3020;--ok-ink:#25643F;
  --edge:rgba(139,106,48,0.22);--edge-gold:rgba(139,106,48,0.5);--head:rgba(246,239,224,0.97);--head-line:rgba(139,106,48,0.22);
  --in:#FFFDF7;--in-text:#2A1F0E;--in-meta:rgba(42,31,14,0.5);--in-shadow:0 1px 2px rgba(120,85,25,0.18);
  --out-a:#E6C987;--out-b:#D2AE66;--out-text:#22170A;--out-meta:rgba(34,23,10,0.6);--out-shadow:0 1px 2px rgba(120,85,25,0.22);
  --svc:rgba(120,90,40,0.16);--svc-text:#4F3F22;--card:rgba(255,252,244,0.97);--row-hover:rgba(139,106,48,0.07);
  --pane:linear-gradient(180deg,#F8F1E2,#F1E7D2);--pane-line:rgba(139,106,48,0.3);--pane-shadow:0 -8px 22px rgba(120,85,25,0.14);
  --field:rgba(255,255,255,0.7);--opt:rgba(255,255,255,0.66);--opt-edge:rgba(139,106,48,0.3);--fs:17px;--wall:${wallUrl("#7A5D2A", 0.085)}`;

export const CHAT_CSS = `
.sa-dlg.ch{${DARK};--tail:${TAIL};position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;overflow:hidden;
  color:var(--text);font-family:Georgia,'PT Serif','Times New Roman',serif;-webkit-text-size-adjust:100%;text-size-adjust:100%;
  background-color:var(--bg);background-image:var(--wall),radial-gradient(130% 70% at 50% 0%,var(--glow),transparent 60%),linear-gradient(160deg,var(--bg),var(--bg-2) 50%,var(--bg));
  background-size:240px 240px,auto,auto;padding-bottom:var(--kb,0px)}
.sa-dlg.ch.lt{${LIGHT}}
.sa-dlg.ch *{box-sizing:border-box}
:where(.sa-dlg.ch) button{font:inherit;color:inherit;-webkit-tap-highlight-color:transparent;margin:0}
.ch-ey{${LABEL_CSS};font-size:13.5px;color:var(--gold-ink)}
.ch-head{flex:0 0 auto;position:relative;z-index:4;padding:max(6px,var(--sa-st,env(safe-area-inset-top,0px))) 8px 6px;background:var(--head);border-bottom:1px solid var(--head-line)}
.ch-head-in{display:flex;align-items:center;gap:6px;max-width:640px;margin:0 auto;min-height:50px}
.ch-back,.ch-tool{width:40px;height:40px;flex:0 0 auto;border:0;background:none;color:var(--gold-ink);display:grid;place-items:center;border-radius:50%;padding:0;cursor:pointer}
.ch-back:active,.ch-tool:active{background:var(--row-hover)}
.ch-who{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.ch-id{min-width:0;display:flex;flex-direction:column;gap:1px}
.ch-title{font-family:'Piazzolla',Georgia,serif;font-size:17px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch-st{font-size:13.5px;line-height:1.3;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch-ava{position:relative;width:42px;height:42px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;font-family:'Piazzolla',Georgia,serif;font-weight:700;font-size:15px;letter-spacing:.3px;
  color:var(--gold-ink);background:radial-gradient(circle at 50% 30%,rgba(255,236,196,0.18),rgba(255,236,196,0.04));box-shadow:0 0 0 1.5px var(--edge-gold)}
.ch-ava.big{width:48px;height:48px;font-size:16px}
.ch-ava.team{color:var(--on-gold);background:linear-gradient(180deg,var(--gold-hi),var(--gold));box-shadow:none}

/* список */
.ch-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.ch-list{max-width:640px;margin:0 auto;padding:6px 0 calc(24px + var(--sa-sb,env(safe-area-inset-bottom,0px)))}
.ch-item{display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;border:0;background:none;text-align:left;cursor:pointer;position:relative}
.ch-item:active{background:var(--row-hover)}
.ch-item+.ch-item::before{content:"";position:absolute;top:0;left:74px;right:14px;border-top:1px solid var(--edge)}
.ch-item-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.ch-item-r{display:flex;align-items:baseline;gap:8px}
.ch-item-t{flex:1;min-width:0;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)}
.ch-item-time{flex:0 0 auto;font-size:12.5px;color:var(--faint);font-variant-numeric:tabular-nums}
.ch-item-time.new{color:var(--gold-ink)}
.ch-item-p{flex:1;min-width:0;font-size:14.5px;line-height:1.35;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch-item-p.call{color:var(--gold-ink);font-style:italic}
.ch-badge{flex:0 0 auto;min-width:22px;height:22px;padding:0 7px;border-radius:11px;display:inline-grid;place-items:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  font-size:12.5px;font-weight:700;line-height:1;background:linear-gradient(180deg,var(--gold-hi),var(--gold));color:var(--on-gold);font-variant-numeric:tabular-nums}
.ch-note{max-width:640px;margin:14px auto 0;padding:0 22px;font-size:12.5px;line-height:1.5;color:var(--faint);text-align:center;font-style:italic}
.ch-empty{max-width:420px;margin:40px auto 0;padding:0 24px;text-align:center;color:var(--sub);font-size:15px;line-height:1.5}
.ch-search{display:block;width:calc(100% - 28px);max-width:612px;margin:10px auto 6px;padding:10px 14px;border-radius:14px;border:1px solid var(--opt-edge);background:var(--field);color:var(--text);font-size:16px;font-family:inherit;outline:none}
.ch-sec{max-width:640px;margin:14px auto 2px;padding:0 16px;${LABEL_CSS};font-size:13px;color:var(--gold-ink)}
/* v95: вырез снизу (полоска «домой») — только без клавиатуры: --kbs ведёт ui/keyboard.js тем же ходом, что и низ */
[data-chat-people]{padding-bottom:calc(16px + var(--sa-sb,env(safe-area-inset-bottom,0px)) * var(--kbs,1))}

/* закреплённое */
.ch-pin{flex:0 0 auto;position:relative;z-index:3;padding:6px 8px 6px 12px;background:var(--head);border-bottom:1px solid var(--head-line);box-shadow:0 6px 14px rgba(0,0,0,0.12)}
.ch-pin-in{display:flex;align-items:center;gap:8px;max-width:640px;margin:0 auto}
.ch-pin-b{flex:1;min-width:0;display:flex;align-items:stretch;gap:10px;border:0;background:none;padding:2px 0;text-align:left;cursor:pointer}
.ch-pin-bar{flex:0 0 3px;border-radius:2px;background:linear-gradient(180deg,var(--gold-hi),var(--gold))}
.ch-pin-c{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.ch-pin-l{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;line-height:1.2;color:var(--gold-ink);font-style:italic}
.ch-pin-t{font-size:14px;line-height:1.3;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* переписка */
.ch-chatwrap{position:relative;flex:1 1 auto;min-height:0;overflow:hidden}
.ch-chat{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;overflow-anchor:none;display:flex;flex-direction:column}
.ch-feed{position:relative;width:100%;max-width:640px;margin:auto auto 0;padding:10px 10px 12px;display:flex;flex-direction:column;flex:0 0 auto}
.ch-more{align-self:center;margin:4px 0 8px;padding:6px 14px;border-radius:999px;border:1px solid var(--edge-gold);background:var(--card);color:var(--gold-ink);font-size:13.5px;cursor:pointer}
.ch-row{position:relative;display:flex;flex-direction:column;margin-top:9px;touch-action:pan-y}
.ch-row.same{margin-top:3px}
.ch-row.in{align-items:flex-start;padding:0 12% 0 6px}
.ch-row.out{align-items:flex-end;padding:0 6px 0 12%}
.ch-row.mid{align-items:center}
.ch-row.swiping{transition:none}
.ch-row.back{transition:transform .22s cubic-bezier(.3,1.2,.5,1)}
.ch-swipe{position:absolute;top:50%;width:30px;height:30px;margin-top:-15px;border-radius:50%;display:grid;place-items:center;background:var(--card);color:var(--gold-ink);box-shadow:0 0 0 1px var(--edge-gold);pointer-events:none}
.ch-nm{margin:0 0 3px 12px;font-size:13px;line-height:1.2;color:var(--gold-ink);font-style:italic}
/* v97: имя — кнопка (карточка коллеги) */
.ch-nmb{display:block;border:0;background:none;padding:2px 0;text-align:left;font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ch-nmb:active{opacity:.7}
.ch-pp{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.ch-pp .ch-ava{width:52px;height:52px;font-size:18px}
.ch-pp-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.ch-pp-n{font-family:'Piazzolla',Georgia,serif;font-size:19px;line-height:1.25}
.ch-pp-p{font-size:13.5px;color:var(--sub)}
.ch-pp-sh{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:14px;border:1px solid var(--opt-edge);background:var(--opt);font-size:15px;line-height:1.35;margin-bottom:4px}
.ch-pp-sh svg{flex:0 0 auto;color:var(--gold-ink)}
.ch-b{position:relative;max-width:100%;padding:7px 11px 7px 12px;border-radius:18px;font-size:var(--fs);line-height:1.42;overflow-wrap:anywhere;cursor:pointer;text-align:left;border:0;outline-offset:2px}
.ch-in{background:var(--in);color:var(--in-text);box-shadow:var(--in-shadow)}
.ch-out{background:linear-gradient(180deg,var(--out-a),var(--out-b));color:var(--out-text);box-shadow:var(--out-shadow)}
.ch-row.same .ch-in{border-top-left-radius:6px}.ch-row.same .ch-out{border-top-right-radius:6px}
.ch-row.cont .ch-in{border-bottom-left-radius:6px}.ch-row.cont .ch-out{border-bottom-right-radius:6px}
.ch-row.tail .ch-in{border-bottom-left-radius:4px}.ch-row.tail .ch-out{border-bottom-right-radius:4px}
.ch-row.tail .ch-b::before{content:"";position:absolute;bottom:0;width:11px;height:16px;-webkit-mask:var(--tail) no-repeat 0 0/100% 100%;mask:var(--tail) no-repeat 0 0/100% 100%}
.ch-row.tail .ch-in::before{left:-6px;background:var(--in)}
.ch-row.tail .ch-out::before{right:-6px;background:var(--out-b);transform:scaleX(-1)}
.ch-row.hl .ch-b,.ch-row.hl .ch-call{animation:chHl 1.7s ease-out}
@keyframes chHl{0%,35%{box-shadow:0 0 0 3px var(--gold-hi)}100%{box-shadow:0 0 0 0 rgba(0,0,0,0)}}
.ch-tx{white-space:pre-wrap}
.ch-sp{display:inline-block;width:40px;height:1px}
.ch-out .ch-sp{width:58px}
.ch-sp.ed{width:104px}
.ch-out .ch-sp.ed{width:122px}
.ch-meta{position:absolute;right:10px;bottom:5px;display:inline-flex;align-items:center;gap:3px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  font-size:11px;line-height:1;color:var(--in-meta);font-variant-numeric:tabular-nums;font-style:normal}
.ch-out .ch-meta{color:var(--out-meta)}
.ch-edm{margin-right:3px;font-style:italic}
.ch-meta.on-ph{right:9px;bottom:9px;padding:3px 7px;border-radius:10px;background:rgba(0,0,0,0.5);color:#F6EEDC}
.ch-ticks{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;margin-right:-2px}
.ch-ticks .t2{opacity:0;transition:opacity .3s}
.ch-out.read .ch-ticks .t2{opacity:1}
.ch-out.read .ch-meta{color:rgba(30,20,8,0.8)}
.ch-out.read .ch-meta.on-ph{color:#fff}
.ch-del{font-style:italic;opacity:.75}
.ch-reads{margin:3px 8px 0 0;font-size:11.5px;color:var(--faint);font-style:italic}
.ch-fail{margin:3px 8px 0 0;font-size:12.5px;color:var(--bad-ink);cursor:pointer;background:none;border:0;padding:2px 0}
.ch-day{align-self:center;margin:12px 0 4px;padding:4px 12px;border-radius:12px;background:var(--svc);color:var(--svc-text);font-size:13px;line-height:1.3;font-style:italic}
.ch-sys{align-self:center;display:inline-flex;align-items:center;gap:6px;max-width:92%;margin:8px 0 2px;padding:5px 12px;border-radius:12px;border:0;background:var(--svc);color:var(--svc-text);
  font-size:13px;line-height:1.35;font-style:italic;cursor:pointer;text-align:left}
.ch-sys span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* цитата в пузыре */
.ch-rq{display:flex;flex-direction:column;gap:1px;width:100%;min-width:140px;margin:1px 0 5px;padding:4px 9px 5px;border:0;border-left:3px solid var(--gold);border-radius:8px;
  background:rgba(214,178,102,0.13);text-align:left;cursor:pointer;color:inherit}
.ch-out .ch-rq{border-left-color:rgba(30,20,8,0.55);background:rgba(30,20,8,0.09)}
.ch-rq-n{font-size:12.5px;line-height:1.25;font-weight:700;color:var(--gold-ink)}
.ch-out .ch-rq-n{color:rgba(30,20,8,0.78)}
.ch-rq-t{font-size:13.5px;line-height:1.3;opacity:.85;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
/* фото */
.ch-b.ph{padding:3px}
.ch-b.ph .ch-rq{width:auto;margin:3px 3px 4px}
.ch-b.ph .ch-tx{display:block;padding:5px 8px 3px 9px}
.ch-b.ph .ch-rxs{padding:0 6px 3px}
.ch-ph{display:block;position:relative;border:0;padding:0;margin:0;border-radius:15px;overflow:hidden;background:rgba(214,178,102,0.14);cursor:zoom-in}
.ch-row.same .ch-in .ch-ph{border-top-left-radius:4px}.ch-row.same .ch-out .ch-ph{border-top-right-radius:4px}
.ch-ph img{display:block;width:100%;height:100%;object-fit:cover}
.ch-ph-wait{position:absolute;inset:0;background:linear-gradient(110deg,rgba(214,178,102,0.06) 30%,rgba(214,178,102,0.2) 50%,rgba(214,178,102,0.06) 70%);background-size:220% 100%;animation:chWait 1.3s linear infinite}
@keyframes chWait{from{background-position:120% 0}to{background-position:-100% 0}}
.ch-ph-up{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,0.32);color:#fff}
.ch-spin{width:30px;height:30px;border-radius:50%;border:3px solid rgba(255,255,255,0.35);border-top-color:#fff;animation:chSpin 0.9s linear infinite}
@keyframes chSpin{to{transform:rotate(360deg)}}
/* реакции */
.ch-rxs{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin:6px 0 1px}
.ch-rx{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 9px 0 7px;border-radius:13px;border:1px solid var(--opt-edge);background:rgba(214,178,102,0.10);color:var(--gold-ink);
  font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:12.5px;font-weight:700;line-height:1;cursor:pointer;font-variant-numeric:tabular-nums}
.ch-out .ch-rx{background:rgba(30,20,8,0.08);border-color:rgba(30,20,8,0.24);color:rgba(30,20,8,0.82)}
.ch-rx[aria-pressed="true"]{background:linear-gradient(180deg,var(--gold-hi),var(--gold));border-color:transparent;color:var(--on-gold)}
.ch-out .ch-rx[aria-pressed="true"]{background:rgba(30,20,8,0.8);border-color:transparent;color:var(--out-a)}
.ch-call .ch-rxs{justify-content:center;margin-top:8px}
.ch-call{width:100%;max-width:420px;padding:11px 14px 12px;border-radius:18px;background:var(--card);border:1px solid var(--edge-gold);box-shadow:0 4px 14px rgba(0,0,0,0.2);text-align:center;cursor:pointer}
.ch-call.stale{border-color:var(--edge);opacity:.82}
.ch-call-h{display:flex;align-items:center;justify-content:center;gap:7px;color:var(--gold-ink);${LABEL_CSS};font-size:13px}
.ch-call-t{margin:5px 0 2px;font-family:'Piazzolla',Georgia,serif;font-weight:700;font-size:16.5px;line-height:1.3;color:var(--text)}
.ch-call-s{font-size:13.5px;color:var(--sub)}
.ch-call-s.going{color:var(--ok-ink)}
.ch-go{margin-top:9px;min-width:140px;min-height:42px;padding:0 22px;border-radius:999px;border:0;background:linear-gradient(180deg,var(--gold-hi),var(--gold));color:var(--on-gold);font-weight:700;font-size:15.5px;cursor:pointer;
  box-shadow:0 3px 10px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.35)}
.ch-go:disabled{opacity:.6}
.ch-down{position:absolute;right:12px;bottom:12px;z-index:2;width:42px;height:42px;padding:0;border-radius:50%;border:1px solid var(--edge-gold);background:var(--card);color:var(--gold-ink);
  display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,0.3);cursor:pointer}
.ch-down .ch-badge{position:absolute;top:-8px;right:-4px;min-width:20px;height:20px;font-size:11.5px;padding:0 5px}

/* строка ввода */
.ch-bar{flex:0 0 auto;position:relative;z-index:3;padding:8px 8px calc(8px + var(--sa-sb,env(safe-area-inset-bottom,0px)) * var(--kbs,1));background:var(--head);border-top:1px solid var(--head-line)}
.ch-bar-in{display:flex;align-items:flex-end;gap:6px;max-width:640px;margin:0 auto}
.ch-fieldwrap{position:relative;flex:1;min-width:0;display:flex}
.ch-input{flex:1;min-width:0;min-height:42px;max-height:132px;resize:none;padding:10px 14px;border-radius:21px;border:1px solid var(--opt-edge);background:var(--field);color:var(--text);
  font-family:inherit;font-size:16px;line-height:1.35;outline:none;overflow-y:auto}
.ch-input.clip{padding-right:44px}
.ch-input:focus{border-color:var(--edge-gold)}
.ch-input::placeholder{color:var(--faint);opacity:1}
.ch-attach{position:absolute;right:4px;bottom:4px;width:34px;height:34px;border-radius:50%;border:0;background:none;color:var(--gold-ink);display:grid;place-items:center;cursor:pointer;padding:0}
.ch-attach:active{background:var(--row-hover)}
.ch-send{width:42px;height:42px;flex:0 0 auto;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;background:linear-gradient(180deg,var(--gold-hi),var(--gold));color:var(--on-gold);
  box-shadow:0 2px 8px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.35)}
.ch-send:disabled{opacity:.5}
.ch-bell{width:42px;height:42px;flex:0 0 auto;border-radius:50%;border:1px solid var(--edge-gold);background:rgba(214,178,102,0.10);color:var(--gold-ink);display:grid;place-items:center;cursor:pointer;padding:0}
.ch-count{position:absolute;right:62px;top:-18px;font-size:11px;color:var(--faint);font-family:system-ui,sans-serif}
.ch-count.over{color:var(--bad-ink)}
.ch-err{max-width:640px;margin:0 auto 6px;padding:0 6px;font-size:13px;color:var(--bad-ink)}
.ch-ctx{display:flex;align-items:center;gap:10px;max-width:640px;margin:0 auto 7px;padding:2px 0 2px 6px;color:var(--gold-ink)}
.ch-ctx-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;padding-left:10px;border-left:3px solid var(--gold)}
.ch-ctx-l{font-size:12.5px;line-height:1.25;font-weight:700;color:var(--gold-ink)}
.ch-ctx-t{font-size:13.5px;line-height:1.3;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* листы снизу */
/* v94: лист стоит над клавиатурой, как и строка ввода (--kb, ui/keyboard.js) */
.ch-veil{position:absolute;inset:0 0 var(--kb,0px);z-index:20;background:rgba(8,6,3,0.55);display:flex;align-items:flex-end;justify-content:center}
.sa-dlg.ch.lt .ch-veil{background:rgba(70,52,24,0.32)}
.ch-sheet{width:100%;max-width:640px;max-height:86%;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:12px 16px calc(16px + var(--sa-sb,env(safe-area-inset-bottom,0px)) * var(--kbs,1));
  border-radius:22px 22px 0 0;background:var(--pane);box-shadow:inset 0 1px 0 var(--pane-line),var(--pane-shadow)}
/* v94: в слое .sa-dlg палец двигает только ленты с классом sa-dlgscroll (ui/css.js), и листы не листались пальцем:
   «Задание», «О чате» со списком участников и другие (запись владельца). Листам и подписи к фото прокрутку возвращаем */
.sa-dlg .ch-sheet,.sa-dlg .ch-sheet *,.ch-view .ch-view-cap,.ch-view .ch-view-cap *{touch-action:pan-y !important}
.ch-grip{width:38px;height:4px;border-radius:2px;background:var(--edge-gold);margin:0 auto 10px;opacity:.6}
.ch-sheet-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.ch-sheet-t{flex:1;font-family:'Piazzolla',Georgia,serif;font-weight:700;font-size:18px}
.ch-x{width:36px;height:36px;flex:0 0 auto;border-radius:50%;border:0;background:none;color:var(--sub);display:grid;place-items:center;cursor:pointer;padding:0}
.ch-lbl{margin:12px 0 6px;${LABEL_CSS};font-size:13.5px;color:var(--gold-ink)}
.ch-chips{display:flex;flex-wrap:wrap;gap:7px}
.ch-chip{padding:8px 13px;border-radius:999px;border:1px solid var(--opt-edge);background:var(--opt);color:var(--text);font-size:14.5px;cursor:pointer;line-height:1.2}
.ch-chip[aria-checked="true"],.ch-chip[aria-pressed="true"]{border-color:var(--gold);background:rgba(214,178,102,0.18);color:var(--text)}
.ch-field{display:block;width:100%;margin-top:8px;padding:10px 14px;border-radius:14px;border:1px solid var(--opt-edge);background:var(--field);color:var(--text);font-family:inherit;font-size:16px;outline:none}
.ch-field.num{width:120px}
.ch-preview{margin:14px 0 0;padding:10px 12px;border-radius:14px;background:var(--opt);border:1px dashed var(--edge-gold);font-size:15px;line-height:1.4;color:var(--text)}
.ch-main{display:block;width:100%;margin-top:12px;min-height:50px;border-radius:999px;border:0;background:linear-gradient(180deg,var(--gold-hi),var(--gold));color:var(--on-gold);font-weight:700;font-size:16px;cursor:pointer;
  box-shadow:0 4px 14px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.35)}
.ch-main:disabled{opacity:.55}
.ch-act{display:flex;align-items:center;gap:12px;width:100%;padding:13px 6px;border:0;border-bottom:1px solid var(--edge);background:none;color:var(--text);font-size:16px;cursor:pointer;text-align:left}
.ch-act:last-child{border-bottom:0}
.ch-act svg{color:var(--gold-ink);flex:0 0 auto}
.ch-act.bad,.ch-act.bad svg{color:var(--bad-ink)}
.ch-act:disabled{opacity:.55}
.ch-clear-t{font-size:15px;line-height:1.5;color:var(--sub);padding:0 2px 10px}
.ch-quote{margin:0 0 6px;padding:8px 12px;border-radius:12px;background:var(--opt);font-size:14.5px;line-height:1.4;color:var(--sub);max-height:84px;overflow:hidden}
.ch-names{font-size:14.5px;line-height:1.55;color:var(--text)}
.ch-names i{color:var(--faint)}
.ch-rline{display:flex;align-items:center;gap:8px;padding:2px 0}
.ch-rline svg{color:var(--gold-ink);flex:0 0 auto}
.ch-rbar{display:flex;justify-content:space-between;gap:4px;margin:0 0 12px;padding:5px;border-radius:999px;background:var(--opt);border:1px solid var(--opt-edge)}
.ch-rbtn{flex:1 1 0;min-width:0;max-width:52px;height:44px;border-radius:22px;border:0;background:none;color:var(--gold-ink);display:grid;place-items:center;cursor:pointer;padding:0}
.ch-rbtn:active{background:var(--row-hover)}
.ch-rbtn[aria-pressed="true"]{background:linear-gradient(180deg,var(--gold-hi),var(--gold));color:var(--on-gold)}
.ch-person{display:flex;align-items:center;gap:12px;width:100%;padding:9px 4px;border:0;background:none;text-align:left;cursor:pointer;border-radius:12px}
.ch-person[aria-pressed="true"]{background:rgba(214,178,102,0.16)}
.ch-person-n{font-size:15.5px;color:var(--text)}
.ch-tick{width:24px;height:24px;flex:0 0 auto;margin-left:auto;border-radius:50%;border:1.5px solid var(--opt-edge);display:grid;place-items:center;color:var(--on-gold)}
.ch-tick.on{border-color:transparent;background:linear-gradient(180deg,var(--gold-hi),var(--gold))}
.ch-tick svg{width:15px;height:15px}
.ch-new .ch-ava svg{width:22px;height:22px}
.ch-foot{flex:0 0 auto;position:relative;z-index:3;padding:10px 14px calc(10px + var(--sa-sb,env(safe-area-inset-bottom,0px)) * var(--kbs,1));background:var(--head);border-top:1px solid var(--head-line)}
.ch-foot .ch-main{max-width:612px;margin:0 auto}
.ch-whob{border:0;background:none;padding:0;margin:0;text-align:left;color:inherit;font:inherit;cursor:pointer;border-radius:12px}
.ch-gm{display:flex;align-items:center;gap:12px;padding:8px 2px;border-bottom:1px solid var(--edge)}
.ch-gm:last-child{border-bottom:0}
.ch-gm-b{display:flex;flex-direction:column;min-width:0;flex:1}
.ch-gm-x{flex:0 0 auto;border:1px solid var(--opt-edge);background:none;color:var(--sub);border-radius:999px;padding:6px 12px;font-size:13.5px;font-family:inherit;cursor:pointer}
.ch-gm-x:disabled{opacity:.5}
.ch-person-p{font-size:12.5px;color:var(--sub)}
.ch-shot{display:block;width:100%;max-height:46vh;object-fit:contain;border-radius:14px;background:rgba(0,0,0,0.25)}
.ch-shotwait{display:grid;place-items:center;height:180px;border-radius:14px;background:rgba(0,0,0,0.18);color:var(--sub);font-size:14.5px;font-style:italic}

/* фото на весь экран */
.ch-view{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;background:rgba(6,5,3,0.97);color:#F1E8D6}
.ch-view,.ch-view *{touch-action:none !important}
.ch-view-h{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:max(8px,var(--sa-st,env(safe-area-inset-top,0px))) 8px 8px;background:linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0))}
.ch-view-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.ch-view-n{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch-view-s{font-size:12.5px;opacity:.72}
.ch-view-btn{width:42px;height:42px;flex:0 0 auto;border-radius:50%;border:0;background:rgba(255,255,255,0.1);color:#F1E8D6;display:grid;place-items:center;cursor:pointer;padding:0;text-decoration:none}
.ch-view-img{flex:1;min-height:0;position:relative;overflow:hidden;display:grid;place-items:center}
.ch-view-img img{max-width:100%;max-height:100%;object-fit:contain;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;will-change:transform}
.ch-view-cap{flex:0 0 auto;max-height:30%;overflow-y:auto;padding:10px 18px calc(14px + var(--sa-sb,env(safe-area-inset-bottom,0px)));font-size:15px;line-height:1.45;text-align:center;white-space:pre-wrap}
.ch-view-img:last-child{margin-bottom:var(--sa-sb,env(safe-area-inset-bottom,0px))}

/* вызов поверх приложения */
.ch-banner{position:fixed;left:10px;right:10px;top:calc(8px + var(--sa-st,env(safe-area-inset-top,0px)));z-index:1200;max-width:520px;margin:0 auto;display:flex;align-items:center;gap:10px;
  padding:10px 10px 10px 12px;border-radius:18px;background:var(--card);border:1px solid var(--edge-gold);box-shadow:0 10px 30px rgba(0,0,0,0.45);color:var(--text);font-family:Georgia,'PT Serif',serif;
  animation:chDrop .35s cubic-bezier(.3,1.3,.5,1) both}
.ch-banner .ch-go{margin:0;min-width:0;min-height:40px;padding:0 16px;font-size:15px}
.ch-banner-t{flex:1;min-width:0;font-size:15px;line-height:1.35}
.ch-banner-t b{font-family:'Piazzolla',Georgia,serif}
@keyframes chDrop{from{opacity:0;transform:translateY(-24px)}to{opacity:1;transform:none}}
/* v99 (Доп. 412): упоминания: «@Имя» в тексте — золотом; меня упомянули — пузырь с золотой каймой; подсказки после «@» */
.ch-at{font-weight:700;color:var(--gold-ink)}
.ch-out .ch-at{color:rgba(30,20,8,0.92)}
.ch-at.me{padding:0 3px;border-radius:5px;background:rgba(214,178,102,0.24)}
.ch-out .ch-at.me{background:rgba(30,20,8,0.12)}
.ch-row.atme .ch-in{box-shadow:var(--in-shadow),inset 0 0 0 1.5px var(--edge-gold)}
.ch-mb{display:flex;gap:6px;max-width:640px;margin:0 auto 7px;overflow-x:auto;scrollbar-width:none;padding:0 2px}
.ch-mb::-webkit-scrollbar{display:none}
.sa-dlg .ch-mb,.sa-dlg .ch-mb *{touch-action:pan-x !important}
.ch-mc{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 13px 0 4px;border-radius:999px;border:1px solid var(--edge-gold);background:var(--card);color:var(--text);font-size:14.5px;cursor:pointer}
.ch-mc .ch-ava{width:28px;height:28px;font-size:11.5px}
.ch-mc .ch-ava svg{width:17px;height:17px}
.ch-badge.at{min-width:22px;padding:0;background:none;border:1.5px solid var(--gold);color:var(--gold-ink)}
.ch-badge.at svg{width:15px;height:15px}
.ch-item-p .dr{color:var(--bad-ink);font-style:normal}
/* v99: поиск по переписке */
.ch-q{flex:1;min-width:0;width:100%;height:40px;padding:0 40px 0 14px;border-radius:20px;border:1px solid var(--opt-edge);background:var(--field);color:var(--text);font-size:16px;font-family:inherit;outline:none;-webkit-appearance:none;appearance:none;box-sizing:border-box}
.ch-q:focus{border-color:var(--edge-gold)}
.ch-q::-webkit-search-cancel-button,.ch-q::-webkit-search-decoration{-webkit-appearance:none;appearance:none;display:none}
.ch-qw{position:relative;flex:1;min-width:0;display:flex}
.ch-qx{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:0;border-radius:50%;background:none;color:var(--gold-ink);display:grid;place-items:center;cursor:pointer;padding:0}
.ch-qx svg{width:16px;height:16px}
.ch-sr{display:flex;align-items:flex-start;gap:12px;width:100%;padding:10px 14px;border:0;background:none;text-align:left;cursor:pointer;position:relative;color:var(--text)}
.ch-sr:active{background:var(--row-hover)}
.ch-sr+.ch-sr::before{content:"";position:absolute;top:0;left:68px;right:14px;border-top:1px solid var(--edge)}
.ch-sr .ch-ava{width:42px;height:42px}
.ch-sr-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.ch-sr-h{display:flex;align-items:baseline;gap:8px}
.ch-sr-c{flex:1;min-width:0;font-size:14.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch-sr-t{flex:0 0 auto;font-size:12.5px;color:var(--faint);font-variant-numeric:tabular-nums}
.ch-sr-x{font-size:14px;line-height:1.4;color:var(--sub);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ch-sr-x b{color:var(--gold-ink);font-weight:700;background:rgba(214,178,102,0.16);border-radius:4px;padding:0 1px}
.ch-sr-w{color:var(--text)}
/* v96: «Уменьшить движение»: переходы 0 с, а не 0,01 мс. С 0,01 мс любая смена стиля шла переходом и на кадр
   запаздывала: вырез снизу у строки ввода убирался кадром позже низа, строка подскакивала на 34 px */
@media (prefers-reduced-motion: reduce){.sa-dlg.ch *,.ch-banner{animation-duration:.01ms!important;transition-duration:0s!important}}
`;
const CSS_ID = "sa-chat-css";
export function ensureChatCss() {
  try {
    if (typeof document === "undefined" || typeof document.getElementById !== "function" || !document.head) return;
    const old = document.getElementById(CSS_ID);
    if (old && old.textContent === CHAT_CSS + CARDS_CSS) return;
    const el = old || document.createElement("style");
    el.id = CSS_ID; el.textContent = CHAT_CSS + CARDS_CSS;
    if (!old) document.head.appendChild(el);
  } catch (e) { /* */ }
}
// поверх приложения — в body: кнопка «Назад» Telegram (clickScreenBack) сначала закрывает чат, а не экран под ним
const portal = (el) => (typeof document !== "undefined" && document.body && document.body.nodeType === 1 ? createPortal(el, document.body) : el);

// ── значки — ui/chat-kit.jsx (v93: общие с умными карточками) ──
const TICKS = (
  <svg className="ch-ticks" viewBox="0 0 18 10" width="17" height="10" aria-hidden="true">
    <path className="t1" d="M1.5 5.4l2.9 2.8L10.6 1.8" /><path className="t2" d="M6.6 6.2l2 2L14.8 1.8" />
  </svg>);

const TITLE = { team: "Вся команда", leads: "Старшие", net: "Руководители сети" };
export const chatTitle = (c) => (c && (c.kind === "dm" ? (c.peer && c.peer.name) || "Коллега" : TITLE[c.kind] || c.title || "Чат")) || "Чат";
const Ava = ({ c, big }) => (c && c.kind === "group"
  ? <span className={"ch-ava team" + (big ? " big" : "")} aria-hidden="true">{chatInitials(c.title || "Чат")}</span>
  : c && c.kind !== "dm"
  ? <span className={"ch-ava team" + (big ? " big" : "")} aria-hidden="true">{c.kind === "leads" ? IC.star : c.kind === "net" ? IC.net : IC.team}</span>
  : <span className={"ch-ava" + (big ? " big" : "")} aria-hidden="true">{chatInitials(c && c.peer ? c.peer.name : "")}</span>);
const whoName = (m, me) => (m && me && String(m.emp) === String(me.id) ? "Ты" : bubbleName(m && m.name));
// в «Руководителях сети» к имени — заведение: «Мария К. · Океан»
const withRest = (name, rest, net) => (net && rest ? name + " · " + restShort(rest) : name);

// виден ли экран (поллинг только видимого)
const hidden = () => typeof document !== "undefined" && document.hidden;

// клавиатура: низ слоя поднимается над ней (ui/keyboard.js, общий с Наставником). v91: по низу самого слоя; v94: в
// Telegram на iPhone по высоте, которую Telegram сообщает, как только клавиатура поехала, и вместе с ней
export { kbOverlap, kbPad } from "./keyboard";

// ── фото: превью и полные — по запросу, запоминаем на время работы приложения ──
const PH = new Map();   // "id:t" | "id:f" → { url, p }
const phKey = (id, full) => String(id) + (full ? ":f" : ":t");
export const photoCached = (id, full) => { const h = PH.get(phKey(id, full)); return h ? h.url : null; };
// память: до 80 превью и до 8 полных фото (полное — до 300 КБ), старые уходят первыми
function trimPH() {
  const fulls = [...PH.keys()].filter((k) => k.endsWith(":f"));
  while (fulls.length > 8) PH.delete(fulls.shift());
  while (PH.size > 88) PH.delete(PH.keys().next().value);
}
export function rememberPhoto(id, full, url) {
  if (id == null || !url) return;
  PH.set(phKey(id, full), { url, p: Promise.resolve(url) });
  trimPH();
}
function loadPhoto(api, id, full) {
  const k = phKey(id, full), hit = PH.get(k);
  if (hit) return hit.p;
  const p = Promise.resolve(api && api.photo ? api.photo(id, full) : null).then((r) => {
    if (r && r.ok && r.url) { const h = PH.get(k); if (h) h.url = r.url; return r.url; }
    PH.delete(k); return null;
  }).catch(() => { PH.delete(k); return null; });
  PH.set(k, { url: null, p });
  trimPH();
  return p;
}
function PhotoImg({ api, id, local = null, alt = "" }) {
  const [src, setSrc] = React.useState(() => local || photoCached(id, false) || photoCached(id, true));
  React.useEffect(() => {
    if (local) { setSrc(local); return undefined; }
    if (src || id == null) return undefined;
    let alive = true;
    loadPhoto(api, id, false).then((u) => { if (alive && u) setSrc(u); });
    return () => { alive = false; };
  }, [id, local]);   // eslint-disable-line react-hooks/exhaustive-deps
  return src ? <img src={src} alt={alt} draggable={false} decoding="async" /> : <span className="ch-ph-wait" aria-hidden="true" />;
}

// ── экран ─────────────────────────────────────────────────────────────────────────
/**
 * me: { id, name, pos, lead, restaurant }; api: { list, open, send, read, dm, people, call, go, del, edit, react, pin,
 * photoSend, photo, clear (v91), groupCreate, groupEdit, groupLeave, groupDelete (v92) } — каждый возвращает Promise с ответом сервера; stt: { url, headers } — распознавание речи для
 * микрофона (нет — без микрофона). openId — сразу открыть этот чат (из баннера вызова или ссылки).
 */
/*
 * v97 (Доп. 410): intent — с чем чат открыли из приложения: { kind: "chat", id, msg } — этот чат и сообщение (ссылка из
 * Telegram), { kind: "give" | "swap", date } — «Вся команда» и лист «Отдать смену» / «Поменяться» с этим днём (из
 * «Графика»), { kind: "share", item } — «Поделиться в чат» (Меню, Колода, Справочник, урок): куда отправить,
 * { kind: "dm", emp } — личная переписка.
 */
export function ChatScreen({ a11y, me: me0, api, onBack, stt = null, openId = null, onUnread, app: app0 = null, appCtx = null, intent = null }) {
  // v93: что чат знает о приложении — готовое (демо) или из лёгкого контекста App.jsx (lib/chat-app.js)
  const app = React.useMemo(() => app0 || (appCtx ? makeChatApp(appCtx) : null), [app0, appCtx]);
  ensureChatCss();
  const rootRef = React.useRef(null);
  const kb = useKeyboardLift(rootRef, { cls: "kb" });   // v94: { lift, up }; отступ снизу слой берёт из --kb; v95: класс kb ставит сам хук
  const [me, setMe] = React.useState(me0);   // кто я — как считает сервер (руководитель ли, заведение)
  const [chats, setChats] = React.useState(null);
  const [err, setErr] = React.useState("");
  const [curId, setCurId] = React.useState(openId);
  const [picker, setPicker] = React.useState(false);   // true — «Написать» (личное), "group" — новый свой чат (v92)
  const [callOpen, setCallOpen] = React.useState(false);
  const [note, setNote] = React.useState("");          // v92: «Этого чата у тебя больше нет» и т. п. — над списком
  const [search, setSearch] = React.useState(false);   // v99 (Доп. 412): поиск по переписке — вместо списка
  const searchQ = React.useRef("");                    // что искали: вернулся из найденного чата — тот же запрос
  // v91: открытая переписка остаётся открытой, даже если её нет в списке с сервера: пустую личную (ещё не написали)
  // и очищенную список не показывает, и раньше через 10 секунд опрос списка закрывал такую переписку
  const keepRef = React.useRef(null);
  React.useEffect(() => { if (openId != null) setCurId(openId); }, [openId]);
  // v97: с чем открыли (intent): переписка и сообщение, лист смены, «Поделиться в чат», личная
  const [init, setInit] = React.useState(null);        // для переписки: { msg } или { shift, date }
  const [shareItem, setShareItem] = React.useState(null);
  const wantRef = React.useRef(null);                  // ждём список чатов, чтобы найти «Вся команда»
  React.useEffect(() => {
    const it = intent;
    if (!it || !it.kind) return;
    if (it.kind === "chat" && it.id != null) { setInit(it.msg ? { msg: it.msg } : null); setCurId(it.id); return; }
    if (it.kind === "share" && it.item) { setCurId(null); setPicker(false); setShareItem(it.item); return; }
    if (it.kind === "dm" && it.emp) { openDm({ id: it.emp }); return; }   // eslint-disable-line no-use-before-define
    if (it.kind === "give" || it.kind === "swap" || it.kind === "late" || it.kind === "team") wantRef.current = it;   // v99: «Опаздываю» из «Смены» и с главной; v107: «Вся команда» (карточка новичка)
  }, [intent]);   // eslint-disable-line react-hooks/exhaustive-deps
  const load = React.useCallback(() => Promise.resolve(api.list()).then((r) => {
    if (r && r.ok) {
      const list = r.chats || [], k = keepRef.current;
      setChats(k && !list.some((c) => String(c.id) === String(k.id)) ? [...list, k] : list);
      setErr(""); if (r.me) setMe((m) => ({ ...m, ...r.me })); if (onUnread) onUnread(r);
    }
    else setErr(r && r.error === "missing" ? "На сервере ещё нет этапа 38 (supabase-stage38-chat.sql). Чат появится, когда руководитель его добавит." : "Чат не загрузился. Проверь связь.");
  }).catch(() => setErr("Нет связи. Список обновится сам.")), [api]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    load();
    const t = setInterval(() => { if (!hidden()) load(); }, 10000);
    return () => clearInterval(t);
  }, [load]);
  const cur = (chats || []).find((c) => String(c.id) === String(curId)) || null;
  keepRef.current = cur;
  const team = (chats || []).find((c) => c.kind === "team") || null;
  React.useEffect(() => {
    const w = wantRef.current;
    if (!w || !team) return;
    wantRef.current = null; setInit(w.kind === "late" ? { late: true } : w.kind === "team" ? (w.msg ? { msg: w.msg } : null) : { shift: w.kind, date: w.date || null }); setCurId(team.id);
  }, [team]);   // eslint-disable-line react-hooks/exhaustive-deps
  function openDm(p) { return Promise.resolve(api.dm(p.id)).then((r) => {
    if (r && r.ok && r.chat) { setChats((cs) => (cs || []).some((c) => String(c.id) === String(r.chat.id)) ? cs : [...(cs || []), r.chat]); setPicker(false); setCurId(r.chat.id); }
  }); }
  // v92: свой чат заведён — сразу в него
  const openNew = (chat) => { setChats((cs) => [...(cs || []).filter((c) => String(c.id) !== String(chat.id)), chat]); setPicker(false); setNote(""); setCurId(chat.id); load(); };
  const gone = (why) => {
    keepRef.current = null; setCurId(null);
    setNote(why === "left" ? "Ты больше не в этом чате." : why === "deleted" ? "Чат удалён у всех." : "Этого чата у тебя больше нет: его удалили или тебя убрали из участников.");
    load();
  };
  const newRow = canGroup(me) ? (
    <div style={{ maxWidth: 640, margin: "8px auto 0", padding: "0 10px" }}>
      <button type="button" className="ch-person ch-new" data-chat-newgroup="" onClick={() => { vibrate("light"); setPicker("group"); }}>
        <span className="ch-ava team" aria-hidden="true">{IC.plus}</span>
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span className="ch-person-n">Новый чат</span><span className="ch-person-p">название и несколько коллег</span></span>
      </button>
    </div>) : null;
  return portal(
    <div ref={rootRef} className={"sa-dlg ch" + (a11y ? " lt" : "") + (kb.up ? " kb" : "")} data-chat="" role="dialog" aria-modal="true" aria-label="Чат">
      {cur ? <Thread key={cur.id} a11y={a11y} me={me} api={api} app={app} chat={cur} stt={stt} onBack={() => { keepRef.current = null; setInit(null); setCurId(null); load(); }} onSent={load} onGone={gone} onDm={openDm}
          init={init && String(curId) === String(cur.id) ? init : null} />
        : search && api.search ? <SearchView api={api} me={me} chats={chats} q0={searchQ.current} onQ={(q) => { searchQ.current = q; }} onBack={() => { searchQ.current = ""; setSearch(false); }}
            onPick={(chatId, msgId) => { setInit({ msg: msgId, deep: true }); setCurId(chatId); }} />
        : picker === "group" ? <GroupNew me={me} api={api} onBack={() => setPicker(true)} onDone={openNew} />
        : picker ? <People a11y={a11y} me={me} api={api} title="Написать" hint="Личная переписка: видите только вы двое." onBack={() => setPicker(false)} onPick={openDm} top={newRow} />
        : <List chats={chats} me={me} err={err} note={note} onBack={onBack} onOpen={(c) => { vibrate("light"); setNote(""); setCurId(c.id); }} onWrite={() => { vibrate("light"); setNote(""); setPicker(true); }}
            onCall={team ? () => { vibrate("light"); setCallOpen(true); } : null} back={!callOpen} onSearch={api.search ? () => { vibrate("light"); setNote(""); searchQ.current = ""; setSearch(true); } : null} />}
      {callOpen && !cur && team ? <CallSheet me={me} api={api} chat={team} onClose={() => setCallOpen(false)} onDone={() => { setCallOpen(false); setCurId(team.id); }} /> : null}
      {shareItem && !cur ? <ShareTo api={api} me={me} chats={chats} item={shareItem} onClose={() => setShareItem(null)}
        onSent={(chat) => { setShareItem(null); setInit(null); setCurId(chat.id); load(); }} /> : null}
    </div>
  );
}

// v97 (Доп. 410): «Поделиться в чат» из приложения (Меню, Колода, Справочник, урок): что, пара слов и куда — карточка
// уходит в выбранный чат, и он открывается
function ShareTo({ api, me, chats, item, onClose, onSent }) {
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(null);
  const [err, setErr] = React.useState("");
  const list = (chats || []).filter((c) => c && (c.kind !== "net" || ["lesson", "quiz", "module", "ref"].includes(item.kind)));
  const send = (c) => {
    if (busy) return;
    vibrate("light"); setBusy(c.id); setErr("");
    Promise.resolve(api.cardSend(c.id, { t: "share", item, note: note.trim() })).then((r) => { setBusy(null); if (r && r.ok) onSent(c); else setErr(smartErr(r)); })
      .catch(() => { setBusy(null); setErr(smartErr({ error: "net" })); });
  };
  return (
    <div className="ch-veil" data-kbm="" onClick={onClose}>
      <div className="ch-sheet" role="dialog" aria-modal="true" aria-label="Поделиться в чат" data-chat-shareto={item.kind + ":" + item.id} onClick={stop}>
        <div className="ch-grip" aria-hidden="true" />
        <div className="ch-sheet-h"><span className="ch-sheet-t">Поделиться в чат</span><button type="button" className="ch-x" data-sa-back="" aria-label="Закрыть" onClick={onClose}>{IC.x}</button></div>
        <div className="ch-opt ch-share-it" aria-label={"Что: " + item.title}>
          <span className="ch-opt-i" aria-hidden="true">{item.img ? <img src={item.img} alt="" /> : IC.share}</span>
          <span className="ch-opt-b"><span className="ch-opt-t">{item.title}</span>{item.sub ? <span className="ch-opt-s">{item.sub}</span> : null}</span>
        </div>
        <input className="ch-field sa-field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Пара слов коллегам (можно без них)" aria-label="Пара слов коллегам" data-chat-share-note="" />
        <div className="ch-lbl">Куда</div>
        {!chats ? <div className="ch-hint">Загружаю чаты…</div> : !list.length ? <div className="ch-hint">Чатов пока нет.</div> : null}
        {list.map((c) => (
          <button key={c.id} type="button" className="ch-opt" data-chat-shareto-chat={c.kind} disabled={!!busy} onClick={() => send(c)}>
            <Ava c={c} />
            <span className="ch-opt-b"><span className="ch-opt-t">{chatTitle(c)}</span><span className="ch-opt-s">{busy === c.id ? "Отправляю…" : c.kind === "dm" ? "Личная переписка" : peopleWord(c.members)}</span></span>
          </button>))}
        {err ? <div className="ch-err" role="alert" data-chat-share-err="">{err}</div> : null}
      </div>
    </div>);
}

// ── список чатов ──
function List({ chats, me, err, note = "", onBack, onOpen, onWrite, onCall, back = true, onSearch = null }) {
  const now = new Date();
  return (<>
    <header className="ch-head">
      <div className="ch-head-in">
        <button type="button" className="ch-back" data-sa-back={back ? "" : undefined} aria-label={back ? "Назад" : "Выйти из чата"} onClick={onBack}>{IC.back}</button>
        <div className="ch-id" style={{ flex: 1 }}><b className="ch-title">Чат</b><span className="ch-st">{me && me.restaurant ? me.restaurant : "команда заведения"}</span></div>
        {onSearch ? <button type="button" className="ch-tool" data-chat-searchbtn="" aria-label="Поиск по сообщениям" onClick={onSearch}>{IC.search}</button> : null}
        {onCall ? <button type="button" className="ch-tool" data-chat-callbtn="" aria-label="Позвать" onClick={onCall}>{IC.bell}</button> : null}
        <button type="button" className="ch-tool" data-chat-write="" aria-label="Написать коллеге" onClick={onWrite}>{IC.pen}</button>
      </div>
    </header>
    <div className="ch-scroll sa-dlgscroll">
      <div className="ch-list" role="list">
        {err ? <div className="ch-empty" role="alert">{err}</div> : null}
        {note ? <div className="ch-empty" role="status" data-chat-note="">{note}</div> : null}
        {!chats && !err ? <div className="ch-empty">Загружаю переписку…</div> : null}
        {(chats || []).map((c) => {
          const last = c.last, call = last && last.kind === "call" && !last.del;
          const dr = draftLine(me && me.id, c.id);   // v99 (Доп. 412): «Черновик: …», как в Telegram
          return (
            <button key={c.id} type="button" role="listitem" className="ch-item" data-chat-item={c.kind === "dm" ? "dm" : c.kind} data-chat-id={c.id} onClick={() => onOpen(c)}>
              <Ava c={c} big />
              <span className="ch-item-b">
                <span className="ch-item-r"><span className="ch-item-t">{chatTitle(c)}</span><span className={"ch-item-time" + (c.unread ? " new" : "")}>{last ? listTime(last.at, now) : ""}</span></span>
                <span className="ch-item-r">{dr ? <span className="ch-item-p" data-chat-draft={c.id}><span className="dr">Черновик:</span> {dr}</span>
                  : <span className={"ch-item-p" + (call ? " call" : "")}>{last ? previewText(last, me && me.id, c.kind !== "dm") : c.kind === "dm" ? "Напиши первым" : "Пока тихо"}</span>}
                  {c.ment ? <span className="ch-badge at" data-chat-ment={c.ment} aria-label={"тебя упомянули: " + c.ment}>{IC.at}</span> : null}
                  {c.unread ? <span className="ch-badge" data-chat-unread={c.unread} aria-label={"непрочитанных: " + c.unread}>{badge(c.unread)}</span> : null}</span>
              </span>
            </button>);
        })}
        {chats ? <div className="ch-note">{(chats || []).some((c) => c.kind === "net")
          ? "Переписку видят только сотрудники вашего заведения, «Руководителей сети» видят руководители всех заведений. Она хранится 30 дней."
          : "Переписку видят только сотрудники вашего заведения. Она хранится 30 дней."}</div> : null}
      </div>
    </div>
  </>);
}

// ── v99 (Доп. 412): поиск по переписке — во всех моих чатах (из списка) или в одном (из переписки). Сервер ищет по
// словам в тексте, подписях к фото, карточках и ответах Наставника (регистр и «ё» не важны), до 50 последних; нажатие —
// переписка открывается на этом сообщении ──
function SearchView({ api, me, chats, chat = null, q0 = "", onQ = null, onBack, onPick }) {
  const [q, setQ] = React.useState(q0 || "");
  const [res, setRes] = React.useState(null);   // { q, msgs, more } | { q, err }
  const [busy, setBusy] = React.useState(false);
  const inRef = React.useRef(null);
  React.useEffect(() => { const t = setTimeout(() => { try { if (inRef.current) inRef.current.focus(); } catch (e) { /* */ } }, 60); return () => clearTimeout(t); }, []);
  React.useEffect(() => {
    const qq = searchQuery(q);
    if (onQ) onQ(q);
    if (!qq) { setRes(null); setBusy(false); return undefined; }
    let alive = true;
    setBusy(true);
    const t = setTimeout(() => {
      Promise.resolve(api.search(qq, chat ? chat.id : null)).then((r) => {
        if (!alive) return;
        setBusy(false);
        setRes(r && r.ok ? { q: qq, msgs: Array.isArray(r.msgs) ? r.msgs : [], more: !!r.more }
          : { q: qq, err: r && r.error === "missing" ? "Поиск заработает, когда руководитель обновит сервер (этап 39)." : "Не получилось найти. Проверь связь." });
      }).catch(() => { if (alive) { setBusy(false); setRes({ q: qq, err: "Нет связи. Попробуй ещё раз." }); } });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);   // eslint-disable-line react-hooks/exhaustive-deps
  const byId = new Map((chats || []).map((c) => [String(c.id), c]));
  const now = new Date(), qq = searchQuery(q);
  return (<>
    <header className="ch-head"><div className="ch-head-in">
      <button type="button" className="ch-back" data-sa-back="" aria-label="Назад" onClick={onBack}>{IC.back}</button>
      <span className="ch-qw">
        <input ref={inRef} className="ch-q sa-field" type="search" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} enterKeyHint="search"
          placeholder={chat ? "Поиск в «" + chatTitle(chat) + "»" : "Поиск по сообщениям"} aria-label={chat ? "Поиск в этом чате" : "Поиск по сообщениям"} data-chat-q="" />
        {q ? <button type="button" className="ch-qx" data-chat-qx="" aria-label="Очистить" onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setQ(""); try { if (inRef.current) inRef.current.focus(); } catch (e) { /* */ } }}>{IC.x}</button> : null}
      </span>
    </div></header>
    <div className="ch-scroll sa-dlgscroll" data-chat-results={res && !res.err ? res.msgs.length : ""}>
      <div className="ch-list" role="list">
        {!qq ? <div className="ch-note" data-chat-search-hint="">{chat ? "Ищу в этом чате" : "Ищу во всех твоих чатах"} за 30 дней: по словам из сообщений, подписей к фото и карточек.</div> : null}
        {qq && busy && !res ? <div className="ch-empty" role="status">Ищу…</div> : null}
        {res && res.err ? <div className="ch-empty" role="alert" data-chat-search-err="">{res.err}</div> : null}
        {res && !res.err && !res.msgs.length ? <div className="ch-empty" data-chat-nofound="">Ничего не нашёл.</div> : null}
        {res && !res.err ? res.msgs.map((m) => {
          const c = byId.get(String(m.chat)) || null;
          const sn = searchSnippet(m.body, res.q);
          const who = String(m.emp) === String(me && me.id) ? "Ты" : m.kind === "ai" ? AI_NAME : bubbleName(m.name);
          return (
            <button key={m.id} type="button" role="listitem" className="ch-sr" data-chat-sr={m.id} onClick={() => { vibrate("light"); onPick(m.chat, m.id); }}>
              {c ? <Ava c={c} /> : <span className="ch-ava" aria-hidden="true">{chatInitials(m.name)}</span>}
              <span className="ch-sr-b">
                <span className="ch-sr-h"><span className="ch-sr-c">{c ? chatTitle(c) : "Чат"}</span><span className="ch-sr-t">{listTime(m.at, now)}</span></span>
                <span className="ch-sr-x"><span className="ch-sr-w">{who}: </span>{sn.pre}{sn.hit ? <b>{sn.hit}</b> : null}{sn.post}</span>
              </span>
            </button>);
        }) : null}
        {res && res.more ? <div className="ch-note">Показаны 50 последних. Уточни запрос, чтобы найти раньше.</div> : null}
      </div>
    </div>
  </>);
}

// ── коллеги (личное сообщение, вызов человека; v92: несколько — в свой чат) ──
// multi — Set выбранных (галочки), exclude — Set тех, кого не показывать (уже в чате), top — над поиском, foot — внизу
function People({ me, api, title, sub = "Коллеги вашего заведения", hint, onBack, onPick, picked, inline = false, multi = null, exclude = null, top = null, foot = null, emptyText = "Пока здесь никого." }) {
  const [list, setList] = React.useState(null);
  const [bad, setBad] = React.useState(false);   // список не пришёл (не «никого нет»)
  const [q, setQ] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    const fail = () => { if (alive) { setList([]); setBad(true); } };
    Promise.resolve(api.people()).then((r) => { if (!alive) return; if (r && r.ok) { setBad(false); setList((r.people || []).filter((p) => String(p.id) !== String(me && me.id))); } else fail(); }).catch(fail);
    return () => { alive = false; };
  }, [api]);   // eslint-disable-line react-hooks/exhaustive-deps
  const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");
  const shown = (list || []).filter((p) => (!exclude || !exclude.has(String(p.id))) && (!q.trim() || norm(p.name).includes(norm(q.trim()))));
  const onShift = shown.filter((p) => p.shift), rest = shown.filter((p) => !p.shift);
  const row = (p) => {
    const on = multi ? multi.has(String(p.id)) : picked != null ? String(picked) === String(p.id) : undefined;
    return (
      <button key={p.id} type="button" className="ch-person" data-chat-person={p.id} aria-pressed={on} onClick={() => { vibrate("light"); onPick(p); }}>
        <span className="ch-ava" aria-hidden="true">{chatInitials(p.name)}</span>
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span className="ch-person-n">{p.name}</span><span className="ch-person-p">{[posName(p.pos), p.shift ? "сегодня в смене" : ""].filter(Boolean).join(" · ")}</span></span>
        {multi ? <span className={"ch-tick" + (on ? " on" : "")} aria-hidden="true">{on ? IC.check : null}</span> : null}
      </button>);
  };
  const body = (<>
    {top}
    <input className="ch-search sa-field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти по имени" aria-label="Найти по имени" data-chat-search="" />
    {!list ? <div className="ch-empty">Загружаю команду…</div> : bad ? <div className="ch-empty" role="alert" data-chat-people-bad="">Список коллег не загрузился. Проверь связь и открой ещё раз.</div>
      : !shown.length ? <div className="ch-empty">{q.trim() ? "Никого не нашёл." : emptyText}</div> : null}
    {onShift.length ? <div className="ch-sec">Сегодня в смене</div> : null}
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 10px" }}>{onShift.map(row)}</div>
    {rest.length && onShift.length ? <div className="ch-sec">Остальные</div> : null}
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 10px" }}>{rest.map(row)}</div>
    {hint ? <div className="ch-note">{hint}</div> : null}
  </>);
  if (inline) return body;
  return (<>
    <header className="ch-head"><div className="ch-head-in">
      <button type="button" className="ch-back" data-sa-back="" aria-label="Назад" onClick={onBack}>{IC.back}</button>
      <div className="ch-id" style={{ flex: 1 }}><b className="ch-title">{title}</b><span className="ch-st">{sub}</span></div>
    </div></header>
    <div className="ch-scroll sa-dlgscroll" data-chat-people="">{body}</div>
    {foot}
  </>);
}

// ── v92 (Доп. 405): свой чат — название и коллеги (заводят руководитель и старший) ──
const pickToggle = (set, p) => { const n = new Set(set), k = String(p.id); if (n.has(k)) n.delete(k); else n.add(k); return n; };
const groupErr = (r) => (r && r.error === "forbidden" ? "Это могут руководитель и старший." : r && r.error === "too_fast" ? "Сегодня новых чатов уже много. Завтра можно снова."
  : r && r.error === "too_many" ? "В чате может быть до 100 человек." : r && r.error === "net" ? "Нет связи. Попробуй ещё раз." : "Не получилось. Проверь связь.");
function GroupNew({ me, api, onBack, onDone }) {
  const [title, setTitle] = React.useState("");
  const [sel, setSel] = React.useState(() => new Set());
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const t = groupTitle(title);
  const can = !!t && sel.size > 0 && !busy;
  const create = () => {
    if (!can) return;
    vibrate("light"); setBusy(true); setErr("");
    Promise.resolve(api.groupCreate(t, [...sel])).then((r) => { setBusy(false); if (r && r.ok && r.chat) onDone(r.chat); else setErr(groupErr(r)); })
      .catch(() => { setBusy(false); setErr(groupErr({ error: "net" })); });
  };
  const top = (<>
    <div className="ch-sec">Название</div>
    <input className="ch-search sa-field" value={title} maxLength={GROUP_TITLE_MAX + 10} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Бар, Веранда, Банкет в субботу"
      aria-label="Название чата" data-chat-gtitle="" />
    <div className="ch-sec" data-chat-gcount={sel.size}>Кого добавить{sel.size ? " · " + sel.size : ""}</div>
  </>);
  const foot = (
    <div className="ch-foot" data-kbm="" data-kbm-at="">
      {err ? <div className="ch-err" role="alert" data-chat-gerr="">{err}</div> : null}
      <button type="button" className="ch-main" data-chat-gcreate="" disabled={!can} onClick={create}>
        {busy ? "Создаю…" : !t ? "Дай чату название" : !sel.size ? "Отметь коллег" : "Создать чат · " + peopleWord(sel.size + 1)}</button>
    </div>);
  return <People me={me} api={api} title="Новый чат" sub="Название и коллеги вашего заведения" onBack={onBack} onPick={(p) => setSel((s) => pickToggle(s, p))} multi={sel} top={top} foot={foot}
    hint="Чат видят только его участники. Добавлять и убирать людей, переименовать и удалить чат могут руководитель и старший." />;
}
// добавить людей в свой чат: коллеги, которых в нём ещё нет
function GroupAdd({ me, api, chat, members, onBack, onDone }) {
  const [sel, setSel] = React.useState(() => new Set());
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const inChat = React.useMemo(() => new Set((members || []).map((p) => String(p.id))), [members]);
  const add = () => {
    if (!sel.size || busy) return;
    vibrate("light"); setBusy(true); setErr("");
    Promise.resolve(api.groupEdit(chat.id, { add: [...sel] })).then((r) => { setBusy(false); if (r && r.ok) onDone(r); else setErr(groupErr(r)); })
      .catch(() => { setBusy(false); setErr(groupErr({ error: "net" })); });
  };
  const foot = (
    <div className="ch-foot" data-kbm="" data-kbm-at="">
      {err ? <div className="ch-err" role="alert" data-chat-gerr="">{err}</div> : null}
      <button type="button" className="ch-main" data-chat-gaddgo="" disabled={!sel.size || busy} onClick={add}>{busy ? "Добавляю…" : sel.size ? "Добавить · " + sel.size : "Отметь коллег"}</button>
    </div>);
  return <People me={me} api={api} title={"Добавить в «" + chatTitle(chat) + "»"} onBack={onBack} onPick={(p) => setSel((s) => pickToggle(s, p))} multi={sel} exclude={inChat}
    emptyText="Все коллеги уже в этом чате." foot={foot} />;
}
// о своём чате: участники; руководитель и старший — переименовать, добавить, убрать, удалить; каждый — выйти
// v97 (Доп. 410): карточка коллеги — нажатие на имя над сообщением или на шапку личной переписки: должность, смена
// сегодня или ближайшая по графику (chat_person), «Написать лично»
function PersonSheet({ api, emp, chat, onClose, onDm = null }) {
  const [p, setP] = React.useState(null);
  const [err, setErr] = React.useState("");
  const [mark, setMark] = React.useState("");   // v107 (Доп. 420): «Наставник новичков»
  React.useEffect(() => {
    let alive = true;
    if (api.newbieMark) Promise.resolve(api.newbieMark(emp)).then((r) => { if (alive && r && r.ok) setMark(mentorLine(r)); }).catch(() => {});
    return () => { alive = false; };
  }, [api, emp]);
  React.useEffect(() => {
    let alive = true;
    Promise.resolve(api.person(emp)).then((r) => { if (!alive) return; if (r && r.ok && r.person) setP(r.person); else setErr(r && r.error === "missing" ? "Карточки коллег появятся, когда руководитель перезапустит этап 38." : "Карточка не загрузилась. Проверь связь."); })
      .catch(() => { if (alive) setErr("Нет связи. Попробуй ещё раз."); });
    return () => { alive = false; };
  }, [api, emp]);
  const here = chat && chat.kind === "dm" && chat.peer && String(chat.peer.id) === String(emp);
  return (
    <div className="ch-veil" data-kbm="" onClick={onClose}>
      <div className="ch-sheet" role="dialog" aria-modal="true" aria-label={p ? p.name : "Коллега"} data-chat-person={emp} onClick={stop}>
        <div className="ch-grip" aria-hidden="true" />
        <div className="ch-pp">
          <span className="ch-ava" aria-hidden="true">{p ? chatInitials(p.name) : ""}</span>
          <div className="ch-pp-b"><b className="ch-pp-n" data-chat-person-n="">{p ? p.name : "Коллега"}</b>
            {p ? <span className="ch-pp-p" data-chat-person-p="">{[posName(p.pos), p.same ? "" : restShort(p.rest)].filter(Boolean).join(" · ")}</span> : null}</div>
          <button type="button" className="ch-x" data-sa-back="" aria-label="Закрыть" onClick={onClose}>{IC.x}</button>
        </div>
        {!p ? <div className="ch-hint" role={err ? "alert" : "status"}>{err || "Загружаю…"}</div> : (<>
          <div className="ch-pp-sh" data-chat-person-shift="">{IC.cal}<span>{personShiftLine(p)}</span></div>
          {mark ? <div className="ch-pp-sh" data-chat-person-mentor="">{IC.star}<span>{mark}</span></div> : null}
          {!p.me && !here && onDm ? <button type="button" className="ch-main" data-chat-person-dm={p.id} onClick={() => { vibrate("light"); onClose(); onDm({ id: p.id, name: p.name }); }}>Написать лично</button> : null}
        </>)}
      </div>
    </div>);
}

function GroupInfo({ chat, me, api, members, onClose, onChanged, onAdd, onGone }) {
  const manage = canManage(chat, me);
  const meId = me && me.id;
  const [title, setTitle] = React.useState(chat.title || "");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [sure, setSure] = React.useState(null);   // "leave" | "delete" — переспросить
  const t = groupTitle(title), renamed = manage && !!t && t !== chat.title;
  const run = (q, after) => {
    setBusy(true); setErr("");
    Promise.resolve(q).then((r) => { setBusy(false); if (r && r.ok) after(r); else setErr(groupErr(r)); }).catch(() => { setBusy(false); setErr(groupErr({ error: "net" })); });
  };
  const list = [...(members || [])].sort((a, b) => (String(a.id) === String(meId) ? -1 : String(b.id) === String(meId) ? 1 : String(a.name).localeCompare(String(b.name), "ru")));
  return (
    <div className="ch-veil" data-kbm="" onClick={onClose}>
      <div className="ch-sheet" role="dialog" aria-modal="true" aria-label={"О чате «" + chatTitle(chat) + "»"} data-chat-ginfo="" onClick={stop}>
        <div className="ch-grip" aria-hidden="true" />
        <div className="ch-sheet-h"><span className="ch-sheet-t">{chatTitle(chat)}</span><button type="button" className="ch-x" data-sa-back="" aria-label="Закрыть" onClick={onClose}>{IC.x}</button></div>
        {manage ? (<>
          <div className="ch-lbl" style={{ marginTop: 0 }}>Название</div>
          <input className="ch-field sa-field" style={{ marginTop: 0 }} value={title} maxLength={GROUP_TITLE_MAX + 10} onChange={(e) => setTitle(e.target.value)} placeholder="Название чата" aria-label="Название чата" data-chat-grename="" />
          {renamed ? <button type="button" className="ch-main" data-chat-gsave="" disabled={busy} onClick={() => run(api.groupEdit(chat.id, { title: t }), onChanged)}>Сохранить название</button> : null}
        </>) : null}
        <div className="ch-lbl" data-chat-gmembers={list.length}>Участники · {list.length}</div>
        {manage ? <button type="button" className="ch-act" data-chat-gadd="" onClick={onAdd}>{IC.plus}Добавить людей</button> : null}
        <div>{list.map((p) => {
          const self = String(p.id) === String(meId);
          return (
            <div key={p.id} className="ch-gm" data-chat-gm={p.id}>
              <span className="ch-ava" aria-hidden="true">{chatInitials(p.name)}</span>
              <span className="ch-gm-b"><span className="ch-person-n">{p.name}{self ? " (ты)" : ""}</span>
                <span className="ch-person-p">{[posName(p.pos), String(p.id) === String(chat.owner) ? "создатель чата" : ""].filter(Boolean).join(" · ")}</span></span>
              {manage && !self ? <button type="button" className="ch-gm-x" data-chat-gremove={p.id} disabled={busy} aria-label={"Убрать из чата: " + p.name}
                onClick={() => run(api.groupEdit(chat.id, { remove: [p.id] }), onChanged)}>Убрать</button> : null}
            </div>);
        })}</div>
        {err ? <div className="ch-err" role="alert" data-chat-gerr="" style={{ marginTop: 8 }}>{err}</div> : null}
        <button type="button" className="ch-act bad" data-chat-gleave="" disabled={busy} style={{ marginTop: 6 }}
          onClick={() => { if (sure !== "leave") { vibrate("light"); setSure("leave"); return; } run(api.groupLeave(chat.id), () => onGone("left")); }}>
          {IC.back}{sure === "leave" ? "Точно выйти? Нажми ещё раз" : "Выйти из чата"}</button>
        {manage ? <button type="button" className="ch-act bad" data-chat-gdelete="" disabled={busy}
          onClick={() => { if (sure !== "delete") { vibrate("light"); setSure("delete"); return; } run(api.groupDelete(chat.id), () => onGone("deleted")); }}>
          {IC.trash}{sure === "delete" ? "Удалить у всех? Нажми ещё раз" : "Удалить чат"}</button> : null}
      </div>
    </div>);
}

// ── переписка ──
const mergeMsgs = (prev, add) => {
  if (!add || !add.length) return prev;
  const byId = new Map(prev.map((m) => [String(m.id), m]));
  add.forEach((m) => { if (m && m.id != null) byId.set(String(m.id), { ...(byId.get(String(m.id)) || {}), ...m }); });
  return [...byId.values()].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
};
const SWIPE_AT = 56;

// свайп вбок пальцем — ответить (вправо, как в WhatsApp, и влево, как в Telegram); мышью — нет: там тянут, чтобы
// выделить текст, а ответить можно из листа сообщения
function useSwipe(on, onSwipe) {
  const [dx, setDx] = React.useState(0);
  const s = React.useRef(null), v = React.useRef(0), quiet = React.useRef(false);
  const down = (e) => { if (!on || e.pointerType === "mouse") return; s.current = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false, buzz: false }; };
  const move = (e) => {
    const g = s.current;
    if (!g || g.id !== e.pointerId) return;
    const ddx = e.clientX - g.x, ddy = e.clientY - g.y;
    if (!g.on) {
      if (Math.abs(ddy) > 10 && Math.abs(ddy) >= Math.abs(ddx)) { s.current = null; return; }
      if (Math.abs(ddx) < 12 || Math.abs(ddx) < Math.abs(ddy) * 1.6) return;
      g.on = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    }
    const d = Math.sign(ddx) * Math.max(0, Math.min(84, Math.abs(ddx) - 12));
    v.current = d; setDx(d);
    if (Math.abs(d) >= SWIPE_AT && !g.buzz) { g.buzz = true; vibrate("light"); }
  };
  const up = () => {
    const g = s.current; s.current = null;
    if (g && g.on) { quiet.current = true; setTimeout(() => { quiet.current = false; }, 350); if (Math.abs(v.current) >= SWIPE_AT) onSwipe(); }
    v.current = 0; setDx(0);
  };
  return { dx, quiet, handlers: { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up } };
}

function SwipeIcon({ dx }) {
  if (!dx) return null;
  const k = Math.min(1, Math.abs(dx) / SWIPE_AT);
  return <span className="ch-swipe" aria-hidden="true" style={{ [dx > 0 ? "left" : "right"]: -36, opacity: k, transform: "scale(" + (0.6 + 0.4 * k) + ")" }}>{IC.reply}</span>;
}

function Reactions({ m, me, onReact }) {
  const rx = reactGroups(m.reacts, me && me.id);
  if (!rx.length) return null;
  return rx.map((g) => (
    <button key={g.r} type="button" className="ch-rx" aria-pressed={g.mine} data-chat-rx={g.r} aria-label={reactName(g.r) + ": " + g.n + (g.mine ? ", твоя" : "")}
      title={g.names.map(bubbleName).join(", ")} onClick={(e) => { e.stopPropagation(); vibrate("light"); onReact(m, g.r); }}>{ric(g.r, 15)}{g.n}</button>));
}

function Quote({ q, me, onJump }) {
  if (!q) return null;
  return (
    <button type="button" className="ch-rq" data-chat-rq={q.id} onClick={(e) => { e.stopPropagation(); if (onJump) onJump(q.id); }} aria-label={"Ответ на сообщение: " + whoName(q, me) + ", " + quoteText(q, me && me.id)}>
      <span className="ch-rq-n">{whoName(q, me)}</span><span className="ch-rq-t">{quoteText(q, me && me.id)}</span>
    </button>);
}

function Bubble({ row, me, api, reads, myLastId, othersN, group, net = false, hl, onMenu, onReply, onReact, onJump, onView, onWho = null, names = null, leadIds = null }) {
  const m = row.m, out = row.side === "out", meId = me && me.id;
  const sw = useSwipe(!m.del, () => onReply(m));
  const rb = out ? readBy(m, reads, meId) : [];
  const ph = m.kind === "photo" && m.photo && !m.del;
  const box = ph ? photoBox(m.photo.w, m.photo.h) : null;
  const cap = m.del ? "" : String(m.body || "");
  // v99 (Доп. 412): «@Имя» — золотом; меня упомянули (или «@все» руководителя) — пузырь с золотой каймой
  const parts = group && names && cap.indexOf("@") >= 0 ? mentionParts(cap, names, { meId, leadAuthor: !!(leadIds && leadIds.has(String(m.emp))) }) : null;
  const atMe = !out && !!parts && parts.some((p) => p.t === "at" && p.me);
  const hasRx = !m.del && reactGroups(m.reacts, meId).length > 0;
  const open = () => { if (!sw.quiet.current && !m.del) onMenu(m); };
  const cls = "ch-row " + row.side + (row.same ? " same" : "") + (row.cont ? " cont" : " tail") + (hl ? " hl" : "") + (atMe ? " atme" : "") + (sw.dx ? " swiping" : " back");
  const spacer = <i className={"ch-sp" + (m.edited && !m.del ? " ed" : "")} aria-hidden="true" />;
  const label = (out ? "Ты" : withRest(m.name, m.rest, net)) + ", " + hhmm(m.at) + ": " + (m.del ? "сообщение удалено" : (ph ? "фото" + (cap ? ", " + cap : "") : cap)) +
    (m.edited && !m.del ? ", изменено" : "") + (out ? (rb.length ? ", прочитано" : ", отправлено") : "");
  return (
    <div className={cls} data-chat-msg={m.id} data-chat-side={row.side} style={sw.dx ? { transform: "translateX(" + sw.dx + "px)" } : undefined} {...sw.handlers}>
      <SwipeIcon dx={sw.dx} />
      {/* v97: имя над сообщением — карточка коллеги (должность, смена, «Написать лично») */}
      {row.showName ? (onWho && m.emp && m.emp !== "ai"
        ? <button type="button" className="ch-nm ch-nmb" data-chat-who={m.emp} aria-label={"Коллега: " + withRest(m.name, m.rest, net)} onClick={(e) => { e.stopPropagation(); vibrate("light"); onWho(m); }}>{withRest(bubbleName(m.name), m.rest, net)}</button>
        : <div className="ch-nm" aria-hidden="true">{withRest(bubbleName(m.name), m.rest, net)}</div>) : null}
      <div className={"ch-b " + (out ? "ch-out" : "ch-in") + (out && rb.length ? " read" : "") + (ph ? " ph" : "")} style={ph ? { width: box.w + 6 } : undefined}
        role="group" tabIndex={0} aria-label={label} data-chat-bubble="" onClick={open} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); open(); } }}>
        {!m.del && m.reply ? <Quote q={m.reply} me={me} onJump={onJump} /> : null}
        {ph ? <button type="button" className="ch-ph" style={{ width: box.w, height: box.h }} data-chat-photo={m.photo.id} aria-label="Открыть фото" onClick={(e) => { e.stopPropagation(); if (!sw.quiet.current) onView(m); }}>
          <PhotoImg api={api} id={m.photo.id} alt={cap ? "Фото: " + cap : "Фото"} /></button> : null}
        {!ph || cap ? <span className={"ch-tx" + (m.del ? " ch-del" : "")}>{m.del ? "Сообщение удалено" : parts ? parts.map((p, i) => (p.t === "at"
          ? <span key={i} className={"ch-at" + (p.me ? " me" : "")} data-chat-at={p.id}>{p.s}</span> : <React.Fragment key={i}>{p.s}</React.Fragment>)) : cap}{hasRx ? null : spacer}</span> : null}
        {hasRx ? <span className="ch-rxs"><Reactions m={m} me={me} onReact={onReact} />{spacer}</span> : null}
        <span className={"ch-meta" + (ph && !cap && !hasRx ? " on-ph" : "")} aria-hidden="true">{m.edited && !m.del ? <span className="ch-edm">изменено</span> : null}{hhmm(m.at)}{out ? TICKS : null}</span>
      </div>
      {group && out && myLastId === m.id && !m.del ? <div className="ch-reads" data-chat-reads={rb.length}>{readLine(rb.length, othersN, group)}</div> : null}
    </div>);
}

function CallCard({ row, me, now, busyGo, hl, onGo, onMenu, onReply, onReact }) {
  const m = row.m;
  const sw = useSwipe(!m.del, () => onReply(m));
  const st = callState(m, now), forMe = isCallForMe(m, me), iGo = st.st === "going" && st.going.some((g) => String(g.id) === String(me && me.id));
  return (
    <div className={"ch-row mid" + (hl ? " hl" : "") + (sw.dx ? " swiping" : " back")} data-chat-msg={m.id} style={sw.dx ? { transform: "translateX(" + sw.dx + "px)" } : undefined} {...sw.handlers}>
      <SwipeIcon dx={sw.dx} />
      <div className={"ch-call" + (st.st === "stale" ? " stale" : "")} data-chat-call={st.st} data-chat-forme={forMe ? "1" : "0"} onClick={() => { if (!sw.quiet.current && !m.del) onMenu(m); }}>
        <div className="ch-call-h">{IC.bell}<span>Вызов · {hhmm(m.at)}</span></div>
        <div className="ch-call-t">{m.del ? "Вызов удалён" : callLine(m, me && me.id)}</div>
        {!m.del ? <div className={"ch-call-s" + (st.st === "going" ? " going" : "")}>
          {st.st === "going" ? "Идёт: " + st.going.map((g) => bubbleName(g.name)).join(", ") : st.st === "stale" ? "Без ответа" : st.min ? "Ждёт ответа · " + st.min + " мин" : "Ждёт ответа"}</div> : null}
        {!m.del && forMe && !iGo && st.st === "wait" ? <button type="button" className="ch-go" data-chat-go={m.id} disabled={busyGo === m.id} onClick={(e) => { e.stopPropagation(); onGo(m); }}>Иду</button> : null}
        {!m.del && reactGroups(m.reacts, me && me.id).length ? <div className="ch-rxs"><Reactions m={m} me={me} onReact={onReact} /></div> : null}
      </div>
    </div>);
}

function Thread({ a11y, me, api, app = null, chat, stt, onBack, onSent, onGone, onDm = null, init = null }) {
  const group = chat.kind !== "dm";
  const meId = me && me.id;
  const [msgs, setMsgs] = React.useState([]);
  const [members, setMembers] = React.useState([]);
  const [pin, setPin] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);
  const [more, setMore] = React.useState(false);
  const [err, setErr] = React.useState("");
  // v99 (Доп. 412): черновик этого чата — в строке ввода с первого кадра (и на что отвечал — когда переписка загрузится)
  const draft0 = React.useRef(undefined);
  if (draft0.current === undefined) draft0.current = draftGet(meId, chat.id);
  const [text, setText] = React.useState(() => (draft0.current ? draft0.current.t : ""));
  const [caret, setCaret] = React.useState(() => (draft0.current ? draft0.current.t.length : 0));   // v99: где каретка — для подсказок после «@»
  const stashRef = React.useRef(null);                 // v99: черновик на время правки своего сообщения
  const [pending, setPending] = React.useState([]);   // ещё не дошли до сервера: { tmp, body, at, failed, reply, photo }
  // v97: открыли из «Графика» — сразу лист «Отдать смену» или «Поменяться» с этим днём
  const [sheet, setSheet] = React.useState(() => (init && init.shift ? { shift: init.shift, date: init.date || null } : init && init.late ? "late" : null));     // "call" | { msg }; v99: "late" — «Опаздываю» из «Смены»
  const [reply, setReply] = React.useState(null);     // отвечаю на (цитата)
  const [edit, setEdit] = React.useState(null);       // правлю своё
  const [shot, setShot] = React.useState(null);       // фото к отправке: { busy } | сжатое
  const [caption, setCaption] = React.useState("");
  const [view, setView] = React.useState(null);       // фото на весь экран
  const [hl, setHl] = React.useState(null);
  const [away, setAway] = React.useState(false);
  const [fresh, setFresh] = React.useState(0);
  const [busyGo, setBusyGo] = React.useState(null);
  const [cardBusy, setCardBusy] = React.useState(null);   // v93: карточка, по которой ждём ответ сервера
  const [aiWait, setAiWait] = React.useState(0);          // v93: Наставник печатает (сколько вопросов ждут ответа)
  const [toast, setToast] = React.useState("");
  const [whoOpen, setWhoOpen] = React.useState(() => new Set());   // v93: у каких заданий раскрыт «Кто не прошёл»
  const [tick, setTick] = React.useState(0);
  const chatRef = React.useRef(null), inputRef = React.useRef(null), fileRef = React.useRef(null), stick = React.useRef(true), lastId = React.useRef(0), readId = React.useRef(0), since = React.useRef(null);
  const msgsRef = React.useRef(msgs); msgsRef.current = msgs;
  const moreRef = React.useRef(more); moreRef.current = more;
  const membersKey = React.useRef(""), pinKey = React.useRef("null");
  const cleared = React.useRef(undefined);   // v91: когда чат очищали (chat.cleared с сервера) — сменилась, пока открыт: перечитать
  const pullRef = React.useRef(null);
  const [clearBusy, setClearBusy] = React.useState(false);
  const [clearErr, setClearErr] = React.useState("");
  const maxId = (list) => list.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0);
  // новое и изменённое (кто идёт на вызов, правка, реакции, удаление) — в ленту по номеру; пришло не моё, а я выше по
  // ленте — счётчик у «вниз». Курсор опроса (lastId) двигают только ответы опроса: своё отправленное приходит с номером
  // больше, чем ещё не полученное чужое (коллега ответил, пока я звал), и сдвиг курсора по нему терял бы чужие сообщения.
  const addMsgs = (list, { poll = false, quiet = false } = {}) => {
    const known = new Set(msgsRef.current.map((m) => String(m.id)));
    const next = mergeMsgs(msgsRef.current, list || []);
    if (poll) lastId.current = Math.max(lastId.current, maxId(list || []));
    const added = (list || []).filter((m) => m && !known.has(String(m.id)) && String(m.emp) !== String(meId)).length;
    if (!quiet && !stick.current && added) setFresh((n) => n + added);
    msgsRef.current = next; setMsgs(next);
  };
  const pull = React.useCallback((first) => Promise.resolve(api.open(chat.id, first ? {} : { after: lastId.current, since: since.current })).then((r) => {
    if (r && r.error === "not_found") { if (onGone) onGone("gone"); return; }   // v92: чат удалили или меня убрали из участников
    if (!r || !r.ok) { if (first) setErr("Переписка не загрузилась. Проверь связь."); return; }
    // v91: чат очистили у всех, пока он открыт: стёртого на сервере больше нет — лента заново
    const cl = r.chat ? r.chat.cleared || null : undefined;
    if (cl !== undefined) {
      if (first || cleared.current === undefined) cleared.current = cl;
      else if (clearedChanged(cleared.current, cl)) { cleared.current = cl; wipe(); if (pullRef.current) pullRef.current(true); return; }
    }
    setErr((e) => (first ? "" : e));
    if (r.now) since.current = r.now;
    // участники и закреп — заново, только если что-то поменялось (опрос раз в 4 секунды не перерисовывает экран зря)
    if (Array.isArray(r.members)) { const s = JSON.stringify(r.members); if (s !== membersKey.current) { membersKey.current = s; setMembers(r.members); } }
    if ("pin" in r) { const s = JSON.stringify(r.pin || null); if (s !== pinKey.current) { pinKey.current = s; setPin(r.pin || null); } }
    if (first) setMore(!!r.more);
    addMsgs(r.msgs, { poll: true, quiet: first });
    setLoaded(true);
  }).catch(() => { if (first) setErr("Нет связи. Переписка откроется, когда связь появится."); }), [api, chat.id, meId]);   // eslint-disable-line react-hooks/exhaustive-deps
  pullRef.current = pull;
  // лента без стёртого: ни сообщений, ни закрепа, ни ответа или правки стёртого
  function wipe() {
    msgsRef.current = []; setMsgs([]); setMore(false); moreRef.current = false; lastId.current = 0; setFresh(0);
    pinKey.current = "null"; setPin(null); setReply(null); setEdit(null); setSheet(null); setView(null);
  }
  // опрос: раз в 4 секунды; 20 секунд после своего сообщения, вызова или «Иду» — чаще (ответ коллеги виден сразу)
  const hotUntil = React.useRef(0), lastPoll = React.useRef(0);
  const heat = () => { hotUntil.current = Date.now() + 20000; };
  React.useEffect(() => {
    pull(true); lastPoll.current = Date.now();
    const t = setInterval(() => {
      if (hidden()) return;
      const gap = Date.now() < hotUntil.current ? POLL_HOT_MS : POLL_OPEN_MS;
      if (Date.now() - lastPoll.current >= gap) { lastPoll.current = Date.now(); pull(false); }
    }, 500);
    const m = setInterval(() => setTick((x) => x + 1), 30000);   // «ждёт 2 мин» у вызовов
    return () => { clearInterval(t); clearInterval(m); };
  }, [pull]);
  // прочитал: последнее видимое — на сервер (не чаще, чем растёт)
  React.useEffect(() => {
    const top = maxId(msgs);
    if (loaded && top > readId.current && stick.current && !hidden()) { readId.current = top; Promise.resolve(api.read(chat.id, top)).catch(() => {}); }
  }, [msgs, loaded, away]);   // eslint-disable-line react-hooks/exhaustive-deps
  // прокрутка: у низа — держимся низа
  const toBottom = (smooth) => { const el = chatRef.current; if (el) { try { el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" }); } catch (e) { el.scrollTop = el.scrollHeight; } } };
  React.useLayoutEffect(() => { if (stick.current) toBottom(false); }, [msgs, pending, loaded]);   // eslint-disable-line react-hooks/exhaustive-deps
  usePinBottom(chatRef);   // v94: клавиатура поднимает низ, поле растёт: последние сообщения остаются на виду
  const onScroll = () => {
    const el = chatRef.current; if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = near; setAway(!near); if (near) setFresh(0);
  };
  const loadOlder = () => {
    const first = msgsRef.current[0]; if (!first) return Promise.resolve(false);
    const el = chatRef.current, h0 = el ? el.scrollHeight : 0, t0 = el ? el.scrollTop : 0;
    return Promise.resolve(api.open(chat.id, { before: first.id })).then((r) => {
      if (!r || !r.ok) return false;
      setMore(!!r.more); moreRef.current = !!r.more;
      stick.current = false;
      addMsgs(r.msgs, { quiet: true });
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - h0 + t0; });
      return true;
    }).catch(() => false);
  };
  // к сообщению (цитата, закреп): подгружаем раньше, пока не найдём; подсвечиваем
  const jumpTo = async (id, deep = false) => {   // v99: deep — из поиска: сообщение может быть и месяц назад
    if (id == null) return;
    const has = () => msgsRef.current.some((m) => String(m.id) === String(id));
    for (let i = 0; i < (deep ? 40 : 8) && !has() && moreRef.current; i++) { if (!(await loadOlder())) break; }
    if (!has()) { setErr("Этого сообщения уже нет в переписке."); return; }
    stick.current = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = chatRef.current && chatRef.current.querySelector('[data-chat-msg="' + id + '"]');
      if (el) { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { el.scrollIntoView(); } }
      setHl(String(id)); setTimeout(() => setHl((h) => (h === String(id) ? null : h)), 1800);
    }));
  };
  // v97: ссылка из Telegram на сообщение (?go=chat_<чат>_<сообщение>) — к нему, когда переписка загрузилась
  const jumped = React.useRef(false);
  React.useEffect(() => { if (loaded && init && init.msg && !jumped.current) { jumped.current = true; jumpTo(init.msg, !!init.deep); } }, [loaded]);   // eslint-disable-line react-hooks/exhaustive-deps
  // v99 (Доп. 412): черновик: на что отвечал — когда переписка загрузилась; текст пишется по ходу (не во время правки) и
  // при выходе из переписки; после отправки — стирается
  React.useEffect(() => {
    const d = draft0.current;
    if (!loaded || !d || d.r == null) return;
    draft0.current = { ...d, r: null };
    const q = msgsRef.current.find((x) => String(x.id) === String(d.r));
    if (q && !q.del) setReply(q);
  }, [loaded]);   // eslint-disable-line react-hooks/exhaustive-deps
  const live = React.useRef({}); live.current = { text, reply, edit };
  React.useEffect(() => {
    if (edit) return undefined;
    const t = setTimeout(() => draftSet(meId, chat.id, text, reply ? reply.id : null), 300);
    return () => clearTimeout(t);
  }, [text, reply, edit]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => () => {
    const v = live.current, st = stashRef.current;
    if (!v.edit) draftSet(meId, chat.id, v.text, v.reply ? v.reply.id : null);
    else if (st) draftSet(meId, chat.id, st.t, st.reply ? st.reply.id : null);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => { if (text && inputRef.current) grow(inputRef.current); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // отправка: сразу в ленту (часики), сервер ответил — настоящее сообщение
  const fail = (t) => setPending((p) => p.map((x) => (x.tmp === t ? { ...x, failed: true } : x)));
  const sendErr = (r) => setErr(r && r.error === "too_fast" ? "Слишком часто: подожди минуту." : r && r.error === "photo_limit" ? "На сегодня фото в чате уже много. Завтра можно снова."
    : r && r.error === "too_big" ? "Фото слишком большое." : "");
  const deliver = (item) => {
    const t = item.tmp;
    setPending((p) => [...p.filter((x) => x.tmp !== t), { ...item, failed: false }]);
    stick.current = true;
    const q = item.photo
      ? api.photoSend(chat.id, { full: item.photo.full, thumb: item.photo.thumb, w: item.photo.w, h: item.photo.h, body: item.body, reply: item.reply ? item.reply.id : null })
      : api.send(chat.id, item.body, item.reply ? item.reply.id : null);
    return Promise.resolve(q).then((r) => {
      if (r && r.ok && r.msg) {
        if (item.photo && r.msg.photo) { rememberPhoto(r.msg.photo.id, false, item.photo.thumbUrl); rememberPhoto(r.msg.photo.id, true, item.photo.fullUrl); }
        setPending((p) => p.filter((x) => x.tmp !== t)); addMsgs([r.msg], { quiet: true }); heat(); if (onSent) onSent();
        if (!item.photo && askAi(item.body)) askMentor(r.msg, item.body);   // v93: «@Наставник …» — ответ в переписку
        return r.msg;
      }
      fail(t); sendErr(r); return null;
    }).catch(() => { fail(t); return null; });
  };
  // v93: Наставник в переписке — вопрос уходит ИИ, ответ видят все в этом чате
  const askMentor = (m, body) => {
    if (!api.aiAsk) return;
    setAiWait((n) => n + 1); stick.current = true;
    Promise.resolve(api.aiAsk(chat.id, m.id, aiQuestion(body))).then((r) => {
      setAiWait((n) => Math.max(0, n - 1));
      if (r && r.ok && r.msg) { stick.current = true; addMsgs([r.msg], { quiet: true }); heat(); } else flash(smartErr(r));
    }).catch(() => { setAiWait((n) => Math.max(0, n - 1)); flash(smartErr({ error: "net" })); });
  };
  const toastT = React.useRef(0);
  const flash = (s) => { setToast(s); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 3200); };
  // v93: карточка ушла (из листа «+»): в ленту сразу
  const cardDone = (msg) => { setSheet(null); if (msg) { stick.current = true; addMsgs([msg], { quiet: true }); heat(); if (onSent) onSent(); } };
  // v93: кнопки на карточках
  const onAct = (m, a, extra) => {
    // ответ сервера: карточка как есть (и при «уже забрали» — тоже, чтобы кнопка пропала)
    const upd = (q, ctx = "") => { setCardBusy(m.id); return Promise.resolve(q).then((r) => { setCardBusy(null); if (r && r.msg) addMsgs([r.msg], { quiet: true }); if (r && r.ok) { heat(); return r; } flash(smartErr(r, ctx)); return null; })
      .catch(() => { setCardBusy(null); flash(smartErr({ error: "net" })); return null; }); };
    if (a === "open") { if (app && app.open) app.open(extra); else flash("Откроется в приложении"); return; }
    if (a === "take") { upd(api.shiftTake(m.id)).then((r) => { if (r) flash("Смена твоя, график обновлён"); }); return; }
    if (a === "need") { upd(api.shiftTake(m.id)).then((r) => { if (r) flash("Ты выходишь в смену, график обновлён"); }); return; }   // v97: «Ищем в смену» — «Выйду»
    if (a === "swap") { setSheet({ swap: m }); return; }
    if (a === "cancel") { upd(api.shiftCancel(m.id)); return; }
    if (a === "remind") {
      upd(api.taskRemind(m.id), "remind").then((r) => {
        if (!r) return;
        const n = Number(r.n) || 0, sent = r.sent == null ? n : Number(r.sent) || 0;
        flash(!n ? "Все уже прошли" : sent >= n ? "Напомнили: " + n : sent ? "Напомнили в Telegram: " + sent + " из " + n : "Telegram у них не подключён: напомни в чате");
      });
      return;
    }
    if (a === "who") { setWhoOpen((s) => new Set(s).add(String(m.id))); return; }   // список не закрывается, когда карточка обновилась
    if (a === "vote") { addMsgs([{ id: m.id, card: { ...(m.card || {}), votes: withVote((m.card || {}).votes, extra, me) } }], { quiet: true }); upd(api.pollVote(m.id, extra)); return; }
    if (a === "unstop") { const d = (m.card || {}).dish || {}; upd(api.stopSet(chat.id, d, false, null, m.id)); return; }
    if (a === "lateok") { upd(api.lateOk(m.id)).then((r) => { if (r) flash("Принято. " + bubbleName(m.name).split(" ")[0] + " увидит это на карточке"); }); }   // v99
    if (a === "greet" && api.greet) {   // v107: «Поздороваться», «Поздравить» — своё имя на карточке сразу
      const cd = m.card || {};
      addMsgs([{ id: m.id, card: { ...cd, greet: [...(Array.isArray(cd.greet) ? cd.greet : []), { id: me && me.id, n: me && me.name }] } }], { quiet: true });
      upd(api.greet(m.id));
    }
  };
  // v93: подсказки над строкой ввода и плитки «+»
  const onTile = (k) => {
    if (k === "photo") { setSheet(null); pickPhoto(); return; }
    if (k === "late") { setSheet("late"); return; }   // v99 (Доп. 412)
    if (k === "give" || k === "swap") { setSheet({ shift: k }); return; }
    if (k === "poll") { setSheet({ poll: text.trim() }); return; }
    if (k === "ai") {
      setSheet(null);
      setText((t) => (askAi(t) ? t : "@" + AI_NAME + " " + t.trim()).replace(/\s+$/, "") + " ");
      setTimeout(() => { const el = inputRef.current; if (el) { el.focus(); grow(el); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* */ } } }, 30);
      return;
    }
    setSheet(k);   // task, share, stop, brief
  };
  const send = () => {
    const body = cleanBody(text);
    if (!body) return;
    vibrate("light"); setText(""); setCaret(0); setErr(""); draftClear(meId, chat.id);
    if (inputRef.current) { inputRef.current.style.height = ""; inputRef.current.focus(); }
    const r = reply; setReply(null);
    deliver({ tmp: "t" + Date.now(), body, at: new Date().toISOString(), reply: r ? replyOf(r) : null, photo: null });
  };
  const sugg = React.useMemo(() => (edit || !text.trim() ? [] : intents(text, me, chat.kind)), [text, edit, me, chat.kind]);
  // v99 (Доп. 412): «@» — подсказки: участники (имя, у тёзок с буквой фамилии), «все» у руководителя, Наставник
  const names = React.useMemo(() => mentionNames(members), [members]);
  const leadIds = React.useMemo(() => new Set((members || []).filter((p) => isLeadPos(p.pos)).map((p) => String(p.id))), [members]);
  const mq = !edit && text.indexOf("@") >= 0 ? mentionQuery(text, caret) : null;
  const msugg = mq ? mentionSuggest(names, mq.q, { meId, lead: !!(me && me.lead), group, ai: true }) : [];
  const pickMention = (it) => {
    if (!mq) return;
    vibrate("light");
    const r = mentionInsert(text, mq.start, caret, it.disp);
    setText(r.text); setCaret(r.caret);
    try { if (inputRef.current) inputRef.current.focus(); } catch (e) { /* */ }   // в том же нажатии: клавиатура не прячется
    setTimeout(() => { const el = inputRef.current; if (el) { grow(el); try { el.setSelectionRange(r.caret, r.caret); } catch (e) { /* */ } } }, 20);
  };
  const onCaret = (e) => { try { setCaret(e.target.selectionStart == null ? e.target.value.length : e.target.selectionStart); } catch (x) { /* */ } };
  // правка своего: в строке ввода, «Сохранить» — галочкой
  // v99: на время правки черновик откладывается и потом возвращается в строку ввода
  const startEdit = (m) => { if (!edit) stashRef.current = { t: text, reply }; setReply(null); setEdit(m); setText(m.body || ""); setTimeout(() => { const el = inputRef.current; if (el) { el.focus(); grow(el); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* */ } } }, 30); };
  const unstash = () => {
    const st = stashRef.current; stashRef.current = null;
    setText(st ? st.t : ""); setCaret(st ? st.t.length : 0); if (st && st.reply) setReply(st.reply);
    if (inputRef.current) inputRef.current.style.height = "";
    if (st && st.t) setTimeout(() => grow(inputRef.current), 20);
  };
  const cancelEdit = () => { setEdit(null); unstash(); };
  const saveEdit = () => {
    const m = edit; if (!m) return;
    const body = cleanBody(text);
    if (!body && m.kind !== "photo") return;
    vibrate("light");
    setEdit(null); setErr(""); unstash();
    if (body === String(m.body || "")) return;
    addMsgs([{ id: m.id, body, edited: true }], { quiet: true });
    Promise.resolve(api.edit(m.id, body)).then((r) => {
      if (r && r.ok && r.msg) addMsgs([r.msg], { quiet: true });
      else { addMsgs([{ id: m.id, body: m.body, edited: m.edited }], { quiet: true }); setErr(r && r.error === "too_late" ? "Править можно в течение суток." : "Правка не сохранилась. Проверь связь."); }
    }).catch(() => { addMsgs([{ id: m.id, body: m.body, edited: m.edited }], { quiet: true }); setErr("Нет связи: правка не сохранилась."); });
  };
  const fine = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  const onKey = (e) => { if (fine && e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (edit) saveEdit(); else send(); } };
  const grow = (el) => { if (!el) return; el.style.height = "auto"; el.style.height = Math.min(132, el.scrollHeight + 2) + "px"; };
  const startReply = (m) => { if (!m || m.del) return; vibrate("light"); if (edit) cancelEdit(); setReply(m); setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 30); };
  const react = (m, r) => {
    const next = myReact(m, meId) === r ? null : r;
    addMsgs([{ id: m.id, reacts: withReact(m.reacts, next, me) }], { quiet: true });
    Promise.resolve(api.react(m.id, next)).then((x) => { if (x && x.ok && x.msg) addMsgs([x.msg], { quiet: true }); }).catch(() => {});
  };
  const pinMsg = (m) => Promise.resolve(api.pin(chat.id, m ? m.id : null)).then((r) => {
    if (r && r.ok) { pinKey.current = JSON.stringify(r.pin || null); setPin(r.pin || null); if (r.msg) { stick.current = true; addMsgs([r.msg], { quiet: true }); } heat(); }
    else setErr(r && r.error === "forbidden" ? "Закреплять может руководитель или старший." : "Не получилось. Проверь связь.");
  }).catch(() => setErr("Нет связи. Попробуй ещё раз."));
  const go = (m) => {
    if (busyGo) return;
    vibrate("medium"); setBusyGo(m.id);
    Promise.resolve(api.go(m.id)).then((r) => { setBusyGo(null); if (r && r.ok && r.msg) { addMsgs([r.msg], { quiet: true }); heat(); } }).catch(() => setBusyGo(null));
  };
  // v91 (Доп. 404): очистить чат целиком у всех
  const clearChat = () => {
    if (clearBusy) return;
    vibrate("medium"); setClearBusy(true); setClearErr("");
    Promise.resolve(api.clear(chat.id)).then((r) => {
      setClearBusy(false);
      if (r && r.ok) {
        cleared.current = r.cleared || null;
        if (edit && inputRef.current) inputRef.current.style.height = "";
        if (edit) setText("");
        wipe(); stick.current = true;
        heat(); if (onSent) onSent();
      } else setClearErr(r && r.error === "forbidden" ? "Очистить этот чат может руководитель или старший." : "Не получилось очистить. Проверь связь.");
    }).catch(() => { setClearBusy(false); setClearErr("Нет связи. Попробуй ещё раз."); });
  };
  const del = (m) => Promise.resolve(api.del(m.id)).then((r) => {
    if (r && r.ok) { setSheet(null); addMsgs([{ id: m.id, del: true, body: "", photo: null, reacts: [] }], { quiet: true }); if (pin && String(pin.id) === String(m.id)) { pinKey.current = "null"; setPin(null); } }
  });
  // фото: выбрать → сжать → подпись → отправить
  const pickPhoto = () => { vibrate("light"); const el = fileRef.current; if (el) { el.value = ""; el.click(); } };
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setCaption(text.trim() && !edit ? text : "");
    setShot({ busy: true });
    compressPhoto(f).then((d) => setShot({ ...d, busy: false })).catch((x) => {
      setShot(null);
      setErr(x && x.message === "big" ? "Фото слишком большое: выбери другое." : "Это фото не открылось. Попробуй другое (JPEG или PNG).");
    });
  };
  const sendShot = () => {
    if (!shot || shot.busy) return;
    vibrate("light");
    const body = cleanBody(caption), r = reply;
    if (body && cleanBody(text) === body) setText("");
    setShot(null); setCaption(""); setReply(null); setErr("");
    deliver({ tmp: "p" + Date.now(), body, at: new Date().toISOString(), reply: r ? replyOf(r) : null, photo: { full: shot.full, thumb: shot.thumb, w: shot.w, h: shot.h, thumbUrl: shot.thumbUrl, fullUrl: shot.fullUrl } });
  };
  // Escape: закрыть верхний слой
  React.useEffect(() => {
    const k = (e) => {
      if (e.key !== "Escape") return;
      if (view) setView(null); else if (shot) setShot(null); else if (sheet) setSheet(null); else if (edit) cancelEdit(); else if (reply) setReply(null); else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  // кто сколько прочитал: участники и их последнее прочитанное
  const reads = Object.fromEntries((members || []).map((p) => [p.id, p.read || 0]));
  const others = (members || []).filter((p) => String(p.id) !== String(meId));
  const myLast = [...msgs].reverse().find((m) => String(m.emp) === String(meId) && m.kind !== "call" && m.kind !== "sys" && !m.del);
  const rows = feedRows(msgs, meId, group);
  void tick;
  const now = Date.now();
  const status = group ? (members.length ? peopleWord(members.length) + (chat.kind === "net" ? " · все заведения" : chat.shift ? " · в смене " + chat.shift : "") : "")
    : [posName(chat.peer && chat.peer.pos), chat.peer && chat.peer.shift ? "сегодня в смене" : ""].filter(Boolean).join(" · ") || "личная переписка";
  const over = text.length > CHAT_MAX;
  const layer = !!(view || shot || sheet);
  const renderRow = (row) => {
    if (row.type === "day") return <div key={row.key} className="ch-day" data-chat-day="">{row.label}</div>;
    const m = row.m;
    const isHl = hl != null && String(m.id) === hl;
    if (m.kind === "sys") {
      const to = m.reply && m.reply.id;
      // v93: строка для руководителей о передаче или обмене смены (без подтверждения, но на виду)
      if (m.card && m.card.t === "log") return (
        <div key={row.key} className={"ch-row mid" + (isHl ? " hl" : "")} data-chat-msg={m.id}>
          <div className="ch-sys log" data-chat-sys="log">{m.card.mode === "swap" ? IC.swap : IC.give}<span>{m.body}</span></div>
        </div>);
      return (
        <div key={row.key} className={"ch-row mid" + (isHl ? " hl" : "")} data-chat-msg={m.id}>
          <button type="button" className="ch-sys" data-chat-sys="" onClick={() => { if (to) jumpTo(to); }}>{IC.pinS}<span>{m.body}</span></button>
        </div>);
    }
    if (m.kind === "call") return <CallCard key={row.key} row={row} me={me} now={now} busyGo={busyGo} hl={isHl} onGo={go} onMenu={(x) => setSheet({ msg: x })} onReply={startReply} onReact={react} />;
    if (m.kind === "card") return <CardMsg key={row.key} row={row} me={me} app={app} busy={cardBusy === m.id} hl={isHl} showWho={whoOpen.has(String(m.id))} onAct={onAct} onMenu={(x) => setSheet({ msg: x })} />;   // v93
    if (m.kind === "ai") return <AiMsg key={row.key} row={row} me={me} hl={isHl} onAct={onAct} onMenu={(x) => setSheet({ msg: x })} />;
    return <Bubble key={row.key} row={row} me={me} api={api} reads={reads} myLastId={myLast && myLast.id} othersN={others.length} group={group} net={chat.kind === "net"} hl={isHl}
      onMenu={(x) => setSheet({ msg: x })} onReply={startReply} onReact={react} onJump={jumpTo} onView={setView} onWho={api.person ? (x) => setSheet({ person: String(x.emp) }) : null}
      names={names} leadIds={leadIds} />;
  };
  // v92: добавить людей в свой чат — на весь экран вместо переписки (хуки — выше)
  // v99 (Доп. 412): поиск в этом чате — на весь экран вместо переписки; нашёл — к сообщению (подгружая раньше)
  if (sheet === "search" && api.search) return <SearchView api={api} me={me} chats={[chat]} chat={chat} onBack={() => setSheet(null)}
    onPick={(cid, mid) => { setSheet(null); stick.current = false; setTimeout(() => jumpTo(mid, true), 30); }} />;
  if (sheet === "add") return <GroupAdd me={me} api={api} chat={chat} members={members} onBack={() => setSheet("info")}
    onDone={() => { setSheet(null); if (onSent) onSent(); if (pullRef.current) pullRef.current(false); }} />;
  return (<>
    <header className="ch-head">
      <div className="ch-head-in">
        <button type="button" className="ch-back" data-sa-back={layer ? undefined : ""} aria-label="К списку чатов" onClick={onBack}>{IC.back}</button>
        {chat.kind === "group"
          ? <button type="button" className="ch-who ch-whob" data-chat-info="" aria-label={"О чате «" + chatTitle(chat) + "»: участники"} onClick={() => { vibrate("light"); setSheet("info"); }}>
              <Ava c={chat} /><div className="ch-id"><b className="ch-title" data-chat-title="">{chatTitle(chat)}</b><span className="ch-st">{status}{status ? " · участники" : ""}</span></div></button>
          : chat.kind === "dm" && chat.peer && api.person
            // v97: личная переписка — нажатие на шапку открывает карточку коллеги
            ? <button type="button" className="ch-who ch-whob" data-chat-peer={chat.peer.id} aria-label={"Коллега: " + chatTitle(chat)} onClick={() => { vibrate("light"); setSheet({ person: String(chat.peer.id) }); }}>
                <Ava c={chat} /><div className="ch-id"><b className="ch-title" data-chat-title="">{chatTitle(chat)}</b><span className="ch-st">{status}</span></div></button>
            : <div className="ch-who"><Ava c={chat} /><div className="ch-id"><b className="ch-title" data-chat-title="">{chatTitle(chat)}</b><span className="ch-st">{status}</span></div></div>}
        {api.search ? <button type="button" className="ch-tool" data-chat-tsearch="" aria-label="Поиск в этом чате" onClick={() => { vibrate("light"); setSheet("search"); }}>{IC.search}</button> : null}
        {canClear(chat, me) ? <button type="button" className="ch-tool" data-chat-clear="" aria-label={group ? "Очистить чат" : "Очистить переписку"}
          onClick={() => { vibrate("light"); setClearErr(""); setSheet("clear"); }}>{IC.trash}</button> : null}
      </div>
    </header>
    {group && pin ? (
      <div className="ch-pin" data-chat-pinbar={pin.id}>
        <div className="ch-pin-in">
          <button type="button" className="ch-pin-b" onClick={() => jumpTo(pin.id)} aria-label={"Закреплённое сообщение: " + quoteText(pin, meId) + ". Показать в переписке"}>
            <span className="ch-pin-bar" aria-hidden="true" />
            <span className="ch-pin-c"><span className="ch-pin-l">{IC.pinS}Закреплено</span><span className="ch-pin-t">{bubbleName(pin.name).split(" ")[0]}: {quoteText(pin, meId)}</span></span>
          </button>
          {canPin(chat, me) ? <button type="button" className="ch-x" data-chat-unpin="" aria-label="Открепить" onClick={() => { vibrate("light"); pinMsg(null); }}>{IC.x}</button> : null}
        </div>
      </div>) : null}
    <div className="ch-chatwrap sa-dlgpath">
      {/* v96: лента едет с клавиатурой трансформом внутри рамки .ch-chatwrap (уходит под шапку, не налезая) — ui/keyboard.js */}
      <div ref={chatRef} className="ch-chat sa-dlgscroll" role="log" aria-live="polite" aria-relevant="additions" onScroll={onScroll} data-chat-feed="" data-kbm="" data-kbm-scroll="">
        <div className="ch-feed">
          {more ? <button type="button" className="ch-more" onClick={() => loadOlder()}>Показать раньше</button> : null}
          {!loaded && !err ? <div className="ch-day">Загружаю…</div> : null}
          {loaded && !rows.length && !pending.length ? <div className="ch-day">{group ? "Здесь пока тихо. Напиши первым." : "Напиши первым: " + chatTitle(chat).split(" ")[0] + " увидит сообщение у себя."}</div> : null}
          {rows.map(renderRow)}
          {aiWait ? <AiTyping /> : null}
          {pending.map((p) => {
            const box = p.photo ? photoBox(p.photo.w, p.photo.h) : null;
            return (
              <div key={p.tmp} className="ch-row out tail" data-chat-pending={p.failed ? "failed" : "1"}>
                <div className={"ch-b ch-out" + (p.photo ? " ph" : "")} style={{ opacity: p.failed ? 0.7 : 0.9, ...(p.photo ? { width: box.w + 6 } : {}) }}>
                  {p.reply ? <Quote q={p.reply} me={me} /> : null}
                  {p.photo ? <span className="ch-ph" style={{ width: box.w, height: box.h }}><img src={p.photo.thumbUrl} alt="" />{!p.failed ? <span className="ch-ph-up"><span className="ch-spin" /></span> : null}</span> : null}
                  {!p.photo || p.body ? <span className="ch-tx">{p.body}<i className="ch-sp" aria-hidden="true" /></span> : null}
                  <span className={"ch-meta" + (p.photo && !p.body ? " on-ph" : "")} aria-hidden="true">{p.failed ? "!" : hhmm(p.at)}</span>
                </div>
                {p.failed ? <button type="button" className="ch-fail" onClick={() => deliver(p)}>Не отправлено. Повторить</button> : null}
              </div>);
          })}
        </div>
      </div>
      {away ? <button type="button" className="ch-down" data-kbm="" aria-label="К последним сообщениям" onClick={() => { stick.current = true; setAway(false); setFresh(0); toBottom(true); }}>
        {IC.down}{fresh ? <span className="ch-badge">{badge(fresh)}</span> : null}</button> : null}
    </div>
    <div className="ch-bar" data-kbm="" data-kbm-at="">
      {err ? <div className="ch-err" role="alert">{err}</div> : null}
      {reply ? (
        <div className="ch-ctx" data-chat-replybar={reply.id}>
          {IC.reply}
          <span className="ch-ctx-b"><span className="ch-ctx-l">Ответ: {whoName(reply, me)}</span><span className="ch-ctx-t">{quoteText(reply, meId)}</span></span>
          <button type="button" className="ch-x" aria-label="Не отвечать" data-chat-noreply="" onClick={() => setReply(null)}>{IC.x}</button>
        </div>) : null}
      {edit ? (
        <div className="ch-ctx" data-chat-editbar={edit.id}>
          {IC.pen}
          <span className="ch-ctx-b"><span className="ch-ctx-l">{edit.kind === "photo" ? "Правка подписи" : "Правка сообщения"}</span><span className="ch-ctx-t">{quoteText(edit, meId)}</span></span>
          <button type="button" className="ch-x" aria-label="Отменить правку" data-chat-noedit="" onClick={cancelEdit}>{IC.x}</button>
        </div>) : null}
      {msugg.length ? (
        <div className="ch-mb" role="listbox" aria-label="Кого упомянуть" data-chat-mentions="">
          {msugg.map((it) => (
            <button key={it.kind + it.id} type="button" role="option" aria-selected="false" className="ch-mc" data-chat-mention={it.kind === "person" ? it.id : it.kind} onMouseDown={(e) => e.preventDefault()} onClick={() => pickMention(it)}>
              <span className={"ch-ava" + (it.kind === "person" ? "" : " team")} aria-hidden="true">{it.kind === "all" ? IC.team : it.kind === "ai" ? IC.ai : chatInitials(it.name)}</span>
              {it.kind === "all" ? "Все" : it.disp}</button>))}
        </div>)
        : !edit ? <Suggest items={sugg} onPick={(k) => (k === "stop" || k === "give" || k === "swap" || k === "poll" || k === "ai" ? onTile(k) : null)} /> : null}
      <div className="ch-bar-in" style={{ position: "relative" }}>
        {text.length > CHAT_MAX - 100 ? <span className={"ch-count" + (over ? " over" : "")}>{text.length} / {CHAT_MAX}</span> : null}
        {chat.kind === "team" && !edit ? <button type="button" className="ch-bell" data-chat-callbtn="" aria-label="Позвать" onClick={() => { vibrate("light"); setSheet("call"); }}>{IC.bell}</button> : null}
        <div className="ch-fieldwrap">
          <textarea ref={inputRef} className={"ch-input sa-field" + (edit ? "" : " clip")} rows={1} value={text} maxLength={CHAT_MAX + 200} placeholder={edit ? (edit.kind === "photo" ? "Подпись к фото" : "Сообщение") : "Сообщение"}
            aria-label={edit ? "Правка сообщения" : "Сообщение"} data-chat-input="" onChange={(e) => { setText(e.target.value); onCaret(e); grow(e.target); }} onKeyDown={onKey}
            onSelect={onCaret} onKeyUp={onCaret} onClick={onCaret} />
          {!edit ? <button type="button" className="ch-attach" data-chat-attach="" aria-label="Фото, смена, задание, опрос и другое" onClick={() => { vibrate("light"); setSheet("act"); }}>{IC.more}</button> : null}
        </div>
        {edit ? <button type="button" className="ch-send" data-chat-save="" aria-label="Сохранить правку" disabled={over || (!text.trim() && edit.kind !== "photo")} onClick={saveEdit}>{IC.check}</button>
          : text.trim() ? <button type="button" className="ch-send" data-chat-send="" aria-label="Отправить" disabled={over} onClick={send}>{IC.send}</button>
          : stt ? <span data-chat-mic=""><MicButton a11y={a11y} size={42} sttUrl={stt.url} headers={stt.headers} onText={(x) => { setText((t) => (t.trim() ? t.trim() + " " : "") + String(x || "").trim()); }} onError={(e) => setErr(e)} /></span> : null}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} data-chat-file="" tabIndex={-1} aria-hidden="true" />
      </div>
    </div>
    {sheet === "call" ? <CallSheet me={me} api={api} chat={chat} onClose={() => setSheet(null)} onDone={(msg) => { setSheet(null); if (msg) { stick.current = true; addMsgs([msg], { quiet: true }); heat(); } }} /> : null}
    {sheet === "info" ? <GroupInfo chat={chat} me={me} api={api} members={members} onClose={() => setSheet(null)} onAdd={() => setSheet("add")} onGone={(why) => { setSheet(null); if (onGone) onGone(why); }}
      onChanged={() => { if (onSent) onSent(); if (pullRef.current) pullRef.current(false); }} /> : null}
    {sheet === "clear" ? <ClearSheet chat={chat} busy={clearBusy} err={clearErr} onClear={clearChat} onClose={() => { if (!clearBusy) setSheet(null); }} /> : null}
    {sheet === "act" ? <ActSheet me={me} chat={chat} onPick={onTile} onClose={() => setSheet(null)} /> : null}
    {sheet && sheet.shift ? <ShiftSheet api={api} chat={chat} mode={sheet.shift} date={sheet.date || null} onClose={() => setSheet(null)} onDone={cardDone} /> : null}
    {sheet && sheet.swap ? <SwapSheet api={api} msg={msgs.find((x) => String(x.id) === String(sheet.swap.id)) || sheet.swap} onClose={() => setSheet(null)} onDone={(m) => { cardDone(m); flash("Поменялись, график обновлён"); }} /> : null}
    {sheet === "task" ? <TaskSheet app={app} api={api} chat={chat} onClose={() => setSheet(null)} onDone={cardDone} /> : null}
    {sheet && sheet.person ? <PersonSheet api={api} emp={sheet.person} chat={chat} onClose={() => setSheet(null)} onDm={onDm} /> : null}
    {sheet === "share" ? <ShareSheet app={app} api={api} chat={chat} onClose={() => setSheet(null)} onDone={cardDone} /> : null}
    {sheet && typeof sheet.poll === "string" ? <PollSheet api={api} chat={chat} q0={sheet.poll} onClose={() => setSheet(null)} onDone={(m) => { cardDone(m); setText(""); }} /> : null}
    {sheet === "stop" ? <StopSheet app={app} api={api} chat={chat} onClose={() => setSheet(null)} onDone={cardDone} /> : null}
    {sheet === "brief" ? <BriefSheet app={app} api={api} chat={chat} onClose={() => setSheet(null)} onDone={cardDone} /> : null}
    {sheet === "late" && api.late ? <LateSheet api={api} chat={chat} onClose={() => setSheet(null)}
      onDone={(m, r) => { cardDone(m); flash(r && Number(r.sent) > 0 ? "Руководитель получил сообщение в Telegram" : "Карточка в чате: руководитель увидит её здесь"); }} /> : null}
    {toast && !sheet ? <div className="ch-toast" role="status" data-chat-toast="">{toast}</div> : null}
    {sheet && sheet.msg ? <MsgSheet me={me} msg={msgs.find((x) => String(x.id) === String(sheet.msg.id)) || sheet.msg} chat={chat} members={others} reads={reads} pinned={pin}
      onClose={() => setSheet(null)} onDelete={del} onReply={startReply} onEdit={startEdit} onPin={pinMsg} onReact={react} /> : null}
    {shot ? <PhotoSheet shot={shot} caption={caption} onCaption={setCaption} reply={reply} me={me} onSend={sendShot} onClose={() => setShot(null)} /> : null}
    {view ? <Viewer api={api} msg={view} me={me} onClose={() => setView(null)} /> : null}
  </>);
}

// ── «Позвать» ──
function CallSheet({ me, api, chat, onClose, onDone }) {
  const [who, setWho] = React.useState("");
  const [person, setPerson] = React.useState(null);
  const [why, setWhy] = React.useState("");
  const [table, setTable] = React.useState("");
  const [own, setOwn] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const call = { who, emp: person && person.id, toName: person && person.name, why, table, text: own };
  const problem = callProblem(call);
  const preview = !problem ? callLine({ name: (me && me.name) || "Ты", emp: me && me.id, call }, null).replace(/^\S+ зовёт /, "Позовёшь ") : "";
  const submit = () => {
    if (problem || busy) { if (problem) setErr(problem); return; }
    setBusy(true); setErr(""); vibrate("medium");
    Promise.resolve(api.call({ chat: chat.id, who, emp: person ? person.id : null, why, table: why === "table" ? String(table).trim() : "", text: why === "own" ? own.trim() : "" })).then((r) => {
      setBusy(false);
      if (r && r.ok) onDone(r.msg || null);
      else setErr(r && r.error === "too_fast" ? "Ты уже звал(а) только что: подожди минуту." : "Не отправилось. Проверь связь и попробуй ещё раз.");
    }).catch(() => { setBusy(false); setErr("Нет связи. Попробуй ещё раз."); });
  };
  return (
    <div className="ch-veil" data-kbm="" onClick={onClose}>
      <div className="ch-sheet" role="dialog" aria-modal="true" aria-label="Позвать" data-chat-callsheet="" onClick={stop}>
        <div className="ch-grip" aria-hidden="true" />
        <div className="ch-sheet-h"><span className="ch-sheet-t">Позвать</span><button type="button" className="ch-x" data-sa-back="" aria-label="Закрыть" onClick={onClose}>{IC.x}</button></div>
        <div style={{ fontSize: 13.5, color: "var(--sub)", lineHeight: 1.45 }}>Вызов увидит вся команда, а тот, кого зовёшь, получит его сразу и ответит «Иду».</div>
        <div className="ch-lbl">Кого</div>
        <div className="ch-chips" role="radiogroup" aria-label="Кого позвать">
          {CALL_WHO.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={who === id} className="ch-chip" data-chat-who={id} onClick={() => { vibrate("light"); setWho(id); setPerson(null); setErr(""); }}>{label}</button>)}
          <button type="button" role="radio" aria-checked={who === "person"} className="ch-chip" data-chat-who="person" onClick={() => { vibrate("light"); setWho("person"); setErr(""); }}>{person ? person.name.split(" ")[0] : "Человека"}</button>
        </div>
        {who === "person" ? <div style={{ marginTop: 8, maxHeight: 220, overflowY: "auto", borderRadius: 14, border: "1px solid var(--edge)" }} className="sa-dlgscroll">
          <People me={me} api={api} inline picked={person && person.id} onPick={(p) => { setPerson(p); setErr(""); }} />
        </div> : null}
        <div className="ch-lbl">Зачем</div>
        <div className="ch-chips" role="radiogroup" aria-label="Зачем">
          {CALL_WHY.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={why === id} className="ch-chip" data-chat-why={id} onClick={() => { vibrate("light"); setWhy(id); setErr(""); }}>{label}</button>)}
        </div>
        {why === "table" ? <input className="ch-field num sa-field" inputMode="numeric" value={table} maxLength={6} placeholder="Номер стола" aria-label="Номер стола" data-chat-table="" onChange={(e) => { setTable(e.target.value); setErr(""); }} /> : null}
        {why === "own" ? <input className="ch-field sa-field" value={own} maxLength={CALL_OWN_MAX} placeholder="Например: принеси детский стульчик" aria-label="Зачем зовёшь" data-chat-own="" onChange={(e) => { setOwn(e.target.value); setErr(""); }} /> : null}
        {preview ? <div className="ch-preview" data-chat-preview="">{preview}</div> : null}
        {err ? <div className="ch-err" role="alert" style={{ marginTop: 10, padding: 0 }}>{err}</div> : null}
        <button type="button" className="ch-main" data-chat-call-send="" disabled={busy} onClick={submit}>{busy ? "Зову…" : "Позвать"}</button>
      </div>
    </div>);
}

// ── сообщение: реакции, ответить, изменить, закрепить, кто прочитал, скопировать, удалить ──
function MsgSheet({ me, msg, chat, members, reads, pinned, onClose, onDelete, onReply, onEdit, onPin, onReact }) {
  const meId = me && me.id, group = chat.kind !== "dm";
  const mine = String(msg.emp) === String(meId);
  const call = msg.kind === "call";
  const net = chat.kind === "net";
  const canDel = mine || canDelOthers(chat, me);
  const [sure, setSure] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const my = myReact(msg, meId), rx = reactGroups(msg.reacts, meId);
  const read = mine && group ? members.filter((p) => Number(reads[p.id] || 0) >= Number(msg.id)) : [];
  const unread = mine && group ? members.filter((p) => Number(reads[p.id] || 0) < Number(msg.id)) : [];
  const isPinned = !!pinned && String(pinned.id) === String(msg.id);
  const copy = () => {
    const done = () => { setCopied(true); vibrate("light"); setTimeout(onClose, 600); };
    try { Promise.resolve(navigator.clipboard.writeText(msg.body || "")).then(done).catch(() => setCopied(false)); } catch (e) { setCopied(false); }
  };
  return (
    <div className="ch-veil" data-kbm="" onClick={onClose}>
      <div className="ch-sheet" role="dialog" aria-modal="true" aria-label="Сообщение" data-chat-msgsheet={msg.id} onClick={stop}>
        <div className="ch-grip" aria-hidden="true" />
        <div className="ch-rbar" role="group" aria-label="Реакция">
          {REACTS.map(([r, label]) => <button key={r} type="button" className="ch-rbtn" aria-pressed={my === r} aria-label={label} title={label} data-chat-react={r}
            onClick={() => { vibrate("light"); onReact(msg, r); onClose(); }}>{ric(r, 24)}</button>)}
        </div>
        <div className="ch-quote">{withRest(whoName(msg, me), mine ? "" : msg.rest, net)}, {hhmm(msg.at)}: {quoteText(msg, meId)}</div>
        {rx.length ? <div className="ch-names" data-chat-reactors="" style={{ padding: "2px 4px 8px" }}>
          {rx.map((g) => <div key={g.r} className="ch-rline">{ric(g.r, 16)}<span><b>{reactName(g.r)}</b>: {g.names.map(bubbleName).join(", ")}</span></div>)}
        </div> : null}
        {mine && group && !call ? <div style={{ padding: "2px 4px 10px" }} data-chat-readers="">
          <div className="ch-lbl" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>{IC.eye}Прочитали: {read.length} из {members.length}</div>
          <div className="ch-names">{read.length ? read.map((p) => withRest(bubbleName(p.name), p.rest, net)).join(", ") : <i>Пока никто</i>}</div>
          {unread.length ? <div className="ch-names" style={{ marginTop: 6 }}><i>Ещё не прочитали: </i>{unread.map((p) => withRest(bubbleName(p.name), p.rest, net)).join(", ")}</div> : null}
        </div> : null}
        <button type="button" className="ch-act" data-chat-reply="" onClick={() => { onClose(); onReply(msg); }}>{IC.reply}Ответить</button>
        {canEdit(msg, meId) ? <button type="button" className="ch-act" data-chat-edit="" onClick={() => { onClose(); onEdit(msg); }}>{IC.pen}{msg.kind === "photo" ? "Изменить подпись" : "Изменить"}</button> : null}
        {canPin(chat, me) && pinnable(msg) ? <button type="button" className="ch-act" data-chat-pin={isPinned ? "off" : "on"} onClick={() => { vibrate("light"); onClose(); onPin(isPinned ? null : msg); }}>
          {IC.pin}{isPinned ? "Открепить" : "Закрепить для всех"}</button> : null}
        {!call && msg.body ? <button type="button" className="ch-act" data-chat-copy="" onClick={copy}>{IC.copy}{copied ? "Скопировано" : "Скопировать текст"}</button> : null}
        {canDel ? <button type="button" className="ch-act bad" data-chat-del="" onClick={() => { if (!sure) { vibrate("light"); setSure(true); return; } onDelete(msg); }}>{IC.trash}{sure ? (mine ? "Точно удалить? Нажми ещё раз" : "Удалить у всех? Нажми ещё раз") : mine ? "Удалить" : "Удалить у всех (как старший)"}</button> : null}
        <button type="button" className="ch-act" data-sa-back="" style={{ justifyContent: "center", color: "var(--sub)" }} onClick={onClose}>Закрыть</button>
      </div>
    </div>);
}

// ── v91 (Доп. 404): очистить чат целиком — переспросить ──
function ClearSheet({ chat, busy, err, onClear, onClose }) {
  const dm = chat.kind === "dm";
  return (
    <div className="ch-veil" data-kbm="" onClick={onClose}>
      <div className="ch-sheet" role="dialog" aria-modal="true" aria-label={dm ? "Очистить переписку" : "Очистить чат"} data-chat-clearsheet="" onClick={stop}>
        <div className="ch-grip" aria-hidden="true" />
        <div className="ch-sheet-h"><span className="ch-sheet-t">{dm ? "Очистить переписку?" : "Очистить «" + chatTitle(chat) + "»?"}</span>
          <button type="button" className="ch-x" data-sa-back="" aria-label="Закрыть" onClick={onClose}>{IC.x}</button></div>
        <div className="ch-clear-t" data-chat-clear-text="">{dm
          ? "Сообщения и фото исчезнут у вас обоих, а переписка уйдёт из списка чатов. Вернуть их нельзя."
          : "Сообщения, фото и закреплённое исчезнут у всех, чат станет пустым. Вернуть переписку нельзя."}</div>
        {err ? <div className="ch-err" role="alert" data-chat-clear-err="">{err}</div> : null}
        <button type="button" className="ch-act bad" data-chat-clear-go="" disabled={busy} style={{ justifyContent: "center" }} onClick={onClear}>{IC.trash}{busy ? "Очищаю…" : dm ? "Очистить переписку" : "Очистить чат"}</button>
        <button type="button" className="ch-act" style={{ justifyContent: "center", color: "var(--sub)" }} onClick={onClose}>Отмена</button>
      </div>
    </div>);
}

// ── фото к отправке: превью и подпись ──
function PhotoSheet({ shot, caption, onCaption, reply, me, onSend, onClose }) {
  return (
    <div className="ch-veil" data-kbm="" onClick={onClose}>
      <div className="ch-sheet" role="dialog" aria-modal="true" aria-label="Фото" data-chat-photosheet="" onClick={stop}>
        <div className="ch-grip" aria-hidden="true" />
        <div className="ch-sheet-h"><span className="ch-sheet-t">Фото</span><button type="button" className="ch-x" data-sa-back="" aria-label="Закрыть" onClick={onClose}>{IC.x}</button></div>
        {shot.busy ? <div className="ch-shotwait">Готовлю фото…</div> : <img className="ch-shot" src={shot.fullUrl} alt="Фото к отправке" />}
        {reply ? <div className="ch-ctx" style={{ marginTop: 10 }}>{IC.reply}<span className="ch-ctx-b"><span className="ch-ctx-l">Ответ: {whoName(reply, me)}</span><span className="ch-ctx-t">{quoteText(reply, me && me.id)}</span></span></div> : null}
        <input className="ch-field sa-field" value={caption} maxLength={CHAT_MAX} placeholder="Подпись (можно без неё)" aria-label="Подпись к фото" data-chat-caption=""
          onChange={(e) => onCaption(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); onSend(); } }} />
        <button type="button" className="ch-main" data-chat-photo-send="" disabled={!!shot.busy} onClick={onSend}>Отправить</button>
        <div className="ch-note" style={{ marginTop: 10, padding: 0 }}>Фото сжимается перед отправкой и хранится 30 дней, как переписка.</div>
      </div>
    </div>);
}

// ── фото на весь экран: щипок и двойное касание — крупнее, вниз — закрыть ──
function Viewer({ api, msg, me, onClose }) {
  const id = msg.photo && msg.photo.id;
  const [src, setSrc] = React.useState(() => photoCached(id, true) || photoCached(id, false));
  React.useEffect(() => {
    if (photoCached(id, true) || id == null) return undefined;
    let alive = true;
    loadPhoto(api, id, true).then((u) => { if (alive && u) setSrc(u); });
    return () => { alive = false; };
  }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [t, setT] = React.useState({ s: 1, x: 0, y: 0 });
  const [dy, setDy] = React.useState(0);
  const tR = React.useRef(t); tR.current = t;
  const dyR = React.useRef(0); dyR.current = dy;
  const P = React.useRef(new Map()), G = React.useRef(null), last = React.useRef(0), box = React.useRef(null);
  const start = () => {
    const pts = [...P.current.values()], t0 = tR.current;
    if (pts.length >= 2) { const [a, b] = pts; G.current = { k: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: t0.s, x0: t0.x, y0: t0.y }; }
    else if (pts.length === 1) G.current = { k: "pan", px: pts[0].x, py: pts[0].y, x0: t0.x, y0: t0.y, moved: false };
    else G.current = null;
  };
  const down = (e) => { P.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* */ } start(); };
  const move = (e) => {
    if (!P.current.has(e.pointerId)) return;
    P.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = G.current, pts = [...P.current.values()];
    if (!g) return;
    if (g.k === "pinch" && pts.length >= 2) {
      const [a, b] = pts, s = Math.min(4, Math.max(1, g.s0 * (Math.hypot(a.x - b.x, a.y - b.y) / g.d0)));
      setT(s <= 1.01 ? { s: 1, x: 0, y: 0 } : { s, x: g.x0, y: g.y0 });
    } else if (g.k === "pan" && pts.length === 1) {
      const ddx = pts[0].x - g.px, ddy = pts[0].y - g.py;
      if (Math.abs(ddx) + Math.abs(ddy) > 6) g.moved = true;
      if (tR.current.s > 1) setT({ s: tR.current.s, x: g.x0 + ddx, y: g.y0 + ddy });
      else setDy(Math.max(0, ddy));
    }
  };
  const up = (e) => {
    const g = G.current;
    P.current.delete(e.pointerId);
    if (g && g.k === "pan" && P.current.size === 0) {
      if (!g.moved) {
        const now = Date.now();
        if (now - last.current < 320) {
          last.current = 0;
          if (tR.current.s > 1) setT({ s: 1, x: 0, y: 0 });
          else { const r = box.current ? box.current.getBoundingClientRect() : null; const cx = r ? r.left + r.width / 2 : e.clientX, cy = r ? r.top + r.height / 2 : e.clientY; setT({ s: 2.5, x: (cx - e.clientX) * 1.5, y: (cy - e.clientY) * 1.5 }); }
        } else last.current = now;
      }
      if (dyR.current > 110) { onClose(); return; }
      setDy(0);
    }
    start();
  };
  const wheel = (e) => { const s = Math.min(4, Math.max(1, tR.current.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); setT(s <= 1.01 ? { s: 1, x: 0, y: 0 } : { ...tR.current, s }); };
  const cap = String(msg.body || "").trim();
  return (
    <div className="ch-view" role="dialog" aria-modal="true" aria-label="Фото" data-chat-viewer={id} style={dy ? { background: "rgba(6,5,3," + Math.max(0.35, 0.97 - dy / 400) + ")" } : undefined}>
      <div className="ch-view-h">
        <button type="button" className="ch-view-btn" data-sa-back="" aria-label="Закрыть фото" onClick={onClose}>{IC.x}</button>
        <div className="ch-view-t"><span className="ch-view-n">{whoName(msg, me)}</span><span className="ch-view-s">{hhmm(msg.at)}</span></div>
        {src ? <a className="ch-view-btn" href={src} download={"фото-" + id + ".jpg"} aria-label="Сохранить фото" data-chat-savephoto="">{IC.save}</a> : null}
      </div>
      <div ref={box} className="ch-view-img" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
        {src ? <img src={src} alt={cap ? "Фото: " + cap : "Фото"} draggable={false}
          style={{ transform: "translate(" + t.x + "px," + (t.y + dy) + "px) scale(" + t.s + ")", transition: P.current.size ? "none" : "transform .2s ease-out" }} /> : <span className="ch-spin" aria-label="Загружаю фото" />}
      </div>
      {cap ? <div className="ch-view-cap">{cap}</div> : null}
    </div>);
}

// ── вызов мне — поверх любого экрана ──
/** call: сообщение-вызов (kind "call"); onGo — «Иду»; onClose — «позже»; onOpen — открыть чат. */
export function CallBanner({ a11y, me, call, onGo, onClose, onOpen, busy = false }) {
  ensureChatCss();
  if (!call) return null;
  return portal(
    <div className={"sa-dlg ch" + (a11y ? " lt" : "")} style={{ position: "static", inset: "auto", background: "none", display: "contents" }}>
      <div className="ch-banner" role="alertdialog" aria-label="Вызов" data-chat-banner={call.id}>
        <span className="ch-ava team" aria-hidden="true" style={{ width: 38, height: 38 }}>{IC.bell}</span>
        <span className="ch-banner-t" {...(onOpen ? { onClick: onOpen, ...onActivate(onOpen), style: { cursor: "pointer" } } : {})}><b>{callLine(call, me && me.id)}</b></span>
        <button type="button" className="ch-go" data-chat-banner-go="" disabled={busy} onClick={onGo}>Иду</button>
        <button type="button" className="ch-x" aria-label="Позже" onClick={onClose}>{IC.x}</button>
      </div>
    </div>);
}
