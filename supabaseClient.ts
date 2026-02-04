
import { createClient } from '@supabase/supabase-js';

// Access environment variables directly from process.env
// In Vercel and many build tools, these are injected at build or runtime.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * We check if the environment variables are present before initializing.
 * If they are missing, we export null to be handled by the UI.
 * This prevents the "supabaseUrl is required" error.
 */
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
