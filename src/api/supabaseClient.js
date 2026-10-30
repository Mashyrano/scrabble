import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY — copy .env.example to .env.local and fill them in.');
}

export const supabase = createClient(url, key);

// Set once Google is enabled under Authentication → Sign In / Providers.
export const GOOGLE_SIGN_IN = import.meta.env.VITE_GOOGLE_SIGN_IN === 'true';

// The app's view of a signed-in user.
export function toAppUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email,
    full_name: meta.full_name || meta.name || String(user.email || '').split('@')[0],
  };
}
