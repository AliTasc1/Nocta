import * as LocalAuthentication from 'expo-local-authentication';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { useApp } from '@/providers/AppProvider';
import { colors } from '@/theme';
import { Button, GlowBackground, Icon, SerifTitle, T } from './ui';

/**
 * Ayarlar → Gizlilik → Uygulama kilidi açıksa, uygulama açılışında ve
 * arka plandan dönüşte Face ID / Touch ID / cihaz şifresi ister.
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { profile } = useApp();
  const enabled = !!profile?.settings?.app_lock;
  const [locked, setLocked] = useState(false);
  const wentBackground = useRef(false);
  const initial = useRef(true);

  const unlock = useCallback(async () => {
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!has || !enrolled) return setLocked(false);
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Nocta kilidini aç',
        cancelLabel: 'Vazgeç',
        fallbackLabel: 'Şifre kullan',
      });
      if (r.success) setLocked(false);
    } catch {
      setLocked(false);
    }
  }, []);

  // Yalnızca profil ilk yüklendiğinde (uygulama açılışı) kilitle; ayarlardan yeni açıldığında tekrar sorma
  const loaded = !!profile;
  useEffect(() => {
    if (!loaded || !initial.current) return;
    initial.current = false;
    if (enabled) {
      setLocked(true);
      unlock();
    }
  }, [loaded, enabled, unlock]);

  useEffect(() => {
    if (!enabled) setLocked(false);
  }, [enabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (!enabled) return;
      if (s === 'background') wentBackground.current = true;
      if (s === 'active' && wentBackground.current) {
        wentBackground.current = false;
        setLocked(true);
        unlock();
      }
    });
    return () => sub.remove();
  }, [enabled, unlock]);

  return (
    <>
      {children}
      {locked ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }]}>
          <GlowBackground variant="center" />
          <Icon name="lock" size={40} color={colors.blush} />
          <SerifTitle text="noc" accent="ta" v="h1" center />
          <T v="bodySm" center>Uygulama kilitli. Devam etmek için kimliğini doğrula.</T>
          <Button title="Kilidi aç" icon="fingerprint" onPress={unlock} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : null}
    </>
  );
}
