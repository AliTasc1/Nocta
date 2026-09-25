import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorText } from '@/lib/supabase';
import { useToast } from '@/providers/ToastProvider';
import { colors, radius } from '@/theme';
import { Button, Icon, T } from './ui';

export type DialogAction = {
  label: string;
  kind?: 'primary' | 'danger' | 'ghost' | 'light' | 'outline';
  icon?: string;
  /** Promise döndürürse düğme yüklenir; hata olursa toast gösterilir ve diyalog açık kalır. */
  onPress?: () => void | Promise<unknown>;
};

export type DialogOptions = {
  icon?: string;
  tone?: 'rose' | 'error' | 'warn' | 'ok' | 'iris';
  title: string;
  desc?: string;
  actions: DialogAction[];
  /** İçeriğe ek alan (ör. form) */
  children?: React.ReactNode;
};

const TONES = {
  rose: [colors.roseTintStrong, colors.blush],
  error: [colors.errorTint, colors.error],
  warn: [colors.warningTint, colors.warning],
  ok: [colors.successTint, colors.success],
  iris: [colors.irisTint, colors.irisSoft],
} as const;

/**
 * Tasarım sistemindeki "Dialog" (07 Overlays). Web'de de çalışır (Alert'in aksine).
 * Kullanım: const { dialog, ask, close } = useDialog(); … {dialog}
 */
export function useDialog() {
  const [opts, setOpts] = useState<DialogOptions | null>(null);
  const close = useCallback(() => setOpts(null), []);
  const ask = useCallback((o: DialogOptions) => setOpts(o), []);
  const dialog = <Dialog opts={opts} onClose={close} />;
  return { dialog, ask, close };
}

export function Dialog({ opts, onClose }: { opts: DialogOptions | null; onClose: () => void }) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<number | null>(null);
  const tone = TONES[opts?.tone ?? 'rose'];

  const run = async (a: DialogAction, i: number) => {
    if (!a.onPress) return onClose();
    try {
      const r = a.onPress();
      if (r && typeof (r as Promise<unknown>).then === 'function') {
        setBusy(i);
        await r;
      }
      onClose();
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={!!opts} transparent animationType="fade" statusBarTranslucent onRequestClose={busy === null ? onClose : undefined}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable
          accessibilityLabel="Kapat"
          onPress={busy === null ? onClose : undefined}
          style={{ flex: 1, backgroundColor: 'rgba(7,5,10,.72)', justifyContent: 'center', paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}
        >
          {opts ? (
            <Pressable onPress={() => {}} style={{ maxWidth: 420, width: '100%', alignSelf: 'center', maxHeight: '100%' }}>
              <ScrollView
                bounces={false}
                keyboardShouldPersistTaps="handled"
                style={{ borderRadius: radius.lg + 4, backgroundColor: colors.dusk, borderWidth: 1, borderColor: colors.lineStrong }}
                contentContainerStyle={{ padding: 22, gap: 14 }}
              >
                {opts.icon ? (
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tone[0], alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={opts.icon} size={24} color={tone[1]} />
                  </View>
                ) : null}
                <T v="h3" style={{ fontSize: 28, lineHeight: 31 }}>{opts.title}</T>
                {opts.desc ? <T v="bodySm" style={{ fontSize: 14, lineHeight: 21 }}>{opts.desc}</T> : null}
                {opts.children}
                <View style={{ gap: 8, marginTop: 6 }}>
                  {opts.actions.map((a, i) => (
                    <Button
                      key={a.label}
                      title={a.label}
                      icon={a.icon}
                      kind={a.kind ?? (i === 0 ? 'primary' : 'ghost')}
                      size="md"
                      loading={busy === i}
                      disabled={busy !== null && busy !== i}
                      onPress={() => run(a, i)}
                    />
                  ))}
                </View>
              </ScrollView>
            </Pressable>
          ) : null}
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
