import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { haptic } from '@/components/games/shared';
import { Button, Card, EmptyState, GlowBackground, Header, Icon, Loading, Pill, Screen, SectionTitle, T, TintCard } from '@/components/ui';
import { errorText, isPremiumError, supabase } from '@/lib/supabase';
import type { GameSession } from '@/lib/types';
import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts, LEVELS, radius } from '@/theme';

/** Oyun detayı: kategori / hikâye seçimi → start_session → lobi */
export default function GameDetailScreen() {
  const { slug: rawSlug } = useLocalSearchParams<{ slug: string }>();
  const slug = String(rawSlug ?? '');
  const { couple, partner, profile, isPremium } = useApp();
  const content = useContent();
  const { show: showToast } = useToast();
  const game = content.gameBySlug(slug);

  const [category, setCategory] = useState<string | null>(null);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [openSession, setOpenSession] = useState<GameSession | null>(null);

  // Sohbet oyunu sohbet ekranında oynanır
  useEffect(() => {
    if (game?.engine === 'chat_game') router.replace('/chat?prompt=1');
  }, [game?.engine]);

  const connected = couple?.status === 'active' && !!partner;

  // Yarım kalmış bir oyun var mı? (bildirimi kaçıran partner için)
  const coupleId = connected ? couple?.id : null;
  const checkOpen = useCallback(async () => {
    if (!coupleId) return;
    const { data } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('couple_id', coupleId)
      .in('status', ['lobby', 'playing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setOpenSession((data as GameSession) ?? null);
  }, [coupleId]);
  useEffect(() => {
    (async () => {
      await checkOpen();
    })();
  }, [checkOpen]);

  if (!game) {
    if (content.loading || !content.games.length) return <Loading label="Oyun yükleniyor…" />;
    return (
      <Screen bg={<GlowBackground />}>
        <Header onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <EmptyState icon="search_off" title="Oyun bulunamadı" desc="Bu oyun kaldırılmış ya da şu an kullanılamıyor olabilir." action="Ana sayfaya dön" onAction={() => router.replace('/')} />
      </Screen>
    );
  }

  const cats = game.engine === 'story' ? [] : content.categoriesFor(game.id);
  const freeMax = Number(content.settings?.free_max_level ?? 1);
  const cap = isPremium ? 3 : Number.isFinite(freeMax) ? freeMax : 1;
  const level = Math.max(0, Math.min(profile?.level ?? 0, partner?.level ?? 3, cap));
  const levelCapped = !isPremium && Math.min(profile?.level ?? 0, partner?.level ?? 3) > cap;
  const lockedGame = game.is_premium && !isPremium;
  const isQuiz = game.engine === 'quiz';
  // Soru sayılı kategori seçimi (testler, emoji bulmacaları, kartlar)
  const counted = isQuiz || game.engine === 'emoji' || game.engine === 'cards';
  const stories = content.stories.filter((s) => s.is_active).sort((a, b) => a.sort - b.sort);
  const selectedStory = stories.find((s) => s.id === storyId);
  const openGame = openSession && openSession.couple_id === couple?.id ? content.gameById(openSession.game_id) : undefined;

  const start = async () => {
    if (starting) return;
    if (lockedGame || (selectedStory?.is_premium && !isPremium)) {
      router.push('/premium');
      return;
    }
    setStarting(true);
    const { data, error } = await supabase.rpc('start_session', {
      p_game_slug: game.slug,
      p_category: category,
      p_story: game.engine === 'story' ? storyId : null,
    });
    setStarting(false);
    if (error) {
      if (isPremiumError(error)) {
        showToast('Bu içerik Nocta Premium ile açılır.', 'info');
        router.push('/premium');
      } else showToast(errorText(error), 'error');
      return;
    }
    haptic.success();
    router.replace(`/lobby/${(data as GameSession).id}`);
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (game.engine === 'chat_game') return <Loading />;

  return (
    <Screen
      bg={<GlowBackground />}
      footer={
        connected ? (
          lockedGame ? (
            <Button title="Premium ile aç" icon="lock_open" onPress={() => router.push('/premium')} glow />
          ) : (
            <Button title="Partnerini davet et ve başla" iconRight="arrow_forward" loading={starting} onPress={start} glow />
          )
        ) : null
      }
    >
      <Header onBack={back} label="OYUN" />

      <TintCard color={game.color} style={{ gap: 14, paddingVertical: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,.25)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={game.icon} size={28} color={colors.blush} />
          </View>
          {game.is_premium ? <Pill text="PREMIUM" tone="pro" /> : null}
        </View>
        <T v="h1">{game.name}</T>
        <T v="body">{game.description}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <MetaChip icon="schedule" text={game.duration_label} />
          {game.engine !== 'story' ? <MetaChip icon="style" text={`${game.rounds} ${counted ? 'soru' : 'tur'}`} /> : <MetaChip icon="movie" text="Seçimli hikâye" />}
        </View>
      </TintCard>

      {!connected ? (
        <EmptyState
          icon="link_off"
          tone="iris"
          title="Önce partnerine bağlan"
          desc="Nocta oyunları iki telefonda, birlikte oynanır. Partnerini davet et, bağlandığınız an başlayın."
          action="Partnerini davet et"
          onAction={() => router.push('/invite')}
        />
      ) : (
        <>
          {openSession && openGame ? (
            <Card style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: 'rgba(231,104,138,.4)' }}>
              <Icon name="sports_esports" size={26} color={colors.blush} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="caption" color={colors.mist}>{openSession.status === 'playing' ? 'Süren bir oyununuz var' : 'Lobide bekleyen bir oyun var'}</T>
                <T v="title" style={{ fontSize: 15 }} numberOfLines={1}>{openGame.name}</T>
              </View>
              <Button title="Katıl" size="sm" onPress={() => router.push(`/lobby/${openSession.id}`)} />
            </Card>
          ) : null}

          <Card style={{ marginTop: 16, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="local_fire_department" size={22} color={colors.blush} />
              <T v="title" style={{ flex: 1 }}>{`Ortak seviyeniz: ${LEVELS[level]?.name ?? 'Yumuşak'}`}</T>
            </View>
            <T v="bodySm">
              {levelCapped
                ? `Ücretsiz planda sorular ${LEVELS[cap]?.name ?? 'Flörtöz'} seviyesine kadar açılır. Daha cesur sorular Premium ile gelir.`
                : 'İkinizin seçtiği seviyelerin en düşüğü kullanılır; kimse rahatsız olacağı bir soruyla karşılaşmaz.'}
            </T>
            {levelCapped ? (
              <Pressable accessibilityRole="button" onPress={() => router.push('/premium')} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.blush }}>Premium’u incele →</Text>
              </Pressable>
            ) : null}
          </Card>

          {cats.length ? (
            <View style={{ marginTop: 24 }}>
              <SectionTitle label={isQuiz ? 'TEST' : 'KATEGORİ'} title={isQuiz ? 'Test seç' : counted ? 'Kategori seç' : 'Bu gece hangisi?'} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <CatChip label={isQuiz ? 'Karışık test' : 'Karışık'} icon="shuffle" active={category === null} onPress={() => setCategory(null)} count={counted ? content.questionCount(game.id) : undefined} />
                {cats.map((c) => {
                  const locked = c.is_premium && !isPremium;
                  return (
                    <CatChip
                      key={c.id}
                      label={c.name}
                      icon={locked ? 'lock' : c.icon}
                      active={category === c.id}
                      locked={locked}
                      count={counted && !locked ? content.questionCount(game.id, c.id) : undefined}
                      onPress={() => {
                        if (locked) {
                          showToast(isQuiz ? 'Bu test Nocta Premium ile açılır.' : 'Bu kategori Nocta Premium ile açılır.', 'info');
                          router.push('/premium');
                        } else setCategory(c.id);
                      }}
                    />
                  );
                })}
              </View>
              <T v="bodySm" style={{ marginTop: 12 }}>
                {category ? cats.find((c) => c.id === category)?.description : isQuiz
                    ? 'Tüm testlerden karışık sorular: bazılarında aynı cevabı vermeye, bazılarında doğruyu bulmaya çalışırsınız.'
                    : game.engine === 'emoji'
                      ? 'Tüm kategorilerden karışık emoji bulmacaları: doğru emojiyi ikiniz de kendi ekranınızdan seçin.'
                      : game.engine === 'cards'
                        ? 'Tüm kategorilerden karışık sorular: her soruda bir kart seçin, aynı kartı mı seçeceksiniz?'
                        : 'Tüm kategorilerden karışık sorular.'}
              </T>
            </View>
          ) : null}

          {game.engine === 'story' ? (
            <View style={{ marginTop: 24, gap: 10 }}>
              <SectionTitle label="HİKÂYE" title="Hangi geceyi yaşayalım?" />
              <StoryOption title="Bize bırak" desc="Seviyenize uygun ilk hikâye seçilir." active={storyId === null} onPress={() => setStoryId(null)} color={colors.plum} />
              {stories.map((s) => {
                const locked = s.is_premium && !isPremium;
                return (
                  <StoryOption
                    key={s.id}
                    title={s.title}
                    desc={s.description}
                    meta={LEVELS[s.level]?.name}
                    color={s.cover_color}
                    locked={locked}
                    active={storyId === s.id}
                    onPress={() => {
                      if (locked) router.push('/premium');
                      else setStoryId(s.id);
                    }}
                  />
                );
              })}
            </View>
          ) : null}

          <View style={{ marginTop: 20, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="notifications_active" size={18} color={colors.mute} />
            <T v="caption" color={colors.mute} style={{ flex: 1 }}>
              {`${partner?.display_name ?? 'Partnerin'} bir bildirim alır ve lobiye katılır. İkiniz de “Hazırım” deyince oyun aynı anda başlar.`}
            </T>
          </View>
        </>
      )}
    </Screen>
  );
}

function MetaChip({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,.25)' }}>
      <Icon name={icon} size={15} color={colors.pearlSoft} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.pearlSoft }}>{text}</Text>
    </View>
  );
}

function CatChip({ label, icon, active, locked, count, onPress }: { label: string; icon: string; active: boolean; locked?: boolean; count?: number; onPress: () => void }) {
  const bg = active ? colors.pearl : colors.whiteFaint;
  const fg = active ? colors.onRose : locked ? colors.mute : colors.pearl;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={locked ? `${label}, Premium` : count != null ? `${label}, ${count} soru` : label}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: bg, borderWidth: 1, borderColor: active ? colors.pearl : 'rgba(255,230,240,.14)', flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.8 : 1 })}
    >
      <Icon name={icon} size={16} color={fg} />
      <Text style={{ fontFamily: active ? fonts.bold : fonts.semibold, fontSize: 13, color: fg }}>{label}</Text>
      {count != null ? <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: active ? colors.onRose : colors.mute, opacity: 0.8 }}>{`${count} soru`}</Text> : null}
      {locked ? <Pill text="PREMIUM" tone="pro" style={{ paddingHorizontal: 7, paddingVertical: 2 }} /> : null}
    </Pressable>
  );
}

function StoryOption({ title, desc, meta, color, active, locked, onPress }: { title: string; desc: string; meta?: string; color: string; active: boolean; locked?: boolean; onPress: () => void }) {
  return (
    <TintCard color={color} onPress={onPress} accessibilityLabel={title} style={{ padding: 16, gap: 6, borderColor: active ? colors.rose : colors.line, borderWidth: active ? 1.5 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T v="h3" style={{ flex: 1, fontSize: 22, lineHeight: 26 }} numberOfLines={2}>{title}</T>
        {locked ? <Pill text="PREMIUM" tone="pro" /> : active ? <Icon name="check_circle" size={22} color={colors.rose} /> : null}
      </View>
      <T v="bodySm" color={colors.pearlSoft} numberOfLines={3}>{desc}</T>
      {meta ? <T v="caption" color={colors.blush}>{meta}</T> : null}
    </TintCard>
  );
}
