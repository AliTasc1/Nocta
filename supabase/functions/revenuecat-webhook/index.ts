// RevenueCat → Supabase abonelik senkronizasyonu
//
// Kurulum (RevenueCat entegrasyonu aşamasında):
//  1) Supabase → Edge Functions → Secrets: REVENUECAT_WEBHOOK_SECRET = <uzun rastgele değer>
//  2) RevenueCat → Project → Integrations → Webhooks:
//       URL: https://<proje>.supabase.co/functions/v1/revenuecat-webhook
//       Authorization header: Bearer <aynı değer>
//  3) Uygulamada Purchases.logIn(<supabase user id>) ile app_user_id = Supabase kullanıcı kimliği olmalı.
//
// Abonelik çifte bağlanır: kullanıcının açık odası varsa couple_id yazılır, böylece tek abonelik iki kişiyi kapsar.
import { createClient } from 'npm:@supabase/supabase-js@2';

const PRICES: Record<string, number> = { monthly: 139, yearly: 899 };

function planFrom(productId: string, periodType?: string): 'monthly' | 'yearly' | 'lifetime' {
  const p = productId.toLowerCase();
  if (p.includes('year') || p.includes('annual') || p.includes('yillik')) return 'yearly';
  if (p.includes('life')) return 'lifetime';
  if (periodType === 'NORMAL' || p.includes('month') || p.includes('aylik')) return 'monthly';
  return 'monthly';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const auth = req.headers.get('Authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => null);
  const ev = body?.event;
  if (!ev) return new Response('Bad request', { status: 400 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const userId: string | undefined = ev.app_user_id ?? ev.original_app_user_id;
  const uuidRe = /^[0-9a-f-]{36}$/i;
  if (!userId || !uuidRe.test(userId)) {
    // Anonim RevenueCat kimlikleri: kullanıcı logIn olana kadar yok say
    return Response.json({ ok: true, skipped: 'anonymous user' });
  }

  const { data: couple } = await db
    .from('couples')
    .select('id')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .in('status', ['pending', 'active'])
    .maybeSingle();

  const productId: string = ev.product_id ?? '';
  const plan = planFrom(productId, ev.period_type);
  const ref: string = ev.original_transaction_id ?? ev.transaction_id ?? ev.id;
  const expires = ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null;
  const price = typeof ev.price_in_purchased_currency === 'number' && ev.currency === 'TRY'
    ? ev.price_in_purchased_currency
    : typeof ev.price === 'number' ? ev.price : PRICES[plan] ?? 0;

  const statusByType: Record<string, string> = {
    INITIAL_PURCHASE: ev.period_type === 'TRIAL' ? 'trial' : 'active',
    RENEWAL: 'active',
    PRODUCT_CHANGE: 'active',
    UNCANCELLATION: 'active',
    NON_RENEWING_PURCHASE: 'active',
    CANCELLATION: 'canceled',
    BILLING_ISSUE: 'billing_issue',
    EXPIRATION: 'expired',
    SUBSCRIPTION_PAUSED: 'canceled',
  };
  const status = statusByType[ev.type];

  if (status) {
    const { data: existing } = await db.from('subscriptions').select('id').eq('provider_ref', ref).maybeSingle();
    const row = {
      user_id: userId,
      couple_id: couple?.id ?? null,
      plan,
      status,
      provider: 'revenuecat',
      provider_ref: ref,
      price_try: price,
      expires_at: expires,
      canceled_at: status === 'canceled' || status === 'expired' ? new Date().toISOString() : null,
    };
    let subId = existing?.id as string | undefined;
    if (existing) await db.from('subscriptions').update(row).eq('id', existing.id);
    else {
      const { data } = await db.from('subscriptions').insert(row).select('id').single();
      subId = data?.id;
    }

    if (['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE'].includes(ev.type) && ev.period_type !== 'TRIAL') {
      await db.from('payments').insert({
        subscription_id: subId,
        user_id: userId,
        couple_id: couple?.id ?? null,
        provider_ref: ev.transaction_id ?? ref,
        amount_try: price,
        method: ev.store === 'APP_STORE' ? 'App Store' : ev.store === 'PLAY_STORE' ? 'Google Play' : String(ev.store ?? ''),
        status: 'paid',
        raw: ev,
      });
    }
    if (ev.type === 'BILLING_ISSUE') {
      await db.from('payments').insert({
        subscription_id: subId, user_id: userId, couple_id: couple?.id ?? null,
        provider_ref: ev.transaction_id ?? ref, amount_try: price, method: String(ev.store ?? ''), status: 'failed', raw: ev,
      });
    }
  }
  if (ev.type === 'REFUND' || (ev.type === 'CANCELLATION' && ev.cancel_reason === 'CUSTOMER_SUPPORT')) {
    await db.from('payments').update({ status: 'refunded' }).eq('provider_ref', ev.transaction_id ?? ref);
  }

  return Response.json({ ok: true });
});
