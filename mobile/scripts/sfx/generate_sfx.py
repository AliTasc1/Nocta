"""
Nocta · oyun ses efektleri sentezleyicisi
Rus Ruleti, Shot Ruleti ve Burası Neresi? için tüm sesler matematiksel olarak üretilir (lisans sorunu yok).
Çalıştırma:  python3 mobile/scripts/sfx/generate_sfx.py   → mobile/assets/sfx/*.wav
"""
import os
import wave

import numpy as np
from scipy import signal

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'sfx')
rng = np.random.default_rng(7)


def t(sec):
    return np.arange(int(SR * sec)) / SR


def noise(sec):
    return rng.standard_normal(int(SR * sec))


def env_exp(n, decay):
    return np.exp(-np.arange(n) / (SR * decay))


def bandpass(x, lo, hi, order=4):
    sos = signal.butter(order, [lo, hi], btype='bandpass', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def lowpass(x, f, order=4):
    sos = signal.butter(order, f, btype='lowpass', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def highpass(x, f, order=4):
    sos = signal.butter(order, f, btype='highpass', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def reverb(x, room=0.25, decay=0.35, mix=0.25):
    ir_len = int(SR * room * 4)
    ir = rng.standard_normal(ir_len) * env_exp(ir_len, decay * room)
    ir = lowpass(ir, 6000)
    wet = signal.fftconvolve(x, ir)[: len(x) + ir_len]
    out = np.zeros(len(wet))
    out[: len(x)] += x
    out += mix * wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(x))
    return out


def place(buf, clip, at):
    i = int(at * SR)
    end = min(len(buf), i + len(clip))
    buf[i:end] += clip[: end - i]


def metal_click(strength=1.0, pitch=1.0, dur=0.06):
    """Metalik tık: kısa transient + rezonans modları"""
    n = int(SR * dur)
    x = noise(dur) * env_exp(n, 0.0025)
    x = highpass(x, 1800)
    tt = np.arange(n) / SR
    for f, a, d in [(2400, 0.5, 0.012), (3900, 0.35, 0.009), (6200, 0.25, 0.006)]:
        x += a * np.sin(2 * np.pi * f * pitch * tt) * env_exp(n, d)
    return strength * x


def normalize(x, peak=0.9):
    x = x - np.mean(x)
    fade = int(SR * 0.01)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x / (np.max(np.abs(x)) + 1e-9) * peak


def save(name, x):
    os.makedirs(OUT, exist_ok=True)
    data = (normalize(x) * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    peak = np.max(np.abs(data.astype(np.int32))) / 32768
    rms = np.sqrt(np.mean((data.astype(np.float64) / 32768) ** 2))
    clipped = int(np.sum(np.abs(data.astype(np.int32)) >= 32767))
    print(f'{name + ".wav":22s} {len(data) / SR:5.2f}s  peak {20 * np.log10(peak + 1e-12):6.2f} dBFS  rms {20 * np.log10(rms + 1e-12):6.2f} dBFS  clipped={clipped}')


# ─────────────────────────────── Rus Ruleti ───────────────────────────────
def bullet_load():
    buf = np.zeros(int(SR * 0.7))
    # mermi yuvaya kayarken sürtünme
    slide = bandpass(noise(0.22), 2500, 9000) * np.linspace(0.2, 0.6, int(SR * 0.22)) * 0.25
    place(buf, slide, 0.05)
    # yerine oturma
    place(buf, metal_click(1.0, 0.8, 0.09), 0.27)
    place(buf, metal_click(0.4, 1.3, 0.05), 0.29)
    return reverb(buf, 0.12, 0.3, 0.15)


def cylinder_spin():
    dur = 2.2
    buf = np.zeros(int(SR * dur))
    # yavaşlayan mandal tıkları
    tt, rate = 0.0, 26.0
    while tt < dur - 0.1 and rate > 3:
        place(buf, metal_click(0.55 * min(1, rate / 18), 1.1, 0.03), tt)
        tt += 1.0 / rate
        rate *= 0.955
    # dönme uğultusu
    whirr = bandpass(noise(dur), 300, 1800) * np.linspace(0.12, 0.0, int(SR * dur))
    buf += whirr
    return reverb(buf, 0.1, 0.3, 0.12)


def cylinder_close():
    buf = np.zeros(int(SR * 0.4))
    place(buf, metal_click(1.2, 0.7, 0.12), 0.0)
    thud = np.sin(2 * np.pi * 140 * t(0.12)) * env_exp(int(SR * 0.12), 0.03) * 0.6
    place(buf, thud, 0.0)
    return reverb(buf, 0.12, 0.3, 0.2)


def hammer_cock():
    buf = np.zeros(int(SR * 0.45))
    place(buf, metal_click(0.7, 0.9, 0.05), 0.0)
    place(buf, bandpass(noise(0.08), 1500, 6000) * env_exp(int(SR * 0.08), 0.03) * 0.25, 0.03)
    place(buf, metal_click(1.1, 0.75, 0.08), 0.16)
    return reverb(buf, 0.1, 0.3, 0.15)


def empty_click():
    buf = np.zeros(int(SR * 0.6))
    place(buf, metal_click(1.3, 0.65, 0.1), 0.0)
    body = np.sin(2 * np.pi * 220 * t(0.08)) * env_exp(int(SR * 0.08), 0.015) * 0.5
    place(buf, body, 0.0)
    return reverb(buf, 0.25, 0.4, 0.3)


def gunshot():
    dur = 2.2
    buf = np.zeros(int(SR * dur))
    n = len(buf)
    # keskin ilk patlama
    crack = highpass(noise(0.03), 2000) * env_exp(int(SR * 0.03), 0.004) * 1.6
    place(buf, crack, 0.0)
    # gövde: filtrelenmiş gürültü
    body = lowpass(noise(0.6), 3500) * env_exp(int(SR * 0.6), 0.07)
    place(buf, body, 0.0)
    # alçak frekans boom (düşen perde)
    tb = t(0.5)
    freq = 90 * np.exp(-tb * 4) + 40
    boom = np.sin(2 * np.pi * np.cumsum(freq) / SR) * env_exp(len(tb), 0.12) * 1.4
    place(buf, boom, 0.0)
    # yankı / oda
    buf = reverb(buf, 0.6, 0.5, 0.45)
    # hafif saturasyon
    buf = np.tanh(buf / (np.max(np.abs(buf)) + 1e-9) * 2.2)
    return buf[:n]


# ─────────────────────────────── Shot Ruleti ───────────────────────────────
# Top yaklaşık 7.6 sn kasnakta döner: hızlı başlar, son 3–4 sn'de belirgin biçimde yavaşlar
# (Shots.tsx'teki LAND_MS ve üstel yavaşlama eğrisiyle aynı). Düşüş sesi ayrıca 'ball_drop'.
SPIN_LAND = 7.6
SPIN_K = 2.6


def spin_progress(u):
    """Shots.tsx: spinEase ile aynı eğri (hız sona doğru sıfıra iner)"""
    f = lambda x: (1 - np.exp(-SPIN_K * x)) / SPIN_K - x * np.exp(-SPIN_K)
    return f(np.clip(u, 0, 1)) / f(1.0)


def roulette_spin():
    dur = SPIN_LAND + 0.2
    buf = np.zeros(int(SR * dur))
    n = len(buf)
    tt = np.arange(n) / SR
    u = np.clip(tt / SPIN_LAND, 0, 1)
    # anlık hız (0–1): eğrinin türevi
    vel = (np.exp(-SPIN_K * u) - np.exp(-SPIN_K)) / (1 - np.exp(-SPIN_K))
    vel[tt > SPIN_LAND] = 0
    # yuvarlanma uğultusu: hız düştükçe hem kısılır hem koyulaşır
    roll_hi = bandpass(noise(dur), 700, 3200)
    roll_lo = bandpass(noise(dur), 250, 1100)
    rumble = 1 + 0.35 * np.sin(2 * np.pi * np.cumsum(2 + 9 * vel) / SR)
    buf += (roll_hi * vel ** 1.3 * 0.32 + roll_lo * np.sqrt(vel) * 0.22) * rumble
    # bölmelere çarpan tıkırtılar: aralıkları topun hızıyla seyrelir
    pos = spin_progress(u) * 8 * 16  # 8 tur × 16 elmas/bölme
    k, last = 1, 0
    for i in range(1, n, 64):
        if pos[i] >= k:
            v = vel[i]
            if tt[i] - last > 0.012 and tt[i] > 0.25:
                place(buf, metal_click(0.3 * min(1.0, 0.25 + v), 0.5 + 0.1 * v, 0.03), tt[i])
                last = tt[i]
            k = int(pos[i]) + 1
    return reverb(buf, 0.2, 0.35, 0.18)


def ball_drop():
    buf = np.zeros(int(SR * 0.9))
    # birkaç sekme + yuvaya oturma
    for i, (at, s) in enumerate([(0.0, 1.0), (0.13, 0.7), (0.22, 0.45), (0.28, 0.3), (0.32, 0.2)]):
        place(buf, metal_click(s, 0.5 + 0.05 * i, 0.05), at)
        thock = np.sin(2 * np.pi * (420 - 30 * i) * t(0.05)) * env_exp(int(SR * 0.05), 0.012) * s * 0.6
        place(buf, thock, at)
    return reverb(buf, 0.2, 0.35, 0.2)


def glass_clink():
    dur = 1.4
    tt = t(dur)
    n = len(tt)
    x = np.zeros(n)
    for f, a, d in [(2637, 0.6, 0.45), (3520, 0.35, 0.35), (5274, 0.25, 0.2), (7040, 0.12, 0.12)]:
        x += a * np.sin(2 * np.pi * f * tt) * env_exp(n, d)
    x[: int(SR * 0.004)] += highpass(noise(0.004), 3000) * 0.8
    return reverb(x, 0.15, 0.3, 0.15)


def saved_chime():
    dur = 1.0
    tt = t(dur)
    n = len(tt)
    x = np.zeros(n)
    for i, f in enumerate([659.25, 783.99, 1046.5]):
        start = int(SR * 0.09 * i)
        seg = np.zeros(n)
        k = np.arange(n - start) / SR
        seg[start:] = (np.sin(2 * np.pi * f * k) + 0.3 * np.sin(2 * np.pi * 2 * f * k)) * np.exp(-k / 0.35)
        x += seg * 0.5
    return reverb(x, 0.2, 0.4, 0.2)


# ─────────────────────────────── Shot Ruleti · gerilim ───────────────────────────────
TENSION_LEN = 4.0  # Shots.tsx: TENSION_AT → top düşüşü arası


def saw(freq, tt, phase0=0.0):
    ph = np.cumsum(np.broadcast_to(freq, tt.shape)) / SR + phase0
    return 2 * (ph % 1.0) - 1


def tension():
    dur = TENSION_LEN
    tt = t(dur)
    n = len(tt)
    u = tt / dur
    out = np.zeros(n)
    # 1) alçak drone (A1 + E2), yavaşça açılan filtre
    drone = saw(55.0, tt) + 0.7 * saw(55.0 * 1.003, tt, 0.3) + 0.5 * saw(82.41, tt, 0.6)
    drone = lowpass(drone, 180) * 0.55 + lowpass(drone, 520) * 0.25 * u
    out += drone * (0.55 + 0.45 * u)
    # 2) hızlanan kalp atışı (lub-dub), sona doğru yoğunlaşır
    beat_t, gap = 0.05, 0.62
    while beat_t < dur - 0.08:
        for off, amp in ((0.0, 1.0), (0.14 * gap / 0.62, 0.65)):
            bt = t(0.18)
            f = 62 * np.exp(-bt * 9) + 38
            thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(bt), 0.05)
            thump += lowpass(noise(0.18), 300) * env_exp(len(bt), 0.012) * 0.3
            place(out, thump * amp * (0.9 + 0.8 * beat_t / dur), beat_t + off)
        beat_t += gap
        gap = max(0.26, gap * 0.9)
    # 3) yükselen yaylı tremolo: birbirine göre akortsuz testereler, filtre sona doğru açılır
    notes = [220.0, 261.63, 311.13]  # A3 · C4 · D#4 (gergin küçük/eksik akor)
    glide = 2 ** (5 * u ** 1.6 / 12)  # dört ses yukarı kayar
    strings = np.zeros(n)
    for i, f0 in enumerate(notes):
        for d in (-0.007, 0.0, 0.006):
            strings += saw(f0 * glide * (1 + d), tt, (i * 0.37 + d * 50) % 1)
    dark = lowpass(strings, 900)
    bright = lowpass(strings, 4200)
    strings = dark * (1 - u) + bright * u
    trem_rate = 9 + 9 * u
    trem = 0.55 + 0.45 * np.sin(2 * np.pi * np.cumsum(trem_rate) / SR)
    out += highpass(strings, 140) * trem * (0.05 + 0.3 * u ** 1.5)
    # 4) yükselen riser: gürültü + sinüs süpürmesi
    riser = highpass(noise(dur), 2500) * (u ** 2.4) * 0.35
    sweep = np.sin(2 * np.pi * np.cumsum(300 + 1500 * u ** 2) / SR) * (u ** 3) * 0.18
    out += riser + sweep
    # hafif doygunluk; son kesiş sert (düşüşte kesilir)
    out = np.tanh(out / (np.max(np.abs(out)) + 1e-9) * 1.6)
    return reverb(out, 0.25, 0.4, 0.15)[:n]


# ─────────────────────────────── Burası Neresi? ───────────────────────────────
def resonator(x, f, bw):
    """İki kutuplu formant rezonatörü"""
    r = np.exp(-np.pi * bw / SR)
    c = 2 * np.pi * f / SR
    a = [1, -2 * r * np.cos(c), r * r]
    return signal.lfilter([1 - r], a, x)


def voiced(f0_curve, formants, jitter=0.01):
    """Gırtlak darbe dizisi → sesli harf formantları"""
    n = len(f0_curve)
    f0 = f0_curve * (1 + jitter * lowpass(rng.standard_normal(n), 30) * 8)
    ph = np.cumsum(f0) / SR
    pulses = np.zeros(n)
    idx = np.where(np.diff(np.floor(ph)) > 0)[0]
    pulses[idx] = 1.0
    src = lowpass(pulses, 3500, 2)  # yumuşak gırtlak
    src += 0.02 * rng.standard_normal(n)  # nefes
    out = np.zeros(n)
    for f, bw, g in formants:
        out += g * resonator(src, f, bw)
    return out


def clown_laugh():
    dur = 2.7
    buf = np.zeros(int(SR * dur))
    A = [(820, 90, 1.0), (1250, 110, 0.7), (2650, 160, 0.3), (3600, 220, 0.12)]  # /a/
    at = 0.02
    syll = 8
    for i in range(syll):
        L = 0.15 - 0.004 * i
        # 'h' nefesi
        h = bandpass(noise(0.045), 900, 3800) * np.hanning(int(SR * 0.045)) * 0.35
        place(buf, h, at)
        tt = t(L)
        base = 470 * (0.955 ** i)  # alçalan perde
        f0 = base * (1.06 - 0.12 * tt / L)  # hece içinde düşüş
        v = voiced(f0, A)
        env = np.minimum(1, tt / 0.018) * np.exp(-tt / (L * 0.55))
        amp = 1.0 if i < 6 else 0.8
        place(buf, v * env * amp, at + 0.03)
        at += L + 0.06 + 0.006 * i
    # sonda gıcırtılı korna: "honk"
    at += 0.05
    for j, (L, f) in enumerate([(0.2, 520), (0.32, 470)]):
        tt = t(L)
        bend = f * (1 + 0.18 * np.sin(np.pi * np.minimum(1, tt / L)) - 0.05 * tt / L)
        ph = np.cumsum(bend) / SR
        sq = np.sign(np.sin(2 * np.pi * ph)) * 0.6 + saw(bend, tt) * 0.5
        sq = bandpass(sq, 700, 4200)
        sq = resonator(sq, 1500, 300) * 0.5 + sq * 0.5
        env = np.minimum(1, tt / 0.012) * np.minimum(1, (L - tt) / 0.05)
        place(buf, sq * env * 0.3, at)
        at += L + 0.06
    return reverb(buf, 0.18, 0.35, 0.18)[: int(SR * (at + 0.35))]


def clown_pop():
    dur = 0.75
    tt = t(dur)
    n = len(tt)
    # "boing": yükselip yaylanan perde
    f = 170 + 260 * (1 - np.exp(-tt * 28)) + 70 * np.sin(2 * np.pi * 11 * tt) * np.exp(-tt * 4.5)
    ph = np.cumsum(f) / SR
    tone = np.sin(2 * np.pi * ph) + 0.35 * np.sin(4 * np.pi * ph) + 0.12 * np.sin(6 * np.pi * ph)
    tone *= np.minimum(1, tt / 0.006) * np.exp(-tt / 0.24)
    pop = highpass(noise(0.02), 1200) * env_exp(int(SR * 0.02), 0.003) * 0.9
    x = tone * 0.8
    x[: len(pop)] += pop
    return reverb(x, 0.12, 0.3, 0.12)[:n]


def photo_frost():
    dur = 1.5
    tt = t(dur)
    n = len(tt)
    # yumuşak 'whoosh': süpürülen bant geçiren gürültü
    src = noise(dur)
    lo = bandpass(src, 500, 1800)
    hi = bandpass(src, 2200, 7500)
    u = tt / dur
    mix = np.clip(u * 1.6, 0, 1)
    env = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.6
    x = (lo * (1 - mix) + hi * mix) * env * 0.6
    # buz çıtırtısı: seyrek parlak tıklar
    for _ in range(26):
        at = rng.uniform(0.25, 1.25)
        L = 0.03
        k = t(L)
        f = rng.uniform(4200, 9000)
        place(x, np.sin(2 * np.pi * f * k) * env_exp(len(k), 0.006) * rng.uniform(0.05, 0.16), at)
    return reverb(x, 0.3, 0.45, 0.25)[: n + int(SR * 0.2)]


# ─────────────────────────────── Sevgiliye Mektup ───────────────────────────────
def _crinkle(dur, density, lo=1800, hi=9000, amp=0.2):
    """Kâğıt çıtırtısı: rastgele kısa, parlak gürültü kıvılcımları"""
    buf = np.zeros(int(SR * dur))
    for _ in range(int(dur * density)):
        L = rng.uniform(0.002, 0.012)
        c = bandpass(noise(L + 0.01), lo, hi, 2)[: int(SR * L)] * env_exp(int(SR * L), L / 3)
        place(buf, c * rng.uniform(0.3, 1.0) * amp, rng.uniform(0, dur - L))
    return buf


def paper_fold():
    """Kâğıt katlama: iki yumuşak hışırtı + kat yerine basılan parmak (hafif çıtırtılı)"""
    dur = 1.0
    buf = np.zeros(int(SR * dur))
    for at, L, a in [(0.0, 0.42, 0.55), (0.34, 0.3, 0.4)]:
        n = int(SR * L)
        u = np.linspace(0, 1, n)
        env = np.sin(np.pi * u) ** 1.4 * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * u) ** 2)
        swish = bandpass(noise(L), 700, 5200, 2) * env * a
        place(buf, swish, at)
        place(buf, _crinkle(L, 90, amp=0.16) * env, at)
    # kat yerine bastırma: boğuk tok ses + sıkışan lif çıtırtısı
    press = lowpass(noise(0.09), 900) * env_exp(int(SR * 0.09), 0.02) * 0.9
    place(buf, press, 0.66)
    place(buf, _crinkle(0.16, 160, 2500, 10000, 0.22), 0.66)
    return reverb(buf, 0.12, 0.3, 0.12)


def cork_pop():
    """Mantar tıpa: cama sürtünen gıcırtı, ardından yerine oturan tok 'pop'"""
    dur = 0.9
    buf = np.zeros(int(SR * dur))
    # gıcırtı: titreşimli sürtünme (yükselen perde, testere dişi benzeri)
    L = 0.32
    tt = t(L)
    f = 620 + 520 * (tt / L) ** 1.3 + 35 * np.sin(2 * np.pi * 23 * tt)
    ph = 2 * np.pi * np.cumsum(f) / SR
    squeak = sum(np.sin(k * ph) / k for k in range(1, 6))
    stick = (np.sin(2 * np.pi * 38 * tt) > -0.2).astype(float)  # tut-kay sürtünmesi
    squeak = bandpass(squeak * stick, 500, 5000, 2) * np.sin(np.pi * tt / L) ** 0.8 * 0.28
    squeak += bandpass(noise(L), 1500, 6000, 2) * np.sin(np.pi * tt / L) * 0.06
    place(buf, squeak, 0.0)
    # pop: hava sıkışması + ahşap tok
    tb = t(0.25)
    fb = 260 * np.exp(-tb * 18) + 120
    thump = np.sin(2 * np.pi * np.cumsum(fb) / SR) * env_exp(len(tb), 0.035) * 0.9
    burst = lowpass(noise(0.05), 2500) * env_exp(int(SR * 0.05), 0.008) * 0.8
    place(buf, thump, 0.33)
    place(buf, burst, 0.33)
    # cam şişenin hafif çınlaması
    tr = t(0.4)
    ring = sum(a * np.sin(2 * np.pi * fr * tr) for fr, a in [(1320, 0.12), (2870, 0.07)]) * env_exp(len(tr), 0.09)
    place(buf, ring, 0.335)
    return reverb(buf, 0.18, 0.35, 0.18)


def glass_bottle():
    """Cam şişe tıngırtısı: kalın camın inharmonik modları + içi boş gövdenin tınısı"""
    dur = 1.3
    buf = np.zeros(int(SR * dur))
    tt = t(dur)
    n = len(tt)
    for at, s in [(0.0, 1.0), (0.11, 0.35)]:
        x = np.zeros(n)
        for f, a, d in [(1180, 0.5, 0.32), (2930, 0.4, 0.22), (4650, 0.22, 0.14), (6870, 0.1, 0.07)]:
            x += a * np.sin(2 * np.pi * f * (1 + 0.004 * at) * tt + rng.uniform(0, 6)) * env_exp(n, d)
        x += 0.25 * np.sin(2 * np.pi * 190 * tt) * env_exp(n, 0.05)  # gövde (Helmholtz)
        x[: int(SR * 0.003)] += highpass(noise(0.003), 2500) * 0.7
        place(buf, x * s, at)
    return reverb(buf, 0.2, 0.35, 0.2)[: n]


def ocean_waves():
    """Döngüye uygun ~8 sn okyanus: alçak gürleme + iki yavaş dalga kabarması + köpük hışırtısı.
    Sondaki pad bölümü başa çapraz karıştırılır → dikişsiz döngü."""
    dur = 8.0
    n = int(SR * dur)
    pad = int(SR * 0.6)
    tt = np.arange(n + pad) / SR
    ph = 2 * np.pi * tt / 4.0
    swell = (0.5 - 0.5 * np.cos(ph)) ** 1.8
    crash = (0.5 - 0.5 * np.cos(ph - 0.9)) ** 5

    def band(fn):
        y = fn(rng.standard_normal(n + pad))
        return y / (np.max(np.abs(y)) + 1e-9)

    rumble = band(lambda z: lowpass(z, 140, 2))
    body = band(lambda z: lowpass(z, 520, 2))
    mid = band(lambda z: bandpass(z, 600, 2200, 2))
    foam = band(lambda z: bandpass(z, 2400, 9000, 2))
    x = rumble * (0.35 + 0.25 * swell) + body * (0.25 + 0.55 * swell) + mid * 0.35 * crash + foam * (0.05 + 0.4 * crash)
    x = x + _crinkle(dur + 0.6, 120, 3000, 11000, 0.08)[: n + pad] * (0.2 + crash)
    fade = np.linspace(0, 1, pad)
    out = x[:n].copy()
    # t=[0,pad) bölgesi, t=[n,n+pad) ile aynı faza sahip (8 sn periyot) → yumuşak geçiş
    out[:pad] = x[:pad] * fade + x[n:n + pad] * (1 - fade)
    return out


def letter_arrive():
    """Büyülü çan: yumuşak çan arpeji + parıltı + uzun yankı"""
    dur = 2.6
    tt = t(dur)
    n = len(tt)
    x = np.zeros(n)
    notes = [783.99, 987.77, 1174.66, 1567.98, 1975.53]  # G5 B5 D6 G6 B6
    for i, f in enumerate(notes):
        st = int(SR * 0.11 * i)
        k = np.arange(n - st) / SR
        bell = np.zeros(n - st)
        for m, a, d in [(1.0, 1.0, 0.9), (2.76, 0.35, 0.4), (5.4, 0.15, 0.18), (2.0, 0.2, 0.6)]:
            bell += a * np.sin(2 * np.pi * f * m * k * (1 + 0.0015 * np.sin(2 * np.pi * 5 * k))) * np.exp(-k / d)
        x[st:] += bell * 0.3 * (1 - 0.1 * i)
    # parıltı: yüksek, rastgele küçük çınlamalar
    for _ in range(30):
        at = rng.uniform(0.05, 1.4)
        L = 0.25
        k = t(L)
        f = rng.uniform(3500, 7500)
        place(x, np.sin(2 * np.pi * f * k) * env_exp(len(k), 0.05) * rng.uniform(0.02, 0.07), at)
    # alttan sıcak bir ped
    x += 0.12 * np.sin(2 * np.pi * 392 * tt) * np.sin(np.pi * np.clip(tt / 1.8, 0, 1)) ** 2
    return reverb(x, 0.5, 0.5, 0.35)[:n]


if __name__ == '__main__':
    save('bullet_load', bullet_load())
    save('cylinder_spin', cylinder_spin())
    save('cylinder_close', cylinder_close())
    save('hammer_cock', hammer_cock())
    save('empty_click', empty_click())
    save('gunshot', gunshot())
    save('roulette_spin', roulette_spin())
    save('ball_drop', ball_drop())
    save('glass_clink', glass_clink())
    save('saved_chime', saved_chime())
    save('tension', tension())
    save('clown_laugh', clown_laugh())
    save('clown_pop', clown_pop())
    save('photo_frost', photo_frost())
    # Sevgiliye Mektup
    save('paper_fold', paper_fold())
    save('cork_pop', cork_pop())
    save('glass_bottle', glass_bottle())
    save('ocean_waves', ocean_waves())
    save('letter_arrive', letter_arrive())
