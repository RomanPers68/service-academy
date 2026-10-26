// tools/claude/chat-demo/entry.jsx — демо чата смены: главная приложения (снимок настоящей сборки v90) со значком чата
// в верхней строке — нажатие открывает настоящий ui/chat.jsx на демо-сервере (demo-api.js). Сборка в одну страницу —
// build.mjs (снимки главной — home-dark.webp и home-light.webp, место значка — HOME_BOX).
import React from "react";
import { createRoot } from "react-dom/client";
import { ChatScreen, CallBanner } from "../../../ui/chat.jsx";
import { demoApi } from "./demo-api.js";
import { badge, unreadTotal } from "../../../lib/chat.js";

/* global __HOME__ */
const HOME = typeof __HOME__ !== "undefined" ? __HOME__ : null;   // { w, h, dark: { src, box }, light: { src, box } }

const prefersLight = () => {
  try {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "light";
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
  } catch (e) { return false; }
};
const IcBell = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>);
const IcMsg = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M4 5h16v10H9l-5 4z" /></svg>);
const IcTheme = ({ light }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {light ? <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>}</svg>);

// главная: снимок, поверх — значок чата с живым числом (как в приложении: золотой кружок в углу)
function Home({ light, total, onOpen, hint }) {
  const ref = React.useRef(null);
  const [k, setK] = React.useState(1);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !HOME) return undefined;
    const f = () => setK(el.getBoundingClientRect().width / HOME.w);
    f();
    let ro = null;
    try { ro = new ResizeObserver(f); ro.observe(el); } catch (e) { window.addEventListener("resize", f); }
    return () => { if (ro) ro.disconnect(); else window.removeEventListener("resize", f); };
  }, []);
  if (!HOME) return null;
  const t = light ? HOME.light : HOME.dark, b = t.box;
  return (
    <div className="phone" ref={ref} style={{ aspectRatio: HOME.w + " / " + HOME.h }}>
      <img src={t.src} alt="Главная приложения Service Academy: значок чата в верхней строке, рядом с поиском" draggable={false} />
      <button type="button" className={"hot" + (hint ? " hint" : "")} data-demo-open="" aria-label={"Открыть чат смены" + (total ? ", непрочитанных: " + total : "")} onClick={onOpen}
        style={{ left: b.x * k, top: b.y * k, width: b.w * k, height: b.h * k, borderRadius: 11 * k }}>
        {total ? <span className="hbadge" data-demo-badge={total} style={{ top: -6 * k, right: -7 * k, minWidth: 16 * k, height: 16 * k, padding: "0 " + 4 * k + "px", borderRadius: 8 * k, fontSize: 10 * k,
          boxShadow: "0 0 0 " + 2 * k + "px " + (light ? "#F3EBDA" : "#16110A") }}>{badge(total)}</span> : null}
      </button>
    </div>);
}

function Demo() {
  const [tick, setTick] = React.useState(0);
  const api = React.useMemo(() => { const a = demoApi({ onChange: () => setTick((x) => x + 1) }); try { window.__demoApi = a; } catch (e) { /* */ } return a; }, []);
  const [open, setOpen] = React.useState(false);
  const [opened, setOpened] = React.useState(false);
  const [openId, setOpenId] = React.useState(null);
  const [light, setLight] = React.useState(prefersLight);
  const [sum, setSum] = React.useState(null);
  const [gone, setGone] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const autoCall = React.useRef(false);
  React.useEffect(() => {
    let alive = true;
    const f = () => api.list().then((r) => { if (alive && r && r.ok) setSum(r); });
    f();
    const t = setInterval(f, 1500);
    return () => { alive = false; clearInterval(t); };
  }, [api, tick]);
  React.useEffect(() => { try { document.documentElement.setAttribute("data-theme", light ? "light" : "dark"); } catch (e) { /* */ } }, [light]);
  // в чате через 40 секунд — вызов мне (как в смене)
  React.useEffect(() => {
    if (!open || autoCall.current) return undefined;
    autoCall.current = true;
    const t = setTimeout(() => api.demoCall(), 40000);
    return () => clearTimeout(t);
  }, [open, api]);
  const total = sum ? unreadTotal(sum.chats) : 0;
  const call = !open && sum && (sum.calls || []).find((c) => !gone[c.id]);
  const goNow = () => { if (!call || busy) return; setBusy(true); api.go(call.id).then(() => { setBusy(false); setGone((g) => ({ ...g, [call.id]: 1 })); setTick((x) => x + 1); }); };
  const openChat = (id = null) => { setOpenId(id); setOpen(true); setOpened(true); };
  return (<>
    <main className="shell">
      <div className="top">
        <span className="mark">SA · чат смены</span>
        <button type="button" className="pill" onClick={() => setLight((v) => !v)} aria-label={light ? "Тёмная тема" : "Светлая тема"}><IcTheme light={light} />{light ? "Тёмная" : "Светлая"}</button>
      </div>
      <h1>Чат на главной</h1>
      <p className="lead">Значок чата встаёт в верхнюю строку, рядом с поиском, и виден с любого экрана. Число на нём: сколько непрочитанных. Нажми на значок.</p>
      {HOME ? <Home light={light} total={total} hint={!opened} onOpen={() => openChat(null)} /> : (
        <button type="button" className="card" data-demo-open="" onClick={() => openChat(null)}><b>Открыть чат</b>{total ? <span className="badge">{badge(total)}</span> : null}</button>)}
      <section className="note">
        <h2>Это демо</h2>
        <p>Коллеги и переписка выдуманы, всё работает прямо в этой странице. Попробуй: ответь на сообщение свайпом вбок, поставь реакцию, поправь своё, закрепи важное, отправь фото с телефона, позови хостес колокольчиком.</p>
        <div className="acts">
          <button type="button" className="pill" onClick={() => api.demoCall()} data-demo-call=""><IcBell />Вызов мне</button>
          <button type="button" className="pill" onClick={() => api.demoMessage()} data-demo-msg=""><IcMsg />Сообщение от Анны</button>
        </div>
      </section>
      <p className="foot">Service Academy · чат смены · демо</p>
    </main>
    {open ? <ChatScreen a11y={light} me={api.me} api={api} openId={openId} stt={{ url: "demo", headers: {} }} onBack={() => setOpen(false)} /> : null}
    {call ? <CallBanner a11y={light} me={api.me} call={call} busy={busy} onGo={goNow} onClose={() => setGone((g) => ({ ...g, [call.id]: 1 }))}
      onOpen={() => { setGone((g) => ({ ...g, [call.id]: 1 })); openChat("team"); }} /> : null}
  </>);
}

createRoot(document.getElementById("app")).render(<Demo />);
