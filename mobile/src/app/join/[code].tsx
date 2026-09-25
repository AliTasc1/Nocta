import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';

import { Loading } from '@/components/ui';
import { formatInviteCode, setPendingJoin } from '@/lib/pendingJoin';
import { useApp } from '@/providers/AppProvider';

/**
 * Derin bağlantı: nocta://join/ABCD-1234
 * Kod saklanır; kullanıcı girişli ve profili hazırsa doğrudan katılma ekranına gider,
 * değilse kök düzen (Guard) onu giriş/onboarding'e yönlendirir ve davet adımında kod kullanılır.
 */
export default function JoinLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, profile } = useApp();
  const clean = formatInviteCode(String(code ?? ''));
  const saved = useRef(false);
  const onboarded = !!session && !!profile?.onboarded;

  useEffect(() => {
    if (clean.length !== 9) {
      router.replace('/');
      return;
    }
    const go = () => {
      if (onboarded) router.replace({ pathname: '/join', params: { code: clean, auto: '1' } });
    };
    if (!saved.current) {
      saved.current = true;
      setPendingJoin(clean).finally(go);
    } else go();
  }, [clean, onboarded]);

  return <Loading label="Davet açılıyor…" />;
}
