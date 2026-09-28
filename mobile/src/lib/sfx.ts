import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useSyncExternalStore } from 'react';

/**
 * Oyun ses efektleri (Rus Ruleti, Shot Ruleti).
 *  - `preloadSfx()` oyun ekranı açılınca çağrılır: ses modu ayarlanır, oynatıcılar önceden oluşturulur.
 *  - `play(name)` asla hata fırlatmaz; sessize alınmışsa hiçbir şey yapmaz.
 *  - Sessiz ayarı cihazda saklanır ('nocta.sfx.muted').
 */
const SOURCES = {
  bullet_load: require('../../assets/sfx/bullet_load.wav'),
  cylinder_spin: require('../../assets/sfx/cylinder_spin.wav'),
  cylinder_close: require('../../assets/sfx/cylinder_close.wav'),
  hammer_cock: require('../../assets/sfx/hammer_cock.wav'),
  empty_click: require('../../assets/sfx/empty_click.wav'),
  gunshot: require('../../assets/sfx/gunshot.wav'),
  roulette_spin: require('../../assets/sfx/roulette_spin.wav'),
  ball_drop: require('../../assets/sfx/ball_drop.wav'),
  glass_clink: require('../../assets/sfx/glass_clink.wav'),
  saved_chime: require('../../assets/sfx/saved_chime.wav'),
} as const;

export type SfxName = keyof typeof SOURCES;

const MUTE_KEY = 'nocta.sfx.muted';
const players: Partial<Record<SfxName, AudioPlayer>> = {};
let muted = false;
let modeSet = false;
let muteLoaded = false;
const listeners = new Set<(m: boolean) => void>();

function playerOf(name: SfxName): AudioPlayer | null {
  try {
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      players[name] = p;
    }
    return p;
  } catch {
    return null;
  }
}

function loadMuted() {
  if (muteLoaded) return;
  muteLoaded = true;
  AsyncStorage.getItem(MUTE_KEY)
    .then((v) => {
      const m = v === '1';
      if (m !== muted) {
        muted = m;
        listeners.forEach((l) => l(m));
      }
    })
    .catch(() => {});
}

/** Ses modunu ayarla ve tüm efektleri önceden yükle (tekrar çağrılması zararsız) */
export function preloadSfx(names: SfxName[] = Object.keys(SOURCES) as SfxName[]) {
  loadMuted();
  if (!modeSet) {
    modeSet = true;
    // Oyun atmosferi için sessiz modda da çalar; kullanıcının müziğini kesmez
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});
  }
  names.forEach((n) => playerOf(n));
}

/** Efekti baştan çal. Hiçbir koşulda hata fırlatmaz. */
export function play(name: SfxName, opts: { volume?: number } = {}) {
  if (muted) return;
  try {
    const p = playerOf(name);
    if (!p) return;
    if (opts.volume != null) p.volume = Math.max(0, Math.min(1, opts.volume));
    const r = p.seekTo(0) as unknown;
    if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => {});
    p.play();
  } catch {
    // ses çalınamadı: oyun sessiz devam eder
  }
}

/** Çalan efekti durdur */
export function stop(name: SfxName) {
  try {
    const p = players[name];
    if (p && p.playing) p.pause();
  } catch {
    // yok say
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  if (m) (Object.keys(players) as SfxName[]).forEach(stop);
  AsyncStorage.setItem(MUTE_KEY, m ? '1' : '0').catch(() => {});
  listeners.forEach((l) => l(m));
}

function subscribe(l: (m: boolean) => void) {
  loadMuted();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Sessiz ayarı (bileşenler arasında senkron) */
export function useSfxMuted(): [boolean, (m: boolean) => void] {
  const m = useSyncExternalStore(subscribe, isMuted, isMuted);
  return [m, setMuted];
}
