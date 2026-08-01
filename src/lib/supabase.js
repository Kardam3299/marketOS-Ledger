// Supabase client is handled exclusively in the Electron Main process (IPC only) for security.
// React components should not access Supabase directly.
export const supabase = null;
export const isSupabaseConfigured = false;
