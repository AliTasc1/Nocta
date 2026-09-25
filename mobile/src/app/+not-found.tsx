import { router, Stack } from 'expo-router';
import React from 'react';

import { EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen edges={['top', 'bottom']} contentStyle={{ justifyContent: 'center' }}>
        <EmptyState
          icon="nightlight"
          title="Burası karanlık kaldı"
          desc="Aradığın sayfa bulunamadı ya da taşınmış olabilir."
          action="Ana sayfaya dön"
          onAction={() => router.replace('/')}
        />
      </Screen>
    </>
  );
}
