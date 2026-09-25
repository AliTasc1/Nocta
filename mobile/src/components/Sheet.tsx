import React from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { IconButton, T } from './ui';

/**
 * Alttan açılan sayfa (tasarım: BottomSheet). Klavye açıldığında içerik yukarı kayar,
 * uzun içerik kaydırılabilir, alt güvenli alan hesaba katılır.
 */
export function Sheet({
  visible,
  onClose,
  title,
  label,
  children,
  footer,
  dismissable = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  label?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissable?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={dismissable ? onClose : undefined}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,5,10,.6)' }}>
          <Pressable accessibilityLabel="Kapat" style={{ flex: 1, minHeight: insets.top + 24 }} onPress={dismissable ? onClose : undefined} />
          <View
            style={{
              maxHeight: '92%',
              backgroundColor: colors.dusk,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: colors.lineStrong,
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.2)', alignSelf: 'center', marginTop: 10 }} />
            {title || label ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingTop: 12 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  {label ? <T v="label">{label}</T> : null}
                  {title ? <T v="h3">{title}</T> : null}
                </View>
                {dismissable ? <IconButton name="close" label="Kapat" onPress={onClose} size={40} /> : null}
              </View>
            ) : null}
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 8, gap: 14 }}
            >
              {children}
            </ScrollView>
            {footer ? <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
