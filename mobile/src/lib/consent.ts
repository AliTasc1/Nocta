import AsyncStorage from '@react-native-async-storage/async-storage';

/** 18+ ve kullanım koşulları onayı (kayıttan önce zorunlu) */
export const AGE_KEY = 'nocta.age_ok';

export async function saveAgeConsent() {
  try {
    await AsyncStorage.setItem(AGE_KEY, JSON.stringify({ at: new Date().toISOString() }));
  } catch {
    // depolama yoksa da devam
  }
}

export async function hasAgeConsent(): Promise<boolean> {
  try {
    return !!(await AsyncStorage.getItem(AGE_KEY));
  } catch {
    return false;
  }
}
