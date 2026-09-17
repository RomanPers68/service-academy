// ui/icons-extra.jsx
// Мелкие SVG-иконки, вынесены из App.jsx без изменений. Используются в карточках статистики/команды.

import React from "react";

export function crownIcon(color, size=22){
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 16L3.4 7.8l4.8 3.4L12 5.5l3.8 5.7 4.8-3.4L19 16z"/><path d="M5 19h14"/></svg>);
}
export function flameIcon(color, size=24){
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2c0 3-2 4-2 7 0 1 .6 1.7 1.5 1.7S14 9.8 14 9c1 1.2 2 2.7 2 4.5a5 5 0 0 1-10 0C6 9 10 6 13 2z"/></svg>);
}
export function trophyIcon(color, size=18){
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H5a2 2 0 0 0 2 4"/><path d="M17 6h2a2 2 0 0 1-2 4"/><path d="M12 14v3"/><path d="M9.5 20h5l-.6-3h-3.8z"/></svg>);
}
export function faceIcon(level, color, size=28){
  const m={1:"M8.5 16.2 Q12 13.4 15.5 16.2",2:"M8.7 15.5 Q12 14.2 15.3 15.5",3:"M9 15 H15",4:"M8.7 14.6 Q12 16.4 15.3 14.6",5:"M8 14 Q12 17.8 16 14"};
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="0.7" fill={color} stroke="none"/><circle cx="15" cy="10" r="0.7" fill={color} stroke="none"/><path d={m[level]||m[3]}/></svg>);
}
