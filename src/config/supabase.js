console.log("--- SUPABASE CONFIG LOADING START ---");
/**
 * Supabase Configuration & Client Initialization
 */

export const SUPABASE_URL = "https://ogioncykqergwuwmhimb.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9naW9uY3lrcWVyZ3d1d21oaW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzkxMTYsImV4cCI6MjA5MTc1NTExNn0.KlaZmhczgQx3XFi0wt-JWEJH2aItc7CWM3-RoH7NsVA";

// Initialize Supabase Client with strict cache busting and sessionStorage
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: (url, options) => {
      const headers = new Headers(options?.headers || {});
      
      // Enforce strict no-cache headers on all requests
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');

      let finalUrl = url;
      // Append a dynamic query param to bypass proxy/CDN caching on the GET user endpoint
      const isGetRequest = !options?.method || options.method.toUpperCase() === 'GET';
      if (isGetRequest && url.includes('/auth/v1/user')) {
        try {
          const u = new URL(url);
          u.searchParams.set('cb', Date.now().toString());
          finalUrl = u.toString();
        } catch (e) {
          // Fallback if URL parsing fails
          finalUrl = `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
        }
      }

      return fetch(finalUrl, {
        ...options,
        headers
      });
    }
  }
});
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
