#!/usr/bin/env python3
"""Титры для видео-знакомств Service Academy.

Плашка цвета #2B3A50 со скруглёнными углами, белый Inter ExtraBold, текущее слово золотом.
Ключевые фразы (строки с «!» в файле фраз) выходят на золотой плашке крупнее.

Тайминг слов берётся из звука: участки речи между паузами сопоставляются с фразами сценария
(динамическое программирование по длине фраз), внутри участка время делится по длине слов.

  python3 make_captions.py chunks.txt --times role_fa.json -o captions.ass   # тайминг из fa.py (основной путь)
  python3 make_captions.py chunks.txt --audio voice.wav -o captions.ass --timing timing.json   # грубо, без fa.py
  python3 make_captions.py chunks.txt --demo 9 -o demo.ass        # без звука, ровный темп
"""
import argparse
import json
import math
import re
import wave

import numpy as np
from PIL import ImageFont

FONT_PATH = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FONT_NAME = "Inter ExtraBold"
CELL = 2478 / 2048          # (ascender + descender) / unitsPerEm у Inter: размер в ASS = высота ячейки

W, H = 1080, 1920
FS = 78                     # обычные титры
FS_KEY = 88                 # ключевые фразы
MAX_W = 880                 # ширина строки текста, пикселей
PAD_X, PAD_Y, RADIUS = 34, 20, 30
BOTTOM = 1650               # нижний край плашки

NAVY, GOLD, WHITE, INK = "2B3A50", "F2C14E", "FFFFFF", "1E2A3C"
PLATE_KEY = "D9B263"

VOW = set("аеёиоуыэюяАЕЁИОУЫЭЮЯ")
PUNCT_END = re.compile(r"[.,!?:;…]+[»\")]*$")


def ass_color(hexrgb, alpha=0, style=False):
    r, g, b = int(hexrgb[0:2], 16), int(hexrgb[2:4], 16), int(hexrgb[4:6], 16)
    if style:
        return f"&H{alpha:02X}{b:02X}{g:02X}{r:02X}"
    return f"&H{b:02X}{g:02X}{r:02X}&"


def letters(w):
    return sum(ch.isalpha() for ch in w)


def load_chunks(path):
    chunks = []
    for line in open(path, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key = line.startswith("!")
        text = line[1:].strip() if key else line.strip()
        chunks.append({"key": key, "words": text.split()})
    return chunks


# ---------------------------------------------------------------- звук → участки речи

def read_wav(path):
    with wave.open(path) as wf:
        sr, n, ch = wf.getframerate(), wf.getnframes(), wf.getnchannels()
        x = np.frombuffer(wf.readframes(n), dtype=np.int16).astype(np.float32)
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x / 32768.0, sr


def speech_segments(x, sr, hop=0.01, win=0.03, min_gap=0.14, min_seg=0.10):
    h, wl = int(sr * hop), int(sr * win)
    nfr = max(1, (len(x) - wl) // h + 1)
    idx = np.arange(wl)[None, :] + (np.arange(nfr) * h)[:, None]
    e = np.sqrt(np.mean(x[idx] ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(e + 1e-9)
    floor, peak = np.percentile(db, 8), np.percentile(db, 98)
    thr = floor + 0.30 * (peak - floor)
    sp = db > thr
    runs, start = [], None
    for i, v in enumerate(sp):
        if v and start is None:
            start = i
        if not v and start is not None:
            runs.append([start, i])
            start = None
    if start is not None:
        runs.append([start, len(sp)])
    merged = []
    for r in runs:                      # короткие провалы внутри речи склеиваем
        if merged and (r[0] - merged[-1][1]) * hop < min_gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    segs = [(a * hop, b * hop + win / 2) for a, b in merged if (b - a) * hop >= min_seg]
    return segs, {"floor_db": round(float(floor), 1), "peak_db": round(float(peak), 1), "thr_db": round(float(thr), 1)}


def phrases_of(words):
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        if PUNCT_END.search(w):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def weight(w):
    return letters(w) + 1.5


def align(words, segs):
    """Каждому участку речи — непрерывная группа фраз; минимизируем расхождение длительностей."""
    phr = phrases_of(words)
    while len(segs) > len(phr):         # лишние паузы: склеиваем по самой короткой
        gaps = [segs[i + 1][0] - segs[i][1] for i in range(len(segs) - 1)]
        k = int(np.argmin(gaps))
        segs = segs[:k] + [(segs[k][0], segs[k + 1][1])] + segs[k + 2:]
    pw = [sum(weight(words[i]) for i in p) for p in phr]
    total_w, total_t = sum(pw), sum(b - a for a, b in segs)
    rate = total_w / total_t
    S, P = len(segs), len(phr)
    INF = 1e18
    dp = np.full((S + 1, P + 1), INF)
    back = np.zeros((S + 1, P + 1), dtype=int)
    dp[0][0] = 0
    cum = np.concatenate([[0], np.cumsum(pw)])
    for s in range(1, S + 1):
        dur = segs[s - 1][1] - segs[s - 1][0]
        for j in range(s, P - (S - s) + 1):
            best, arg = INF, -1
            for i in range(s - 1, j):
                if dp[s - 1][i] >= INF:
                    continue
                expect = (cum[j] - cum[i]) / rate
                c = dp[s - 1][i] + math.log(dur / expect) ** 2
                if c < best:
                    best, arg = c, i
            dp[s][j], back[s][j] = best, arg
    groups, j = [], P
    for s in range(S, 0, -1):
        i = back[s][j]
        groups.append((i, j))
        j = i
    groups.reverse()
    times = [None] * len(words)
    report = []
    for (i, j), (a, b) in zip(groups, segs):
        idxs = [k for p in phr[i:j] for k in p]
        ws = [weight(words[k]) for k in idxs]
        t, tot = a, sum(ws)
        for k, wv in zip(idxs, ws):
            d = (b - a) * wv / tot
            times[k] = [round(t, 3), round(t + d, 3)]
            t += d
        report.append({"seg": [round(a, 2), round(b, 2)], "text": " ".join(words[k] for k in idxs),
                       "rate": round(sum(ws) / (b - a), 1), "idx": idxs})
    return times, report, round(rate, 1)


def demo_times(words, start=0.6):
    t, times = start, []
    for w in words:
        d = 0.055 * weight(w)
        times.append([round(t, 3), round(t + d, 3)])
        t += d + (0.28 if PUNCT_END.search(w) else 0.0)
    return times


# ---------------------------------------------------------------- раскладка и ASS

def font_px(fs):
    return ImageFont.truetype(FONT_PATH, max(1, round(fs / CELL)))


def text_w(font, s):
    return font.getlength(s)


def wrap(words, font):
    full = " ".join(words)
    if text_w(font, full) <= MAX_W or len(words) == 1:
        return [words]
    best = None
    for k in range(1, len(words)):         # две строки, самая ровная разбивка
        a, b = words[:k], words[k:]
        m = max(text_w(font, " ".join(a)), text_w(font, " ".join(b)))
        if m <= MAX_W and (best is None or m < best[0]):
            best = (m, [a, b])
    if best:
        return best[1]
    lines, cur = [], []                    # запасной вариант: жадно
    for w in words:
        if cur and text_w(font, " ".join(cur + [w])) > MAX_W:
            lines.append(cur)
            cur = []
        cur.append(w)
    lines.append(cur)
    return lines


def rrect(w, h, r):
    k = 0.5523 * r
    f = lambda v: f"{v:.1f}".rstrip("0").rstrip(".")
    return (f"m {f(r)} 0 l {f(w - r)} 0 b {f(w - r + k)} 0 {f(w)} {f(r - k)} {f(w)} {f(r)} "
            f"l {f(w)} {f(h - r)} b {f(w)} {f(h - r + k)} {f(w - r + k)} {f(h)} {f(w - r)} {f(h)} "
            f"l {f(r)} {f(h)} b {f(r - k)} {f(h)} 0 {f(h - r + k)} 0 {f(h - r)} "
            f"l 0 {f(r)} b 0 {f(r - k)} {f(r - k)} 0 {f(r)} 0")


def ts(t):
    t = max(0.0, t)
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def build_ass(chunks, times, tail=0.35, hold=0.9):
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{FONT_NAME},{FS},{ass_color(WHITE, style=True)},{ass_color(WHITE, style=True)},{ass_color('000000', style=True)},{ass_color('000000', 0x90, style=True)},0,0,0,0,100,100,0,0,1,0,0,2,0,0,0,1
Style: Plate,{FONT_NAME},{FS},{ass_color(NAVY, 0x26, style=True)},{ass_color(NAVY, style=True)},{ass_color('000000', style=True)},{ass_color('000000', 0x9A, style=True)},0,0,0,0,100,100,0,0,1,0,6,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    k = 0
    starts = []
    for ch in chunks:
        n = len(ch["words"])
        starts.append(times[k][0])
        k += n
    k = 0
    for ci, ch in enumerate(chunks):
        words = ch["words"]
        n = len(words)
        wt = times[k:k + n]
        k += n
        c0 = wt[0][0] - 0.06
        nxt = starts[ci + 1] - 0.06 if ci + 1 < len(chunks) else None
        c1 = wt[-1][1] + tail
        if nxt is not None and nxt - wt[-1][1] <= hold:
            c1 = nxt
        elif nxt is not None:
            c1 = min(c1, nxt)
        fs = FS_KEY if ch["key"] else FS
        font = font_px(fs)
        lines = wrap(words, font)
        tw = max(text_w(font, " ".join(l)) for l in lines)
        pw, ph = tw + 2 * PAD_X, len(lines) * fs + 2 * PAD_Y
        px, py = (W - pw) / 2, BOTTOM - ph
        tx, ty = W / 2, BOTTOM - PAD_Y + fs * 0.06
        plate_col = PLATE_KEY if ch["key"] else NAVY
        enter = 0.14
        plate = (f"{{\\an7\\move({px:.1f},{py + 16:.1f},{px:.1f},{py:.1f},0,{int(enter * 1000)})"
                 f"\\fad(90,60)\\p1\\1c{ass_color(plate_col)}\\1a&H{0x14 if ch['key'] else 0x26:02X}&"
                 f"\\bord{0 if ch['key'] else 2}\\3c{ass_color('C2A361')}\\3a&H70&\\shad6\\4a&H9A&}}{rrect(pw, ph, RADIUS)}")
        ev.append(f"Dialogue: 0,{ts(c0)},{ts(c1)},Plate,,0,0,0,,{plate}")
        mv = f"\\move({tx:.1f},{ty + 16:.1f},{tx:.1f},{ty:.1f},0,{int(enter * 1000)})\\fad(90,0)"
        pos = f"\\pos({tx:.1f},{ty:.1f})"
        if ch["key"]:
            pop = "\\fscx90\\fscy90\\t(0,180,\\fscx100\\fscy100)"
            body = "\\N".join(" ".join(l) for l in lines)
            mv_only = f"\\move({tx:.1f},{ty + 16:.1f},{tx:.1f},{ty:.1f},0,{int(enter * 1000)})"
            ev.append(f"Dialogue: 1,{ts(c0)},{ts(c1)},Cap,,0,0,0,,"
                      f"{{\\an2{mv_only}{pop}\\fs{fs}\\1c{ass_color(INK)}\\fad(90,60)}}{body}")
            continue
        flat = [w for l in lines for w in l]
        breaks = set()
        acc = 0
        for l in lines[:-1]:
            acc += len(l)
            breaks.add(acc)
        for wi in range(n):
            s = c0 if wi == 0 else wt[wi][0]
            e = c1 if wi == n - 1 else wt[wi + 1][0]
            parts = []
            for j, w in enumerate(flat):
                sep = "" if j == 0 else ("\\N" if j in breaks else " ")
                if j == wi:
                    parts.append(f"{sep}{{\\1c{ass_color(GOLD)}}}{w}{{\\1c{ass_color(WHITE)}}}")
                else:
                    parts.append(f"{sep}{w}")
            first, last = wi == 0, wi == n - 1
            anim = (f"\\move({tx:.1f},{ty + 16:.1f},{tx:.1f},{ty:.1f},0,{int(enter * 1000)})" if first else pos)
            fad = f"\\fad({90 if first else 0},{60 if last else 0})" if (first or last) else ""
            tag = f"{{\\an2{anim}{fad}\\fs{fs}}}"
            ev.append(f"Dialogue: 1,{ts(s)},{ts(e)},Cap,,0,0,0,,{tag}{''.join(parts)}")
    return head + "\n".join(ev) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("chunks")
    ap.add_argument("--audio")
    ap.add_argument("--demo", type=float)
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--timing")
    ap.add_argument("--times", help="тайминг слов из fa.py (точнее, чем --audio)")
    a = ap.parse_args()
    chunks = load_chunks(a.chunks)
    words = [w for c in chunks for w in c["words"]]
    if a.times:
        tw = json.load(open(a.times, encoding="utf-8"))["words"]
        assert [w[0] for w in tw] == words, "слова в файле тайминга не совпадают с файлом фраз"
        times = [[w[1], w[2]] for w in tw]
    elif a.audio:
        x, sr = read_wav(a.audio)
        segs, info = speech_segments(x, sr)
        times, report, rate = align(words, segs)
        if a.timing:
            json.dump({"vad": info, "rate": rate, "segments": report,
                       "words": [[w] + t for w, t in zip(words, times)]},
                      open(a.timing, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    else:
        times = demo_times(words)
        if a.demo:
            keep = sum(1 for t in times if t[1] <= a.demo)
            cut, k = [], 0
            for c in chunks:
                if k + len(c["words"]) > keep:
                    break
                cut.append(c)
                k += len(c["words"])
            chunks, times = cut, times[:k]
    open(a.out, "w", encoding="utf-8").write(build_ass(chunks, times))


if __name__ == "__main__":
    main()
