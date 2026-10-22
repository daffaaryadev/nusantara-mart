import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

console.log("================================");
console.log("SUPABASE URL:", supabaseUrl);
console.log("================================");

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);