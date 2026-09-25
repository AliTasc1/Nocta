// Nocta tasarım sistemi — design/project/Design System.dc.html ile birebir
export const colors = {
  ink: '#0C080B',
  velvet: '#171016',
  velvetDeep: '#120C11',
  dusk: '#211720',
  plum: '#2A1530',
  plumRose: '#3A1D2B',
  plumViolet: '#3A1740',
  wine: '#6B1E38',
  wineSoft: '#5A1A2E',
  rose: '#E7688A',
  blush: '#F4B9C8',
  iris: '#A88BF0',
  irisSoft: '#C9B8F7',
  pearl: '#F6EEF1',
  pearlSoft: '#E0CFD6',
  pearlMuted: '#D8C7CE',
  mist: '#B3A2AA',
  mute: '#8E7C85',
  faint: '#6B5A63',
  disabled: '#3A2A34',
  disabledText: '#7F6D76',
  onRose: '#1A0710',
  success: '#7FD1AE',
  onSuccess: '#0B2019',
  warning: '#F2C27B',
  error: '#F07A7A',
  info: '#A88BF0',
  line: 'rgba(255,230,240,.08)',
  lineStrong: 'rgba(255,230,240,.12)',
  lineHeavy: 'rgba(255,230,240,.2)',
  glass: 'rgba(23,16,22,.72)',
  whiteFaint: 'rgba(255,255,255,.04)',
  roseTint: 'rgba(231,104,138,.12)',
  roseTintStrong: 'rgba(231,104,138,.16)',
  successTint: 'rgba(127,209,174,.14)',
  warningTint: 'rgba(242,194,123,.14)',
  errorTint: 'rgba(240,122,122,.14)',
  irisTint: 'rgba(168,139,240,.14)',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 56, 10: 80 } as const;
export const radius = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32, pill: 999 } as const;
export const motion = { instant: 120, quick: 200, base: 320, reveal: 600, cinematic: 900 } as const;

export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  body: 'Manrope_500Medium',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

// Seviyeler (Soft / Flirty / Bold / Wild)
export const LEVELS = [
  { value: 0, name: 'Yumuşak', desc: 'Tatlı, romantik, güvenli' },
  { value: 1, name: 'Flörtöz', desc: 'Biraz gerilim, bol kahkaha' },
  { value: 2, name: 'Cesur', desc: 'Konfor alanının kenarı' },
  { value: 3, name: 'Vahşi', desc: 'Sınırları birlikte zorlayın' },
] as const;

export const MOODS = [
  { key: 'romantik', icon: 'favorite', name: 'Romantik', desc: 'Yavaş, yumuşak' },
  { key: 'eglenceli', icon: 'celebration', name: 'Eğlenceli', desc: 'Gülmeye hazır' },
  { key: 'flortoz', icon: 'local_fire_department', name: 'Flörtöz', desc: 'Biraz gerilim' },
  { key: 'cesur', icon: 'bolt', name: 'Cesur', desc: 'Konfor alanı dışı' },
  { key: 'gizemli', icon: 'dark_mode', name: 'Gizemli', desc: 'Sırlar & sürprizler' },
  { key: 'karisik', icon: 'shuffle', name: 'Karışık', desc: 'Bize bırakın' },
] as const;

export const AVATAR_COLORS = ['#2A1530', '#3A1D2B', '#6B1E38', '#3A1740', '#5A1A2E', '#1E2A3A'] as const;

export function flirtLevel(xp: number) {
  if (xp >= 2000) return { level: 5, name: 'Durdurulamaz', floor: 2000, next: null as number | null };
  if (xp >= 1000) return { level: 4, name: 'Yakın', floor: 1000, next: 2000 };
  if (xp >= 500) return { level: 3, name: 'Flörtöz', floor: 500, next: 1000 };
  if (xp >= 200) return { level: 2, name: 'Meraklı', floor: 200, next: 500 };
  return { level: 1, name: 'Başlangıç', floor: 0, next: 200 };
}
