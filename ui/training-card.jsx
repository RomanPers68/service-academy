// ui/training-card.jsx
// «Карта обучения» — печатный документ для личного дела сотрудника.
// Собирается из данных приложения: треки, экзамены (с переаттестацией),
// допуски наставника. Кнопка «Распечатать» → системный диалог печати,
// откуда сохраняется в PDF. Сам лист всегда «бумажный» (светлый) —
// это документ, а не экран; рамка вокруг подстраивается под тему.

import React from "react";
import { MODULES } from "../data/modules";
import { ROLES } from "../data/roles";
import { ROLE_SKILLS } from "../data/skills";
import { onActivate, vibrate } from "../lib/utils";
import { GOLD } from "./tokens";

// Допуски наставника — тот же ключ, что в ui/mentor.jsx
const loadSkills = (profile) => {
  try { return JSON.parse(localStorage.getItem(`sa_skills_${(profile?.name || "guest")}|${(profile?.surname || "")}`.toLowerCase()) || "{}"); }
  catch (e) { return {}; }
};

const fmtDate = (d) => { try { return new Date(d).toLocaleDateString("ru-RU"); } catch (e) { return String(d || ""); } };

export function TrainingCardScreen({ T, a11y, profile, completed = {}, quizDone = {}, examResults = {}, onBack }) {
  const skills = React.useMemo(() => loadSkills(profile), [profile]);
  const today = new Date().toLocaleDateString("ru-RU");
  const posLabel = { waiter: "Официант", hostess: "Хостес", manager: "Менеджер", senior: "Руководящий состав" }[profile?.position] || profile?.position || "";

  // Прогресс по каждому треку
  const tracks = ROLES.map(r => {
    const mods = MODULES[r.id] || [];
    const ls = mods.flatMap(m => (m.lessons || [])).filter(l => l.type !== "result");
    const total = ls.length;
    const done = ls.filter(l => (l.type === "quiz" ? quizDone[l.id] : completed[l.id])).length;
    return { r, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }).filter(t => t.total > 0);

  // Экзамены + срок действия (12 мес — как на экране «Сертификаты»)
  const exams = ROLES.map(r => ({ r, res: examResults[r.id] })).filter(x => x.res && x.res.passed).map(x => {
    let until = null, expired = false;
    if (x.res.date) {
      const d = new Date(x.res.date);
      if (!isNaN(d)) { until = new Date(d); until.setMonth(until.getMonth() + 12); expired = until < new Date(); }
    }
    return { ...x, until, expired };
  });

  // Подтверждённые допуски с подписями навыков
  const skillLabel = {};
  Object.values(ROLE_SKILLS || {}).forEach(list => (list || []).forEach(s => { skillLabel[s.id] = s.label; }));
  const confirmed = Object.entries(skills).map(([id, rec]) => ({ id, label: skillLabel[id] || id, ...rec }));

  const doPrint = () => { vibrate("light"); try { window.print(); } catch (e) {} };

  const gold = "#8B6A30";       // золото документа — глубокое, печатное
  const ink = "#2A1F0E";
  const line = "1px solid rgba(139,106,48,0.35)";

  return (
    <div style={T.screen} className="sa-screen">
      {/* Печатаем только сам лист */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #sa-print-card, #sa-print-card * { visibility: visible !important; }
        #sa-print-card { position: absolute !important; left: 0; top: 0; width: 100% !important; margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
      }`}</style>

      <div style={T.lessHead}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Карта обучения</div>
      </div>

      <div style={{ padding: "6px 16px 4px", color: T.modSub?.color, fontSize: 12, lineHeight: 1.55 }}>
        Документ для личного дела. «Распечатать» откроет системный диалог — там же сохраняется в PDF.
      </div>

      {/* ── Лист-документ: всегда светлая «бумага» ── */}
      <div id="sa-print-card" style={{
        margin: "12px 14px 14px", padding: "22px 20px", borderRadius: 6,
        background: "linear-gradient(170deg, #FBF5E8 0%, #F2E8D2 100%)",
        border: "1px solid rgba(139,106,48,0.45)",
        boxShadow: a11y ? "0 4px 16px rgba(120,85,25,0.22)" : "0 8px 26px rgba(0,0,0,0.5)",
        color: ink, fontFamily: "Georgia, 'Times New Roman', serif",
      }}>
        {/* Шапка документа */}
        <div style={{ textAlign: "center", borderBottom: `2px solid ${gold}`, paddingBottom: 12, marginBottom: 14 }}>
          <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 3, color: gold }}>✦ SERVICE ACADEMY ✦</div>
          <div style={{ fontSize: 19, fontWeight: "bold", marginTop: 5 }}>Карта обучения сотрудника</div>
          <div style={{ fontSize: 11, color: "#7A6548", marginTop: 3 }}>сформирована {today}</div>
        </div>

        {/* Сотрудник */}
        <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", marginBottom: 16 }}><tbody>
          {[["Сотрудник", `${profile?.name || ""} ${profile?.surname || ""}`.trim()],
            ["Ресторан", profile?.restaurant || "—"],
            ["Должность", posLabel]].map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: "4px 0", color: "#7A6548", width: "34%" }}>{k}</td>
              <td style={{ padding: "4px 0", fontWeight: "bold" }}>{v}</td>
            </tr>
          ))}
        </tbody></table>

        {/* Треки обучения */}
        <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 2.5, color: gold, borderBottom: line, paddingBottom: 4, marginBottom: 8 }}>ТРЕКИ ОБУЧЕНИЯ</div>
        <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", marginBottom: 16 }}><tbody>
          {tracks.map(({ r, done, total, pct }) => (
            <tr key={r.id} style={{ borderBottom: "1px solid rgba(139,106,48,0.15)" }}>
              <td style={{ padding: "6px 0" }}>{r.label}</td>
              <td style={{ padding: "6px 0", color: "#7A6548", textAlign: "right", whiteSpace: "nowrap" }}>{done} / {total}</td>
              <td style={{ padding: "6px 0 6px 12px", fontWeight: "bold", textAlign: "right", width: 64, color: pct === 100 ? "#2A6B45" : ink }}>{pct === 100 ? "100% ✓" : `${pct}%`}</td>
            </tr>
          ))}
        </tbody></table>

        {/* Экзамены */}
        <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 2.5, color: gold, borderBottom: line, paddingBottom: 4, marginBottom: 8 }}>ЭКЗАМЕНЫ И СЕРТИФИКАТЫ</div>
        {exams.length === 0
          ? <div style={{ fontSize: 12, color: "#7A6548", marginBottom: 16 }}>Экзамены пока не сданы.</div>
          : <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", marginBottom: 16 }}><tbody>
              {exams.map(({ r, res, until, expired }) => (
                <tr key={r.id} style={{ borderBottom: "1px solid rgba(139,106,48,0.15)" }}>
                  <td style={{ padding: "6px 0" }}>{r.label}</td>
                  <td style={{ padding: "6px 0", textAlign: "right", fontWeight: "bold", whiteSpace: "nowrap" }}>{res.score}%</td>
                  <td style={{ padding: "6px 0 6px 12px", textAlign: "right", color: expired ? "#8B3020" : "#7A6548", fontSize: 11.5, whiteSpace: "nowrap" }}>
                    {fmtDate(res.date)}{until ? (expired ? " · срок истёк" : ` · до ${fmtDate(until)}`) : ""}
                  </td>
                </tr>
              ))}
            </tbody></table>}

        {/* Допуски наставника */}
        <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 2.5, color: gold, borderBottom: line, paddingBottom: 4, marginBottom: 8 }}>ДОПУСКИ НАСТАВНИКА</div>
        {confirmed.length === 0
          ? <div style={{ fontSize: 12, color: "#7A6548", marginBottom: 16 }}>Подтверждённых навыков пока нет.</div>
          : <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginBottom: 16 }}><tbody>
              {confirmed.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid rgba(139,106,48,0.15)" }}>
                  <td style={{ padding: "5px 0", lineHeight: 1.35 }}>{s.label}</td>
                  <td style={{ padding: "5px 0 5px 12px", textAlign: "right", color: "#7A6548", fontSize: 11, whiteSpace: "nowrap" }}>
                    {s.mentor} · {s.date}{s.verified ? " · PIN ✓" : ""}
                  </td>
                </tr>
              ))}
            </tbody></table>}

        {/* Подвал документа */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `2px solid ${gold}`, paddingTop: 10, marginTop: 4 }}>
          <div style={{ fontSize: 10, color: "#7A6548", lineHeight: 1.5 }}>
            Данные из приложения Service Academy.<br />Допуски с отметкой «PIN ✓» заверены наставником через сервер.
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 8.5, letterSpacing: 1.5, color: gold, border: `1px solid rgba(139,106,48,0.5)`, borderRadius: 8, padding: "4px 9px", transform: "rotate(-4deg)", flexShrink: 0 }}>SA · {today}</div>
        </div>
      </div>

      {/* Кнопка печати — на экране, но не на бумаге */}
      <div style={{ padding: "0 16px 26px" }} className="sa-no-print">
        <button className="sa-btn" onClick={doPrint} {...onActivate(doPrint)}
          style={{ width: "100%", padding: "13px", borderRadius: 13, border: "none", background: `linear-gradient(135deg, ${GOLD}, #8B6A30)`, color: "#1A1008", fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 15, cursor: "pointer" }}>
          🖨 Распечатать · сохранить в PDF
        </button>
        <div style={{ textAlign: "center", marginTop: 8, color: T.modSub?.color, fontSize: 11, lineHeight: 1.5 }}>
          Если диалог печати не открылся (в Telegram такое бывает) — открой приложение в обычном браузере по той же ссылке.
        </div>
      </div>
    </div>
  );
}
