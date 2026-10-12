// ui/table-css.js — стили формата «у стола» (Доп. 289–292).
// Один <style id="sa-table-css">, классы с приставкой tb-. Палитра — переменные:
// тёмная по умолчанию, светлая — под html.sa-light (класс ставит App по теме).
// Рукописный шрифт (записки наставника, «пройден» в меню) — Marck Script. Доп. 294:
// лежит внутри приложения (assets/fonts, лицензия OFL), раньше грузился из Google
// Fonts — без сети почерк превращался в обычный шрифт. Vite кладёт файл в /assets/
// с хэшем, сервис-воркер его кэширует — работает и офлайн.

const HAND_FONT_URL = new URL("../assets/fonts/marck-script.woff", import.meta.url).href;

export const TABLE_CSS = `
@font-face{font-family:'Marck Script';src:url(${HAND_FONT_URL}) format('woff');font-weight:400;font-style:normal;font-display:swap}
.tb,.tbm,.tbv{--bg:#14110A;--bg-2:#1C1509;--glow:rgba(214,170,80,0.11);--bar:#16120A;
  --text:#EFE4C8;--sub:#AA9D80;--faint:#7F7461;
  --gold:#C8A96E;--gold-hi:#E4C88C;--gold-deep:#7A5D2A;--gold-ink:#D9B87C;--on-gold:#1A1008;
  --ok:#5DBB8A;--ok-ink:#8AD8AF;--ok-wash:rgba(93,187,138,0.13);--ok-edge:rgba(93,187,138,0.5);
  --bad:#E07878;--bad-ink:#F3A8A8;--bad-wash:rgba(224,120,120,0.13);--bad-edge:rgba(224,120,120,0.5);
  --frost:#A3BAD4;--flame-a:#F8D27A;--flame-b:#E2873A;--flame-core:rgba(255,244,214,0.92);--flame-off:#6E6450;
  --glass:rgba(226,186,116,0.085);--glass-2:rgba(226,186,116,0.15);--sheet:#1E170C;
  --edge:rgba(255,255,255,0.13);--edge-gold:rgba(214,178,102,0.45);--inner:rgba(255,248,230,0.07);--hi:rgba(255,255,255,0.12);
  --drop:rgba(0,0,0,0.45);--track:rgba(255,255,255,0.09);--scrim:rgba(8,6,3,0.62);
  --paper:#F7EEDB;--paper-ink:#3A2A14;--paper-sub:#7A6446;--paper-line:#D9CBB0;
  --cur-bg:linear-gradient(180deg,rgba(214,178,102,0.17),rgba(214,178,102,0.05));--cur-edge:rgba(214,178,102,0.4);--cur-top:rgba(226,190,120,0.46);
  --cur-shadow:inset 0 0 22px rgba(255,240,205,0.08),inset 0 1px 0 rgba(255,255,255,0.13),0 5px 16px rgba(0,0,0,0.45);
  --mk-bg:#1E170C;--slot:rgba(0,0,0,0.32);--chip-bg:#1A1409;--candle:#F3E6C8;--candle-edge:#9C7B45;--plate:#EFE4C8;--water:#9DBAD6;
  /* v32 (Доп. 338): шторки — тоже «морозный лёд»: тёплое стекло, золотая кромка сверху, свечение изнутри */
  --sheet-bg:linear-gradient(180deg,rgba(46,35,18,0.98),rgba(28,21,10,0.98));--sheet-edge:rgba(214,178,102,0.2);--sheet-top:rgba(215,170,68,0.55);
  --sheet-shadow:inset 0 0 26px rgba(255,248,230,0.06),inset 0 1px 0 rgba(255,236,190,0.16),0 -12px 44px rgba(0,0,0,0.45);
  --font-display:'Piazzolla',Georgia,'Times New Roman',serif;--font-body:Georgia,'Times New Roman',serif;
  --font-hand:'Marck Script','Caveat','Segoe Script',cursive;--font-mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace}
html.sa-light .tb,html.sa-light .tbm,html.sa-light .tbv{--bg:#E8DEC8;--bg-2:#EFE6D3;--glow:rgba(255,251,240,0.85);--bar:#F0E8D6;
  --text:#2A1F0E;--sub:#64523A;--faint:#8A7A5C;
  --gold:#A8843F;--gold-ink:#76561C;
  --ok:#3E9A6A;--ok-ink:#25643F;--ok-wash:rgba(62,154,106,0.12);--ok-edge:rgba(62,154,106,0.5);
  --bad:#D2685A;--bad-ink:#8B3020;--bad-wash:rgba(201,89,74,0.11);--bad-edge:rgba(201,89,74,0.5);
  --frost:#3E5C80;--flame-a:#F3BE4E;--flame-b:#D46F28;--flame-core:rgba(255,246,222,0.95);--flame-off:#B5A88E;
  --glass:rgba(250,242,222,0.62);--glass-2:rgba(255,249,236,0.92);--sheet:#F6EEDC;
  --edge:rgba(139,106,48,0.28);--edge-gold:rgba(139,106,48,0.55);--inner:rgba(255,255,255,0.55);--hi:rgba(255,255,255,0.9);
  --drop:rgba(120,85,25,0.16);--track:rgba(120,90,30,0.14);--scrim:rgba(70,52,24,0.35);
  --cur-bg:linear-gradient(180deg,rgba(236,214,166,0.5),rgba(250,242,222,0.72));--cur-edge:rgba(150,112,40,0.42);--cur-top:rgba(175,135,50,0.58);
  --cur-shadow:inset 0 0 22px rgba(255,255,255,0.6),inset 0 1px 0 rgba(255,255,255,0.95),0 4px 12px rgba(120,85,25,0.14);
  --mk-bg:#F6EEDC;--slot:rgba(120,90,40,0.18);--chip-bg:#F7F0E0;--candle:#FFF8EA;--plate:#FFFDF6;--water:#5D86B0;
  --sheet-bg:linear-gradient(180deg,rgba(255,252,244,0.99),rgba(247,239,222,0.99));--sheet-edge:rgba(139,106,48,0.24);--sheet-top:rgba(255,255,255,0.95);
  --sheet-shadow:inset 0 0 26px rgba(255,255,255,0.55),inset 0 1px 0 #fff,0 -10px 36px rgba(120,85,25,0.18)}

.tb *,.tbm *{box-sizing:border-box}
:where(.tb,.tbm) button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;margin:0}
:where(.tb) button:disabled{cursor:default}
.tb-col{width:100%;max-width:560px;margin:0 auto}
.tb-ic{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto;display:block}
/* свеча — серия */
.candle{overflow:visible}
.candle .cw{fill:var(--candle);stroke:var(--candle-edge);stroke-width:.9}
.candle .wick{stroke:#3A2A14;stroke-width:1.2;stroke-linecap:round}
.candle .drip{fill:var(--candle);opacity:.9}
.candle .fo{fill:none;stroke:var(--flame-off);stroke-width:1.2;stroke-dasharray:1.5 1.6;transition:opacity .3s}
.candle.lit .fo{opacity:0}
.candle .base{fill:none;stroke:var(--gold-ink);stroke-width:1.7;stroke-linecap:round}
.candle .fl,.candle .fc{transform-box:fill-box;transform-origin:50% 100%;transition:transform .5s cubic-bezier(.2,1.5,.4,1),opacity .25s}
.candle .fc{fill:var(--flame-core)}
.candle .glow{fill:var(--flame-a);opacity:.2;transition:opacity .5s}
.candle:not(.lit) .fl,.candle:not(.lit) .fc{transform:scale(0);opacity:0}
.candle:not(.lit) .glow{opacity:0}
@keyframes tbHalo{0%,100%{opacity:.9;transform:scale(1)}50%{opacity:.3;transform:scale(1.07)}}
@keyframes tbWrite{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@media (prefers-reduced-motion: reduce){.tbm-cur .tbm-mk::after,.tbm-hand.just{animation:none!important}}

/* ── меню раздела (ModuleScreen) ── */
.tbm{color:var(--text);font-family:var(--font-body)}
.tbm-menu{position:relative;margin:4px 14px 6px;padding:15px 12px 4px;border-radius:22px;border:1px solid var(--edge);
  background:linear-gradient(180deg,var(--glass-2),var(--glass) 42%);box-shadow:inset 0 0 22px var(--inner),inset 0 1px 0 var(--hi),0 6px 18px var(--drop)}
.tbm-lasse{position:absolute;right:26px;top:-1px;width:9px;height:30px;clip-path:polygon(0 0,100% 0,100% 100%,50% 76%,0 100%)}
.tbm-head{text-align:center;padding:0 10px}
/* v32 (Доп. 334): меню темы компактнее — значок в строке метки, плотнее шапка и строки шагов */
.tbm-top{display:flex;align-items:center;justify-content:center;gap:7px;min-width:0}
.tbm-icon{display:flex;justify-content:center;margin:0;flex:0 0 auto}
.tbm-icon svg{width:20px;height:20px}
.tbm-eyebrow{font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.8px;text-transform:uppercase}
.tbm-title{font-family:var(--font-display);font-size:21.5px;font-weight:700;line-height:1.15;margin:6px 0 3px;text-wrap:balance;color:var(--text)}
.tbm-sub{margin:0;color:var(--sub);font-style:italic;font-size:13px;line-height:1.3;text-wrap:balance}
.tbm-orn{display:flex;align-items:center;gap:10px;max-width:180px;margin:9px auto 5px;color:var(--gold-ink);font-size:10px;line-height:1}
.tbm-orn i{flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--edge-gold))}
.tbm-orn i:last-child{background:linear-gradient(90deg,var(--edge-gold),transparent)}
.tbm-list{list-style:none;margin:0;padding:0}
.tbm-list>li{position:relative;--my:17px}
.tbm-list>li::before,.tbm-list>li::after{content:"";position:absolute;left:12px;width:2px;margin-left:-1px;background:repeating-linear-gradient(to bottom,var(--edge-gold) 0 3px,transparent 3px 7px)}
.tbm-list>li::before{top:0;height:var(--my)}
.tbm-list>li::after{top:var(--my);bottom:0}
.tbm-list>li:first-child::before,.tbm-list>li:last-child::after{display:none}
.tbm-list>li.pd::before,.tbm-list>li.sd::after{background:var(--gold)}
.tbm-list>li.cur{--my:34px}
.tbm-node{position:relative;display:block;width:100%;min-height:40px;padding:7px 2px 8px 34px;border:0;background:none;text-align:left;color:var(--text)}
.tbm-mk{position:absolute;left:3px;top:calc(var(--my) - 9px);width:18px;height:18px;border-radius:50%;display:grid;place-items:center;z-index:1;background:var(--mk-bg);box-shadow:inset 0 0 0 1.5px var(--edge-gold);color:var(--gold-ink)}
.tbm-mk .nm{font:600 9.5px/1 var(--font-mono);letter-spacing:-.3px;color:var(--gold-ink)}
.tbm-node.done .tbm-mk{background:var(--gold);box-shadow:none;color:var(--on-gold)}
.tbm-cur .tbm-mk{background:var(--role-fill,var(--gold));box-shadow:0 0 0 4px var(--role-wash,rgba(214,178,102,.25))}
.tbm-cur .tbm-mk::after{content:"";position:absolute;inset:-8px;border-radius:50%;border:1.5px solid var(--role-edge,var(--edge-gold));animation:tbHalo 2.6s ease-in-out infinite}
.tbm-mk.seal{width:22px;height:22px;left:1px;top:calc(var(--my) - 11px);background:var(--slot);box-shadow:inset 0 1.5px 3px rgba(0,0,0,.35)}
.tbm-node.done .tbm-mk.seal{background:none;box-shadow:none}
.tbm-mk.seal svg{width:26px;height:26px;flex:0 0 auto;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
.tbm-row{display:flex;align-items:flex-end;min-width:0}
.tbm-t{min-width:0;font-family:var(--font-display);font-size:15.5px;line-height:1.28;color:var(--text)}
.tbm-node.done .tbm-t{color:var(--sub)}
.tbm-lead{flex:1 1 auto;min-width:16px;margin:0 8px 5px;border-bottom:1.5px dotted var(--edge-gold)}
.tbm-m{flex:0 0 auto;font-family:var(--font-mono);font-size:11px;letter-spacing:.6px;color:var(--sub);white-space:nowrap;padding-bottom:2px}
.tbm-hand{font-family:var(--font-hand);font-size:19px;letter-spacing:0;line-height:1;color:var(--gold-ink);padding-bottom:0}
.tbm-hand.just{animation:tbWrite 1s .3s ease-out both}
.tbm-s{display:block;margin-top:1px;font-style:italic;font-size:12px;line-height:1.3;color:var(--sub)}
.tbm-list>li.final>.tbm-node::before{content:"";position:absolute;left:34px;right:2px;top:0;border-top:3px double var(--edge-gold)}
.tbm-list>li.final>.tbm-node{padding-top:10px}
.tbm-card{display:flex;align-items:center;gap:10px;padding:10px 10px 10px 12px;border-radius:18px;background:var(--cur-bg);border:1px solid var(--cur-edge);border-top-color:var(--cur-top);box-shadow:var(--cur-shadow)}
.tbm-cc{flex:1;min-width:0}
.tbm-ck{display:flex;align-items:center;gap:7px;font-family:var(--font-mono);font-size:10px;letter-spacing:1px;color:var(--sub);white-space:nowrap;overflow:hidden}
.tbm-kchip{font-family:var(--font-mono);font-size:9px;letter-spacing:1.2px;padding:2px 7px;border-radius:999px;border:1px solid var(--role-edge,var(--edge-gold));color:var(--role-ink,var(--gold-ink));background:var(--chip-bg)}
.tbm-ct{display:block;margin:4px 0 1px;font-family:var(--font-display);font-size:17px;font-weight:700;line-height:1.22;color:var(--text);text-wrap:balance}
.tbm-cs{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;line-height:1.35;color:var(--sub)}
.tbm-cta{flex:0 0 auto;padding:9px 15px;border-radius:999px;font-family:var(--font-body);font-size:14px;font-weight:700;color:var(--on-gold);background:linear-gradient(180deg,var(--gold-hi),var(--gold));box-shadow:0 3px 10px var(--drop),inset 0 1px 0 rgba(255,255,255,.35);transition:transform .1s}
.tbm-node:active .tbm-cta{transform:scale(.96)}
.tbm-foot{display:flex;align-items:center;gap:10px;margin:2px 0 0;padding:8px 2px 9px 34px;border-top:1px dashed var(--edge-gold);font-family:var(--font-mono);font-size:10.5px;letter-spacing:.8px;color:var(--sub)}
/* v30: свежесть темы и действия (освежить, зачёт на опыт, раунд мастера) */
.tbm-acts{display:flex;flex-direction:column;align-items:center;gap:6px;margin:0 0 4px}
.tbm-fresh{font-family:var(--font-mono);font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#9C8E70;text-align:center}
.tbm-fresh.fading{color:#C9A35C}.tbm-fresh.faded{color:#D08A6A}.tbm-fresh.upd{color:#8FB0D6}
.tbm-actrow{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
.tbm-act{font:600 12px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:6px 12px;border-radius:999px;cursor:pointer;
  border:1px solid var(--role-edge,rgba(214,178,102,.5));background:transparent;color:var(--role-ink,#D9B87C)}
.tbm-act.hot{background:var(--role-wash,rgba(214,178,102,.18));border-color:var(--role-fill,#C8A96E);color:#F3E9D2}
html.sa-light .tbm-act.hot{color:#2A1F0E}
.tbm-act.gold{border-color:rgba(214,170,70,.7);color:#E8C56A}
.tbm-act.gold.got{background:linear-gradient(180deg,rgba(232,197,106,.22),rgba(201,154,46,.12))}
.tbm-act[disabled]{opacity:.55;cursor:default}
.tbm-act:focus-visible{outline:2px solid #D9B87C;outline-offset:2px}
html.sa-light .tbm-fresh{color:#6E5E40}html.sa-light .tbm-fresh.fading{color:#7A5A16}html.sa-light .tbm-fresh.faded{color:#8F3E20}html.sa-light .tbm-fresh.upd{color:#2F5A86}
html.sa-light .tbm-act.gold{border-color:#A07A22;color:#6B4E0E}
html.sa-light .tbm-act.gold.got{background:linear-gradient(180deg,rgba(232,197,106,.35),rgba(201,154,46,.2))}
.tbm-foot span{flex:1;min-width:0}
/* Доп. 298: стакан — цель дня */
.glass{overflow:visible}
.glass .gl-o{fill:none;stroke:var(--gold-ink);stroke-width:1.4;stroke-linejoin:round}
.glass .gl-w{fill:var(--water);transition:y .6s cubic-bezier(.2,.8,.2,1),height .6s cubic-bezier(.2,.8,.2,1)}
.glass .gl-s{fill:none;stroke:rgba(255,255,255,.45);stroke-width:1;stroke-linecap:round}
/* Доп. 296: живая свеча — пламя чуть колышется, когда серия сегодня продлена */
.candle.lit .fl{animation:tbFlick 2.8s ease-in-out infinite}
.candle.lit .glow{animation:tbGlow 2.8s ease-in-out infinite}
@keyframes tbFlick{0%,100%{transform:scale(1) rotate(-1.5deg)}30%{transform:scale(1.06,.97) rotate(1.5deg)}55%{transform:scale(.97,1.04) rotate(-.5deg)}80%{transform:scale(1.03) rotate(1deg)}}
@keyframes tbGlow{0%,100%{opacity:.2}50%{opacity:.34}}
/* Доп. 297: печать раздела — когда пройдены все шаги */
.tbm-seal{position:absolute;left:14px;top:12px;width:58px;height:58px;transform:rotate(-12deg);filter:drop-shadow(0 3px 5px rgba(0,0,0,.45));pointer-events:none}
.tbm-seal svg{width:58px;height:58px;display:block}
.tbm-seal.stamp{animation:tbStamp .75s cubic-bezier(.2,1.2,.3,1) .35s both}
.tbm-sealnote{display:inline-flex;align-items:center;gap:6px;margin:10px auto 0;padding:4px 10px;border-radius:999px;border:1px solid rgba(150,51,31,.45);color:#C0624B;font-family:var(--font-mono);font-size:10px;letter-spacing:1.4px;text-transform:uppercase}
html.sa-light .tbm-sealnote{color:#8B3020}
@keyframes tbStamp{0%{transform:rotate(-30deg) scale(2.3);opacity:0}55%{transform:rotate(-10deg) scale(.92);opacity:1}75%{transform:rotate(-13deg) scale(1.04)}100%{transform:rotate(-12deg) scale(1)}}
/* Доп. 307: трек — меню тем, листаются за пальцем; номера тем — оглавление, как страницы меню */
.tbp-strip{position:relative;z-index:6;display:flex;align-items:center;gap:8px;margin:10px 14px 6px}
/* v32 (Доп. 332): ряд номеров — в стеклянной капсуле «морозного льда»; текущая тема — под золотой монетой */
.tbp-cap{position:relative;flex:1;min-width:0;padding:1px 2px;border-radius:17px;background:rgba(226,186,116,.07);border:1px solid rgba(255,255,255,.11);
  box-shadow:inset 0 0 18px rgba(255,248,230,.05),inset 0 1px 0 rgba(255,255,255,.10),0 4px 14px rgba(0,0,0,.28)}
html.sa-light .tbp-cap{background:rgba(250,242,222,.62);border-color:rgba(139,106,48,.28);box-shadow:inset 0 0 18px rgba(255,255,255,.5),inset 0 1px 0 rgba(255,255,255,.9),0 4px 12px rgba(120,85,25,.12)}
.tbp-nums{position:relative;flex:1;min-width:0;display:flex;gap:0;overflow-x:auto;scrollbar-width:none;padding:0 3px}
.tbp-nums::-webkit-scrollbar{display:none}
.tbp-nums.over{gap:4px;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 14px),transparent);mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 14px),transparent)}
.tbp-num{flex:1 1 0;min-width:0;height:40px;padding:4px 0 0;border:0;border-radius:10px;background:transparent;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;gap:3px;color:#9C8D70;font:400 14px/1 Georgia,serif;font-variant-numeric:tabular-nums;letter-spacing:-.2px;
  -webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;transition:background .2s,color .2s,box-shadow .2s}
.tbp-nums.over .tbp-num{flex:0 0 auto;min-width:24px}
.tbp-num .n{display:block;height:26px;line-height:26px;white-space:nowrap}
.tbp-num .st{display:block;width:5px;height:5px;border-radius:50%;box-sizing:border-box}
.tbp-num.part{color:#CFC2A4}
.tbp-num.part .st{border:1.3px solid var(--dot,var(--role,#C8A96E))}
.tbp-num.done{color:var(--role,#C8A96E)}
.tbp-num.done .st{background:var(--dot,var(--role,#C8A96E))}
.tbp-num.cur{color:#E0C285}
.tbp-num.on{color:#F3E2B8;font-weight:700}
/* монета: едет за пальцем (transform из кода), внутри — те же номера тёмными цифрами */
.tbp-ind{position:absolute;left:0;top:4px;height:26px;width:24px;border-radius:13px;z-index:2;pointer-events:none;overflow:hidden;opacity:0;
  background:linear-gradient(180deg,#F3DFAD 0%,#DEBF84 46%,#B8925A 100%);
  box-shadow:inset 0 1px 0 rgba(255,250,232,.8),inset 0 -1px 0 rgba(110,72,24,.35),0 2px 8px rgba(0,0,0,.38),0 0 14px rgba(232,197,106,.28);will-change:transform}
.tbp-ind-row{position:absolute;left:0;top:0;height:100%;will-change:transform}
.tbp-ind-row span{position:absolute;top:0;width:40px;margin-left:-20px;height:100%;text-align:center;font:700 14px/26px Georgia,serif;font-variant-numeric:tabular-nums;letter-spacing:-.2px;color:#24180A;white-space:nowrap}
.tbp-ind-row span::before{content:attr(data-n)}   /* текст — из атрибута: копия номеров не попадает в текст страницы */
html.sa-light .tbp-ind{background:linear-gradient(180deg,#EBD39B 0%,#CDA862 52%,#A8843F 100%);box-shadow:inset 0 1px 0 rgba(255,250,232,.85),0 2px 7px rgba(120,85,25,.32)}
html.sa-light .tbp-ind-row span{color:#1E1407}
.tbp-num.on.done{color:#F3E2B8}
.tbp-num:focus-visible,.tbp-view:focus-visible{outline:2px solid #D9B87C;outline-offset:1px}
/* v30: тема выдыхается — номер и точка бледнеют; золотая тема — золотой номер; обновлённый урок — синяя точка */
.tbp-num.fade1 .n{opacity:.82}.tbp-num.fade1 .st{filter:saturate(.4);opacity:.75}
.tbp-num.fade2 .n{opacity:.66}.tbp-num.fade2 .st{filter:saturate(0);opacity:.55}
.tbp-num.gold .n{color:#E8C56A;text-shadow:0 0 8px rgba(232,197,106,.45)}.tbp-num.gold .st{background:#E8C56A!important;border-color:#E8C56A!important;filter:none;opacity:1}
.tbp-num.upd .st{background:#8FB0D6!important;border-color:#8FB0D6!important;filter:none;opacity:1}
/* v31: свежесть пройденной темы — «уровень вина» в бокале под номером (полный — свежая, на донышке — пора освежить) */
.tbp-num .wl{display:block;position:relative;width:7px;height:9px;margin:-2px auto 0;box-sizing:border-box;border:1.3px solid var(--dot,var(--role,#C8A96E));border-top-width:0;border-radius:0 0 3.5px 3.5px;overflow:hidden}
.tbp-num .wl b{position:absolute;left:0;right:0;bottom:0;background:var(--dot,var(--role,#C8A96E));transition:height .4s}
.tbp-num.fade1 .wl,.tbp-num.fade2 .wl{filter:none;opacity:1}
.tbm-cellar{margin-left:6px;padding:0;border:0;background:none;color:var(--gold-ink);font:700 11px var(--font-body);letter-spacing:.3px;cursor:pointer;text-transform:none}
html.sa-light .tbp-num.gold .n{color:#8A6410;text-shadow:none}html.sa-light .tbp-num.gold .st{background:#B8902E!important;border-color:#B8902E!important}
html.sa-light .tbp-num.upd .st{background:#2F5A86!important;border-color:#2F5A86!important}
.tbp-view{flex:0 0 auto;width:34px;height:34px;border-radius:50%;padding:0;cursor:pointer;display:grid;place-items:center;
  border:1px solid rgba(255,255,255,.12);background:rgba(226,186,116,.08);color:#C8A96E;box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 4px 12px rgba(0,0,0,.26)}
.tbp-mist{display:flex;align-items:center;gap:9px;margin:2px 14px 8px;padding:8px 12px;border-radius:14px;cursor:pointer;
  border:1px solid rgba(214,178,102,.3);background:rgba(255,250,238,.035);color:#D9B87C;font:13px/1.35 Georgia,serif}
.tbp-mist span:first-of-type{color:#EFE4C8}
.tbp-vp{position:relative;overflow:hidden;touch-action:pan-y}
.tbp-track{position:relative;will-change:transform}
.tbp-side{position:absolute;top:0;left:calc(var(--k,1) * (100% - 22px));width:100%;pointer-events:none}
/* v32: текущая страница — тоже отдельный блок (поля меню не «схлопываются» наружу), иначе после
   свайпа её содержимое подпрыгивало на 4 px относительно того, как она выглядела соседней */
.tbp-cur{display:flow-root}
.tbp-fade{animation:tbpFade .26s ease-out}
@keyframes tbpFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
html.sa-light .tbp-num{color:#6E5E40}
html.sa-light .tbp-num.part{color:#4A3B22}
html.sa-light .tbp-num.part .st{border-color:var(--dot,var(--role-ink,#7A5D2A))}
html.sa-light .tbp-num.done{color:var(--role-ink,#7A5D2A)}
html.sa-light .tbp-num.done .st{background:var(--dot,var(--role-ink,#7A5D2A))}
html.sa-light .tbp-num.cur{color:#8B6420}
html.sa-light .tbp-num.on{color:#2A1F0E}
html.sa-light .tbp-num.on.done{color:#2A1F0E}
html.sa-light .tbp-view{border-color:rgba(139,106,48,.3);background:rgba(250,242,222,.62);color:#7A5D2A;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 3px 10px rgba(120,85,25,.12)}
html.sa-light .tbp-mist{border-color:rgba(150,112,40,.3);background:rgba(250,242,222,.6);color:#7A5D2A}
html.sa-light .tbp-mist span:first-of-type{color:#2A1F0E}
/* Доп. 308: трек — закладки соседних тем на краях, свечение цвета темы, «Дальше» в конце меню,
   номера прилипают сверху, название темы по долгому нажатию, «К уроку» над нижним меню */
.tbp-root{position:relative;isolation:isolate}
.tbp-tint{position:absolute;left:0;right:0;top:0;height:640px;z-index:-1;pointer-events:none;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 24%,#000 76%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 24%,#000 76%,transparent 100%)}
@media (max-width:360px){.tbp-strip{gap:5px;margin-left:10px;margin-right:10px}.tbp-num{font-size:12.5px;letter-spacing:-.5px}.tbp-nums.over .tbp-num{min-width:20px}.tbp-ind-row span{font-size:12.5px;letter-spacing:-.5px}.tbp-view{width:30px;height:30px}}
.tbp-tint i{position:absolute;inset:0;display:block}
.tbp-tint .b{opacity:0}
.tbp-tint .a.in{animation:tbpTintIn .5s ease-out}
@keyframes tbpTintIn{from{opacity:0}to{opacity:1}}
.tbp-tab{position:absolute;top:26px;z-index:3;width:14px;height:32px;padding:0;border:0;cursor:pointer;display:grid;place-items:center;
  font:700 10.5px/1 Georgia,serif;font-variant-numeric:tabular-nums;letter-spacing:-.5px;
  box-shadow:0 2px 8px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.22);-webkit-tap-highlight-color:transparent}
.tbp-tab.pv{left:calc(var(--k,-1) * (100% - 22px) + 100% - 22px);border-radius:0 8px 8px 0}
.tbp-tab.nx{left:calc(var(--k,1) * (100% - 22px) + 8px);border-radius:8px 0 0 8px}
.tbp-tab::after{content:"";position:absolute;top:-8px;bottom:-8px;left:-6px;right:-10px}
.tbp-tab.nx::after{left:-10px;right:-6px}
.tbp-tab:focus-visible{outline:2px solid #D9B87C;outline-offset:1px}
.tbp-nextlink{display:flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;width:calc(100% - 28px);min-height:44px;margin:4px 14px 2px;padding:8px 12px;
  border:0;border-radius:14px;background:transparent;cursor:pointer;font:italic 14px/1.3 Georgia,serif;color:#B9AB8C;text-align:center;-webkit-tap-highlight-color:transparent}
.tbp-nextlink b{font-style:normal;font-weight:400;color:#EFE4C8;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tbp-nextlink .ar{font-style:normal;color:#D9B87C;font-size:18px;line-height:1}
.tbp-nextlink:focus-visible{outline:2px solid #D9B87C;outline-offset:-2px}
.tbp-peek{position:absolute;z-index:20;top:calc(100% + 6px);left:0;box-sizing:border-box;max-width:min(270px,calc(100% - 8px));padding:8px 12px 9px;border-radius:12px;pointer-events:none;
  background:#241C10;box-shadow:inset 0 0 0 1px rgba(214,178,102,.45),0 12px 28px rgba(0,0,0,.5);color:#EFE4C8;font:14px/1.3 Georgia,serif;animation:tbpPeekIn .16s ease-out}
.tbp-peek b{display:block;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tbp-peek span{display:block;margin-top:3px;font:12px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#B9AB8C}
.tbp-peek .ar{position:absolute;top:-5px;left:0;width:10px;height:10px;margin-left:-5px;transform:rotate(45deg);background:#241C10;box-shadow:inset 1px 1px 0 rgba(214,178,102,.45)}
@keyframes tbpPeekIn{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
.tbp-pin{position:fixed;z-index:330;top:0;left:50%;width:100%;max-width:430px;box-sizing:border-box;transform:translateX(-50%);
  padding:calc(env(safe-area-inset-top,0px) + 4px) 14px 5px;background:rgba(24,19,11,.94);-webkit-backdrop-filter:blur(16px) saturate(1.2);backdrop-filter:blur(16px) saturate(1.2);
  border-bottom:1px solid rgba(214,178,102,.22);box-shadow:0 10px 24px rgba(0,0,0,.35);animation:tbpPinIn .22s ease-out}
.tbp-pin .tbp-strip{margin:0}
.tbp-pin .tbp-num{height:34px;padding-top:3px;gap:2px}
.tbp-pin .tbp-num .n{height:22px;line-height:22px}
.tbp-pin .tbp-ind{top:3px;height:22px;border-radius:11px}
.tbp-pin .tbp-ind-row span{line-height:22px}
.tbp-pin .tbp-cap{box-shadow:inset 0 0 14px rgba(255,248,230,.05),inset 0 1px 0 rgba(255,255,255,.10)}
.tbp-pin .tbp-view{width:28px;height:28px}
.tbp-pin-t{display:block;box-sizing:border-box;width:100%;margin:1px 0 0;padding:2px 4px 0;border:0;background:none;cursor:pointer;text-align:center;
  font:italic 12.5px/1.35 Georgia,serif;color:#B9AB8C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;-webkit-tap-highlight-color:transparent}
.tbp-pin-t b{font-style:normal;font-weight:400;color:#EFE4C8}
@keyframes tbpPinIn{from{transform:translate(-50%,-100%)}to{transform:translate(-50%,0)}}
.tbp-go{position:fixed;z-index:340;left:max(14px,calc(50% - 201px));bottom:calc(max(env(safe-area-inset-bottom,0px),8px) + 78px);box-sizing:border-box;max-width:min(calc(100% - 100px),320px);
  display:flex;align-items:center;gap:7px;height:40px;padding:0 15px 0 11px;border:0;border-radius:999px;cursor:pointer;
  background:rgba(32,25,13,.88);-webkit-backdrop-filter:blur(14px) saturate(1.2);backdrop-filter:blur(14px) saturate(1.2);
  box-shadow:inset 0 0 0 1px rgba(214,178,102,.5),inset 0 1px 0 rgba(255,255,255,.12),0 8px 22px rgba(0,0,0,.45);
  color:#EFE4C8;font:13.5px/1.2 Georgia,serif;-webkit-tap-highlight-color:transparent;animation:tbpGoIn .3s cubic-bezier(.2,.8,.2,1)}
.tbp-go .ic{flex:0 0 auto;display:inline-flex;color:#D9B87C}
.tbp-go .k{flex:0 0 auto;color:#E0C285;font-weight:700}
.tbp-go .t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tbp-go:focus-visible{outline:2px solid #D9B87C;outline-offset:2px}
@keyframes tbpGoIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
html.sa-light .tbp-nextlink{color:#6B5B40}
html.sa-light .tbp-nextlink b{color:#2A1F0E}
html.sa-light .tbp-nextlink .ar{color:#7A5D2A}
html.sa-light .tbp-peek,html.sa-light .tbp-peek .ar{background:#FFFBF2}
html.sa-light .tbp-peek{box-shadow:inset 0 0 0 1px rgba(139,106,48,.42),0 10px 22px rgba(120,90,30,.2);color:#2A1F0E}
html.sa-light .tbp-peek .ar{box-shadow:inset 1px 1px 0 rgba(139,106,48,.42)}
html.sa-light .tbp-peek span{color:#6B5B40}
html.sa-light .tbp-pin{background:rgba(247,240,224,.96);border-bottom-color:rgba(150,112,40,.28);box-shadow:0 10px 22px rgba(120,90,30,.16)}
html.sa-light .tbp-pin-t{color:#6B5B40}
html.sa-light .tbp-pin-t b{color:#2A1F0E}
html.sa-light .tbp-go{background:rgba(251,246,234,.94);box-shadow:inset 0 0 0 1px rgba(139,106,48,.5),inset 0 1px 0 rgba(255,255,255,.9),0 8px 20px rgba(120,90,30,.22);color:#2A1F0E}
html.sa-light .tbp-go .ic,html.sa-light .tbp-go .k{color:#7A5D2A}
@media (prefers-reduced-motion: reduce){.candle.lit .fl,.candle.lit .glow,.tbm-seal.stamp,.tbp-fade,.tbp-pin,.tbp-go,.tbp-peek,.tbp-tint .a.in{animation:none!important}.tbp-ind,.tbp-ind-row,.tbp-tab{transition:none!important}}
`;

export function ensureTableCss() {
  if (typeof document === "undefined" || !document.getElementById || !document.head) return;
  if (document.getElementById("sa-table-css")) return;
  const el = document.createElement("style");
  el.id = "sa-table-css";
  el.textContent = TABLE_CSS;
  document.head.appendChild(el);
}
