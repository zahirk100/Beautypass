// Public project settings. The publishable key is meant to be public: access is enforced by
// row level security and the database functions. Local development overrides via .env.local.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pcylljcylsbzfsgzhcgc.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_1_hhX5RTIM_uA9oTvzcjcQ_Ekj59PS9';
