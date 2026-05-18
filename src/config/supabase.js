console.log("--- SUPABASE CONFIG LOADING START ---");
/**
 * Supabase Configuration & Client Initialization
 */

const SUPABASE_URL = "https://ogioncykqergwuwmhimb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9naW9uY3lrcWVyZ3d1d21oaW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzkxMTYsImV4cCI6MjA5MTc1NTExNn0.KlaZmhczgQx3XFi0wt-JWEJH2aItc7CWM3-RoH7NsVA";

// Initialize Supabase Client
// Note: 'supabase' is expected to be available globally via the CDN script in index.html
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.__supabaseClient = supabaseClient;

/**
 * Centralized Error Handler
 * Processes Supabase errors and returns UI-friendly messages.
 */
export function handleSupabaseError(error, context) {
  if (!error) return null;
  console.error(`Error in ${context}:`, error);

  const status = error?.response?.status;
  if (status === 401) {
    console.warn("[Supabase] 401 Unauthorized - Dev Mode: Not redirecting.");
    // window.location.href = 'login.html';
    return { type: 'auth', message: 'Session expired. (Dev Mode: Not redirecting)' };
  }

  if (status === 403) {
    return {
      type: 'permission',
      message: '🚫 You do not have permission to view this data'
    };
  }

  return {
    type: 'general',
    message: error.message || 'Something went wrong'
  };
}
