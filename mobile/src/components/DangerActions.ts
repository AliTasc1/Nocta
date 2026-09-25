import { errorText, supabase } from '@/lib/supabase';
import type { DialogOptions } from './Dialog';

type Ask = (o: DialogOptions) => void;
type Show = (text: string, tone?: 'ok' | 'error' | 'info') => void;

/** Sohbeti / anıları kalıcı silme onayı (Ayarlar ve Gizlilik ekranlarında ortak) */
export function confirmWipe(ask: Ask, show: Show, what: 'chat' | 'memories') {
  ask({
    icon: what === 'chat' ? 'chat' : 'auto_stories',
    tone: 'error',
    title: what === 'chat' ? 'Sohbeti sil?' : 'Anıları sil?',
    desc:
      what === 'chat'
        ? 'Tüm mesajlar ikiniz için de kalıcı olarak silinir. Bu işlem geri alınamaz.'
        : 'Zaman çizelgenizdeki tüm anılar ikiniz için de kalıcı olarak silinir. Bu işlem geri alınamaz.',
    actions: [
      {
        label: 'Kalıcı olarak sil',
        kind: 'danger',
        onPress: async () => {
          const { error } = await supabase.rpc(what === 'chat' ? 'delete_conversation' : 'delete_memories');
          if (error) throw new Error(errorText(error));
          show(what === 'chat' ? 'Sohbet silindi.' : 'Anılar silindi.', 'ok');
        },
      },
      { label: 'Vazgeç', kind: 'ghost' },
    ],
  });
}
