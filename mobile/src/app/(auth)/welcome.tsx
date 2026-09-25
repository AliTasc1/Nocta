import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Logo } from '@/components/Brand';
import { Rings } from '@/components/Rings';
import { Avatar, Button, GlowBackground, Icon, Pill, SerifTitle, T, Screen } from '@/components/ui';
import { colors, fonts } from '@/theme';

export default function Welcome() {
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const av = compact ? 52 : 64;
  return (
    <Screen edges={['top', 'bottom']} bg={<GlowBackground variant="center" />} contentStyle={{ paddingHorizontal: 28, paddingTop: 24, paddingBottom: 12 }}>
      <Logo />
      <View style={{ flex: 1, justifyContent: 'center', gap: compact ? 16 : 22, paddingVertical: compact ? 16 : 28 }}>
        <View style={{ height: compact ? 116 : 150, alignItems: 'center', justifyContent: 'center' }}>
          <Rings size={compact ? 110 : 140} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name="E" color={colors.plum} size={av} ring={colors.ink} />
            <View style={{ width: 28, height: 2, backgroundColor: colors.rose }} />
            <Avatar name="D" color={colors.plumRose} size={av} ring={colors.ink} />
          </View>
          <View style={{ position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: colors.pearl, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="favorite" size={18} color={colors.rose} />
          </View>
        </View>
        <Pill text="18+ · YALNIZCA ÇİFTLER İÇİN" style={{ alignSelf: 'center' }} />
        <SerifTitle text="Bu gece" accent="sizin." v="display" center style={compact ? { fontSize: 46, lineHeight: 46 } : undefined} />
        <T v="body" center style={{ color: colors.pearlSoft }}>
          Partnerinle arandaki bağı, merakı ve heyecanı keşfet. Sekiz oyun, bir hikâye, yalnızca ikinize ait bir oda.
        </T>
      </View>
      <View style={{ gap: 12 }}>
        <Button title="Başlayalım" iconRight="arrow_forward" glow onPress={() => router.push('/age')} />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/login')}
          style={({ pressed }) => ({ minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
        >
          <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.mist, textAlign: 'center' }}>
            Zaten hesabım var · <Text style={{ fontFamily: fonts.bold, color: colors.blush }}>Giriş yap</Text>
          </Text>
        </Pressable>
        <T v="caption" center color={colors.mute}>Yalnızca 18 yaş üstü yetişkin çiftler için.</T>
      </View>
    </Screen>
  );
}
