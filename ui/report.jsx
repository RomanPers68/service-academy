// ui/report.jsx — Доп. 309: «Отчёты по сотрудникам».
// Руководителю: список команды (кто давно не занимался, у кого ошибки и повторы) →
// карточка сотрудника: что пройдено и что нет, где ошибается (что выбрал и как верно),
// с чем работать, что ждёт повтора, тесты, навыки в зале, дни занятий.
// Выгрузка: Excel по всей команде и PDF-карточка (одного или всех). Сотруднику — своя
// карточка. Данные — этап 23 в Supabase; без него экран честно говорит, что нужно.

import React from "react";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { MODULES_INDEX } from "../data/modules-index";
import { ROLES } from "../data/roles";
import { ROLE_SKILLS } from "../data/skills";
import { buildCustomModules } from "../lib/custom-modules";
import { personModel, teamModel, listRow, stepIndex, trackTotals, pl, shortDate } from "../lib/report-model";
import { onActivate, vibrate } from "../lib/utils";
import { serverMissing, serverStage } from "../lib/server-text";   // v58 (Доп. 371): без «этап 23» у руководителя без прав владельца
import { useHintOnce, HintBubble } from "./widgets";
import { hintsFor } from "../data/hints";
import { LABEL_CSS } from "./tokens";   // v73 (Доп. 386): надзаголовок .rp-ey — курсив с засечками, не моноширинный капс

const CSS = `
.rp{min-height:100%;padding:0 0 28px;color:#EFE4C8;font-family:Georgia,serif}
.rp-top{display:flex;align-items:center;gap:8px;padding:14px 14px 4px}
.rp-back{background:none;border:0;padding:0 6px;cursor:pointer;color:#D9B87C;font:25px/1 Georgia,serif}
.rp-ey{${LABEL_CSS};font-size:13px;line-height:1.2;color:#D9B87C}
.rp-h{margin:2px 0 0;font-size:21px;line-height:1.2;font-weight:700;color:#F3E9D2}
.rp-sub{font-size:12.5px;color:#A99B7E;margin-top:2px}
.rp-card{margin:10px 14px 0;padding:13px 14px;border-radius:16px;border:1px solid rgba(214,178,102,.28);background:rgba(255,250,238,.04)}
.rp-btns{display:flex;gap:8px;flex-wrap:wrap;margin:12px 14px 0}
.rp-btn{flex:1 1 auto;min-height:42px;padding:9px 14px;border-radius:999px;cursor:pointer;font:700 13.5px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  border:1px solid rgba(214,178,102,.45);background:transparent;color:#E0C285;display:inline-flex;align-items:center;justify-content:center;gap:7px}
.rp-btn.main{background:linear-gradient(180deg,#E4C88C,#C8A96E);color:#1A1008;border:0}
.rp-btn:disabled{opacity:.55;cursor:default}
.rp-btn:focus-visible,.rp-row:focus-visible,.rp-chip:focus-visible,.rp-back:focus-visible{outline:2px solid #D9B87C;outline-offset:2px}
.rp-note{margin:8px 16px 0;font:12px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#A99B7E}
.rp-msg{margin:10px 14px 0;padding:10px 12px;border-radius:12px;font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:rgba(214,178,102,.1);color:#EFE4C8}
.rp-msg.bad{background:rgba(192,98,75,.16)}
.rp-search{display:flex;gap:8px;margin:12px 14px 0}
.rp-search input{flex:1;min-width:0;height:40px;padding:0 12px;border-radius:12px;border:1px solid rgba(214,178,102,.3);background:rgba(255,250,238,.05);color:#EFE4C8;font:14px Georgia,serif}
.rp-chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 14px 0}
.rp-chip{padding:6px 11px;border-radius:999px;border:1px solid rgba(214,178,102,.3);background:transparent;color:#CFC2A4;cursor:pointer;font:12.5px/1.2 Georgia,serif}
.rp-chip.on{background:rgba(214,178,102,.16);border-color:rgba(214,178,102,.6);color:#F3E2B8}
.rp-list{margin:10px 14px 0;display:flex;flex-direction:column;gap:8px}
.rp-row{display:block;width:100%;text-align:left;padding:11px 13px;border-radius:14px;cursor:pointer;color:inherit;font:inherit;border:1px solid rgba(214,178,102,.24);background:rgba(255,250,238,.035)}
.rp-row.att{border-color:rgba(192,98,75,.5)}
.rp-rn{display:flex;align-items:baseline;gap:8px}
.rp-rn b{font-size:15.5px;color:#F3E9D2;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rp-rn .me{font:11px system-ui,sans-serif;color:#D9B87C}
.rp-rn .at{margin-left:auto;flex:0 0 auto;font:700 10.5px system-ui,sans-serif;color:#E08A70;letter-spacing:.3px}
.rp-rs{font-size:12.5px;color:#A99B7E;margin-top:2px}
.rp-bar{height:4px;border-radius:2px;background:rgba(255,255,255,.08);margin-top:8px;overflow:hidden}
.rp-bar i{display:block;height:100%;border-radius:2px}
.rp-stats{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:7px;font:12px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#B9AB8C}
.rp-stats b{color:#EFE4C8;font-weight:700}
.rp-stats .w b{color:#E08A70}
.rp-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 14px 0}
@media (min-width:560px){.rp-tiles{grid-template-columns:repeat(4,minmax(0,1fr))}}
.rp-tile{padding:10px 11px 11px;border-radius:14px;border:1px solid rgba(214,178,102,.24);background:rgba(255,250,238,.04);min-width:0}
.rp-tile .l{font:11.5px/1.25 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#A99B7E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rp-tile .v{font-size:21px;font-weight:700;margin-top:3px;color:#F3E9D2;line-height:1.15}
.rp-tile .s{font:11.5px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#A99B7E;margin-top:2px}
.rp-tile .v.w{color:#E08A70}.rp-tile .v.g{color:#7FC79A}
.rp-sec{margin:18px 14px 0}
.rp-sec h3{display:flex;align-items:baseline;gap:8px;margin:0 0 8px;font-size:16.5px;color:#F3E9D2}
.rp-sec h3 span{margin-left:auto;font:400 12px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#A99B7E}
.rp-flags{margin:12px 14px 0;padding:11px 13px;border-radius:14px;background:rgba(192,98,75,.12);border:1px solid rgba(192,98,75,.35)}
.rp-flags.ok{background:rgba(93,187,138,.1);border-color:rgba(93,187,138,.35)}
.rp-flags p{margin:4px 0 0;font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#EFE4C8;display:flex;gap:8px}
.rp-flags p i{flex:0 0 auto;font-style:normal}
.rp-flags p i.w{color:#E8907A}.rp-flags p i.g{color:#86CDA0}
.rp-flags .t{font-size:13.5px;font-weight:700;color:#E8A08A}
.rp-flags.ok .t{color:#8FD3A8}
.rp-q{padding:10px 12px;border-radius:12px;border:1px solid rgba(214,178,102,.2);background:rgba(255,250,238,.03);margin-bottom:7px}
.rp-q .qq{font-size:14px;line-height:1.38;color:#F3E9D2}
.rp-q .a{font:12.5px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;margin-top:5px;color:#B9AB8C}
.rp-q .a .bad{color:#E8907A}.rp-q .a .ok{color:#86CDA0}
.rp-q .m{display:flex;gap:10px;font:11.5px system-ui,sans-serif;color:#A99B7E;margin-top:6px}
.rp-q .m .fx{color:#86CDA0}.rp-q .m .nf{color:#E8907A}
.rp-weak{display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid rgba(214,178,102,.14)}
.rp-weak .tt{flex:1;min-width:0}
.rp-weak .tt b{display:block;font-size:14px;color:#F3E9D2}
.rp-weak .tt span{font:12px/1.35 system-ui,sans-serif;color:#A99B7E}
.rp-weak .pb{flex:0 0 74px;text-align:right;font:11px system-ui,sans-serif;color:#A99B7E}
.rp-weak .pb .rp-bar{margin:0 0 3px}
.rp-li{padding:7px 0;border-bottom:1px solid rgba(214,178,102,.12);font-size:13.5px;line-height:1.4;color:#EFE4C8}
.rp-li small{display:block;font:12px/1.35 system-ui,sans-serif;color:#A99B7E;margin-top:2px}
.rp-li .ok{color:#86CDA0}.rp-li .bad{color:#E8907A}.rp-li .gold{color:#E0C285}
.rp-mod{font-size:14px;font-weight:700;color:#F3E9D2;margin:10px 0 3px}
.rp-step{font-size:13px;color:#CFC2A4;padding:2px 0 2px 14px;position:relative}
.rp-step:before{content:"•";position:absolute;left:2px;color:#C8A96E}
.rp-days{display:grid;grid-template-columns:repeat(14,minmax(0,1fr));gap:4px;align-items:end;height:92px;margin-top:4px}
.rp-day{display:flex;flex-direction:column;align-items:center;gap:3px;height:100%;justify-content:flex-end}
.rp-day .col{width:100%;border-radius:4px;background:rgba(255,250,238,.06);position:relative;height:62px;display:flex;align-items:flex-end;overflow:hidden}
.rp-day .col i{display:block;width:100%;border-radius:4px}
.rp-day .d{font:10.5px/1 system-ui,sans-serif;color:#A99B7E}
.rp-day .w{width:5px;height:5px;border-radius:50%;background:#D9B87C}
.rp-day .w.no{background:transparent}
.rp-empty{font-size:13.5px;color:#A99B7E;padding:4px 0}
.rp-master{margin:0 0 8px;font-size:14px;font-weight:700;color:#E0C285}
.rp-ms{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 6px}
.rp-ms span{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:5px 10px 5px 8px;border-radius:999px;border:1px solid rgba(214,178,102,.28);background:rgba(255,250,238,.04);
  font:12.5px/1.25 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#EFE4C8}
.rp-ms span i{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.rp-ms span em{font-style:normal;color:#A99B7E}
.rp-ms .t1 i{background:#C88A5A}.rp-ms .t2 i{background:#C7CDD6}.rp-ms .t3 i{background:#E6C677;box-shadow:0 0 6px rgba(230,198,119,.55)}
.rp-ms .t3{border-color:rgba(230,198,119,.55)}
.rp-foot{margin:18px 16px 0;font:12px/1.5 system-ui,sans-serif;color:#8F826A}
html.sa-light .rp{color:#2A1F0E}
html.sa-light .rp-h,html.sa-light .rp-rn b,html.sa-light .rp-tile .v,html.sa-light .rp-sec h3,html.sa-light .rp-q .qq,html.sa-light .rp-weak .tt b,html.sa-light .rp-mod{color:#2A1F0E}
html.sa-light .rp-ey,html.sa-light .rp-back,html.sa-light .rp-btn{color:#7A5D2A}
html.sa-light .rp-sub,html.sa-light .rp-rs,html.sa-light .rp-tile .l,html.sa-light .rp-tile .s,html.sa-light .rp-note,html.sa-light .rp-sec h3 span,html.sa-light .rp-q .a,html.sa-light .rp-q .m,
html.sa-light .rp-weak .tt span,html.sa-light .rp-weak .pb,html.sa-light .rp-li small,html.sa-light .rp-day .d,html.sa-light .rp-empty,html.sa-light .rp-foot,html.sa-light .rp-stats{color:#6B5B40}
html.sa-light .rp-card,html.sa-light .rp-row,html.sa-light .rp-tile,html.sa-light .rp-q{background:rgba(255,252,244,.6);border-color:rgba(150,112,40,.3)}
html.sa-light .rp-row.att{border-color:rgba(176,69,44,.55)}
html.sa-light .rp-btn{border-color:rgba(122,93,42,.5)}
html.sa-light .rp-btn.main{color:#1A1008}
html.sa-light .rp-chip{color:#5A4A30;border-color:rgba(150,112,40,.35)}
html.sa-light .rp-chip.on{background:rgba(139,106,48,.14);color:#2A1F0E}
html.sa-light .rp-search input{background:rgba(255,252,244,.8);color:#2A1F0E;border-color:rgba(150,112,40,.35)}
html.sa-light .rp-stats b,html.sa-light .rp-li{color:#2A1F0E}
html.sa-light .rp-stats .w b,html.sa-light .rp-rn .at,html.sa-light .rp-tile .v.w,html.sa-light .rp-q .a .bad,html.sa-light .rp-q .m .nf,html.sa-light .rp-li .bad{color:#8F3520}
html.sa-light .rp-tile .v.g,html.sa-light .rp-q .a .ok,html.sa-light .rp-q .m .fx,html.sa-light .rp-li .ok{color:#28603D}
html.sa-light .rp-li .gold,html.sa-light .rp-rn .me{color:#7A5D2A}
html.sa-light .rp-step{color:#4A3B22}
html.sa-light .rp-msg{background:rgba(139,106,48,.1);color:#2A1F0E}
html.sa-light .rp-msg.bad{background:rgba(176,69,44,.12)}
html.sa-light .rp-flags p{color:#2A1F0E}
html.sa-light .rp-flags p i.w{color:#8F3520}html.sa-light .rp-flags p i.g{color:#28603D}
html.sa-light .rp-flags .t{color:#8F3520}
html.sa-light .rp-flags.ok .t{color:#28603D}
html.sa-light .rp-bar,html.sa-light .rp-day .col{background:rgba(120,90,30,.12)}
html.sa-light .rp-weak,html.sa-light .rp-li{border-color:rgba(150,112,40,.2)}
html.sa-light .rp-master{color:#7A5D2A}
html.sa-light .rp-ms span{background:rgba(255,252,244,.6);border-color:rgba(150,112,40,.3);color:#2A1F0E;font-size:13px}
html.sa-light .rp-ms span em{color:#6B5B40}
html.sa-light .rp-ms .t1 i{background:#A0663A}html.sa-light .rp-ms .t2 i{background:#8E96A3}html.sa-light .rp-ms .t3 i{background:#B8892E;box-shadow:none}
html.sa-light .rp-ms .t3{border-color:rgba(150,112,40,.6)}
`;
let cssDone = false;
const ensureCss = () => {
  if (cssDone || typeof document === "undefined" || !document.createElement || !document.head) return;
  try { const st = document.createElement("style"); st.id = "rp-css"; st.textContent = CSS; document.head.appendChild(st); cssDone = true; } catch (e) {}
};

const skillLabel = (id) => { for (const r of Object.keys(ROLE_SKILLS)) { const s = (ROLE_SKILLS[r] || []).find((x) => x.id === id); if (s) return s.label; } return ""; };
const STATUS = { hall: ["в зале ✓", "ok"], pin: ["по PIN ✓", "ok"], pending: ["ждёт старшего", "gold"], declined: ["ещё рано", "bad"] };
const KIND = { lesson: "урок", quiz: "тест", practice: "практика", dialogue: "диалог", build: "сборка" };

// Файл — в браузере сразу, в Telegram — через билет и /api/report (там нельзя скачать из памяти)
async function deliver({ kind, payload, make, name, mime, admin = false }) {
  const tg = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
  const inTg = !!(tg && tg.initData);
  if (inTg) {
    const r = await rpc("report_ticket", { p_token: saToken(), p_kind: kind, p_payload: payload });
    if (rpcMissing(r)) throw new Error(serverStage({ admin, sql: "supabase-stage23-reports.sql" }));   // v58: по-человечески
    if (!r || !r.ok || !r.ticket) throw new Error(r && r.error === "too_big" ? "Отчёт слишком большой для одного файла" : "Сервер не выдал билет на файл");
    const url = window.location.origin + "/api/report?t=" + r.ticket;
    if (typeof tg.downloadFile === "function") {
      return new Promise((res) => { try { tg.downloadFile({ url, file_name: name }, (ok) => res(ok ? "tg" : "cancel")); } catch (e) { try { tg.openLink(url); } catch (e2) {} res("tg"); } });
    }
    try { tg.openLink(url); } catch (e) { window.open(url, "_blank"); }
    return "tg";
  }
  const bytes = await make();
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 60000);
  return "file";
}

export function ReportScreen({ a11y, profile, customLessons = [], onBack, startSelf = false }) {
  ensureCss();
  const customByRole = React.useMemo(() => {
    const out = {};
    ROLES.forEach((r) => { const mods = buildCustomModules(customLessons || [], r.id, { color: r.color }); if (mods.length) out[r.id] = mods; });
    return out;
  }, [customLessons]);
  const steps = React.useMemo(() => stepIndex(MODULES_INDEX, customByRole), [customByRole]);
  const totals = React.useMemo(() => {
    const t = trackTotals(MODULES_INDEX);
    Object.keys(customByRole).forEach((r) => { t[r] = (t[r] || 0) + customByRole[r].reduce((a, m) => a + (m.lessons || []).filter((l) => l.type !== "result").length, 0); });
    return t;
  }, [customByRole]);
  const ctx = React.useMemo(() => ({ steps, roles: ROLES, skillLabel }), [steps]);

  const [list, setList] = React.useState({ status: "loading", rows: [], scope: "", restaurant: "" });
  const [sel, setSel] = React.useState(null);
  const [person, setPerson] = React.useState({ status: "idle" });
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState(null);
  const topRef = React.useRef(null);

  const loadList = React.useCallback(() => {
    setList((l) => ({ ...l, status: "loading" }));
    rpc("report_people", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) { setList({ status: "missing", rows: [] }); return; }
      if (!r || !r.ok) { setList({ status: r && r.error === "auth" ? "auth" : "error", rows: [] }); return; }
      const rows = (r.rows || []).map((x) => listRow(x, { roles: ROLES, totals }));
      setList({ status: "ok", rows, scope: r.scope, restaurant: r.restaurant || "" });
      // рядовой сотрудник видит только себя — сразу его карточка
      if ((r.scope === "self" || startSelf) && rows.length) { const me = rows.find((x) => x.self) || rows[0]; setSel(me.id); }
    }).catch(() => setList({ status: "offline", rows: [] }));
  }, [totals, startSelf]);
  React.useEffect(() => { loadList(); }, [loadList]);

  React.useEffect(() => {
    if (!sel) { setPerson({ status: "idle" }); return undefined; }
    let live = true;
    setPerson({ status: "loading" });
    rpc("report_person", { p_token: saToken(), p_emp: sel }).then((r) => {
      if (!live) return;
      if (rpcMissing(r)) { setPerson({ status: "missing" }); return; }
      if (!r || !r.ok || !r.data) { setPerson({ status: r && r.error === "forbidden" ? "forbidden" : "error" }); return; }
      setPerson({ status: "ok", raw: r.data, model: personModel(r.data, ctx) });
    }).catch(() => { if (live) setPerson({ status: "offline" }); });
    try { (topRef.current && topRef.current.scrollIntoView) && topRef.current.scrollIntoView({ block: "start" }); } catch (e) {}
    return () => { live = false; };
  }, [sel, ctx]);

  const say = (text, bad = false) => setMsg({ text, bad });
  const runExport = async (what) => {
    if (busy) return;
    vibrate("light");
    setBusy(what); setMsg(null);
    try {
      let res;
      if (what === "person_pdf" || what === "person_xlsx") {
        const m = person.model; if (!m) throw new Error("Карточка ещё не загрузилась");
        if (what === "person_pdf") res = await deliver({ admin: !!(profile && profile.is_admin), kind: what, payload: m, name: fileName(m.full, "pdf"), mime: "application/pdf", make: async () => (await import("../lib/report-pdf.js")).personPdf(m) });
        else res = await deliver({ admin: !!(profile && profile.is_admin), kind: what, payload: m, name: fileName(m.full, "xlsx"), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", make: async () => (await import("../lib/report-xlsx.js")).personXlsx(m) });
      } else {
        const r = await rpc("report_team", { p_token: saToken() });
        if (rpcMissing(r)) throw new Error(serverStage({ admin: !!(profile && profile.is_admin), sql: "supabase-stage23-reports.sql" }));
        if (!r || !r.ok) throw new Error(r && r.error === "forbidden" ? "Отчёт по команде видит только руководитель" : "Сервер не отдал данные команды");
        const team = teamModel(r, ctx);
        const label = team.scopeLabel || "команда";
        if (what === "team_xlsx") res = await deliver({ admin: !!(profile && profile.is_admin), kind: what, payload: team, name: fileName("команда " + label, "xlsx"), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", make: async () => (await import("../lib/report-xlsx.js")).teamXlsx(team) });
        else res = await deliver({ admin: !!(profile && profile.is_admin), kind: what, payload: team, name: fileName("команда " + label, "pdf"), mime: "application/pdf", make: async () => (await import("../lib/report-pdf.js")).teamPdf(team) });
      }
      vibrate("success");
      say(res === "tg" ? "Файл уходит в Telegram. Подтверди сохранение, если спросит" : res === "cancel" ? "Скачивание отменено" : "Готово, файл скачан");
    } catch (e) {
      say((e && e.message) || "Не получилось собрать файл", true);
    } finally { setBusy(""); }
  };

  const lead = list.scope && list.scope !== "self";
  const rows = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.rows.filter((r) => (!s || r.full.toLowerCase().includes(s)) && (filter === "all" || (filter === "att" ? r.attention : r.restaurant === filter)))
      .sort((a, b) => (b.attention - a.attention) || a.full.localeCompare(b.full, "ru"));
  }, [list.rows, q, filter]);
  const rests = React.useMemo(() => [...new Set(list.rows.map((r) => r.restaurant).filter(Boolean))], [list.rows]);
  const attN = list.rows.filter((r) => r.attention).length;

  const problem = (st) => st === "missing" ? serverMissing({ what: "отчёты", many: true, admin: !!(profile && profile.is_admin), sql: "supabase-stage23-reports.sql" })
    : st === "auth" ? "Сессия не найдена. Войди заново." : st === "forbidden" ? "Эта карточка тебе не видна: руководитель видит своих сотрудников." : st === "offline" ? "Нет связи с сервером. Попробуй ещё раз." : "Сервер ответил ошибкой. Попробуй позже.";

  // ── Карточка сотрудника ──
  if (sel) {
    const m = person.model;
    const back = () => { if (lead) { setSel(null); setMsg(null); } else onBack && onBack(); };
    return (
      <div className="rp" ref={topRef}>
        <div className="rp-top">
          <button type="button" className="rp-back" onClick={back} aria-label="Назад">‹</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rp-ey">{lead ? "Отчёт по сотруднику" : "Мой отчёт"}</div>
            <h2 className="rp-h">{m ? m.full : (list.rows.find((r) => r.id === sel) || {}).full || "…"}</h2>
            {m ? <div className="rp-sub">{[m.positionLabel, m.restaurant, m.seenDays == null ? "ещё не занимался" : "последнее занятие: " + m.seenLabel].filter(Boolean).join(" · ")}</div> : null}
          </div>
        </div>
        {!lead && list.status === "ok" ? <ReportHint a11y={a11y} k="report_staff" /> : null}
        {person.status === "loading" ? <div className="rp-msg">Собираю отчёт…</div> : null}
        {person.status !== "ok" && person.status !== "loading" && person.status !== "idle" ? <div className="rp-msg bad">{problem(person.status)}</div> : null}
        {m ? (
          <>
            <div className="rp-btns">
              <button type="button" className="rp-btn main" disabled={!!busy} onClick={() => runExport("person_pdf")}>{busy === "person_pdf" ? "Собираю PDF…" : "PDF-карточка"}</button>
              <button type="button" className="rp-btn" disabled={!!busy} onClick={() => runExport("person_xlsx")}>{busy === "person_xlsx" ? "Собираю…" : "Excel"}</button>
            </div>
            {msg ? <div className={"rp-msg" + (msg.bad ? " bad" : "")} role="status">{msg.text}</div> : null}
            <PersonView m={m} />
          </>
        ) : null}
      </div>
    );
  }

  // ── Список команды ──
  return (
    <div className="rp" ref={topRef}>
      <div className="rp-top">
        <button type="button" className="rp-back" onClick={onBack} aria-label="Назад">‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rp-ey">Отчёты по сотрудникам</div>
          <h2 className="rp-h">{list.scope === "restaurant" ? (list.restaurant || "Мой ресторан") : list.scope ? "Все рестораны" : "Команда"}</h2>
          {list.status === "ok" ? <div className="rp-sub">{list.rows.length} {pl(list.rows.length, "сотрудник", "сотрудника", "сотрудников")}{attN ? " · требуют внимания: " + attN : ""}</div> : null}
        </div>
      </div>
      {lead && list.status === "ok" ? <ReportHint a11y={a11y} k="report_admin" /> : null}
      {list.status === "loading" ? <div className="rp-msg">Загружаю команду…</div> : null}
      {list.status !== "ok" && list.status !== "loading" ? (
        <div className="rp-msg bad">{problem(list.status)} {list.status !== "missing" ? <button type="button" className="rp-chip" style={{ marginLeft: 6 }} onClick={loadList}>Ещё раз</button> : null}</div>
      ) : null}
      {list.status === "ok" ? (
        <>
          {lead ? (
            <>
              <div className="rp-btns">
                <button type="button" className="rp-btn main" disabled={!!busy || !list.rows.length} onClick={() => runExport("team_xlsx")}>{busy === "team_xlsx" ? "Собираю Excel…" : "Excel по команде"}</button>
                <button type="button" className="rp-btn" disabled={!!busy || !list.rows.length} onClick={() => runExport("team_pdf")}>{busy === "team_pdf" ? "Собираю PDF…" : "PDF всех карточек"}</button>
              </div>
              <p className="rp-note">В Excel сводка по каждому: где ошибается, с чем работать, что не пройдено, что ждёт повтора, навыки. В PDF карточки для разговора один на один.</p>
            </>
          ) : null}
          {msg ? <div className={"rp-msg" + (msg.bad ? " bad" : "")} role="status">{msg.text}</div> : null}
          {list.rows.length > 4 ? (
            <div className="rp-search"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти по имени" aria-label="Найти сотрудника по имени" /></div>
          ) : null}
          {attN || rests.length > 1 ? (
            <div className="rp-chips" role="group" aria-label="Фильтр">
              <button type="button" className={"rp-chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>Все</button>
              {attN ? <button type="button" className={"rp-chip" + (filter === "att" ? " on" : "")} onClick={() => setFilter("att")}>Требуют внимания · {attN}</button> : null}
              {rests.length > 1 ? rests.map((r) => <button key={r} type="button" className={"rp-chip" + (filter === r ? " on" : "")} onClick={() => setFilter(r)}>{r}</button>) : null}
            </div>
          ) : null}
          <div className="rp-list">
            {rows.map((r) => (
              <button key={r.id} type="button" className={"rp-row" + (r.attention ? " att" : "")} onClick={() => { vibrate("light"); setMsg(null); setSel(r.id); }}>
                <div className="rp-rn"><b>{r.full}</b>{r.self ? <span className="me">это ты</span> : null}{r.attention ? <span className="at">внимание</span> : null}</div>
                <div className="rp-rs">{[r.positionLabel, list.scope !== "restaurant" ? r.restaurant : "", r.track ? r.track + (r.total ? " · " + Math.min(r.lessons + r.quiz, r.total) + " из " + r.total : "") : ""].filter(Boolean).join(" · ")}</div>
                {r.pct != null ? <div className="rp-bar"><i style={{ width: Math.max(r.pct, r.pct ? 2 : 0) + "%", background: r.color }} /></div> : null}
                <div className="rp-stats">
                  <span className={r.wrong30 >= 5 ? "w" : ""}>ошибок за 30 дней <b>{r.wrong30}</b></span>
                  {r.hasPhone ? <span className={r.due >= 10 ? "w" : ""}>на повтор <b>{r.due}</b></span> : null}
                  {r.hasPhone ? <span>дней из 14 <b>{r.days14}</b></span> : null}
                  <span className={r.seenDays == null || r.seenDays >= 7 ? "w" : ""}>{r.seenDays == null ? <b>ещё не занимался</b> : <>был <b>{r.seenLabel}</b></>}</span>
                </div>
              </button>
            ))}
            {!rows.length ? <div className="rp-empty">{list.rows.length ? "Никого не нашлось." : "Пока некого показать."}</div> : null}
          </div>
          <p className="rp-foot">Менеджер видит сотрудников своего ресторана, старший видит всех ниже себя во всех ресторанах, владелец видит всех. Метка «внимание»: давно не занимался, много ошибок или повторов.</p>
        </>
      ) : null}
    </div>
  );
}

const fileName = (who, ext) => ("Отчёт " + (who || "") + " " + new Date().toISOString().slice(0, 10)).replace(/[\\/:*?"<>|]+/g, " ").trim().replace(/\s+/g, "_") + "." + ext;

// Подсказка экрана — один раз (Доп. 310): руководителю про список, сотруднику про свою карточку
function ReportHint({ a11y, k }) {
  const [on, done] = useHintOnce(k);
  const [step, setStep] = React.useState(0);
  const steps = hintsFor(k);
  if (!on || !steps.length) return null;
  return <HintBubble a11y={a11y} text={steps[Math.min(step, steps.length - 1)]} arrow="up" step={step + 1} total={steps.length}
    onNext={step >= steps.length - 1 ? null : () => setStep((v) => v + 1)} onClose={done} />;
}

// v40: «Путь мастера» в карточке — коротко: сколько значков, какие, мастер роли, чем не пользуется
const dayMonth = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? s.slice(8, 10) + "." + s.slice(5, 7) : "");
export function MasteryBlock({ ms }) {
  return (
    <section className="rp-sec">
      <h3>Путь мастера<span>{ms.bronze} из {ms.total} {pl(ms.total, "значка", "значков", "значков")}</span></h3>
      {ms.master.length ? <div className="rp-master">Мастер роли: {ms.master.map((r) => "«" + r.label + "»").join(", ")}</div> : null}
      {ms.badges.length ? (
        <div className="rp-ms" role="list" aria-label="Значки">
          {ms.badges.map((b) => <span key={b.id} role="listitem" className={"t" + b.tier}><i aria-hidden="true" />{b.title}<em>{b.tierName}</em></span>)}
        </div>
      ) : <div className="rp-empty">Значков пока нет.</div>}
      {ms.fw ? <div className="rp-li">Первые шаги пройдены<small>все семь заданий первых двух недель сделаны</small></div> : null}
      {ms.unused.length ? <div className="rp-li">Не пользуется<small>{ms.unused.join(", ")}</small></div> : null}
      {ms.step ? <div className="rp-li">Шаг дня{ms.step.day ? " · " + dayMonth(ms.step.day) : ""}<small>{ms.step.t}</small></div> : null}
    </section>
  );
}

function Tile({ l, v, s, tone }) {
  return <div className="rp-tile"><div className="l">{l}</div><div className={"v" + (tone ? " " + tone : "")}>{v}</div>{s ? <div className="s">{s}</div> : null}</div>;
}

function PersonView({ m }) {
  const mt = m.main;
  const ex = m.exams.find((e) => mt && e.track === mt.id) || m.exams[0] || null;
  const warn = m.flags.filter((f) => f.level === "warn");
  const good = m.flags.filter((f) => f.level === "good");
  const info = m.flags.filter((f) => f.level === "info");
  const maxDay = Math.max(3, ...m.activity.days.map((d) => d.steps + d.fix));
  const [allWrong, setAllWrong] = React.useState(false);
  const wrong = allWrong ? m.wrong : m.wrong.slice(0, 8);
  return (
    <>
      <div className="rp-tiles">
        <Tile l={mt ? "Трек «" + mt.label + "»" : "Трек"} v={mt ? mt.pct + "%" : "—"} s={mt ? mt.done + " из " + mt.total + " " + pl(mt.total, "шага", "шагов", "шагов") : ""} />
        <Tile l="Тесты" v={m.tests.avg == null ? "—" : m.tests.avg + "%"} s={m.tests.passed + " " + pl(m.tests.passed, "сдан", "сдано", "сдано") + " · средний балл"} tone={m.tests.avg != null && m.tests.avg < 70 ? "w" : ""} />
        <Tile l="Ошибки в тестах" v={m.wrong30} s={"за 30 дней · не исправлено " + m.unfixed} tone={m.unfixed >= 3 ? "w" : ""} />
        <Tile l="Ждут повтора" v={m.hasPhone ? m.repeat.due : "—"} s={m.hasPhone ? "из " + m.repeat.total + " в банке ошибок" : "нет данных с телефона"} tone={m.repeat.due >= 10 ? "w" : ""} />
        <Tile l="Дней занятий" v={m.hasPhone ? m.activity.active14 + " из 14" : "—"} s={"разминок за 30 дней: " + m.activity.warm30} />
        <Tile l="Навыки в зале" v={m.skills.confirmed} s={m.skills.pending ? "+" + m.skills.pending + " ждёт старшего" : "подтверждено наставником"} tone={m.skills.confirmed ? "g" : ""} />
        <Tile l="Серия" v={m.activity.streak.count + " " + pl(m.activity.streak.count, "день", "дня", "дней")} s={"лучшая: " + m.activity.streak.best} />
        <Tile l="Экзамен" v={ex ? (ex.passed ? "сдан" : "не сдан") : "—"} s={ex ? ex.label + (ex.score ? " · " + ex.score + "%" : "") : "ещё не сдавал"} tone={ex ? (ex.passed ? "g" : "w") : ""} />
      </div>

      {warn.length || good.length ? (
        <div className={"rp-flags" + (warn.length ? "" : " ok")}>
          <div className="t">{warn.length ? "Обратить внимание" : "Всё идёт хорошо"}</div>
          {warn.map((f) => <p key={f.text}><i className="w" aria-hidden="true">●</i>{f.text}</p>)}
          {good.map((f) => <p key={f.text}><i className="g" aria-hidden="true">✓</i>{f.text}</p>)}
        </div>
      ) : null}

      <section className="rp-sec">
        <h3>Где ошибается<span>{m.wrongQuestions ? m.wrongQuestions + " " + pl(m.wrongQuestions, "вопрос", "вопроса", "вопросов") + " за полгода" : ""}</span></h3>
        {!m.wrong.length ? <div className="rp-empty">Ошибок в тестах за полгода нет.</div> : null}
        {wrong.map((w, i) => (
          <div className="rp-q" key={i}>
            <div className="qq">{w.q}</div>
            <div className="a">{w.chosen ? <>Ответил: <span className="bad">{w.chosen}</span><br /></> : null}{w.right ? <>Верно: <span className="ok">{w.right}</span></> : null}</div>
            <div className="m"><span>{w.topic}</span><span>{"ошибок " + w.wrong + (w.total > w.wrong ? " из " + w.total : "")}</span>{w.fixed ? <span className="fx">потом ответил верно ✓</span> : <span className="nf">не исправлено</span>}</div>
          </div>
        ))}
        {m.wrong.length > 8 ? <button type="button" className="rp-chip" onClick={() => setAllWrong((v) => !v)}>{allWrong ? "Свернуть" : "Показать все " + m.wrong.length}</button> : null}
      </section>

      <section className="rp-sec">
        <h3>С чем работать</h3>
        {!m.weak.length ? <div className="rp-empty">Слабых тем не видно.</div> : null}
        {m.weak.map((w) => (
          <div className="rp-weak" key={w.track + w.topic}>
            <div className="tt"><b>{w.topic}</b><span>{w.why}</span></div>
            {w.total ? <div className="pb"><div className="rp-bar"><i style={{ width: Math.max(4, w.rate) + "%", background: w.rate >= 50 ? "#C0624B" : "#C8A96E" }} /></div>{w.rate}% ошибок</div> : null}
          </div>
        ))}
      </section>

      {m.repeat.total ? (
        <section className="rp-sec">
          <h3>Ждут повтора<span>сейчас {m.repeat.due} из {m.repeat.total}</span></h3>
          {m.repeat.list.slice(0, 12).map((r, i) => (
            <div className="rp-li" key={i}>{r.q}<small>{r.a ? <>Верно: <span className="ok">{r.a}</span> · </> : null}{r.isDue ? <span className="bad">ждёт сейчас</span> : (r.stage + 1) + "-й повтор позже"}{r.topic ? " · " + r.topic : ""}</small></div>
          ))}
        </section>
      ) : null}

      {/* v30: живая практика — живой гость, свежесть тем, зачёты на опыт, золото, квесты */}
      {m.live && (m.live.guests.total || m.live.credits.length || m.live.gold.length || m.live.fresh.total || m.live.quests30) ? (
        <section className="rp-sec">
          <h3>Живая практика<span>за 30 дней</span></h3>
          {m.live.guests.total ? <div className="rp-li">Живой гость: {m.live.guests.n30} {pl(m.live.guests.n30, "разговор", "разговора", "разговоров")}<small>{m.live.guests.avg != null ? "средний чек разбора " + String(m.live.guests.avg).replace(".", ",") + " из 5 · лучший " + m.live.guests.best : "за месяц разговоров не было"}{m.live.guests.lastFix ? " · поправить: " + m.live.guests.lastFix : ""}</small></div> : null}
          {m.live.fresh.total ? <div className="rp-li">Свежесть тем: {m.live.fresh.fading ? m.live.fresh.fading + " " + pl(m.live.fresh.fading, "выдыхается", "выдыхаются", "выдыхаются") : "все свежие"}<small>{m.live.fresh.list.length ? m.live.fresh.list.map((x) => "«" + x.title + "»" + (x.level === "faded" ? " (выдохлась)" : "")).join(", ") : "пройденных тем: " + m.live.fresh.total}{m.live.refresh30 ? " · освежено за месяц: " + m.live.refresh30 : ""}</small></div> : null}
          {m.live.credits.length ? <div className="rp-li">Зачтено по опыту<small>{m.live.credits.map((c) => "«" + c.title + "»: " + c.s + " из " + c.t + (c.d ? ", " + shortDate(c.d) : "")).join("; ")}</small></div> : null}
          {m.live.gold.length ? <div className="rp-li">Золотые темы: {m.live.gold.length}<small>{m.live.gold.map((g) => "«" + g.title + "»").join(", ")}</small></div> : null}
          {m.live.quests30 ? <div className="rp-li">Квест смены закрыт: {m.live.quests30} {pl(m.live.quests30, "раз", "раза", "раз")}<small>вместе со сменой</small></div> : null}
        </section>
      ) : null}

      {/* v40: «Путь мастера» — значки по семействам, мастер роли, чем не пользуется (старая копия — блока нет) */}
      {m.mastery ? <MasteryBlock ms={m.mastery} /> : null}

      <section className="rp-sec">
        <h3>Что не пройдено<span>{mt ? "осталось " + m.notDone.left + " " + pl(m.notDone.left, "шаг", "шага", "шагов") : ""}</span></h3>
        {!m.notDone.left ? <div className="rp-empty">{mt ? "Трек пройден целиком." : "Трек ещё не выбран."}</div> : null}
        {m.notDone.modules.slice(0, 3).map((mod) => (
          <div key={mod.title}>
            <div className="rp-mod">{mod.title}</div>
            {mod.steps.slice(0, 6).map((s, i) => <div className="rp-step" key={i}>{new RegExp("^" + s.kind, "i").test(s.title) ? s.title : s.kind + " · " + s.title}</div>)}
            {mod.steps.length > 6 ? <div className="rp-step">и ещё {mod.steps.length - 6}</div> : null}
          </div>
        ))}
        {m.notDone.modules.length > 3 ? <div className="rp-empty">Дальше ещё {m.notDone.modules.length - 3} {pl(m.notDone.modules.length - 3, "тема", "темы", "тем")}, полный список в Excel.</div> : null}
      </section>

      {m.tests.list.length ? (
        <section className="rp-sec">
          <h3>Тесты<span>лучший результат</span></h3>
          {m.tests.list.map((t) => (
            <div className="rp-li" key={t.id}>{t.title}<small>{t.topic ? t.topic + " · " : ""}{t.total ? t.score + " из " + t.total + " · " : ""}<span className={t.pct < 70 ? "bad" : t.pct >= 90 ? "ok" : "gold"}>{t.pct}%</span></small></div>
          ))}
        </section>
      ) : null}

      <section className="rp-sec">
        <h3>Навыки в зале<span>{m.skills.confirmed} подтверждено{m.skills.pending ? " · " + m.skills.pending + " ждёт" : ""}</span></h3>
        {!m.skills.list.length ? <div className="rp-empty">Подтверждений пока нет.</div> : null}
        {m.skills.list.map((s) => (
          <div className="rp-li" key={s.id || s.label}>{s.label}<small><span className={(STATUS[s.status] || ["", ""])[1]}>{(STATUS[s.status] || [s.status])[0]}</span>{s.by ? " · " + s.by : ""}{s.date ? " · " + (shortDate(s.date) || s.date) : ""}{s.note ? " · «" + s.note + "»" : ""}</small></div>
        ))}
      </section>

      <section className="rp-sec">
        <h3>Дни занятий<span>14 дней · ● разминка</span></h3>
        {m.hasPhone ? (
          <div className="rp-days" role="img" aria-label={"Занимался " + m.activity.active14 + " из 14 дней"}>
            {m.activity.days.map((d) => (
              <div className="rp-day" key={d.day} title={d.date + ": шагов " + (d.steps + d.fix) + (d.warm ? ", разминка" : "")}>
                <div className="col">{d.steps + d.fix ? <i style={{ height: Math.max(8, ((d.steps + d.fix) / maxDay) * 100) + "%", background: (mt && mt.color) || "#C8A96E" }} /> : null}</div>
                <span className={"w" + (d.warm ? "" : " no")} />
                <span className="d">{d.label}</span>
                <span className="d">{d.date}</span>
              </div>
            ))}
          </div>
        ) : <div className="rp-empty">Телефон сотрудника ещё не прислал дни занятий.</div>}
      </section>
      {info.map((f) => <p className="rp-foot" key={f.text}>{f.text}</p>)}
      <p className="rp-foot">{m.phoneAt ? "Данные с телефона: " + shortDate(m.phoneAt) + ". " : ""}Ответы в тестах учтены за последние полгода.{m.tg ? " Напоминания в Telegram включены." : ""}</p>
    </>
  );
}
