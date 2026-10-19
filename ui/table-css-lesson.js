// ui/table-css-lesson.js — стили самого урока «у стола» (Доп. 289–290): грузятся
// вместе с ленивым модулем ui/table.jsx, на старт приложения не попадают.
// Переменные палитры, иконки, свеча и меню раздела — в ui/table-css.js.

export const TABLE_LESSON_CSS = `
/* ── оболочка урока ── */
.tb{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;color:var(--text);font-family:var(--font-body);
  background:radial-gradient(130% 80% at 50% -5%,var(--glow),transparent 55%),linear-gradient(160deg,var(--bg),var(--bg-2) 50%,var(--bg));
  -webkit-text-size-adjust:100%;text-size-adjust:100%}
.tb-head{padding:max(44px,env(safe-area-inset-top,0px)) 16px 8px}
.tb-top{display:flex;align-items:center;gap:10px}
.tb-x{width:38px;height:38px;border-radius:50%;border:1px solid var(--edge);background:var(--glass);display:grid;place-items:center;color:var(--sub);flex:0 0 auto;padding:0}
.tb-host{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.tb-av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;border:1.5px solid var(--edge-gold);background:var(--glass-2);color:var(--gold-ink);font-size:18px;line-height:1}
.tb-host-t{min-width:0}
.tb-host-t b{display:block;font-family:var(--font-display);font-size:15.5px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tb-host-t span{display:block;font-size:12px;color:var(--sub);font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tb-mood{width:40px;height:40px;flex:0 0 auto;display:grid;place-items:center;border-radius:50%;border:1px solid var(--edge);background:var(--glass)}
.tb-mood .mf{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.tb-mood.m1,.tb-mood.m2{color:var(--bad-ink);border-color:var(--bad-edge)} .tb-mood.m3{color:var(--gold-ink)} .tb-mood.m4,.tb-mood.m5{color:var(--ok-ink);border-color:var(--ok-edge)}
.tb-mood.up{animation:tbPop .55s cubic-bezier(.2,1.4,.4,1)} .tb-mood.down{animation:tbShake .45s}
.tb-plates{display:flex;gap:3px;flex:0 0 auto}
.tb-plate .p1{fill:var(--plate);stroke:var(--gold-ink);stroke-width:1.2}
.tb-plate .p2{fill:none;stroke:var(--gold-ink);stroke-width:.9;opacity:.6}
.tb-plate .crack{fill:none;stroke:var(--bad);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.tb-plate.broken{opacity:.45}
.tb-plate.just{animation:tbShake .45s}
.tb-row2{display:flex;align-items:center;gap:8px;margin-top:9px}
.tb-prog{flex:1;min-width:0}
.tb-k{display:flex;align-items:baseline;gap:8px;font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.4px;color:var(--sub);text-transform:uppercase;white-space:nowrap}
.tb-k b{flex:0 0 auto;font-weight:400;color:var(--gold-ink)}
.tb-k span{min-width:0;overflow:hidden;text-overflow:ellipsis;font-family:var(--font-body);font-style:italic;font-size:12.5px;letter-spacing:0;text-transform:none}
.tb-beads{position:relative;height:12px;margin-top:7px}
.tb-beads .bi{position:relative;display:flex;justify-content:space-between;align-items:center;height:12px}
.tb-beads::before{content:"";position:absolute;left:4px;right:4px;top:50%;height:2px;margin-top:-1px;border-radius:1px;background:var(--track)}
.tb-beads .bf{position:absolute;left:4px;top:50%;height:2px;margin-top:-1px;border-radius:1px;background:var(--gold);transition:width .45s cubic-bezier(.2,.8,.2,1)}
.tb-beads i{position:relative;width:8px;height:8px;border-radius:50%;background:var(--mk-bg);box-shadow:inset 0 0 0 1.5px var(--edge-gold);transition:background .3s,transform .3s,box-shadow .3s}
.tb-beads i.on{background:var(--gold);box-shadow:none}
.tb-beads i.bad{background:var(--bad);box-shadow:none}
.tb-beads i.cur{transform:scale(1.45);box-shadow:inset 0 0 0 1.5px var(--gold)}
.tb-tool{width:34px;height:34px;border-radius:10px;border:1px solid var(--edge);background:var(--glass);color:var(--sub);display:grid;place-items:center;flex:0 0 auto;padding:0}
.tb-chip{display:inline-flex;align-items:center;gap:4px;font-family:var(--font-mono);font-size:10.5px;letter-spacing:.8px;color:var(--gold-ink);padding:3px 8px;border-radius:999px;border:1px solid var(--edge-gold);white-space:nowrap;flex:0 0 auto}
.tb-chip.hot{background:var(--glass-2)}
.tb-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:8px 16px 22px}
.tb-foot{padding:12px 16px calc(14px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--edge);background:var(--bar)}
.tb-foot:empty{display:none}
.tb-main{display:block;width:100%;min-height:52px;border-radius:999px;border:0;font-family:var(--font-body);font-weight:700;font-size:16px;letter-spacing:.3px;color:var(--on-gold);
  background:linear-gradient(180deg,var(--gold-hi),var(--gold));box-shadow:0 4px 14px var(--drop),inset 0 1px 0 rgba(255,255,255,.35);transition:transform .1s}
.tb-main:active{transform:scale(.98)}
.tb-main:disabled{background:var(--track);color:var(--sub);box-shadow:none;transform:none}
.tb-ghost{display:block;width:100%;padding:12px 12px 2px;border:0;background:none;color:var(--sub);font-size:14px;font-weight:700}
.tb-hint{margin:2px 0;text-align:center;color:var(--sub);font-size:13.5px}

/* ── сцена ── */
.tb-scene-row{display:flex;align-items:center;gap:8px;margin:4px 0 9px}
.tb-where{font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;padding:3px 9px;border-radius:999px;border:1px solid var(--edge-gold);color:var(--gold-ink);white-space:nowrap}
.tb-where.role{border-color:var(--role-edge,var(--edge-gold));color:var(--role-ink,var(--gold-ink))}
.tb-scene{display:flex;gap:12px;align-items:flex-start;margin:0 0 12px;padding:12px 14px;border-radius:16px;border:1px solid var(--edge);background:var(--glass);box-shadow:inset 0 0 16px var(--inner)}
.tb-scene .em{flex:0 0 auto;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-size:20px;line-height:1;color:#7A5A1E;background:var(--plate);box-shadow:inset 0 0 0 4px rgba(0,0,0,.05),0 2px 6px var(--drop)}
.tb-scene p{margin:0;font-size:15px;line-height:1.5;flex:1;min-width:0}
.tb-thought{max-width:92%;margin:0 0 10px;padding:10px 14px;border-radius:20px;border:1.5px dashed var(--edge-gold);font-style:italic;font-size:14.5px;line-height:1.45}
.tb-who{display:block;font-style:normal;font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:var(--gold-ink);margin-bottom:3px}
.tb-q{font-family:var(--font-display);font-size:19px;font-weight:700;line-height:1.3;margin:4px 0 12px;text-wrap:balance}
.tb-second{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:8px 12px;border-radius:12px;border:1px dashed var(--edge-gold);font-size:13px;line-height:1.35;color:var(--sub)}
.tb-second .tb-ic{color:var(--gold-ink)}
.tb-timer{height:6px;border-radius:999px;background:var(--track);overflow:hidden;margin:0 0 14px}
.tb-timer i{display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--bad),var(--gold));animation:tbDrain linear forwards}
.tb-timer.stop i{animation-play-state:paused}
/* варианты: реплики — черновики сообщения, действия — карточки */
.tb-replies{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.tb-reply{display:flex;align-items:center;gap:10px;max-width:94%;text-align:left;padding:11px 12px 11px 14px;border-radius:16px;border-bottom-right-radius:5px;border:1.5px dashed var(--edge-gold);background:var(--glass);font-size:15px;line-height:1.38;color:var(--text)}
.tb-reply .tb-ic{color:var(--gold-ink)}
.tb-acts{display:flex;flex-direction:column;gap:8px}
.tb-actc{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px 14px;border-radius:14px;border:1px solid var(--edge);background:var(--glass);box-shadow:inset 0 0 16px var(--inner);font-size:15px;line-height:1.38;color:var(--text)}
.tb-actc .tb-ic{color:var(--gold-ink);margin-left:auto}
.tb-reply:active,.tb-actc:active{background:var(--glass-2);transform:scale(.99)}
.tb-chat{display:flex;flex-direction:column;gap:8px;margin:0 0 12px}
.tb-chat:empty{display:none}
.tb-mine{align-self:flex-end;max-width:88%;padding:10px 13px;border-radius:16px;border-bottom-right-radius:5px;background:var(--cur-bg);border:1px solid var(--cur-edge);font-style:italic;font-size:14.5px;line-height:1.42}
.tb-mine::before{content:"→ ";color:var(--gold-ink);font-style:normal}
.tb-mine.good{border-color:var(--ok-edge)} .tb-mine.bad{background:var(--bad-wash);border-color:var(--bad-edge)}
.tb-actl{align-self:center;max-width:92%;text-align:center;font-style:italic;font-size:13.5px;line-height:1.4;color:var(--sub);padding:2px 8px}
.tb-typing{align-self:flex-start;display:flex;gap:4px;padding:13px 14px;border-radius:16px;border-bottom-left-radius:5px;background:var(--glass-2);border:1px solid var(--edge)}
.tb-typing i{width:6px;height:6px;border-radius:50%;background:var(--sub);animation:tbBlink 1s infinite}
.tb-typing i:nth-child(2){animation-delay:.15s} .tb-typing i:nth-child(3){animation-delay:.3s}
.tb-new{animation:tbUp .32s ease both}
/* записка наставника — бумага на скотче */
.tb-note{position:relative;margin:10px 2px 6px;padding:15px 16px 12px;border-radius:3px;background:var(--paper);color:var(--paper-ink);box-shadow:0 8px 22px var(--drop);transform:rotate(-.6deg)}
.tb-note::before{content:"";position:absolute;top:-9px;left:50%;width:70px;height:18px;margin-left:-35px;background:rgba(222,200,150,.62);transform:rotate(2.5deg);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.tb-note .nt{font-family:var(--font-hand);font-size:24px;line-height:1.1;margin:0 0 6px;color:#2E2010}
.tb-note .nt.ok{color:#2C6B48} .tb-note .nt.bad{color:#8B3A2E}
.tb-note p{margin:0 0 7px;font-size:14px;line-height:1.5}
.tb-note .na{display:block;font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.3px;text-transform:uppercase;color:var(--paper-sub);margin:0 0 2px}
.tb-note .nb{font-weight:700}
.tb-note .pts{font-family:var(--font-mono);font-size:11px;letter-spacing:.8px;color:var(--paper-sub);margin:2px 0 0}
.tb-note .sign{font-family:var(--font-hand);font-size:18px;color:var(--paper-sub);text-align:right;margin:2px 0 0}
/* «а теперь — вслух» */
.tb-say{margin:12px 0 4px;padding:12px 14px;border-radius:16px;border:1px solid var(--edge-gold);background:var(--glass)}
.tb-say .ph{display:flex;gap:10px;align-items:flex-start;margin:4px 0 10px}
.tb-say .ph p{margin:0;flex:1;min-width:0;font-family:var(--font-display);font-size:16px;line-height:1.4}
.tb-spk{flex:0 0 36px;width:36px;height:36px;border-radius:50%;border:1px solid var(--edge-gold);background:var(--glass-2);color:var(--gold-ink);display:grid;place-items:center;padding:0}
.tb-say .row{display:flex;gap:8px}
.tb-say .row button{flex:1;padding:9px;border-radius:12px;font-size:13px;font-weight:700;border:1.5px solid var(--edge-gold);background:transparent;color:var(--gold-ink)}
.tb-say .row button.yes{background:linear-gradient(180deg,var(--gold-hi),var(--gold));border-color:transparent;color:var(--on-gold)}
.tb-say .res{font-size:13px;font-weight:700;color:var(--ok-ink)} .tb-say .res.again{color:var(--gold-ink)}
/* правда или миф */
.tb-claim{margin:0 0 14px;padding:14px 16px;border-radius:16px;border:1px solid var(--edge);background:var(--glass);font-style:italic;font-size:16px;line-height:1.5}
.tb-claim .na{display:block;font-style:normal;font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.3px;text-transform:uppercase;color:var(--role-ink,var(--gold-ink));margin-bottom:5px}
.tb-myth{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 6px}
.tb-myth button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:15px 8px;border-radius:16px;border:1px solid var(--edge-gold);background:var(--glass-2);font-family:var(--font-display);font-size:19px;font-weight:700;color:var(--text)}
.tb-myth small{font-family:var(--font-body);font-size:12px;font-weight:400;color:var(--sub)}
.tb-myth button.right{border-color:var(--ok);background:var(--ok-wash)} .tb-myth button.wrong{border-color:var(--bad);background:var(--bad-wash)} .tb-myth button.dim{opacity:.45}
/* собери правило — записка с пропуском */
.tb-note.cloze{transform:rotate(.4deg)}
.tb-note.cloze p{font-size:15px;line-height:1.75}
.tb-blank{display:inline-block;min-width:110px;padding:0 6px;margin:0 2px;border-bottom:1.5px solid var(--paper-sub);font-family:var(--font-hand);font-size:20px;line-height:1.25;color:#2E2010;text-align:center}
.tb-blank.right{color:#2C6B48;border-bottom-color:#2C6B48} .tb-blank.wrong{color:#8B3A2E;border-bottom-color:#8B3A2E}
.tb-chips{display:flex;flex-direction:column;gap:8px}
.tb-chip2{width:100%;text-align:left;padding:11px 13px;border-radius:12px;border:1px solid var(--edge-gold);background:var(--glass-2);font-size:14.5px;line-height:1.38;color:var(--text)}
.tb-chip2:active{transform:scale(.99)}

/* ── итог: чек ── */
.tb-res{display:flex;flex-direction:column;align-items:center;gap:14px;padding:6px 0 10px;text-align:center}
.tb-stars{display:flex;gap:10px;justify-content:center;color:var(--gold)}
.tb-stars svg{width:34px;height:34px}
.tb-stars .off{color:var(--track)}
.tb-stars .s1{animation:tbPop .5s .15s both} .tb-stars .s2{animation:tbPop .5s .3s both} .tb-stars .s3{animation:tbPop .5s .45s both}
.tb-rslot{position:relative;width:100%;max-width:340px;padding-top:4px}
.tb-rslot::before{content:"";position:absolute;left:-4px;right:-4px;top:0;height:8px;border-radius:6px;background:var(--bar);box-shadow:inset 0 2px 4px rgba(0,0,0,.5),0 1px 0 var(--hi);z-index:2}
.tb-rslot-in{overflow:hidden;margin:0 -20px;padding:0 20px 30px}
.tb-receipt{position:relative;padding:18px 18px 14px;background:var(--paper);color:var(--paper-ink);font-family:var(--font-mono);font-size:12.5px;line-height:1.5;text-align:left;
  box-shadow:0 10px 26px var(--drop);animation:tbPrintIn .9s cubic-bezier(.2,.8,.2,1) both}
.tb-edge{position:absolute;left:0;top:100%;width:100%;height:9px;display:block}
.tb-edge path{fill:var(--paper)}
.r-brand{font-size:10.5px;letter-spacing:3px;color:var(--paper-sub);text-align:center}
.r-place{font-size:11px;color:var(--paper-sub);text-align:center;margin-top:1px}
.r-cut{border-top:1.5px dashed var(--paper-line);margin:11px 0}
.r-title{font-family:var(--font-display);font-size:24px;font-weight:700;text-align:center;line-height:1.15;margin:0;color:var(--paper-ink)}
.r-name{font-family:var(--font-body);font-style:italic;font-size:14px;text-align:center;color:var(--paper-sub);margin-top:2px;text-wrap:balance}
.r-meta{font-size:11px;letter-spacing:.6px;color:var(--paper-sub);text-align:center;margin-top:6px}
.r-lines{list-style:none;margin:0;padding:0}
.r-lines li{display:flex;align-items:flex-end;padding:2px 0}
.r-lines li>span{display:inline-flex;align-items:center;gap:6px;min-width:0}
.r-lines li>i{flex:1;min-width:12px;margin:0 6px 5px;border-bottom:1.5px dotted var(--paper-line)}
.r-lines li>b{white-space:nowrap;font-variant-numeric:tabular-nums}
.r-lines .tb-ic{color:var(--paper-sub)}
.r-total{display:flex;justify-content:space-between;align-items:baseline;margin-top:7px;padding-top:7px;border-top:1.5px solid var(--paper-ink)}
.r-total span{font-size:11.5px;letter-spacing:2.4px}
.r-total b{font-family:var(--font-display);font-size:22px;font-variant-numeric:tabular-nums}
.r-note{display:flex;gap:7px;align-items:flex-start;margin:9px 0 0;font-family:var(--font-body);font-size:12.5px;line-height:1.4;color:var(--paper-sub);font-style:italic}
.r-note .tb-ic{color:#3E5C80;margin-top:1px}
.r-thanks{font-family:var(--font-hand);font-size:27px;line-height:1.1;text-align:center;margin:14px 0 2px;color:#2E2010;transform:rotate(-2deg)}
.r-review{font-family:var(--font-hand);font-size:21px;line-height:1.25;margin:14px 0 2px;color:#2E2010;transform:rotate(-1deg)}
.r-by{font-family:var(--font-body);font-style:italic;font-size:12.5px;color:var(--paper-sub);text-align:right}
.tb-receipt .candle .cw{fill:#FFF8EA}
.tb-receipt .glass .gl-o{stroke:#7A5D2A}
.tb-receipt .glass .gl-w{fill:#5D86B0}
/* v30: золотая тема — кромка и печать на чеке раунда мастера */
.tb-receipt.gold{box-shadow:0 10px 26px var(--drop),inset 0 0 0 2px rgba(201,154,46,.55)}
.r-goldseal{position:absolute;right:12px;bottom:16px;width:58px;height:58px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;transform:rotate(-12deg);
  background:radial-gradient(circle at 34% 30%,#F6DD8C,#C99A2E 58%,#7A5612);box-shadow:0 4px 10px rgba(122,86,18,.45),inset 0 2px 4px rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.3);color:#3B2A08;animation:tbPop .6s .5s both}
.r-goldseal span{font-size:16px;line-height:1}
.r-goldseal small{font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.4px}
.r-stamp{width:max-content;max-width:100%;margin:10px auto 0;padding:5px 12px;border:1.5px solid #9A3B25;border-radius:6px;color:#9A3B25;font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.8px;transform:rotate(-3deg)}
.r-week{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin:12px 0 2px;text-align:center}
.r-week>span{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0}
.r-week small{font-size:10.5px;letter-spacing:.4px;color:var(--paper-sub)}
.r-week i{display:block;width:6px;height:6px;margin:6px 0;border-radius:50%;background:var(--paper-line)}
.r-week b{font-size:11px;min-height:16px;font-variant-numeric:tabular-nums}
.r-week .fr .tb-ic{color:#3E5C80;margin:1px 0}
/* Доп. 299: подсмотреть в уроке, послушать, автопереход, наставник */
.tb-peek{max-height:62vh;overflow-y:auto;margin:0 -2px 12px;padding:14px 16px 10px;border-radius:4px;background:var(--paper);color:var(--paper-ink);box-shadow:0 6px 16px var(--drop)}
.tb-peek .ey{font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.3px;text-transform:uppercase;color:var(--paper-sub);margin:0 0 4px}
.tb-peek h4{margin:0 0 8px;font-family:var(--font-display);font-size:17px;line-height:1.25;color:#2A1F0E}
.tb-peek p{margin:0 0 6px;font-size:14px;line-height:1.5}
.tb-peek p.b{font-weight:700;margin-top:8px}
.tb-peek p.li{padding-left:14px;position:relative}
.tb-peek p.li::before{content:"•";position:absolute;left:2px;color:#7A5A1E}
.tb-tool.on{color:var(--gold-ink);border-color:var(--edge-gold);background:var(--glass-2)}
.tb-main{position:relative;overflow:hidden}
.tb-main>.lbl{position:relative;z-index:1}
.tb-main>.auto{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(255,255,255,.34);animation:tbFill linear forwards}
@keyframes tbFill{from{width:0}to{width:100%}}
.tb-autohint{margin:8px 0 0;text-align:center;font-size:12px;color:var(--sub)}
/* v31: правила перед стартом (зачёт, раунд мастера, проверка по треку) */
.tb-intro{margin:6px 0 4px;padding:16px 16px 14px;border-radius:18px;border:1px solid var(--edge-gold);background:var(--glass);box-shadow:inset 0 0 22px var(--inner)}
.tb-intro-t{font-family:var(--font-display);font-size:21px;line-height:1.2;color:var(--text);margin-bottom:8px}
.tb-intro ul{list-style:none;margin:0;padding:0}
.tb-intro li{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-top:1px dashed var(--edge);font-size:15px;line-height:1.45;color:var(--text)}
.tb-intro li:first-child{border-top:0}
.tb-intro li>span:first-child{flex:0 0 22px;text-align:center;color:var(--gold-ink);font-size:15px}
.tb-intro-n{margin:10px 0 0;font-size:13px;line-height:1.45;color:var(--sub);font-style:italic}
/* v31: «запасная свеча» в раунде мастера — одна ошибка в запасе */
.tb-spare{flex:0 0 auto;margin-left:auto;display:inline-flex;align-items:center;gap:4px;font-family:var(--font-mono);font-size:10.5px;letter-spacing:1px;color:var(--gold-ink);text-transform:uppercase}
.tb-spare small{font-size:10.5px}
.tb-spare.out{color:var(--sub)}
/* v31: строки чека «какие темы освежены / что можно сдать на опыт» */
.r-topics{margin:8px 0 2px;padding:0;list-style:none}
.r-topics li{display:flex;align-items:baseline;gap:8px;padding:5px 0;border-top:1px dashed var(--paper-line);font-family:var(--font-body);font-size:13.5px;line-height:1.35;color:var(--paper-ink)}
.r-topics li:first-child{border-top:0}
.r-topics li .t{flex:1;min-width:0}
.r-topics li .v{flex:0 0 auto;font-family:var(--font-mono);font-size:11px;letter-spacing:.6px;color:var(--paper-sub)}
.r-topics li .v.ok{color:#2F6B45}
.r-topics li button{flex:0 0 auto;margin-left:6px;padding:5px 10px;border-radius:999px;border:1px solid #9C7B45;background:transparent;color:#5A4119;font:700 12px var(--font-body);cursor:pointer}
.tb-link{display:inline-flex;align-items:center;gap:6px;margin:4px 0 0;padding:0;border:0;background:none;font-size:13.5px;font-weight:700;color:#7A5A1E!important;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.tb-say .mic-row{display:flex;align-items:center;gap:10px;margin:2px 0 10px}
.tb-say .mic-row span{flex:1;font-size:12.5px;color:var(--sub);line-height:1.4}
.tb-said{margin:0 0 8px;font-family:var(--font-display);font-size:16px;line-height:1.5}
.tb-said .w-ok{color:var(--ok-ink)}
.tb-said .w-no{color:var(--bad-ink);text-decoration:underline dotted;text-underline-offset:3px}
.tb-heard{margin:0 0 8px;font-size:12.5px;font-style:italic;color:var(--sub)}
/* разбор раунда */
.tb-recap{width:100%;text-align:left;margin-top:4px}
.tb-recap h4{margin:0 0 8px;font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.6px;text-transform:uppercase;color:var(--gold-ink);font-weight:400}
.tb-recap li{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;margin:0 0 6px;border-radius:12px;border:1px solid var(--ok-edge);background:var(--ok-wash);list-style:none}
.tb-recap li.no{border-color:var(--bad-edge);background:var(--bad-wash)}
.tb-recap ul{margin:0;padding:0}
.tb-recap .t{font-size:13px;line-height:1.4}
.tb-recap .s{font-size:12px;line-height:1.4;margin-top:2px;color:var(--ok-ink)}
.tb-recap li.no .s{color:var(--bad-ink)}
/* шторка «выйти?» */
.tb-scrim{position:absolute;inset:0;z-index:5;background:var(--scrim);display:flex;align-items:flex-end;animation:tbFade .2s ease}
.tb-sheet{width:100%;max-width:560px;margin:0 auto;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));border-radius:22px 22px 0 0;background-color:var(--sheet);background-image:var(--sheet-bg,none);border:1px solid var(--sheet-edge,var(--edge));border-top-color:var(--sheet-top,var(--edge));border-bottom:0;box-shadow:var(--sheet-shadow,0 -10px 30px var(--drop));animation:tbUp .28s cubic-bezier(.2,.8,.2,1)}
.tb-sheet h3{margin:0 0 6px;font-family:var(--font-display);font-size:20px;font-weight:700}
.tb-sheet p{margin:0 0 14px;color:var(--sub);font-size:14px;line-height:1.5}

/* v40: светлая тема «Для чтения» — мелкий текст крупнее: подписи — от 13 px, моноширинные и
   заглавные метки — от 11 px. Тёмная тема — как была. Чек остаётся «кассовым» (моноширинный 12,5 px) */
html.sa-light .tb-host-t span{font-size:13px}
html.sa-light .tb-k{font-size:11px;letter-spacing:1.2px}
html.sa-light .tb-k span{font-size:13px}
html.sa-light .tb-chip{font-size:11px;letter-spacing:.6px}
html.sa-light .tb-where{font-size:11px;letter-spacing:1.2px}
html.sa-light .tb-who,html.sa-light .tb-note .na,html.sa-light .tb-claim .na,html.sa-light .tb-peek .ey{font-size:11px;letter-spacing:1.1px}
html.sa-light .tb-myth small{font-size:13px}
html.sa-light .tb-autohint{font-size:13px}
html.sa-light .tb-spare,html.sa-light .tb-spare small{font-size:11px;letter-spacing:.8px}
html.sa-light .tb-say .mic-row span,html.sa-light .tb-heard{font-size:13px}
/* подсказка «Проговори фразу вслух…» (без микрофона) — размер задан в ui/table.jsx прямо в разметке */
html.sa-light .tb-say>div:not([class]){font-size:13px!important}
html.sa-light .tb-recap h4{font-size:11px}
html.sa-light .tb-recap .s{font-size:13px}
html.sa-light .r-brand{font-size:11px;letter-spacing:2.6px}
html.sa-light .r-note,html.sa-light .r-by{font-size:13px}
html.sa-light .r-stamp{font-size:11px;letter-spacing:1.6px}
html.sa-light .r-week small{font-size:11px;letter-spacing:0}
html.sa-light .r-topics li button{font-size:13px}

@keyframes tbPop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.06);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes tbShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
@keyframes tbUp{from{transform:translateY(18px);opacity:0}to{transform:none;opacity:1}}
@keyframes tbFade{from{opacity:0}to{opacity:1}}
@keyframes tbBlink{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes tbDrain{from{width:100%}to{width:0}}
@keyframes tbPrintIn{0%{transform:translateY(-101%)}100%{transform:none}}
@media (prefers-reduced-motion: reduce){
  .tb-new,.tb-mood.up,.tb-mood.down,.tb-plate.just,.tb-receipt,.tb-stars svg,.tb-scrim,.tb-sheet,.r-goldseal{animation:none!important}
  .tb-timer i{animation-duration:0s}
}
`;

export function ensureLessonCss() {
  if (typeof document === "undefined" || !document.getElementById || !document.head) return;
  if (document.getElementById("sa-table-lesson-css")) return;
  const el = document.createElement("style");
  el.id = "sa-table-lesson-css";
  el.textContent = TABLE_LESSON_CSS;
  document.head.appendChild(el);
}
