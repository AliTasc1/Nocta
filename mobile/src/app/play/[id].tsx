import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { BackHandler, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDialog } from '@/components/Dialog';
import { CardPick } from '@/components/games/CardPick';
import { Challenges } from '@/components/games/Challenges';
import { EmojiGame } from '@/components/games/EmojiGame';
import { KnowMe } from '@/components/games/KnowMe';
import { Quiz } from '@/components/games/Quiz';
import { Roulette } from '@/components/games/Roulette';
import { SecretQuestions } from '@/components/games/SecretQuestions';
import { Shots } from '@/components/games/Shots';
import { Story } from '@/components/games/Story';
import { ThisOrThat } from '@/components/games/ThisOrThat';
import { TruthOrDare } from '@/components/games/TruthOrDare';
import { useGameSession } from '@/components/games/useGameSession';
import { WouldYouRather } from '@/components/games/WouldYouRather';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/providers/ToastProvider';
import { colors } from '@/theme';

/** Oyun ekranı: oturumu yükler, gerçek zamanlı dinler ve ilgili oyun motorunu çizer */
export default function PlayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = String(id ?? '');
  const g = useGameSession(sessionId);
  const { dialog, ask } = useDialog();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const navigated = useRef(false);

  const status = g.session?.status;
  const { isLeaving } = g;
  useEffect(() => {
    if (!status || navigated.current) return;
    if (status === 'finished') {
      navigated.current = true;
      router.replace(`/result/${sessionId}`);
    } else if (status === 'canceled') {
      navigated.current = true;
      if (!isLeaving()) toast.show('Oyun sona erdi. Partnerin oyundan çıktı.', 'info');
      router.replace('/');
    } else if (status === 'lobby') {
      navigated.current = true;
      router.replace(`/lobby/${sessionId}`);
    }
  }, [status, sessionId, isLeaving, toast]);

  const { cancel, finish } = g;
  const played = (g.session?.current_index ?? 0) > 0;
  const confirmLeave = useCallback(() => {
    // Oturumlar artık kategorideki tüm soruları içeriyor; istenildiği an bitirilip kaydedilebilir
    ask({
      icon: 'logout',
      tone: played ? 'rose' : 'error',
      title: played ? 'Oyunu bitirelim mi?' : 'Oyundan çıkılsın mı?',
      desc: played
        ? 'Buraya kadar oynadığınız turlar kaydedilir ve sonuç ekranına geçersiniz. Kalan sorular bir sonraki oyunda önce gelir.'
        : 'Oyun ikiniz için de sona erer.',
      actions: [
        ...(played
          ? [
              {
                label: 'Bitir ve kaydet',
                kind: 'primary' as const,
                onPress: async () => {
                  await finish();
                },
              },
            ]
          : []),
        {
          label: played ? 'Kaydetmeden çık' : 'Oyundan çık',
          kind: 'danger' as const,
          onPress: async () => {
            await cancel();
            navigated.current = true;
            router.replace('/');
          },
        },
        { label: 'Oyuna devam et', kind: 'ghost' as const },
      ],
    });
  }, [ask, cancel, finish, played]);

  // Android geri tuşu: doğrudan çıkma, önce sor
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        confirmLeave();
        return true;
      });
      return () => sub.remove();
    }, [confirmLeave]),
  );

  let body: React.ReactNode;
  if (g.error && !g.session) {
    body = (
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingTop: insets.top }}>
        <EmptyState icon="wifi_off" tone="error" title="Oyun açılamadı" desc={g.error} action="Tekrar dene" onAction={g.refresh} secondary="Ana sayfaya dön" onSecondary={() => router.replace('/')} />
      </View>
    );
  } else if (g.loading || !g.session || !g.game || status !== 'playing') {
    body = <Loading label="Oyun hazırlanıyor…" />;
  } else {
    const props = { g, onClose: confirmLeave };
    switch (g.game.engine) {
      case 'truth_dare':
        body = <TruthOrDare {...props} />;
        break;
      case 'would_you_rather':
        body = <WouldYouRather {...props} />;
        break;
      case 'this_or_that':
        body = <ThisOrThat {...props} />;
        break;
      case 'know_me':
        body = <KnowMe {...props} />;
        break;
      case 'secret_questions':
        body = <SecretQuestions {...props} />;
        break;
      case 'challenges':
        body = <Challenges {...props} />;
        break;
      case 'story':
        body = <Story {...props} />;
        break;
      case 'quiz':
        body = <Quiz {...props} />;
        break;
      case 'emoji':
        body = <EmojiGame {...props} />;
        break;
      case 'cards':
        body = <CardPick {...props} />;
        break;
      case 'roulette':
        body = <Roulette {...props} />;
        break;
      case 'shots':
        body = <Shots {...props} />;
        break;
      default:
        body = (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
            <EmptyState icon="info" title="Bu oyun burada oynanmıyor" desc="Bu oyun sohbet içinde oynanır." action="Sohbete git" onAction={() => router.replace('/chat?prompt=1')} />
          </View>
        );
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <Stack.Screen options={{ gestureEnabled: false, animation: 'fade' }} />
      {body}
      {dialog}
    </View>
  );
}
