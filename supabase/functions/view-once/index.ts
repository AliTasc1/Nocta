// Tek seferlik (patlayan) fotoğraf/video açma
// POST { message_id } → { url, kind, expires_in }
// - Yalnızca alıcı (gönderen değil) ve yalnızca BİR kez açabilir.
// - Dosya chat-media/<couple>/vo/... altında; istemci bu klasörü doğrudan okuyamaz.
// - Açıldıktan 5 dk sonra dosya depodan silinir (sonraki çağrılarda temizlenir).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Yöntem desteklenmiyor' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const uid = userData?.user?.id;
  if (userErr || !uid) return json({ error: 'Oturum gerekli' }, 401);

  const body = await req.json().catch(() => ({}));
  const messageId = String(body?.message_id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return json({ error: 'Geçersiz mesaj' }, 400);

  const { data: msg } = await admin.from('messages').select('id,couple_id,sender_id,kind,meta').eq('id', messageId).maybeSingle();
  if (!msg || !msg.meta?.view_once || !['photo', 'video'].includes(msg.kind)) return json({ error: 'Mesaj bulunamadı' }, 404);

  const { data: couple } = await admin.from('couples').select('id,user_a,user_b,status').eq('id', msg.couple_id).maybeSingle();
  const member = couple && (couple.user_a === uid || couple.user_b === uid) && couple.status !== 'disconnected';
  if (!member) return json({ error: 'Yetkisiz' }, 403);
  if (msg.sender_id === uid) return json({ error: 'Tek seferlik medyayı yalnızca alıcı açabilir.' }, 403);

  // Eski açılmış dosyaları temizle (5 dk'dan eski)
  const { data: stale } = await admin
    .from('view_once_opens')
    .select('message_id, messages!inner(meta)')
    .eq('couple_id', msg.couple_id)
    .eq('file_deleted', false)
    .lt('opened_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());
  const stalePaths = (stale ?? []).map((r: any) => r.messages?.meta?.path).filter(Boolean);
  if (stalePaths.length) {
    await admin.storage.from('chat-media').remove(stalePaths);
    await admin.from('view_once_opens').update({ file_deleted: true }).in('message_id', (stale ?? []).map((r: any) => r.message_id));
  }

  // Tek kullanımlık: kayıt eklenemezse daha önce açılmıştır
  const { error: openErr } = await admin
    .from('view_once_opens')
    .insert({ message_id: msg.id, couple_id: msg.couple_id, opened_by: uid });
  if (openErr) return json({ error: 'Bu medya zaten açıldı.' , opened: true }, 410);

  const path = String(msg.meta.path ?? '');
  const expiresIn = msg.kind === 'video' ? 300 : 120;
  const { data: signed, error: signErr } = await admin.storage.from('chat-media').createSignedUrl(path, expiresIn);
  if (signErr || !signed?.signedUrl) return json({ error: 'Dosya bulunamadı' }, 404);

  return json({ url: signed.signedUrl, kind: msg.kind, expires_in: expiresIn });
});
