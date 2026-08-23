import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Service role client. Bypasses row level security, so it is used only for
 * account provisioning and invitation redemption, never for ordinary reads.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createSupabaseClient<Database>(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
