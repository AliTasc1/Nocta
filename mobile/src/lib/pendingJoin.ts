import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * nocta://join/KOD bağlantısıyla gelen oda kodu, kullanıcı henüz giriş yapmamış ya da
 * profilini tamamlamamışsa burada bekletilir; davet ekranı açıldığında kullanılır.
 */
const KEY = 'nocta.pending_join';
let memory: string | null = null;

export async function setPendingJoin(code: string | null) {
  memory = code;
  try {
    if (code) await AsyncStorage.setItem(KEY, code);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // depolama yoksa bellekteki değer yeterli
  }
}

export async function getPendingJoin(): Promise<string | null> {
  if (memory) return memory;
  try {
    memory = await AsyncStorage.getItem(KEY);
  } catch {
    memory = null;
  }
  return memory;
}

/** "abcd1234", "ABCD-1234 " → "ABCD-1234" (en fazla 8 karakter) */
export function formatInviteCode(input: string): string {
  const clean = input.toLocaleUpperCase('en-US').replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function inviteLink(code: string) {
  return `nocta://join/${code}`;
}

/** QR / bağlantı içeriğinden kodu çıkarır */
export function codeFromScan(data: string): string | null {
  const m = data.match(/join\/([A-Za-z0-9-]+)/);
  const raw = m ? m[1] : data;
  const code = formatInviteCode(raw);
  return code.length === 9 ? code : null;
}
