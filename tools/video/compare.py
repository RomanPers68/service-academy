#!/usr/bin/env python3
"""Сравнить звук нового ролика со старым — v176 (Доп. 501): что поменялось после пересъёмки в HeyGen.

    python3 compare.py old.wav new.wav out/<роль>_fa.json      # старый звук, новый звук, время слов старого ролика

Звук обоих (16 кГц, моно — как для fa.py) сравнивается по MFCC с выравниванием DTW. Где текст тот же, путь ровный и
цена низкая; где фраза другая или пауза длиннее — участок с высокой ценой. Печатает такие участки (время в старом и в
новом ролике и слова старого) и сдвиг «новый − старый» по словам. Если до последней фразы сдвиг 0,00–0,01 с, время
слов там можно взять из старой привязки (она уже проверена), а заново привязать только изменённый конец.
"""
import json
import os
import sys

import numpy as np
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fa  # noqa: E402


def feats(path):
    sr, x = wavfile.read(path)
    assert sr == fa.SR, f"{path}: нужен звук {fa.SR} Гц (ffmpeg -ac 1 -ar 16000)"
    x = x.astype(np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x /= (np.abs(x).max() + 1e-9)
    F, _ = fa.mfcc(x)
    F = F[::2, :13]                # кадры по 20 мс, только сами MFCC
    return (F - F.mean(0)) / (F.std(0) + 1e-6)


def dtw(A, B, band=250):
    """DTW в полосе ±band кадров вокруг диагонали → путь [(i, j)]"""
    n, m = len(A), len(B)
    INF = 1e18
    D = np.full((n + 1, m + 1), INF)
    D[0, 0] = 0
    slope = m / n
    for i in range(1, n + 1):
        c = int(i * slope)
        lo, hi = max(1, c - band), min(m, c + band)
        d = np.sqrt(((B[lo - 1:hi] - A[i - 1]) ** 2).sum(1))
        prev = D[i - 1, lo - 1:hi + 1]
        best = np.minimum(prev[:-1], prev[1:]) + d
        row = np.empty(hi - lo + 1)
        acc = INF
        for k in range(len(best)):
            acc = min(best[k], acc + d[k])
            row[k] = acc
        D[i, lo:hi + 1] = row
    i, j, path = n, m, []
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        _, i, j = min((D[i - 1, j - 1], i - 1, j - 1), (D[i - 1, j], i - 1, j), (D[i, j - 1], i, j - 1))
    return path[::-1]


def main(old_wav, new_wav, old_fa):
    A, B = feats(old_wav), feats(new_wav)
    path = dtw(A, B)
    cost = np.array([np.sqrt(((A[i] - B[j]) ** 2).sum()) for i, j in path])
    ti = np.array([i for i, _ in path]) * 0.02
    tj = np.array([j for _, j in path]) * 0.02
    sm = np.convolve(cost, np.ones(25) / 25, mode="same")
    med = np.median(sm)
    words = json.load(open(old_fa, encoding="utf-8"))["words"]
    print(f"кадров: старый {len(A)}, новый {len(B)}; медиана цены {med:.2f}")
    hot = sm > med * 1.6
    s = None
    for idx, h in enumerate(hot):
        if h and s is None:
            s = idx
        if (not h or idx == len(hot) - 1) and s is not None:
            a, b = s, idx
            s = None
            if ti[b] - ti[a] < 0.15:
                continue
            w = [x[0] for x in words if x[2] > ti[a] - 0.1 and x[1] < ti[b] + 0.1]
            # короткие всплески на паузах между фразами (цена ~2 медианы) — не изменения; изменения — 5 медиан и выше
            print(f"  старый {ti[a]:6.2f}–{ti[b]:6.2f}  новый {tj[a]:6.2f}–{tj[b]:6.2f}  цена {sm[a:b].max() / med:5.1f} медиан"
                  f"  слова: {' '.join(w)}")
    offs = []
    for x in words:
        k = int(np.searchsorted(ti, x[1]))
        if k < len(tj):
            offs.append((x[0], x[1], tj[k] - x[1]))
    print("сдвиг «новый − старый», каждое 10-е слово:", ", ".join(f"{w}@{t:.1f}:{o:+.2f}" for w, t, o in offs[::10]))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:4])
