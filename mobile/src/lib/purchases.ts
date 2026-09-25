/**
 * Uygulama içi satın alma katmanı.
 *
 * Şu an mağaza entegrasyonu (RevenueCat) yok; bu modül arayüzü sabitler ki ileride
 * `react-native-purchases` eklendiğinde ekranlara dokunmadan değiştirilebilsin.
 *
 * TODO(RevenueCat):
 *  1. `npx expo install react-native-purchases` (geliştirme derlemesi gerekir, Expo Go desteklemez).
 *  2. Uygulama açılışında `Purchases.configure({ apiKey, appUserID: userId })`.
 *  3. `getOfferings()` → `Purchases.getOfferings()` ile current.availablePackages eşlemesi.
 *  4. `purchase(planId)` → `Purchases.purchasePackage(pkg)`; başarılıysa RevenueCat webhook'u
 *     `subscriptions` tablosunu günceller, istemci `refreshPremium()` çağırır.
 *  5. `restore()` → `Purchases.restorePurchases()`.
 */

export type PlanId = 'monthly' | 'yearly';

export type Plan = {
  id: PlanId;
  title: string;
  subtitle: string;
  price: number;
  currency: string;
};

export type PurchaseResult = { ok: true } | { ok: false; reason: 'unavailable' | 'canceled' | 'failed'; message: string };

export const STORE_MESSAGE = 'Satın alma, uygulama mağaza sürümünde aktif olacak.';

/** Satın alma şu an mümkün mü? (RevenueCat bağlanınca true dönecek) */
export function purchasesAvailable(): boolean {
  // TODO(RevenueCat): Purchases yapılandırıldıysa true döndür.
  return false;
}

/** Fiyatlar: şimdilik app_settings.prices'tan, ileride mağaza tekliflerinden. */
export async function getOfferings(prices?: { monthly?: number; yearly?: number; currency?: string } | null): Promise<Plan[]> {
  // TODO(RevenueCat): const offerings = await Purchases.getOfferings(); …
  const monthly = Number(prices?.monthly ?? 139);
  const yearly = Number(prices?.yearly ?? 899);
  const currency = prices?.currency ?? 'TRY';
  const perMonth = yearly / 12;
  const saving = monthly > 0 ? Math.round((1 - perMonth / monthly) * 100) : 0;
  return [
    { id: 'monthly', title: 'Aylık', subtitle: 'Her ay yenilenir', price: monthly, currency },
    {
      id: 'yearly',
      title: 'Yıllık',
      subtitle: `${formatPrice(perMonth, currency)} / ay${saving > 0 ? ` · %${saving} tasarruf` : ''}`,
      price: yearly,
      currency,
    },
  ];
}

export async function purchase(_planId: PlanId): Promise<PurchaseResult> {
  // TODO(RevenueCat): const { customerInfo } = await Purchases.purchasePackage(pkg);
  return { ok: false, reason: 'unavailable', message: STORE_MESSAGE };
}

export async function restore(): Promise<PurchaseResult> {
  // TODO(RevenueCat): await Purchases.restorePurchases();
  return { ok: false, reason: 'unavailable', message: STORE_MESSAGE };
}

export function formatPrice(n: number, currency = 'TRY'): string {
  const symbol = currency === 'TRY' ? '₺' : `${currency} `;
  const rounded = Math.round(n * 10) / 10;
  const txt = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
  return `${symbol}${txt}`;
}
