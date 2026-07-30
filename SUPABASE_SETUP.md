# Supabase setup

1. Create a Supabase project and enable the Table Editor.
2. Create tables for transactions and settings, or keep using the local Electron store for now.
3. Copy .env.example to .env and set:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
4. The app will automatically use the Supabase-backed repository when both values are present; otherwise it stays on the local Electron storage path.

This keeps the UI and business logic unchanged while making the app repository-ready for future cloud sync.
