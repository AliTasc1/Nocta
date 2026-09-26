import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** İstemci adresi ve herkese açık anahtar (depolama yüklemelerinde ilerleme için doğrudan istek atılır). */
export const supabaseUrl = (url || 'http://localhost').replace(/\/+$/, '');
export const supabaseKey = key || 'missing';

export const configMissing = !url || !key;

export const supabase = createClient(url || 'http://localhost', key || 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'nocta-admin-auth' },
});
