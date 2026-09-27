import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Bağlantı bilgileri mobile/.env dosyasından okunur (git'e eklenmez; örnek: mobile/.env.example)
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase ayarları eksik: mobile/.env dosyasında EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlayın.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Uygulama ön plandayken token yenilemeyi çalıştır
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// Postgres / Supabase hatalarını kullanıcı dostu Türkçe metne çevir
export function errorText(e: unknown): string {
  const err = e as { message?: string; code?: string; status?: number } | null;
  const msg = err?.message ?? '';
  if (!msg) return 'Bir şeyler ters gitti. Lütfen tekrar dene.';
  if (msg.includes('PREMIUM_REQUIRED')) return 'Bu içerik Nocta Premium ile açılır.';
  if (/Invalid login credentials/i.test(msg)) return 'E-posta ya da şifre hatalı.';
  if (/Email not confirmed/i.test(msg)) return 'E-posta adresini henüz doğrulamadın. Gelen kutunu kontrol et.';
  if (/User already registered/i.test(msg)) return 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.';
  if (/Password should be at least/i.test(msg)) return 'Şifre en az 6 karakter olmalı.';
  if (/rate limit|too many/i.test(msg)) return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
  if (/Unable to validate email|invalid email/i.test(msg)) return 'Geçerli bir e-posta adresi gir.';
  if (/Network request failed|Failed to fetch|fetch failed/i.test(msg)) return 'İnternet bağlantını kontrol et.';
  if (/JWT expired|session/i.test(msg) && err?.status === 401) return 'Oturum süresi doldu. Tekrar giriş yap.';
  if (/row-level security|permission denied/i.test(msg)) return 'Bu işlem için yetkin yok.';
  // Sunucu fonksiyonlarımız zaten Türkçe hata mesajı döndürüyor
  return msg;
}

export function isPremiumError(e: unknown) {
  return ((e as { message?: string })?.message ?? '').includes('PREMIUM_REQUIRED');
}
