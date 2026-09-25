import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme';
import { Sheet } from './Sheet';
import { Button, Icon, T } from './ui';

export const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export type DMY = { d: number; m: number; y: number }; // m: 1-12

export function parseISODate(iso: string | null | undefined): DMY | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function toISODate(v: DMY): string {
  return `${v.y}-${String(v.m).padStart(2, '0')}-${String(v.d).padStart(2, '0')}`;
}

export function formatDMY(v: DMY | null): string {
  if (!v) return '';
  return `${v.d} ${MONTHS_TR[v.m - 1]} ${v.y}`;
}

export function daysIn(m: number, y: number) {
  return new Date(y, m, 0).getDate();
}

export function ageOf(v: DMY): number {
  const now = new Date();
  let age = now.getFullYear() - v.y;
  const mm = now.getMonth() + 1 - v.m;
  if (mm < 0 || (mm === 0 && now.getDate() < v.d)) age--;
  return age;
}

const ITEM = 44;
const VISIBLE = 5;

function Column({ items, value, onPick, label, flex }: { items: { v: number; t: string }[]; value: number; onPick: (v: number) => void; label: string; flex: number }) {
  const index = Math.max(0, items.findIndex((i) => i.v === value));
  return (
    <View style={{ flex, gap: 8 }}>
      <T v="caption" center>{label}</T>
      <ScrollView
        style={{ height: ITEM * VISIBLE, borderRadius: radius.md, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line }}
        contentOffset={{ x: 0, y: Math.max(0, (index - 2) * ITEM) }}
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
              style={{ height: ITEM, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4, borderRadius: 12, backgroundColor: on ? colors.rose : 'transparent' }}
            >
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 15, color: on ? colors.onRose : colors.pearlSoft }}>
                {it.t}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * Tarih seçici — yerel tarih seçici yerine RN bileşenleriyle; iOS, Android ve web'de aynı çalışır.
 */
function PickerBody({
  value,
  onConfirm,
  minYear,
  maxYear,
  confirmLabel,
}: {
  value: DMY | null;
  onConfirm: (v: DMY) => void;
  minYear: number;
  maxYear: number;
  confirmLabel: string;
}) {
  // Sayfa her açıldığında yeniden bağlanır; taslak başlangıç değerinden kurulur
  const [draft, setDraft] = useState<DMY>(() => value ?? { d: 1, m: 1, y: Math.max(minYear, Math.min(maxYear, maxYear - 7)) });
  const maxDay = daysIn(draft.m, draft.y);
  const set = (patch: Partial<DMY>) =>
    setDraft((cur) => {
      const next = { ...cur, ...patch };
      next.d = Math.min(next.d, daysIn(next.m, next.y));
      return next;
    });

  const days = Array.from({ length: maxDay }, (_, i) => ({ v: i + 1, t: String(i + 1) }));
  const months = MONTHS_TR.map((t, i) => ({ v: i + 1, t }));
  const years: { v: number; t: string }[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push({ v: y, t: String(y) });

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Column label="Gün" items={days} value={draft.d} onPick={(d) => set({ d })} flex={0.9} />
        <Column label="Ay" items={months} value={draft.m} onPick={(m) => set({ m })} flex={1.5} />
        <Column label="Yıl" items={years} value={draft.y} onPick={(y) => set({ y })} flex={1.1} />
      </View>
      <T v="bodySm" center color={colors.pearl}>{formatDMY(draft)}</T>
      <Button title={confirmLabel} onPress={() => onConfirm(draft)} />
    </>
  );
}

/**
 * Tarih seçici — yerel tarih seçici yerine RN bileşenleriyle; iOS, Android ve web'de aynı çalışır.
 */
export function DatePickerSheet({
  visible,
  onClose,
  value,
  onConfirm,
  minYear,
  maxYear,
  title = 'Tarih seç',
  confirmLabel = 'Tamam',
}: {
  visible: boolean;
  onClose: () => void;
  value: DMY | null;
  onConfirm: (v: DMY) => void;
  minYear: number;
  maxYear: number;
  title?: string;
  confirmLabel?: string;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {visible ? <PickerBody value={value} onConfirm={onConfirm} minYear={minYear} maxYear={maxYear} confirmLabel={confirmLabel} /> : null}
    </Sheet>
  );
}

/** Form alanı görünümünde tarih seçici */
export function DateField({
  label,
  value,
  onChange,
  minYear,
  maxYear,
  placeholder = 'Seç',
  error,
  hint,
  sheetTitle,
}: {
  label?: string;
  value: DMY | null;
  onChange: (v: DMY) => void;
  minYear: number;
  maxYear: number;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  sheetTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      {label ? <T v="caption">{label}</T> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Tarih'}: ${value ? formatDMY(value) : placeholder}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          minHeight: 54,
          borderRadius: radius.md,
          backgroundColor: colors.velvet,
          borderWidth: 1,
          borderColor: error ? colors.error : open ? colors.rose : colors.lineStrong,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          gap: 8,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <T v="title" style={{ flex: 1, fontSize: 16 }} color={value ? colors.pearl : colors.mute}>
          {value ? formatDMY(value) : placeholder}
        </T>
        <Icon name="calendar_month" size={22} color={colors.mist} />
      </Pressable>
      {error ? <T v="caption" color={colors.error}>{error}</T> : hint ? <T v="caption" color={colors.mute}>{hint}</T> : null}
      <DatePickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        value={value}
        minYear={minYear}
        maxYear={maxYear}
        title={sheetTitle ?? label ?? 'Tarih seç'}
        onConfirm={(v) => {
          setOpen(false);
          onChange(v);
        }}
      />
    </View>
  );
}
