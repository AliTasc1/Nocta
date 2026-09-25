import { Tabs } from 'expo-router/js-tabs';
import React from 'react';

import { TabBar } from '@/components/TabBar';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.ink }, animation: 'fade' }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa' }} />
      <Tabs.Screen name="games" options={{ title: 'Oyunlar' }} />
      <Tabs.Screen name="chat" options={{ title: 'Sohbet' }} />
      <Tabs.Screen name="memories" options={{ title: 'Anılar' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
