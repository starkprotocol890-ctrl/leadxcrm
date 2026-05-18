import { store } from '../state/store_v2.js';
import { loadLeads } from './leads_v2.js';
import { loadClients } from './clients_v2.js';
import { loadTasks } from './tasks_v2.js';
import { loadEmployeeList } from './employees_v2.js';
import { initPlanner } from './planner_v2.js';
import { initChat } from './chat_v2.js';
import { showCalendarPage } from './calendar_v2.js';
import { loadReports } from './reports_v2.js';
import { logout } from './auth_v2.js';

/**
 * MASTER UI CONTROLLER
 * Optimized for isolation and single-modal state.
 */

window.activeModal = null;
window.activeTab = 'leads';

/**
 * MODAL MANAGER (Requirement 1 & 2)
 */
window.closeAllModals = () => {
  console.log("[ModalManager] Closing all modals...");
  const overlays = document.querySelectorAll('.modal-overlay');
  overlays.forEach(m => {
    m.classList.remove('show');
    m.style.display = 'none'; // Force hide
  });
  if (window.hidePopover) window.hidePopover();
  window.activeModal = null;
};

window.openModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (!modal) return console.error(`[ModalManager] Modal NOT FOUND: ${modalId}`);

  // Requirement 1: Force isolation - close all others first
  window.closeAllModals();

  console.log(`[ModalManager] Opening: ${modalId}`);

  // Ensure visibility
  modal.style.display = 'flex';

  // Allow browser to render display:flex before adding transition class
  requestAnimationFrame(() => {
    modal.classList.add('show');
  });

  window.activeModal = modalId;
};

window.closeModal = (modalId) => {
  console.log(`[ModalManager] Closing: ${modalId}`);
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      if (!modal.classList.contains('show')) {
        modal.style.display = 'none';
      }
    }, 250);
    if (window.activeModal === modalId) window.activeModal = null;
  }
};

/**
 * COMING SOON HANDLER
 */
window.showComingSoon = (featureName) => {
  const title = document.getElementById('comingSoonTitle');
  const message = document.getElementById('comingSoonMessage');

  if (title) title.innerText = `${featureName} is Coming Soon 🚀`;
  if (message) message.innerText = `${featureName} is currently under development and will be available in a future update. Stay tuned!`;

  window.openModal('comingSoonModal');
};

/**
 * TAB MANAGER (Requirement 4 & 5)
 */
export async function switchView(viewName) {
  const page = viewName || 'leads';

  // Check for Coming Soon features
  const comingSoonFeatures = ['analytics', 'chat', 'reports'];
  if (comingSoonFeatures.includes(page)) {
    const featureLabels = {
      'analytics': 'Analytics',
      'chat': 'Chat',
      'reports': 'Reports'
    };
    window.showComingSoon(featureLabels[page]);
    return; // Stop navigation
  }

  console.log(`[UI] Tab Switch -> ${page}`);

  // Update State
  window.activeTab = page;
  store.currentView = page;

  // Requirement 4: Auto-close modals on navigation
  window.closeAllModals();
  if (window.hidePopover) window.hidePopover();

  // 1. Hide all main view containers using the robust .view-container class
  const views = document.querySelectorAll('.view-container');
  views.forEach(v => v.style.display = 'none');

  // 2. Show target container
  const idMap = {
    'leads': 'leadsView',
    'clients': 'clientsView',
    'calendar': 'calendarPage',
    'tasks': 'tasksView',
    'chat': 'chatView',
    'reports': 'reportsView',
    'taskmanager': 'taskManagerView',
    'employees': 'employeesView',
    'analytics': 'analyticsView'
  };

  const targetId = idMap[page];
  const selected = document.getElementById(targetId);
  if (selected) {
    // Special handling for flex layouts
    const flexViews = ['calendar', 'taskmanager'];
    if (flexViews.includes(page)) {
      selected.style.display = 'flex';
    } else {
      selected.style.display = 'block';
    }
  } else {
    console.warn(`[UI] Target container not found for view: ${page} (#${targetId})`);
  }

  // 3. Update Sidebar/Nav UI
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('active');

    // Normalize comparison
    const tabView = tab.id.replace('tab', '').toLowerCase();
    if (tabView === page) {
      tab.classList.add('active');
    }
  });

  const moreTrigger = document.getElementById('moreTabsTrigger');
  if (moreTrigger) {
    if (['reports', 'analytics', 'chat'].includes(page)) {
      moreTrigger.classList.add('active');
    } else {
      moreTrigger.classList.remove('active');
    }
  }

  // Close more tabs dropdown
  const moreMenu = document.getElementById('moreTabsMenu');
  if (moreMenu) {
    moreMenu.classList.remove('show');
  }

  // 4. Trigger Data Loads
  try {
    switch (page) {
      case 'leads': await loadLeads(); break;
      case 'clients':
        await loadClients();
        await loadEmployeeList();
        break;
      case 'tasks': await loadTasks(); break;
      case 'employees': await loadEmployeeList(); break;
      case 'taskmanager': await initPlanner(); break;
      case 'calendar': await showCalendarPage(); break;
      case 'reports': await loadReports(); break;
    }
  } catch (err) {
    console.error(`[UI] Data Load Failed for ${page}:`, err);
  }
}

/**
 * EVENT INITIALIZATION
 */
export function initEventListeners() {
  if (window.__uiInitialized) return;

  console.log("[UI] Initializing Global Interaction Listeners...");

  // Register uiHandlers
  window.uiHandlers = {
    toggleMoreTabs(event) {
      event.stopPropagation();
      const menu = document.getElementById('moreTabsMenu');
      if (menu) {
        menu.classList.toggle('show');
      }
    }
  };

  // Close more tabs dropdown on click outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('moreTabsDropdown');
    if (dropdown && !dropdown.contains(e.target)) {
      const menu = document.getElementById('moreTabsMenu');
      if (menu) {
        menu.classList.remove('show');
      }
    }
  });

  // Tab Listeners
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.onclick = () => {
      const view = tab.id.replace('tab', '').toLowerCase();
      switchView(view);
    };
  });

  // Overlay Click (Requirement 9)
  window.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      window.closeAllModals();
    }
  });

  // ESC Key Support
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.closeAllModals();
  });

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;

  window.__uiInitialized = true;
}

// Global Exposure
window.switchView = switchView;
window.openModal = window.openModal;
window.closeModal = window.closeModal;
window.closeAllModals = window.closeAllModals;
window.showComingSoon = window.showComingSoon;

/**
 * TOAST NOTIFICATION SYSTEM
 */
window.showToast = (message, type = 'success') => {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideIn 0.3s ease-out, fadeOut 0.3s ease-in 2.7s forwards;
  `;

  toast.innerHTML = `
    ${type === 'success' ? '✓' : '⚠️'} ${message}
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
};

// Add animations if not present in CSS
if (!document.getElementById('toastAnimations')) {
  const style = document.createElement('style');
  style.id = 'toastAnimations';
  style.innerHTML = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * GLOBAL CONFIRMATION HELPER
 */
window.confirmAction = (options, onConfirm) => {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmTitle');
  const msgEl = document.getElementById('confirmMessage');
  const btn = document.getElementById('confirmBtn');

  if (!modal) {
    if (confirm(options.message)) onConfirm();
    return;
  }

  titleEl.innerText = options.title || "Confirm Action";
  msgEl.innerText = options.message || "Are you sure?";
  btn.innerText = options.confirmText || "Confirm";

  // UI Polish based on action type
  if (options.isDelete) {
    btn.style.background = "#ef4444";
    btn.style.borderColor = "#ef4444";
  } else {
    btn.style.background = "#2563eb";
    btn.style.borderColor = "#2563eb";
  }

  btn.onclick = () => {
    window.closeModal('confirmModal');
    onConfirm();
  };

  window.openModal('confirmModal');
};
