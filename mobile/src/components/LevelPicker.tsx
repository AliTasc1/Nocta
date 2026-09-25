import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, fonts, LEVELS } from '@/theme';
import { Avatar, Icon, T } from './ui';

export function levelName(v: number | null | undefined) {
  return LEVELS.find((l) => l.value === v)?.name ?? LEVELS[0].name;
}

/**
 * Ortak seviye = iki partnerin seçtiğinin en düşüğü; premium değilse ücretsiz sınırla
 * (sunucudaki couple_effective_level ile aynı kural, istemcide hesaplanır).
 */
export function effectiveLevel(mine: number | null | undefined, partner: number | null | undefined, isPremium: boolean, freeMax: unknown) {
  const cap = isPremium ? 3 : Number.isFinite(Number(freeMax)) && freeMax !== null && freeMax !== undefined ? Number(freeMax) : 1;
  return Math.max(0, Math.min(mine ?? 0, partner ?? 3, cap));
}

/** Onboarding ilerleme çubuğu (tasarım: 3px'lik segmentler) */
export function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Adım ${step} / ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < step ? colors.rose : 'rgba(255,255,255,.12)' }} />
        ))}
      </View>
      <T v="label">{`${step} / ${total}`}</T>
    </View>
  );
}

/** Dört seviyelik seçim satırı (Yumuşak · Flörtöz · Cesur · Vahşi) */
export function LevelRow({ value, onChange, readOnly, lockedFrom }: { value: number | null; onChange?: (v: number) => void; readOnly?: boolean; lockedFrom?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {LEVELS.map((l) => {
        const on = value === l.value;
        const under = value !== null && l.value <= value;
        const fg = on ? colors.onRose : under ? colors.blush : colors.mute;
        const locked = lockedFrom !== undefined && l.value >= lockedFrom;
        return (
          <Pressable
            key={l.value}
            disabled={readOnly}
            accessibilityRole="button"
            accessibilityLabel={`${l.name}: ${l.desc}${locked ? ' (Premium)' : ''}`}
            accessibilityState={{ selected: on, disabled: readOnly }}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange?.(l.value);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 64,
              borderRadius: 14,
              paddingHorizontal: 2,
              paddingVertical: 8,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              backgroundColor: on ? colors.rose : under ? colors.roseTint : 'rgba(255,255,255,.03)',
              borderWidth: 1,
              borderColor: on ? colors.rose : 'rgba(255,230,240,.1)',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
              {Array.from({ length: l.value + 1 }, (_, k) => (
                <View key={k} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: fg }} />
              ))}
              {locked ? <Icon name="lock" size={10} color={fg} style={{ marginLeft: 2 }} /> : null}
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.15} style={{ fontFamily: fonts.bold, fontSize: 12.5, color: fg }}>
              {l.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tasarım: 05b "dual consent" — kişi başı seviye kartı */
export function PersonLevelCard({
  name,
  color,
  value,
  status,
  statusColor,
  onChange,
  readOnly,
  lockedFrom,
}: {
  name: string;
  color?: string;
  value: number | null;
  status: string;
  statusColor: string;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  lockedFrom?: number;
}) {
  return (
    <View style={{ padding: 16, borderRadius: 22, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={name} color={color} size={34} />
        <T v="title" numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>{name}</T>
        <T v="caption" style={{ fontFamily: fonts.bold, flexShrink: 1 }} numberOfLines={1} color={statusColor}>{status}</T>
      </View>
      <LevelRow value={value} onChange={onChange} readOnly={readOnly} lockedFrom={lockedFrom} />
    </View>
  );
}

export function AgreedBanner({ level, note }: { level: number; note?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: 'rgba(231,104,138,.08)', borderWidth: 1, borderColor: 'rgba(231,104,138,.3)' }}>
      <Icon name="handshake" size={24} color={colors.blush} />
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.pearl }} maxFontSizeMultiplier={1.3}>
        Ortak seviye: <Text style={{ fontFamily: fonts.extrabold, color: colors.blush }}>{levelName(level)}</Text>
        {note ? ` · ${note}` : ' · istediğiniz an değiştirilebilir'}
      </Text>
    </View>
  );
}
