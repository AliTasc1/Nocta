"""
Nocta · oyun ses efektleri sentezleyicisi
Rus Ruleti ve Shot Ruleti için tüm sesler matematiksel olarak üretilir (lisans sorunu yok).
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
    print(f'{name}.wav  {len(data) / SR:.2f}s')


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
def roulette_spin():
    dur = 4.6
    buf = np.zeros(int(SR * dur))
    n = len(buf)
    # topun ahşap/metal kasnakta yuvarlanma uğultusu (yavaşlar)
    roll = bandpass(noise(dur), 400, 2600)
    amp = np.linspace(0.35, 0.05, n) * (1 + 0.3 * np.sin(2 * np.pi * np.linspace(9, 2, n) * np.linspace(0, dur, n)))
    buf += roll * amp
    # bölmelere çarpan tıkırtılar (yavaşlayarak)
    tt, rate = 0.4, 22.0
    while tt < dur - 0.3:
        place(buf, metal_click(0.28 * min(1, rate / 14), 0.55, 0.025), tt)
        tt += 1.0 / rate
        rate *= 0.975
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
