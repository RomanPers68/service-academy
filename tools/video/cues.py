#!/usr/bin/env python3
"""Начала предложений ролика — для перемотки «назад / вперёд на фразу» в плеере (data/intro-videos.js, cues; v175).

    python3 cues.py out/spg_fa.json [out/bar_fa.json ...]   # → строка на ролик: «spg: [1.05, 2.12, ...]»

Берёт время слов из fa.py: начало первого слова и каждого слова после точки, «!», «?» или многоточия.
"""
import json
import os
import sys

END = (".", "!", "?", "…")


def cues(path):
    with open(path, encoding="utf-8") as f:
        words = json.load(f)["words"]
    out, new = [], True
    for w in words:
        text, start = w[0], w[1]
        if new:
            out.append(round(float(start), 2))
        new = text.rstrip("»\"')").endswith(END)
    return out


if __name__ == "__main__":
    for p in sys.argv[1:]:
        role = os.path.basename(p).rsplit("_fa.json", 1)[0]
        print(role + ": " + json.dumps(cues(p)))
