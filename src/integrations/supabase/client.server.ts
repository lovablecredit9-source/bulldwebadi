// Server-side Supabase client. Never expose this module to browser code.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env['SUPABASE_URL'];
  // Accept the legacy service-role secret or Supabase's newer server secret key.
  // Never fall back to a VITE_* publishable key for admin operations.
  const SUPABASE_SERVER_KEY =
    process.env['SUPABASE_SERVICE_ROLE_KEY'] || process.env['SUPABASE_SECRET_KEY'];

  if (!SUPABASE_URL || !SUPABASE_SERVER_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_SERVER_KEY ? ['SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Connect Supabase in Lovable Cloud.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVER_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_SERVER_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});


const APP_SUPABASE_URL = "https://ochqpzpsfqytemrgsdir.supabase.co";
const APP_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Wmfpinvf5ZPzf7dmRoNtMw_1L1H1qfC";

/**
 * Authenticated server client using the user's Supabase JWT.
 * This intentionally uses the publishable key; RLS and SECURITY DEFINER
 * functions enforce the wallet permissions. It never needs a service key.
 */
export function createSupabaseUserClient(accessToken: string) {
  return createClient<Database>(APP_SUPABASE_URL, APP_SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(APP_SUPABASE_PUBLISHABLE_KEY),
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
