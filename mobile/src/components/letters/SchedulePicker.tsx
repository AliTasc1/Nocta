import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Button, Icon, T } from '@/components/ui';
import { dative, dayLabel, hhmm, MONTHS_TR_LETTERS, whenLabel } from '@/lib/letters';
import { colors, fonts, radius } from '@/theme';

export type ScheduleKind = 'now' | 'morning' | 'week' | 'custom';

function tomorrowMorning() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}
function nextWeek() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setSeconds(0, 0);
  return d;
}
function defaultCustom() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(21, 0, 0, 0);
  return d;
}

/** Seçime göre teslim zamanı (null = hemen) */
export function resolveSchedule(kind: ScheduleKind, custom: Date): Date | null {
  if (kind === 'now') return null;
  if (kind === 'morning') return tomorrowMorning();
  if (kind === 'week') return nextWeek();
  return custom;
}

/** Animasyon alt yazısı: "Deniz'e ulaşacak · yarın 09:00" */
export function arrivalCaption(at: Date | null, partnerName: string) {
  if (!at) return `${dative(partnerName)} şimdi ulaşıyor`;
  return `${dative(partnerName)} ulaşacak · ${whenLabel(at)}`;
}

/** Özel tarih geçerli mi? (geçmiş ya da bir yıldan uzak olamaz) */
function customError(d: Date): string | null {
  const now = Date.now();
  if (d.getTime() < now + 60_000) return 'Geçmiş bir zaman seçtin; biraz ileri bir an seç.';
  if (d.getTime() > now + 365 * 86400000) return 'En fazla bir yıl sonrasına gönderebilirsin.';
  return null;
}

const ROW = 40;

function Column({ label, items, value, onPick, flex }: { label: string; items: { v: number; t: string }[]; value: number; onPick: (v: number) => void; flex: number }) {
  const index = Math.max(0, items.findIndex((i) => i.v === value));
  const ref = useRef<ScrollView>(null);
  // seçili değeri ortala (web contentOffset'i yok sayar)
  useEffect(() => {
    ref.current?.scrollTo({ y: Math.max(0, (index - 1) * ROW), animated: false });
  }, [index]);
  return (
    <View style={{ flex, gap: 6 }}>
      <T v="caption" center color={colors.mute}>{label}</T>
      <ScrollView
        ref={ref}
        onLayout={() => ref.current?.scrollTo({ y: Math.max(0, (index - 1) * ROW), animated: false })}
        style={{ height: ROW * 3, borderRadius: radius.sm, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line }}
        contentOffset={{ x: 0, y: Math.max(0, (index - 1) * ROW) }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {items.map((it) => {
          const on = it.v === value;
          return (
            <Pressable
              key={it.v}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${it.t}`}
              accessibilityState={{ selected: on }}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onPick(it.v);
              }}
              style={{ height: ROW, marginHorizontal: 3, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.rose : 'transparent' }}
            >
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 14.5, color: on ? colors.onRose : colors.pearlSoft }}>
                {it.t}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Uygulama içi tarih + saat seçici (en fazla 1 yıl ileri) */
function CustomPicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const now = new Date();
  const set = (patch: { y?: number; m?: number; d?: number; h?: number; min?: number }) => {
    const y = patch.y ?? value.getFullYear();
    const m = patch.m ?? value.getMonth();
    const maxD = new Date(y, m + 1, 0).getDate();
    const d = Math.min(patch.d ?? value.getDate(), maxD);
    onChange(new Date(y, m, d, patch.h ?? value.getHours(), patch.min ?? value.getMinutes(), 0, 0));
  };
  const days = Array.from({ length: new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate() }, (_, i) => ({ v: i + 1, t: String(i + 1) }));
  const months = MONTHS_TR_LETTERS.map((t, i) => ({ v: i, t }));
  const years = [now.getFullYear(), now.getFullYear() + 1].map((y) => ({ v: y, t: String(y) }));
  const hours = Array.from({ length: 24 }, (_, i) => ({ v: i, t: String(i).padStart(2, '0') }));
  const mins = Array.from({ length: 12 }, (_, i) => ({ v: i * 5, t: String(i * 5).padStart(2, '0') }));
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Column label="Gün" items={days} value={value.getDate()} onPick={(d) => set({ d })} flex={0.8} />
        <Column label="Ay" items={months} value={value.getMonth()} onPick={(m) => set({ m })} flex={1.3} />
        <Column label="Yıl" items={years} value={value.getFullYear()} onPick={(y) => set({ y })} flex={1} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Column label="Saat" items={hours} value={value.getHours()} onPick={(h) => set({ h })} flex={1} />
        <Column label="Dakika" items={mins} value={value.getMinutes() - (value.getMinutes() % 5)} onPick={(min) => set({ min })} flex={1} />
      </View>
    </View>
  );
}

function Option({ icon, title, desc, active, onPress }: { icon: string; title: string; desc: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${title}, ${desc}`}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: radius.md,
        backgroundColor: active ? colors.roseTint : colors.whiteFaint,
        borderWidth: 1,
        borderColor: active ? colors.rose : colors.line,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.roseTintStrong : 'rgba(255,255,255,.05)' }}>
        <Icon name={icon} size={20} color={active ? colors.blush : colors.mist} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="title" style={{ fontSize: 15 }}>{title}</T>
        <T v="caption" numberOfLines={2}>{desc}</T>
      </View>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? colors.rose : colors.lineHeavy, alignItems: 'center', justifyContent: 'center' }}>
        {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.rose }} /> : null}
      </View>
    </Pressable>
  );
}

/** "Ne zaman ulaşsın?" sayfası */
export function ScheduleSheet({ visible, onClose, onConfirm, sending, partnerName }: { visible: boolean; onClose: () => void; onConfirm: (at: Date | null) => void; sending: boolean; partnerName: string }) {
  const [kind, setKind] = useState<ScheduleKind>('now');
  const [custom, setCustom] = useState<Date>(defaultCustom);
  const at = resolveSchedule(kind, custom);
  const error = kind === 'custom' ? customError(custom) : null;
  const morning = tomorrowMorning();
  const week = nextWeek();
  return (
    <Sheet
      visible={visible}
      onClose={sending ? () => {} : onClose}
      dismissable={!sending}
      label="ŞİŞEYE KOY"
      title="Ne zaman ulaşsın?"
      footer={
        <View style={{ gap: 8 }}>
          <T v="caption" center color={error ? colors.error : colors.mist}>
            {error ?? (at ? `Ulaşma zamanı: ${whenLabel(at)}` : `${dative(partnerName)} hemen ulaşır.`)}
          </T>
          <Button title="Şişeye koy ve gönder" icon="sailing" loading={sending} disabled={!!error} onPress={() => onConfirm(at)} glow />
        </View>
      }
    >
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
        <Option icon="bolt" title="Hemen" desc="Şişe şimdi denize açılır, birazdan ulaşır." active={kind === 'now'} onPress={() => setKind('now')} />
        <Option icon="wb_twilight" title="Yarın sabah" desc={`${dayLabel(morning)} · ${hhmm(morning)}`} active={kind === 'morning'} onPress={() => setKind('morning')} />
        <Option icon="date_range" title="1 hafta sonra" desc={`${dayLabel(week)} · ${hhmm(week)}`} active={kind === 'week'} onPress={() => setKind('week')} />
        <Option icon="edit_calendar" title="Özel tarih ve saat" desc={kind === 'custom' ? `${dayLabel(custom)} · ${hhmm(custom)}` : 'Bir yıldönümü, bir doğum günü…'} active={kind === 'custom'} onPress={() => setKind('custom')} />
      </View>
      {kind === 'custom' ? <CustomPicker value={custom} onChange={setCustom} /> : null}
    </Sheet>
  );
}
