import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, GlowBackground, Icon, IconButton, Screen, SerifTitle, T } from '@/components/ui';
import { codeFromScan, formatInviteCode, setPendingJoin } from '@/lib/pendingJoin';
import { errorText, supabase } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts } from '@/theme';

function joinError(e: unknown) {
  const err = e as { message?: string; code?: string };
  if (err?.code === 'P0002' || /geçersiz/i.test(err?.message ?? '')) return 'Bu oda kodu geçersiz ya da süresi dolmuş.';
  return errorText(e);
}

/** 8 kutulu kod girişi (ABCD-1234). Görünmez bir TextInput tüm kutuları kaplar. */
function CodeBoxes({ value, onChange, error, onSubmit }: { value: string; onChange: (v: string) => void; error?: boolean; onSubmit: () => void }) {
  const input = useRef<TextInput>(null);
  const [focus, setFocus] = useState(false);
  const chars = value.replace('-', '').split('');
  const active = Math.min(chars.length, 7);
  const box = (i: number) => {
    const ch = chars[i];
    const isActive = focus && i === active && chars.length < 8;
    return (
      <View
        key={i}
        style={{
          flex: 1,
          height: 52,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: error ? 'rgba(240,122,122,.06)' : ch ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.03)',
          borderWidth: 1,
          borderColor: error ? colors.error : isActive ? colors.rose : ch ? 'rgba(255,230,240,.14)' : colors.line,
        }}
      >
        <Text maxFontSizeMultiplier={1.1} style={{ fontFamily: fonts.monoMedium, fontSize: 18, color: isActive ? colors.rose : colors.pearl }}>
          {ch ?? (isActive ? '|' : '')}
        </Text>
      </View>
    );
  };
  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Oda kodu" accessibilityHint="Kodu yazmak için dokun">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {[0, 1, 2, 3].map(box)}
        <Text style={{ width: 10, textAlign: 'center', color: colors.mute, fontFamily: fonts.mono }}>–</Text>
        {[4, 5, 6, 7].map(box)}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(formatInviteCode(t))}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
        maxLength={9}
        caretHidden
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        accessibilityLabel="Oda kodu"
        style={[StyleSheet.absoluteFill, { color: 'transparent', opacity: 0.02, fontSize: 1 }]}
      />
    </Pressable>
  );
}

function Scanner({ visible, onClose, onCode }: { visible: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const done = useRef(false);
  useEffect(() => {
    if (visible) done.current = false;
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.ink }}>
        {!permission ? null : permission.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (done.current) return;
              const code = codeFromScan(data);
              if (code) {
                done.current = true;
                onCode(code);
              }
            }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
            <Icon name="photo_camera" size={40} color={colors.blush} />
            <T v="h3" center>Kamera izni gerekli</T>
            <T v="bodySm" center>Partnerinin ekranındaki QR kodu okumak için kameraya erişmemiz gerekiyor.</T>
            {permission.canAskAgain ? (
              <Button title="İzin ver" onPress={() => requestPermission()} style={{ alignSelf: 'stretch' }} />
            ) : (
              <Button title="Ayarları aç" onPress={() => Linking.openSettings().catch(() => {})} style={{ alignSelf: 'stretch' }} />
            )}
          </View>
        )}
        {permission?.granted ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <View style={{ width: 240, height: 240, borderRadius: 28, borderWidth: 2, borderColor: colors.blush }} />
            <T v="title" center style={{ marginTop: 20, paddingHorizontal: 32 }}>Partnerinin QR kodunu çerçeveye getir</T>
          </View>
        ) : null}
        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <IconButton name="close" label="Kapat" onPress={onClose} bg="rgba(12,8,11,.7)" />
        </View>
      </View>
    </Modal>
  );
}

export default function Join() {
  const params = useLocalSearchParams<{ code?: string; auto?: string }>();
  const { refreshCouple, couple } = useApp();
  const toast = useToast();
  const [code, setCode] = useState(formatInviteCode(params.code ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  const [, requestPermission] = useCameraPermissions();
  const auto = useRef(params.auto === '1');

  const complete = code.length === 9;

  const submit = async (value = code) => {
    if (value.length !== 9) {
      setError('Kod 8 karakter olmalı. Örn. ABCD-1234');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: e } = await supabase.rpc('join_couple', { p_code: value });
      if (e) throw e;
      await setPendingJoin(null);
      await refreshCouple();
      router.replace('/connected');
    } catch (e) {
      const msg = joinError(e);
      setError(msg);
      if (!/geçersiz/.test(msg)) toast.show(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (auto.current && code.length === 9) {
      auto.current = false;
      submit(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paste = async () => {
    try {
      const txt = await Clipboard.getStringAsync();
      const c = codeFromScan(txt ?? '') ?? formatInviteCode(txt ?? '');
      if (!c) return toast.show('Panoda bir kod bulunamadı.', 'info');
      setCode(c);
      setError(null);
    } catch {
      toast.show('Pano okunamadı.', 'error');
    }
  };

  const openScanner = async () => {
    if (Platform.OS === 'web') return toast.show('QR okuma yalnızca telefonda çalışır.', 'info');
    await requestPermission().catch(() => null);
    setScan(true);
  };

  return (
    <Screen keyboard edges={['top', 'bottom']} bg={<GlowBackground />} contentStyle={{ paddingHorizontal: 24, paddingTop: 12, gap: 20 }}>
      <View style={{ minHeight: 48, justifyContent: 'center' }}>
        <IconButton name="arrow_back" label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace(couple ? '/invite' : '/'))} />
      </View>
      <View style={{ gap: 10 }}>
        <SerifTitle text="Oda kodu ile" accent="katıl" v="h1" />
        <T v="bodySm">Partnerinin ekranındaki 8 karakterlik kodu yaz ya da QR kodunu okut.</T>
      </View>

      <View style={{ gap: 10 }}>
        <CodeBoxes
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
          error={!!error}
          onSubmit={() => submit()}
        />
        {error ? (
          <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLiveRegion="assertive">
            <Icon name="error" size={18} color={colors.error} />
            <T v="bodySm" color={colors.error} style={{ flex: 1 }}>{error}</T>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Yapıştır" icon="content_paste" kind="outline" size="md" style={{ flex: 1, paddingHorizontal: 12 }} onPress={paste} />
          <Button title="QR okut" icon="qr_code_scanner" kind="outline" size="md" style={{ flex: 1, paddingHorizontal: 12 }} onPress={openScanner} />
        </View>
      </View>

      {error ? (
        <View style={{ padding: 18, borderRadius: 22, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line, gap: 12 }}>
          <T v="title" style={{ fontSize: 14 }}>Şunları dene</T>
          {[
            'Kodu partnerinin ekranıyla karşılaştır (0 ve O farklı).',
            'Partnerin kodu yenilediyse yeni kodu iste.',
            'Partnerin başka biriyle bağlı olmamalı.',
          ].map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <T v="bodySm" color={colors.blush}>{i + 1}</T>
              <T v="bodySm" color={colors.pearlSoft} style={{ flex: 1 }}>{t}</T>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: 'auto', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Icon name="lock" size={18} color={colors.success} />
          <T v="caption" style={{ flex: 1, lineHeight: 17 }}>Odalar yalnızca davetle açılır. Bir hesap aynı anda tek partnere bağlanabilir.</T>
        </View>
        <Button title="Katıl" disabled={!complete} loading={busy} onPress={() => submit()} />
        <Button title="Bunun yerine davet kodu oluştur" kind="ghost" size="sm" onPress={() => setPendingJoin(null).finally(() => router.replace('/invite'))} />
      </View>

      <Scanner
        visible={scan}
        onClose={() => setScan(false)}
        onCode={(c) => {
          setScan(false);
          setCode(c);
          submit(c);
        }}
      />
    </Screen>
  );
}
