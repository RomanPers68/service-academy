// ui/table-bits.jsx — мелочи формата «у стола», нужные и на старте (меню раздела,
// свеча серии на главной), и в самом уроке: иконки, свеча, сургучная печать.
import React from "react";

const P = {
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  chev: <path d="M9 5l7 7-7 7" />,
  send: <><path d="M21 3L10 14" /><path d="M21 3l-6.5 18-3.5-7-7-3.5z" /></>,
  speaker: <><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  mute: <><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>,
  refresh: <><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" /><path d="M3.5 3.5v5h5" /></>,
  snow: <><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" /><path d="M9.6 4.6L12 7l2.4-2.4M9.6 19.4L12 17l2.4 2.4" /></>,
  guest: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  tray: <><path d="M3 17h18" /><path d="M5 16a7 7 0 0 1 14 0" /><path d="M12 9V7.5M10.4 7.3h3.2" /></>,
  list: <><path d="M8 6.5h12M8 12h12M8 17.5h12" /><path d="M4 6.5h.01M4 12h.01M4 17.5h.01" /></>,
  book: <><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M8 7h7M8 11h5" /></>,
  checkC: <><circle cx="12" cy="12" r="9.5" /><path d="M7.8 12.3l2.8 2.8 5.6-5.8" /></>,
  xC: <><circle cx="12" cy="12" r="9.5" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  star: <path style={{ fill: "currentColor", stroke: "none" }} d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.4l-5.4 3 1.2-6.1-4.5-4.2 6.1-.7z" />,
  game: <><rect x="2.5" y="7" width="19" height="10.5" rx="5.2" /><path d="M7.5 10.5v3.6M5.7 12.3h3.6" /><circle cx="15.6" cy="11.3" r="1" style={{ fill: "currentColor" }} /><circle cx="17.8" cy="13.6" r="1" style={{ fill: "currentColor" }} /></>,
  dialog: <><path d="M4 5.5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3.5v-3.5H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" /><path d="M19 9.5h1a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-1v2.5L16 19h-3" /></>,
  shaker: <><path d="M8 8h8l-1.2 12.2a1.5 1.5 0 0 1-1.5 1.3h-2.6a1.5 1.5 0 0 1-1.5-1.3z" /><path d="M8.6 8V6.5a3.4 3.4 0 0 1 6.8 0V8" /><path d="M12 3.1V2" /></>,
  team: <><circle cx="8.5" cy="8.5" r="3.2" /><circle cx="16.5" cy="9.5" r="2.5" /><path d="M2.5 20c0-3.4 2.7-6 6-6s6 2.6 6 6M14.5 19.3c0-2.4 2-4.3 4.3-4.3s3.7 1.6 3.7 4" /></>,
  // ── значки ситуаций вместо эмодзи (Доп. 295) ──
  family: <><circle cx="7.5" cy="6.8" r="2.5" /><circle cx="16.5" cy="6.8" r="2.5" /><circle cx="12" cy="12.6" r="1.9" /><path d="M3 20c0-3.1 2-5.4 4.5-5.4M21 20c0-3.1-2-5.4-4.5-5.4M8.8 20.5c0-2.1 1.4-3.7 3.2-3.7s3.2 1.6 3.2 3.7" /></>,
  upset: <><circle cx="12" cy="12" r="9" /><path d="M8.4 16.4q3.6-3.1 7.2 0" /><path d="M7.6 8.6l2.6 1.3M16.4 8.6l-2.6 1.3" /><circle cx="9" cy="11.6" r=".8" style={{ fill: "currentColor" }} /><circle cx="15" cy="11.6" r=".8" style={{ fill: "currentColor" }} /></>,
  worry: <><circle cx="11.5" cy="12.5" r="8.5" /><path d="M8.5 16.3h6" /><circle cx="8.6" cy="11" r=".8" style={{ fill: "currentColor" }} /><circle cx="14.4" cy="11" r=".8" style={{ fill: "currentColor" }} /><path d="M19.4 2.8c1 1.3 1.5 2.2 1.5 2.9a1.5 1.5 0 0 1-3 0c0-.7.5-1.6 1.5-2.9z" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8.3 14q3.7 3.7 7.4 0" /><circle cx="9" cy="10" r=".8" style={{ fill: "currentColor" }} /><circle cx="15" cy="10" r=".8" style={{ fill: "currentColor" }} /></>,
  glass: <><path d="M7.5 3h9l-.7 5.6a3.8 3.8 0 0 1-7.6 0z" /><path d="M8 6.5h8" /><path d="M12 12.5V19.5M8.3 20.8h7.4" /></>,
  dish: <><path d="M3 17.5h18" /><path d="M5 16.5a7 7 0 0 1 14 0" /><path d="M12 9.5V8M10.4 7.8h3.2" /><path d="M5.5 20.3h13" /></>,
  alert: <><path d="M12 3.6l9.2 16.2H2.8z" /><path d="M12 9.8v4.6M12 17.1v.2" /></>,
  sos: <><circle cx="12" cy="12" r="8.6" /><circle cx="12" cy="12" r="3.6" /><path d="M5.9 5.9l3.6 3.6M14.5 14.5l3.6 3.6M18.1 5.9l-3.6 3.6M9.5 14.5l-3.6 3.6" /></>,
  bill: <><path d="M6 3h12v18l-2.2-1.4L13.6 21 12 19.6 10.4 21l-2.2-1.4L6 21z" /><path d="M9 8h6M9 11.5h6M9 15h3.6" /></>,
  card: <><rect x="3" y="6" width="18" height="12.5" rx="2.2" /><path d="M3 10.2h18M6.5 15h4" /></>,
  clock: <><circle cx="12" cy="12" r="8.6" /><path d="M12 7.4V12l3.1 2" /></>,
  bolt: <path style={{ fill: "currentColor", stroke: "none" }} d="M13.4 2.5L4.8 13.6h6.1l-1.2 7.9 8.7-11.3h-6.2z" />,
  speech: <path d="M4.2 5.5h15.6a1.7 1.7 0 0 1 1.7 1.7v8.2a1.7 1.7 0 0 1-1.7 1.7H10.4l-4.6 3.4v-3.4H4.2a1.7 1.7 0 0 1-1.7-1.7V7.2a1.7 1.7 0 0 1 1.7-1.7z" />,
  thought: <><path d="M7.8 15.6a3.7 3.7 0 0 1-.6-7.4 5 5 0 0 1 9.5-1 3.6 3.6 0 0 1 .3 7.2c-.4.8-1.2 1.2-2.1 1.2z" /><circle cx="6.6" cy="18.6" r="1.1" /><circle cx="4.2" cy="21" r=".6" /></>,
  clipboard: <><rect x="5" y="4.5" width="14" height="16.5" rx="2" /><path d="M9 4.5V3.2h6v1.3" /><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" /></>,
  sprout: <><path d="M12 21V10" /><path d="M12 10c0-3.2 2.6-5.5 6.5-5.5 0 3.2-2.6 5.5-6.5 5.5z" /><path d="M12 14c0-3-2.5-5.2-6-5.2 0 3 2.5 5.2 6 5.2z" /></>,
  broom: <><path d="M15.5 2.8l-4.2 8.6" /><path d="M8.2 10.6l6.4 3-1.6 7.1c-2.8-.5-5.6-1.8-7.8-4z" /><path d="M8.9 15.6l-1.6 2.6M11.6 16.9l-.8 2.9" /></>,
  thermo: <><path d="M9.8 4.6a2.2 2.2 0 0 1 4.4 0v9.1a4.3 4.3 0 1 1-4.4 0z" /><path d="M12 9.2v6.6" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  cards: <><rect x="3.4" y="6.4" width="10" height="14" rx="1.7" transform="rotate(-9 8.4 13.4)" /><rect x="10.6" y="3.6" width="10" height="14" rx="1.7" transform="rotate(9 15.6 10.6)" /></>,
  search: <><circle cx="10.4" cy="10.4" r="6.2" /><path d="M15 15l5.6 5.6" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  mask: <><path d="M4.5 4.2h10.5v6.6a5.25 5.25 0 0 1-10.5 0z" /><path d="M7.6 8.6h.01M11.9 8.6h.01" /><path d="M7.9 12.4q1.85 1.5 3.7 0" /><path d="M15 8h4.5v5.4a4.6 4.6 0 0 1-5.8 4.4" /></>,
};

P.headphones = <><path d="M4 14.5v-2.5a8 8 0 0 1 16 0v2.5" /><rect x="3" y="14" width="4.6" height="6.6" rx="1.7" /><rect x="16.4" y="14" width="4.6" height="6.6" rx="1.7" /></>;
P.stop = <rect x="6.5" y="6.5" width="11" height="11" rx="2" style={{ fill: "currentColor", stroke: "none" }} />;
P.mentor = <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6" /><path d="M13.5 14l2.6 2.6 5-5.2" /></>;
P.share = <><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4" /></>;
P.mic = <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>;
P.bell = <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>;

// Стакан — цель дня: наполняется шагами (Доп. 298)
export function Glass({ pct = 0, s = 22 }) {
  const gid = useUid("tbgl");
  const p = Math.max(0, Math.min(1, pct || 0));
  return (
    <svg className="glass" width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <defs><clipPath id={gid}><path d="M6.7 4.6h10.6l-1.5 14.7a1.5 1.5 0 0 1-1.5 1.3H9.7a1.5 1.5 0 0 1-1.5-1.3z" /></clipPath></defs>
      <g clipPath={`url(#${gid})`}><rect className="gl-w" x="5" y={4.6 + 16 * (1 - p)} width="14" height={16 * p + 0.5} /></g>
      <path className="gl-o" d="M5.6 3.6h12.8l-1.7 16a2.2 2.2 0 0 1-2.2 2H9.5a2.2 2.2 0 0 1-2.2-2z" />
      <path className="gl-s" d="M8.5 6.6l.9 10.4" />
    </svg>
  );
}

// Значок ситуации на «тарелке» (вместо эмодзи)
export function SitIcon({ name, s = 20 }) {
  return <Ic n={P[name] ? name : "guest"} s={s} />;
}

export function Ic({ n, s = 20 }) {
  return <svg className="tb-ic" width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">{P[n] || null}</svg>;
}

let seq = 0;
const useUid = (p) => {
  const ref = React.useRef(null);
  if (ref.current === null) ref.current = p + (++seq);
  return ref.current;
};

// Свеча на столе — серия дней: горит, когда сегодня уже занимался
export function Candle({ lit, s = 22 }) {
  const gid = useUid("tbfl");
  return (
    <svg className={"candle" + (lit ? " lit" : "")} width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--flame-a, #F8D27A)" }} />
          <stop offset="1" style={{ stopColor: "var(--flame-b, #E2873A)" }} />
        </linearGradient>
      </defs>
      <circle className="glow" cx="12" cy="5.6" r="5.2" />
      <path className="fo" d="M12 1.8c1.5 1.9 2.4 3.2 2.4 4.6a2.4 2.4 0 0 1-4.8 0c0-1.4.9-2.7 2.4-4.6z" />
      <rect className="cw" x="8.2" y="10" width="7.6" height="11.6" rx="1.5" />
      <path className="drip" d="M8.2 12.6c0-1.1.5-1.9 1.5-2.4h2.1v3.4a1 1 0 0 1-2 0v-.4a.8.8 0 0 0-1.6 0z" />
      <path className="wick" d="M12 10V7.6" />
      <path className="base" d="M5.2 21.9h13.6" />
      <path className="fl" style={{ fill: `url(#${gid})` }} d="M12 .9c1.8 2.2 2.9 3.8 2.9 5.4a2.9 2.9 0 0 1-5.8 0c0-1.6 1.1-3.2 2.9-5.4z" />
      <path className="fc" d="M12 4.6c.9 1 1.3 1.8 1.3 2.5a1.3 1.3 0 0 1-2.6 0c0-.7.4-1.5 1.3-2.5z" />
    </svg>
  );
}

const WAX_BLOB = "M12 1.9c2.3-.3 4.5.7 6.1 2.2 1.6 1.5 2.9 3.5 3.5 5.6.6 2.2.2 4.6-1 6.5-1.1 1.9-3 3.5-5.1 4.4-2.1.9-4.6 1-6.7.1-2.1-.8-3.9-2.5-5-4.5-1.1-2-1.5-4.4-.9-6.6C3.5 7.4 5 5.4 6.9 4 8.4 2.9 10.2 2.1 12 1.9Z";

// Сургучная печать — сданный тест раздела
export function Wax({ s = 26 }) {
  const gid = useUid("tbwax");
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id={gid} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#C25538" /><stop offset=".45" stopColor="#96331F" /><stop offset=".8" stopColor="#6E2314" /><stop offset="1" stopColor="#521708" />
        </radialGradient>
      </defs>
      <path d={WAX_BLOB} fill={`url(#${gid})`} />
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="rgba(60,12,4,.75)" strokeWidth="1.4" />
      <path d="M12 8.4l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="#F2D7B8" opacity=".92" />
    </svg>
  );
}

export const plural = (n, a, b, c) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return a;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b;
  return c;
};
