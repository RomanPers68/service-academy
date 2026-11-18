"""Выравнивание сценария по звуку: монофоны HMM, обученные на самих роликах.

Голос во всех роликах один и тот же (синтез HeyGen), текст известен точно. Поэтому
модель звуков (39 MFCC-признаков, 2–3 состояния на звук, смесь гауссиан) учим прямо на
роликах: старт с грубой раскладки по участкам речи, затем несколько проходов
«выравнивание Витерби → переоценка». Между словами необязательная пауза (тишина или вдох).

  python3 fa.py out_dir role1:chunks1.txt:audio1.wav role2:... — пишет out_dir/<role>_fa.json
"""
import json
import os
import re
import sys

import numpy as np
from scipy.fft import dct

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_captions as mc  # noqa: E402

SR, HOP, WIN, NFFT = 16000, 160, 400, 512

# ----------------------------------------------------------------- текст → звуки

VOW = {"а": "a", "о": "o", "у": "u", "ы": "y", "э": "e", "и": "i", "е": "e", "ё": "o", "ю": "u", "я": "a"}
IOT = set("еёюя")
CONS = {"б": "b", "п": "p", "в": "v", "ф": "f", "г": "g", "к": "k", "д": "d", "т": "t", "ж": "zh", "ш": "sh",
        "з": "z", "с": "s", "й": "j", "л": "l", "м": "m", "н": "n", "р": "r", "х": "kh", "ц": "ts", "ч": "ch",
        "щ": "shch"}
VOICED = {"b": "p", "v": "f", "g": "k", "d": "t", "zh": "sh", "z": "s"}
UNVOICED = {v: k for k, v in VOICED.items()}
OBSTR_UNV = set(UNVOICED) | {"kh", "ts", "ch", "shch"}
SPECIAL = {                                        # как произносится (буквами)
    "что": "што", "чтобы": "штобы", "его": "ево", "него": "нево", "ничего": "ничево", "того": "тово",
    "хорошего": "хорошево", "сегодня": "севодня", "легче": "лехче", "почувствовал": "почуствовал",
    "чувствует": "чуствует", "здравствуйте": "здраствуйте",
}
VOWEL_PH = set("aoyuei")


def word_phones(w):
    w = re.sub(r"[^а-яё-]", "", w.lower()).replace("-", "")
    w = SPECIAL.get(w, w)
    w = re.sub(r"ть?ся$", "ца", w)
    ph, prev = [], None
    for ch in w:
        if ch in "ьъ":
            prev = ch
            continue
        if ch in VOW:
            if ch in IOT and (prev is None or prev in VOW or prev in "ьъ"):
                ph.append("j")
            ph.append(VOW[ch])
        elif ch in CONS:
            ph.append(CONS[ch])
        prev = ch
    # оглушение на конце слова и уподобление по звонкости внутри слова
    for i in range(len(ph) - 1, -1, -1):
        nxt = ph[i + 1] if i + 1 < len(ph) else None
        if ph[i] in VOICED and (nxt is None or nxt in OBSTR_UNV):
            ph[i] = VOICED[ph[i]]
        elif ph[i] in UNVOICED and nxt in VOICED and nxt != "v":
            ph[i] = UNVOICED[ph[i]]
    return ph


def n_states(p):
    if p in VOWEL_PH:
        return 3
    if p == "j":
        return 1
    return 2


# ----------------------------------------------------------------- признаки

def mel_fb(n_mels=26, fmin=60, fmax=7800):
    def hz2mel(f):
        return 2595 * np.log10(1 + f / 700)

    def mel2hz(m):
        return 700 * (10 ** (m / 2595) - 1)
    mels = np.linspace(hz2mel(fmin), hz2mel(fmax), n_mels + 2)
    hz = mel2hz(mels)
    bins = np.floor((NFFT + 1) * hz / SR).astype(int)
    fb = np.zeros((n_mels, NFFT // 2 + 1))
    for m in range(1, n_mels + 1):
        a, b, c = bins[m - 1], bins[m], bins[m + 1]
        for k in range(a, b):
            fb[m - 1, k] = (k - a) / max(b - a, 1)
        for k in range(b, c):
            fb[m - 1, k] = (c - k) / max(c - b, 1)
    return fb


FB = mel_fb()


def deltas(F, N=2):
    pad = np.pad(F, ((N, N), (0, 0)), mode="edge")
    num = sum(n * (pad[N + n:len(F) + N + n] - pad[N - n:len(F) + N - n]) for n in range(1, N + 1))
    return num / (2 * sum(n * n for n in range(1, N + 1)))


def mfcc(x):
    x = x + np.random.default_rng(1).normal(0, 3e-5, len(x))      # без «цифрового нуля» в паузах
    x = np.append(x[0], x[1:] - 0.97 * x[:-1])
    n = (len(x) - WIN) // HOP + 1
    idx = np.arange(WIN)[None, :] + (np.arange(n) * HOP)[:, None]
    fr = x[idx] * np.hamming(WIN)[None, :]
    spec = np.abs(np.fft.rfft(fr, NFFT, axis=1)) ** 2
    mel = np.log(spec @ FB.T + 1e-8)
    c = dct(mel, type=2, axis=1, norm="ortho")[:, :13]
    F = np.concatenate([c, deltas(c), deltas(deltas(c))], axis=1)
    energy = np.log(spec.sum(axis=1) + 1e-8)
    F = (F - F.mean(axis=0)) / (F.std(axis=0) + 1e-6)
    return F, energy


# ----------------------------------------------------------------- модель

class Model:
    """Гауссовы смеси для каждого состояния каждого звука; 'sil' — одно состояние (тишина и вдох)."""

    def __init__(self, phones, D=39):
        self.keys = [("sil", 0), ("br", 0)] + [(p, k) for p in phones for k in range(n_states(p))]
        self.kid = {k: i for i, k in enumerate(self.keys)}
        self.D = D
        self.mix = [None] * len(self.keys)        # (w[M], mu[M,D], var[M,D])

    def loglik(self, F):
        out = np.empty((len(F), len(self.keys)))
        for i, (w, mu, var) in enumerate(self.mix):
            ll = []
            for m in range(len(w)):
                d = F - mu[m]
                ll.append(np.log(w[m]) - 0.5 * (np.sum(d * d / var[m], axis=1) + np.sum(np.log(2 * np.pi * var[m]))))
            out[:, i] = np.logaddexp.reduce(np.stack(ll), axis=0)
        return out

    def fit(self, frames_by_state, M):
        vfloor = 0.01
        for i, X in enumerate(frames_by_state):
            if X is None or len(X) < 4:
                if self.mix[i] is None:
                    self.mix[i] = (np.ones(1), np.zeros((1, self.D)), np.ones((1, self.D)))
                continue
            self.mix[i] = fit_gmm(X, M if len(X) >= 40 * M else 1, vfloor)


def fit_gmm(X, M, vfloor, iters=8):
    mu0, var0 = X.mean(axis=0), np.maximum(X.var(axis=0), vfloor)
    if M == 1:
        return np.ones(1), mu0[None, :], var0[None, :]
    rng = np.random.default_rng(0)
    # старт: разбиение по первому главному направлению
    sd = np.sqrt(var0)
    mu = np.stack([mu0 - 0.3 * sd, mu0 + 0.3 * sd]) if M == 2 else mu0 + rng.normal(0, 0.3, (M, len(mu0))) * sd
    var = np.stack([var0] * M)
    w = np.full(M, 1 / M)
    for _ in range(iters):
        ll = np.stack([np.log(w[m]) - 0.5 * (np.sum((X - mu[m]) ** 2 / var[m], axis=1) + np.sum(np.log(2 * np.pi * var[m])))
                       for m in range(M)], axis=1)
        ll -= ll.max(axis=1, keepdims=True)
        r = np.exp(ll)
        r /= r.sum(axis=1, keepdims=True)
        nk = r.sum(axis=0) + 1e-6
        w = nk / nk.sum()
        mu = (r.T @ X) / nk[:, None]
        var = np.maximum((r.T @ (X * X)) / nk[:, None] - mu * mu, vfloor)
    return w, mu, var


# ----------------------------------------------------------------- граф и Витерби

PAUSE = ("sil", "br")


def build_graph(words, model):
    """Линейная цепочка состояний. Поля: ключ модели, p_остаться, можно_пропустить, слово, начало слова.

    Пауза между словами: [тишина] [вдох] [тишина], каждая часть необязательна.
    """
    st = [("sil", 0, 0.97, 0.5, -1, False), ("br", 0, 0.95, 0.5, -1, False), ("sil", 0, 0.97, 0.5, -1, False)]
    for wi, w in enumerate(words):
        ph = word_phones(w) or ["n"]
        first = True
        for p in ph:
            ns = n_states(p)
            for k in range(ns):
                stay = 0.55 if p in VOWEL_PH else 0.45
                st.append((p, k, stay, False, wi, first))
                first = False
        if wi < len(words) - 1:
            # после знака препинания пауза обычна, внутри фразы — редкость (короткое слово рядом с паузой
            # иначе может «перепрыгнуть» на чужую сторону: «нормально. | А вот», «госте. | Мы разберём»)
            pk = 0.5 if re.search(r"[,.!?:;…»—]$", w) else 0.015
            # первое слово предложения почти никогда не отделяется паузой от второго: иначе короткое
            # «А» или «Мы» уходит в затухающий конец предыдущей фразы
            if pk < 0.5 and (wi == 0 or re.search(r"[.!?…]»?$", words[wi - 1])):
                pk = 1e-15
            st += [("sil", 0, 0.92, pk, wi, False), ("br", 0, 0.92, pk, wi, False), ("sil", 0, 0.92, pk, wi, False)]
    st.append(("sil", 0, 0.97, 0, len(words), False))
    kidx = np.array([model.kid[(p, k)] for p, k, *_ in st])
    return st, kidx


def viterbi(LLm, st, kidx, maxskip=4):
    """Витерби по линейной цепочке. Пауза между словами — три необязательных узла [тишина, вдох, тишина];
    вход в паузу стоит log(pk), пропуск всей паузы — log(1 - pk), движение внутри неё и выход бесплатны."""
    T, S = LLm.shape[0], len(st)
    E = LLm[:, kidx]
    stay = np.array([np.log(x[2]) for x in st])
    adv = np.array([np.log(1 - x[2]) for x in st])
    pk = np.array([float(x[3]) for x in st])
    is_p = pk > 0
    chain = np.full(S, -1)                                  # номер паузы (слово, после которого она стоит)
    for i, x in enumerate(st):
        if is_p[i]:
            chain[i] = x[4] + 1                              # -1 -> 0 для начальной паузы
    extra = []
    for k in range(1, maxskip + 1):
        ex = np.full(S, -np.inf)
        for d in range(k, S):
            src = d - k
            mid = range(src + 1, d)
            if not all(is_p[m] for m in mid):
                continue
            if mid and len({chain[m] for m in mid}) > 1:
                continue
            if is_p[d]:
                if is_p[src] and chain[src] == chain[d]:
                    ex[d] = 0.0                              # внутри паузы
                elif not is_p[src]:
                    ex[d] = np.log(pk[d])                    # вход в паузу
            else:
                if is_p[src]:
                    ex[d] = 0.0 if (not mid or chain[mid[0]] == chain[src]) else -np.inf   # выход из паузы
                elif mid:
                    full = [m for m in range(S) if chain[m] == chain[mid[0]]]
                    if len(full) == len(mid):
                        ex[d] = np.log(1 - pk[mid[0]])       # пауза пропущена целиком
                else:
                    ex[d] = 0.0                              # обычный шаг
        extra.append(ex)
    delta = np.full(S, -np.inf)
    for s0 in range(S):                                      # старт: начальную паузу можно пропустить
        delta[s0] = E[0, s0]
        if not is_p[s0]:
            break
    bp = np.zeros((T, S), dtype=np.int8)
    ar = np.arange(S)
    for t in range(1, T):
        cand = [delta + stay]
        for k, ex in zip(range(1, maxskip + 1), extra):
            ck = np.full(S, -np.inf)
            ck[k:] = delta[:-k] + adv[:-k] + ex[k:]
            cand.append(ck)
        stk = np.stack(cand)
        a = np.argmax(stk, axis=0)
        delta = stk[a, ar] + E[t]
        bp[t] = a
    path = np.empty(T, dtype=int)
    s_ = S - 1
    for t in range(T - 1, -1, -1):
        path[t] = s_
        s_ -= int(bp[t, s_])
    return path, float(delta[-1])


def init_path(words, times, T, st, energy):
    """Грубый старт: внутри слова кадры делятся поровну между состояниями слова,
    в паузах громкие кадры считаем вдохом, тихие тишиной."""
    path = np.zeros(T, dtype=int)
    by_word = {}
    for si, s in enumerate(st):
        if s[4] >= 0 and not s[3] and s[0] not in PAUSE:
            by_word.setdefault(s[4], []).append(si)
    pause_after = {}
    for si, s in enumerate(st):
        if s[3] and s[4] >= 0:
            pause_after.setdefault(s[4], []).append(si)
    thr = np.percentile(energy, 35)
    cur = 0
    gap_states = [0, 1, 2]
    for wi, (a, b) in enumerate(times):
        i0, i1 = int(round(a * 100)), int(round(b * 100))
        sts = by_word[wi]
        i1 = max(i1, i0 + len(sts))
        g = np.arange(cur, min(i0, T))
        if len(g):
            loud = energy[g] > thr
            path[g] = np.where(loud, gap_states[1], gap_states[0])
        cuts = np.linspace(i0, i1, len(sts) + 1).round().astype(int)
        for s, c0, c1 in zip(sts, cuts[:-1], cuts[1:]):
            path[c0:min(c1, T)] = s
        cur = min(i1, T)
        gap_states = pause_after.get(wi, [len(st) - 1] * 3)
    path[cur:] = len(st) - 1
    return path


def quiet_penalty(energy):
    """Штраф звукам речи на почти тихих кадрах: затухающий хвост фразы — не место для следующего слова."""
    db = 10 * np.log10(np.exp(energy))
    floor = np.percentile(db, 3)
    thr = floor + 14
    return np.clip(thr - db, 0, None) * 0.5


def collect(model, data, paths):
    buckets = [[] for _ in model.keys]
    for (F, st, kidx, words), path in zip(data, paths):
        k = kidx[path]
        for i in np.unique(k):
            buckets[i].append(F[k == i])
    return [np.concatenate(b) if b else None for b in buckets]


def word_times(path, st, nwords):
    T = len(path)
    starts, ends = {}, {}
    for t in range(T):
        s = st[path[t]]
        if s[5] and s[4] not in starts:
            starts[s[4]] = t
        if s[0] not in PAUSE and s[4] >= 0:
            ends[s[4]] = t
    return [[round(starts[w] * 0.01, 3), round((ends[w] + 1) * 0.01, 3)] for w in range(nwords)]


def pauses_of(path, st):
    out, t, T = [], 0, len(path)
    while t < T:
        if st[path[t]][0] in PAUSE:
            u = t
            while u < T and st[path[u]][0] in PAUSE:
                u += 1
            if u - t >= 3:
                out.append([round(t * 0.01, 2), round(u * 0.01, 2)])
            t = u
        else:
            t += 1
    return out


def run(items, iters=8, mix_iters=4, verbose=True):
    """items: [(role, words, x, base_times)] → {role: (times, pauses)}"""
    phones = sorted({p for _, words, _, _ in items for w in words for p in (word_phones(w) or ["n"])})
    model = Model(phones)
    data, paths = [], []
    pens = []
    for role, words, x, base in items:
        F, energy = mfcc(x)
        st, kidx = build_graph(words, model)
        data.append((F, st, kidx, words))
        paths.append(init_path(words, base, len(F), st, energy))
        pens.append(quiet_penalty(energy))
    M = 1
    prev = None
    for it in range(iters + mix_iters):
        if it == iters:
            M = 2
        model.fit(collect(model, data, paths), M)
        new, tot = [], 0.0
        phone_cols = np.array([k[0] not in PAUSE for k in model.keys])
        for (F, st, kidx, words), pen in zip(data, pens):
            LLm = model.loglik(F)
            LLm[:, phone_cols] -= pen[:, None]
            p, score = viterbi(LLm, st, kidx)
            new.append(p)
            tot += score
        if verbose:
            ch = None if prev is None else sum(int((a != b).sum()) for a, b in zip(new, prev))
            print(f"iter {it} M={M} loglik/frame {tot / sum(len(d[0]) for d in data):.2f} changed {ch}")
        prev = paths = new
    out = {}
    for (role, words, x, base), (F, st, kidx, _), path in zip(items, data, paths):
        out[role] = (word_times(path, st, len(words)), pauses_of(path, st))
    return out


def main():
    out_dir = sys.argv[1]
    items = []
    for spec in sys.argv[2:]:
        role, chunks_path, wav = spec.split(":")
        chunks = mc.load_chunks(chunks_path)
        words = [w for c in chunks for w in c["words"]]
        x, sr = mc.read_wav(wav)
        assert sr == SR
        segs, info = mc.speech_segments(x, sr)
        base, report, rate = mc.align(words, segs)
        items.append((role, words, x, base))
    res = run(items)
    for role, words, x, base in items:
        times, pauses = res[role]
        d = np.array([a[0] - b[0] for a, b in zip(times, base)])
        print(f"{role}: |hmm-base| mean {np.abs(d).mean():.3f} max {np.abs(d).max():.3f}")
        json.dump({"pauses": pauses, "words": [[w] + t + b for w, t, b in zip(words, times, base)]},
                  open(f"{out_dir}/{role}_fa.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
