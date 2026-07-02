// ui/search.jsx
// Этап 1 — глобальный поиск по урокам текущей роли и глоссарию.
// Кейс: гость спросил про глютен — сотрудник вбивает слово и за 5 секунд находит ответ.

import React from "react";
import { GLOSSARY } from "../data/glossary";
import { onActivate } from "../lib/utils";

const norm = (s) => (s || "").toLowerCase().replace(/ё/g, "е");

// Фрагмент текста вокруг найденного слова — чтобы было видно контекст
const snippet = (content, q) => {
  const plain = (content || "").replace(/[*#•☑]/g, "").replace(/\s+/g, " ").trim();
  const i = norm(plain).indexOf(q);
  if (i < 0) return plain.slice(0, 90) + (plain.length > 90 ? "…" : "");
  const start = Math.max(0, i - 40);
  const end = Math.min(plain.length, i + q.length + 70);
  return (start > 0 ? "…" : "") + plain.slice(start, end) + (end < plain.length ? "…" : "");
};

export function SearchScreen({ T, a11y, role, modules = [], onOpen, onBack }) {
  const [q, setQ] = React.useState("");
  const [openTerm, setOpenTerm] = React.useState(null);
  const gold = a11y ? "#8B6A30" : "#C8A96E";
  const textColor = a11y ? "#2e211a" : "#F5EFE2";
  const query = norm(q.trim());

  const results = React.useMemo(() => {
    if (query.length < 2) return { terms: [], lessons: [] };
    const terms = GLOSSARY.filter(g => norm(g.term).includes(query) || norm(g.def).includes(query)).slice(0, 8);
    const lessons = [];
    outer:
    for (const m of modules) {
      for (const l of (m.lessons || [])) {
        if (l.type !== "lesson") continue;
        const inTitle = norm(l.title).includes(query);
        const inBody = !inTitle && norm(l.content || "").includes(query);
        if (inTitle || inBody) {
          lessons.push({ m, l, inTitle });
          if (lessons.length >= 20) break outer;
        }
      }
    }
    lessons.sort((a, b) => (b.inTitle ? 1 : 0) - (a.inTitle ? 1 : 0));
    return { terms, lessons };
  }, [query, modules]);

  return (
    <div style={T.screen} className="sa-screen">
      <div style={T.lessHead}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Поиск</div>
      </div>
      <div style={{ padding: "10px 16px 6px" }}>
        <input
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpenTerm(null); }}
          placeholder="Глютен, прожарки, жалоба, стоп-лист…"
          style={{ width: "100%", boxSizing: "border-box", padding: "13px 15px", borderRadius: 14, border: `1px solid ${gold}66`, background: a11y ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", color: textColor, fontSize: 16, outline: "none" }}
        />
      </div>

      {query.length < 2 && (
        <div style={{ textAlign: "center", padding: "44px 24px", color: T.modSub.color }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔎</div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>Введи минимум 2 буквы — найду по всем урокам твоей роли и по глоссарию.</div>
        </div>
      )}

      {query.length >= 2 && results.terms.length === 0 && results.lessons.length === 0 && (
        <div style={{ textAlign: "center", padding: "44px 24px", color: T.modSub.color }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤔</div>
          <div style={{ fontSize: 14 }}>Ничего не нашлось. Попробуй другое слово или его часть.</div>
        </div>
      )}

      {results.terms.length > 0 && <div style={T.secTitle}>Глоссарий</div>}
      <div style={{ padding: "0 14px" }}>
        {results.terms.map((g) => (
          <div
            key={g.term}
            className="sa-card"
            style={{ ...T.modCard, margin: "0 0 10px", flexDirection: "column", alignItems: "stretch", cursor: "pointer" }}
            onClick={() => setOpenTerm(openTerm === g.term ? null : g.term)}
            {...onActivate(() => setOpenTerm(openTerm === g.term ? null : g.term))}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ ...T.modBar, background: gold }} />
              <div style={{ ...T.modTitle, flex: 1 }}>{g.term}</div>
              <div style={T.modArrow}>{openTerm === g.term ? "˅" : "›"}</div>
            </div>
            {openTerm === g.term && (
              <div style={{ ...T.modSub, whiteSpace: "normal", lineHeight: 1.55, marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${gold}` }}>{g.def}</div>
            )}
          </div>
        ))}
      </div>

      {results.lessons.length > 0 && <div style={T.secTitle}>Уроки</div>}
      <div style={{ padding: "0 14px 20px" }}>
        {results.lessons.map(({ m, l }) => (
          <div
            key={l.id}
            className="sa-card"
            style={{ ...T.modCard, margin: "0 0 10px" }}
            onClick={() => onOpen(m, l)}
            {...onActivate(() => onOpen(m, l))}
          >
            <div style={{ ...T.modBar, background: m.color }} />
            <div style={{ flex: 1, minWidth: 0, padding: "2px 0" }}>
              <div style={{ fontSize: 11, color: m.color, letterSpacing: 1, marginBottom: 2, fontFamily: "monospace" }}>{m.title}</div>
              <div style={T.modTitle}>{l.title}</div>
              <div style={{ ...T.modSub, whiteSpace: "normal", lineHeight: 1.5 }}>{snippet(l.content, query)}</div>
            </div>
            <div style={T.modArrow}>›</div>
          </div>
        ))}
      </div>
    </div>
  );
}
