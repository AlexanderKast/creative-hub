import { createClient } from "@supabase/supabase-js";

// Server-side only — nunca exponer al cliente
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
