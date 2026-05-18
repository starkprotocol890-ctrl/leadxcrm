import { supabaseClient } from '../config/supabase.js';
import { store } from '../state/store_v2.js';
import { escapeHtml } from '../utils/appUtils.js';

/**
 * ACTIVITY LOGS MODULE — REALTIME TEXT NOTES
 */

export function initLogs() {
  const currentUser = store.currentUser;
  const logsDropdown = document.getElementById('logsDropdown');
  
  // Restrict to CEO (5), Manager (4), and Department Heads (4)
  if (!currentUser || currentUser.hierarchy_level < 4) {
    if (logsDropdown) logsDropdown.style.display = 'none';
    console.log("[Logs] Access denied. User lacks required hierarchy level.");
    return;
  }

  console.log("[Logs] Initializing real-time activity logs...");
  fetchLogs();
  setupRealtimeSubscription();

  // Polling fallback: fetch logs every 5 seconds
  setInterval(() => {
    fetchLogs();
  }, 5000);

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('logsDropdown');
    const menu = document.getElementById('logsMenu');
    if (dropdown && menu && !dropdown.contains(e.target)) {
      menu.classList.remove('show');
    }
  });

  window.logHandlers = {
    toggleLogsMenu: (e) => {
      e.stopPropagation();
      const menu = document.getElementById('logsMenu');
      if (menu) {
        const isOpening = !menu.classList.contains('show');
        
        // Close others first
        document.querySelectorAll('.notification-menu.show, .profile-menu.show').forEach(m => {
          if (m.id !== 'logsMenu') m.classList.remove('show');
        });

        if (isOpening) {
          menu.classList.add('show');
          // Reset unread badge
          const badge = document.getElementById('logsBadge');
          if (badge) badge.style.display = 'none';
        } else {
          menu.classList.remove('show');
        }
      }
    }
  };
}

export async function fetchLogs() {
  try {
    const { data, error } = await supabaseClient
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    
    // Check if new logs arrived
    const oldLength = store.activityLogs ? store.activityLogs.length : 0;
    const isNew = store.activityLogs && data && data.length > 0 && 
                  (oldLength === 0 || data[0].id !== store.activityLogs[0].id);

    store.activityLogs = data || [];
    renderLogs();

    // Show badge if menu is not open and new logs arrived
    if (isNew) {
      const menu = document.getElementById('logsMenu');
      if (!menu || !menu.classList.contains('show')) {
        const badge = document.getElementById('logsBadge');
        if (badge) badge.style.display = 'block';
      }
    }
  } catch (err) {
    console.error("[Logs] Failed to fetch logs:", err);
  }
}

function setupRealtimeSubscription() {
  supabaseClient.channel('public:activity_logs')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, payload => {
      console.log("[Logs] Real-time log received:", payload.new);
      if (!store.activityLogs) store.activityLogs = [];
      
      // Add to beginning
      store.activityLogs.unshift(payload.new);
      
      // Keep only last 50
      if (store.activityLogs.length > 50) {
        store.activityLogs.pop();
      }

      // Show badge if menu is not open
      const menu = document.getElementById('logsMenu');
      if (!menu || !menu.classList.contains('show')) {
        const badge = document.getElementById('logsBadge');
        if (badge) badge.style.display = 'block';
      }

      renderLogs();
    })
    .subscribe();
}

function renderLogs() {
  const container = document.getElementById('logsMenuBody');
  if (!container) return;

  const logs = store.activityLogs || [];

  if (logs.length === 0) {
    container.innerHTML = `<div class="notification-empty">No recent activity logs.</div>`;
    return;
  }

  container.innerHTML = logs.map(log => {
    // Format the date dynamically
    const dateObj = new Date(log.created_at);
    const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    let icon = "📝";
    if (log.action_type === 'CREATE' || log.action_type === 'insert') icon = "✨";
    if (log.action_type === 'UPDATE' || log.action_type === 'update') icon = "✏️";
    if (log.action_type === 'DELETE' || log.action_type === 'delete') icon = "🗑️";

    return `
      <div class="notification-item">
        <div class="notification-item-title">
          <span>${icon}</span>
          <span style="color: #0f172a">${escapeHtml(log.actor_name || 'System')}</span>
        </div>
        <div style="font-size: 12px; line-height: 1.4; color: #475569; margin: 2px 0;">
          ${escapeHtml(log.action_description || 'performed an action on ' + log.module_name)}
        </div>
        <div class="notification-item-time">${dateStr} at ${timeStr}</div>
      </div>
    `;
  }).join('');
}
