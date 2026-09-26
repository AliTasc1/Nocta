import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Button, Chip, Field, Header, Icon, Pill, Screen, T } from '@/components/ui';
import { clock, shortDate } from '@/lib/format';
import { errorText, supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';
import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts } from '@/theme';

/**
 * Tanıtım ödülü: ücretsiz üye Nocta'yı anlatan bir video paylaşır, en az 24 saat yayında tutar,
 * ekip kontrol edince 30 gün Premium tanımlanır (admin_review_promo). Hesap başına bir kez.
 * Kanıt ekran görüntüleri: özel 'promo-proofs' kovası, `${user_id}/${uuid}.${ext}`.
 */

type Platform = 'tiktok' | 'instagram' | 'youtube';
type Status = 'pending' | 'approved' | 'rejected';
type Submission = {
  id: string;
  platform: Platform;
  url: string;
  handle: string;
  note: string;
  proof_paths: string[];
  posted_at: string;
  status: Status;
  admin_note: string;
  reviewed_at: string | null;
  premium_until: string | null;
  created_at: string;
};
type Proof = { uri: string; mime: string; ext: string; size: number | null };

const PLATFORMS: { key: Platform; label: string; hosts: string[]; example: string }[] = [
  { key: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'], example: 'https://www.tiktok.com/@kullanici/video/…' },
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com', 'instagr.am'], example: 'https://www.instagram.com/reel/…' },
  { key: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'], example: 'https://youtube.com/shorts/…' },
];
const MAX_PROOFS = 3;
const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

function hostOf(url: string) {
  const m = /^https?:\/\/([^/?#\s]+)/i.exec(url.trim());
  return m ? m[1].replace(/:\d+$/, '').replace(/^www\.|^m\.|^vm\.|^vt\./i, '').toLowerCase() : null;
}
function platformOf(url: string): Platform | null {
  const h = hostOf(url);
  if (!h) return null;
  return PLATFORMS.find((p) => p.hosts.some((x) => h === x || h.endsWith('.' + x)))?.key ?? null;
}
function when(iso: string) {
  return `${shortDate(iso)} ${clock(iso)}`;
}
function remaining(ms: number) {
  const m = Math.max(1, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} sa ${m % 60} dk` : `${m} dk`;
}
function settingNum(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default function Promo() {
  const { userId, isPremium, refreshPremium } = useApp();
  const { settings } = useContent();
  const { show } = useToast();
  const enabled = settings.promo_enabled !== false && settings.promo_enabled !== 'false';
  const days = settingNum(settings.promo_days, 30);
  const minHours = settingNum(settings.promo_min_hours, 24);

  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [newAfterReject, setNewAfterReject] = useState(false);
  const [justSent, setJustSent] = useState(false);

  // Form
  const [platform, setPlatform] = useState<Platform>('tiktok');
  const [url, setUrl] = useState('');
  const [handle, setHandle] = useState('');
  const [note, setNote] = useState('');
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('promo_submissions')
      .select('id,platform,url,handle,note,proof_paths,posted_at,status,admin_note,reviewed_at,premium_until,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    setSubs((data ?? []) as Submission[]);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => {
        setSubs((s) => s ?? []);
        show(errorText(e), 'error');
      });
    }, [load, show]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      show(errorText(e), 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const latest = subs?.[0] ?? null;

  // Onaylandıysa premium durumunu tazele (admin onayı abonelik kaydı oluşturur)
  const premiumSynced = useRef(false);
  useEffect(() => {
    if (latest?.status === 'approved' && !isPremium && !premiumSynced.current) {
      premiumSynced.current = true;
      refreshPremium().catch(() => {});
    }
  }, [latest?.status, isPremium, refreshPremium]);

  // Geri sayım (bekleyen başvuruda)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (latest?.status !== 'pending') return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [latest?.status]);

  // ── Doğrulama
  const trimmedUrl = url.trim();
  const detected = platformOf(trimmedUrl);
  const pInfo = PLATFORMS.find((p) => p.key === platform)!;
  const urlError = !trimmedUrl
    ? 'Videonun linkini yapıştır.'
    : !/^https?:\/\/[^\s/]+\.[^\s]{2,}/i.test(trimmedUrl)
      ? 'Geçerli bir link gir (https:// ile başlamalı).'
      : detected !== platform
        ? `Bu link ${pInfo.label} linkine benzemiyor.`
        : null;
  const cleanHandle = handle.trim().replace(/^@+/, '');
  const handleError = cleanHandle.length < 2 ? 'Paylaştığın hesabın kullanıcı adını yaz.' : null;
  const proofError = proofs.length === 0 ? 'Paylaşımın en az bir ekran görüntüsünü ekle.' : null;
  const valid = !urlError && !handleError && !proofError;

  const onUrl = (v: string) => {
    setUrl(v);
    // Link başka bir platformunsa seçimi otomatik düzelt
    const p = platformOf(v.trim());
    if (p && p !== platform) setPlatform(p);
  };

  const addProofs = async () => {
    try {
      const left = MAX_PROOFS - proofs.length;
      if (left <= 0) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: left > 1,
        selectionLimit: left,
        allowsEditing: false,
        quality: 0.8,
        exif: false,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (res.canceled || !res.assets?.length) return;
      const next: Proof[] = [];
      let tooBig = false;
      for (const a of res.assets.slice(0, left)) {
        if (a.fileSize && a.fileSize > MAX_PROOF_BYTES) {
          tooBig = true;
          continue;
        }
        const guessed = (a.fileName ?? a.uri).split('?')[0].split('.').pop()?.toLowerCase() ?? '';
        let mime = (a.mimeType ?? '').toLowerCase();
        if (!EXT[mime]) mime = Object.keys(EXT).find((k) => EXT[k] === (guessed === 'jpeg' ? 'jpg' : guessed)) ?? 'image/jpeg';
        next.push({ uri: a.uri, mime: mime === 'image/jpg' ? 'image/jpeg' : mime, ext: EXT[mime] ?? 'jpg', size: a.fileSize ?? null });
      }
      if (tooBig) show('Ekran görüntüsü en fazla 10 MB olabilir.', 'error');
      if (next.length) setProofs((p) => [...p, ...next].slice(0, MAX_PROOFS));
    } catch (e) {
      show(errorText(e), 'error');
    }
  };

  const submit = async () => {
    setTried(true);
    if (!valid || !userId || busy) return;
    setBusy(true);
    const uploaded: string[] = [];
    try {
      for (let i = 0; i < proofs.length; i++) {
        setProgress(`Görseller yükleniyor ${i + 1} / ${proofs.length}`);
        const p = proofs[i];
        const buf = await (await fetch(p.uri)).arrayBuffer();
        if (buf.byteLength > MAX_PROOF_BYTES) throw new Error('Ekran görüntüsü en fazla 10 MB olabilir.');
        const path = `${userId}/${uuid()}.${p.ext}`;
        const { error } = await supabase.storage.from('promo-proofs').upload(path, buf, { contentType: p.mime, upsert: false });
        if (error) throw error;
        uploaded.push(path);
      }
      setProgress('Gönderiliyor…');
      const { error } = await supabase.from('promo_submissions').insert({
        user_id: userId,
        platform,
        url: trimmedUrl,
        handle: `@${cleanHandle}`.slice(0, 80),
        note: note.trim().slice(0, 500),
        proof_paths: uploaded,
        posted_at: new Date().toISOString(),
      });
      if (error) throw error;
      setJustSent(true);
      setNewAfterReject(false);
      setUrl('');
      setHandle('');
      setNote('');
      setProofs([]);
      setTried(false);
      await load().catch(() => {});
      show('Başvurun alındı', 'ok');
    } catch (e) {
      // Yarım kalan yüklemeleri temizlemeyi dene (yetki yoksa sessizce geç)
      if (uploaded.length) supabase.storage.from('promo-proofs').remove(uploaded).catch(() => {});
      show(errorText(e), 'error');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  const showForm = subs != null && enabled && !isPremium && (!latest || (latest.status === 'rejected' && newAfterReject));

  let footer: React.ReactNode = <Button title="Tamam" kind="ghost" onPress={back} />;
  if (showForm) {
    footer = <Button title={busy && progress ? progress : 'Başvuruyu gönder'} icon="send" loading={busy} disabled={busy} onPress={submit} />;
  } else if (latest?.status === 'rejected' && enabled && !isPremium) {
    footer = <Button title="Yeni başvuru yap" icon="refresh" onPress={() => setNewAfterReject(true)} />;
  }

  return (
    <Screen keyboard edges={['top', 'bottom']} contentStyle={{ gap: 18 }} refreshing={refreshing} onRefresh={onRefresh} footer={footer}>
      <Header onBack={back} label="ÖDÜL" title="Tanıt," accent="Premium kazan" />

      {latest ? <StatusCard sub={latest} now={now} minHours={minHours} justSent={justSent} /> : null}

      {!latest || showForm ? (
        <View style={{ gap: 12 }}>
          <T v="body">{`Nocta'yı sevdiysen anlat: kısa bir tanıtım videosu paylaş, ${days} gün Premium bizden.`}</T>
          <View style={{ gap: 10, padding: 16, borderRadius: 20, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line }}>
            {[
              "Nocta'yı anlatan bir video çek (uygulamayı gösterebilirsin; partnerinin mahremiyetine dikkat et).",
              'TikTok, Instagram veya YouTube’da herkese açık paylaş.',
              'Videonun linkini ve paylaşımın ekran görüntüsünü buraya ekle.',
              `Video en az ${minHours} saat yayında kalsın; ekibimiz kontrol ettikten sonra ${days} gün Premium hesabına tanımlanır.`,
            ].map((t, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.roseTintStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <T v="caption" color={colors.blush} style={{ fontFamily: fonts.bold, fontSize: 12 }}>{i + 1}</T>
                </View>
                <T v="bodySm" color={colors.pearlSoft} style={{ flex: 1 }}>{t}</T>
              </View>
            ))}
          </View>
          <T v="caption" color={colors.mute}>Yalnızca ücretsiz üyeler için · Hesap başına bir kez</T>
        </View>
      ) : null}

      {subs == null ? null : !enabled && !latest ? (
        <Notice icon="event_busy" text="Bu kampanya şu an aktif değil. Daha sonra tekrar göz at." />
      ) : isPremium && (!latest || latest.status === 'rejected') ? (
        <Notice icon="workspace_premium" text="Zaten Premium üyesin. Bu ödül yalnızca ücretsiz üyeler içindir." />
      ) : null}

      {showForm ? (
        <View style={{ gap: 18 }}>
          <View style={{ gap: 10 }}>
            <T v="caption">Platform</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PLATFORMS.map((p) => (
                <Chip key={p.key} label={p.label} active={platform === p.key} onPress={() => setPlatform(p.key)} />
              ))}
            </View>
          </View>
          <Field
            label="Video linki"
            placeholder={pInfo.example}
            value={url}
            onChangeText={onUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            inputMode="url"
            maxLength={500}
            error={tried ? urlError : null}
          />
          <Field
            label="Kullanıcı adı"
            placeholder="@kullaniciadi"
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={80}
            hint={`Videoyu paylaştığın ${pInfo.label} hesabı`}
            error={tried ? handleError : null}
          />
          <Field
            label="Not (isteğe bağlı)"
            placeholder="Eklemek istediğin bir şey var mı?"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
            inputStyle={{ minHeight: 84, textAlignVertical: 'top', paddingTop: 14 }}
          />
          <View style={{ gap: 10 }}>
            <T v="caption">{`Paylaşımın ekran görüntüsü · ${proofs.length} / ${MAX_PROOFS}`}</T>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {proofs.map((p, i) => (
                <View key={p.uri + i} style={{ width: 84, height: 112, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line }}>
                  <Image source={{ uri: p.uri }} contentFit="cover" style={{ flex: 1 }} accessibilityIgnoresInvertColors />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${i + 1}. görseli kaldır`}
                    hitSlop={8}
                    disabled={busy}
                    onPress={() => setProofs((arr) => arr.filter((_, k) => k !== i))}
                    style={{ position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(12,8,11,.75)', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="close" size={16} color={colors.pearl} />
                  </Pressable>
                </View>
              ))}
              {proofs.length < MAX_PROOFS ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ekran görüntüsü ekle"
                  disabled={busy}
                  onPress={addProofs}
                  style={({ pressed }) => ({ width: 84, height: 112, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: tried && proofError ? colors.error : 'rgba(255,230,240,.22)', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: pressed ? 0.7 : 1 })}
                >
                  <Icon name="add_photo_alternate" size={24} color={colors.blush} />
                  <T v="caption" color={colors.mist} style={{ fontSize: 11 }}>Ekle</T>
                </Pressable>
              ) : null}
            </View>
            {tried && proofError ? <T v="caption" color={colors.error}>{proofError}</T> : <T v="caption" color={colors.mute}>Videonun yayında göründüğü ekran · en fazla 10 MB</T>}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="schedule" size={16} color={colors.mist} />
            <T v="caption" style={{ flex: 1 }}>{`Paylaşım zamanı: şimdi · ${minHours} saatlik süre başvurunla başlar`}</T>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────

function Notice({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line }}>
      <Icon name={icon} size={22} color={colors.irisSoft} />
      <T v="bodySm" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

function StatusCard({ sub, now, minHours, justSent }: { sub: Submission; now: number; minHours: number; justSent: boolean }) {
  const platform = PLATFORMS.find((p) => p.key === sub.platform)?.label ?? sub.platform;
  const dueMs = new Date(sub.posted_at).getTime() + minHours * 3600000;
  const left = dueMs - now;
  const tone = sub.status === 'approved' ? colors.success : sub.status === 'rejected' ? colors.error : colors.blush;
  const icon = sub.status === 'approved' ? 'verified' : sub.status === 'rejected' ? 'cancel' : 'hourglass_top';
  const pill = sub.status === 'approved' ? <Pill text="ONAYLANDI" tone="ok" /> : sub.status === 'rejected' ? <Pill text="ONAYLANMADI" tone="bad" /> : <Pill text="İNCELENİYOR" tone="rose" />;
  const progress = Math.min(1, Math.max(0, 1 - left / (minHours * 3600000)));

  return (
    <View style={{ gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.velvet, borderWidth: 1, borderColor: sub.status === 'approved' ? 'rgba(127,209,174,.35)' : colors.line }}>
      {justSent && sub.status === 'pending' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="check_circle" size={18} color={colors.success} />
          <T v="caption" color={colors.success}>Başvurun alındı, teşekkürler!</T>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name={icon} size={24} color={tone} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="title" style={{ fontSize: 15 }} numberOfLines={1}>{`${platform} · ${sub.handle || 'başvurun'}`}</T>
          <T v="caption" numberOfLines={1}>{`Gönderildi: ${when(sub.created_at)}`}</T>
        </View>
        {pill}
      </View>

      {sub.status === 'pending' ? (
        <View style={{ gap: 8 }}>
          <T v="bodySm" color={colors.pearlSoft}>{`İnceleniyor — videonun ${when(new Date(dueMs).toISOString())} tarihine kadar yayında kalması gerekiyor.`}</T>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(progress * 100)}%`, height: 6, borderRadius: 3, backgroundColor: colors.rose }} />
          </View>
          <T v="caption" color={left > 0 ? colors.blush : colors.success}>
            {left > 0 ? `${minHours} saatin dolmasına ${remaining(left)} kaldı` : `${minHours} saat doldu · ekibimiz kısa süre içinde kontrol edecek`}
          </T>
        </View>
      ) : sub.status === 'approved' ? (
        <T v="bodySm" color={colors.pearlSoft}>
          {sub.premium_until ? `Onaylandı · Premium ${shortDate(sub.premium_until)} tarihine kadar aktif. Teşekkürler! ♡` : 'Onaylandı · Premium hesabına tanımlandı. Teşekkürler! ♡'}
        </T>
      ) : (
        <View style={{ gap: 6 }}>
          <T v="bodySm" color={colors.pearlSoft}>Başvurun onaylanmadı. Kuralları kontrol edip yeniden başvurabilirsin.</T>
          {sub.admin_note ? (
            <View style={{ padding: 12, borderRadius: 14, backgroundColor: colors.errorTint }}>
              <T v="caption" color={colors.error} style={{ marginBottom: 2 }}>Ekibin notu</T>
              <T v="bodySm" color={colors.pearlSoft}>{sub.admin_note}</T>
            </View>
          ) : null}
        </View>
      )}

      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(sub.url).catch(() => {})} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
        <Icon name="open_in_new" size={16} color={colors.mist} />
        <T v="caption" numberOfLines={1} style={{ flex: 1 }}>{sub.url}</T>
      </Pressable>
    </View>
  );
}
