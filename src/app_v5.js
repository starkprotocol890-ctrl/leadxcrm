console.log("--- APP_V5.JS MODULE LOADING START ---");
/**
 * Main Entry Point — Master Init App
 */
import { checkAuth, loadCurrentUser } from './modules/auth_v2.js?v=session_isolation_v5';
import { initEventListeners, switchView } from './modules/ui_v2.js?v=session_isolation_v5';
import { loadLeads } from './modules/leads_v2.js?v=session_isolation_v5';
import { loadClients } from './modules/clients_v2.js?v=session_isolation_v5';
import { loadEmployeeList } from './modules/employees_v2.js?v=session_isolation_v5';
import { initChat } from './modules/chat_v2.js?v=session_isolation_v5';
import { loadTasks, initTasksView } from './modules/tasks_v2.js?v=session_isolation_v5';
import { store } from './state/store_v2.js?v=session_isolation_v5';
import { initNotifications, computeNotifications } from './modules/notifications_v2.js?v=session_isolation_v5';
import { initLogs } from './modules/logs_v2.js?v=session_isolation_v5';

let isAppInitialized = false;

export async function initApp() {
  if (isAppInitialized || window.__appInitializing) return;
  window.__appInitializing = true;

  try {
    console.log("[Main] Master Initialization started...");

    // 1. Immediate Auth Check (Critical Security & UX Boundary)
    const session = await checkAuth();
    console.log("[Main] Auth session result:", session);
    console.log("[Main] Current User in store:", store.currentUser);

    if (!session) {
      console.warn("[Main] No session found, redirecting to login...");
      window.location.replace("login.html");
      return;
    }

    // 2. Safe to render dashboard shell and show UI
    document.body.style.display = 'block';
    console.log("[Main] User authenticated, initializing UI...");

    // 3. UI Setup
    initEventListeners();
    initNotifications();
    initLogs(); // Init logs after auth check

    // 4. Sequential Data Load (Robust)
    console.log("[Main] Loading core modules...");
    try { await loadEmployeeList(); console.log("[Main] Employees loaded:", store.allOrgUsers.length); } catch (e) { console.error("Employee load failed", e); }
    try { await loadLeads(); console.log("[Main] Leads loaded:", store.allLeads.length); } catch (e) { console.error("Leads load failed", e); }
    try { await loadClients(); console.log("[Main] Clients loaded:", store.allClients.length); } catch (e) { console.error("Clients load failed", e); }
    try { initTasksView(); await loadTasks(); computeNotifications(); console.log("[Main] Tasks loaded:", store.allTasks.length); } catch (e) { console.error("Tasks load failed", e); }
    try { await initChat(); console.log("[Main] Chat initialized"); } catch (e) { console.error("Chat load failed", e); }

    // 5. Initial View Switch
    const initialView = 'leads';
    try {
      await switchView(initialView);
    } catch (e) {
      console.error("Initial view switch failed", e);
      // Fallback: show the container directly if switchView fails
      const el = document.getElementById('leadsView');
      if (el) el.style.display = 'block';
    }

    isAppInitialized = true;
    console.log("[Main] Master Initialization complete.");
  } catch (err) {
    console.error("[Main] Initialization failed:", err);
  }
}

// Start the app when DOM is ready
// Start the app when DOM is ready
// Redundant if called from index.html, but keeping as safety with guard
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

// Global Exposure for debugging/navigation
window.initApp = initApp;
window.switchView = switchView;
