import { store } from '../state/store_v2.js';
import { escapeHtml } from '../utils/appUtils.js';
import { supabaseClient } from '../config/supabase.js';

/**
 * NOTIFICATIONS MODULE
 * Dynamic notifications computed from the client and task state
 */

let notifications = [];
let readIds = new Set();

// Load read notification IDs from local storage
try {
  const stored = localStorage.getItem('leadx_read_notifications');
  if (stored) {
    readIds = new Set(JSON.parse(stored));
  }
} catch (e) {
  console.error("Failed to load read notifications", e);
}

function saveReadIds() {
  try {
    localStorage.setItem('leadx_read_notifications', JSON.stringify(Array.from(readIds)));
  } catch (e) {
    console.error("Failed to save read notifications", e);
  }
}

/**
 * Checks if two dates represent the same day
 */
function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

/**
 * Compute notifications based on current tasks
 */
export function computeNotifications() {
  const currentUser = store.currentUser;
  if (!currentUser) return;

  const tasks = store.allTasks || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const newNotifications = [];

  tasks.forEach(task => {
    const isGlobalViewer = currentUser.role === 'ceo' || currentUser.role === 'manager';
    const isAssigned = task.assigned_to === currentUser.id;
    const isCreator = task.created_by === currentUser.id;
    
    // CEO and Manager see all task notifications globally.
    // Others only see tasks assigned to them or created by them.
    if (!isGlobalViewer && !isAssigned && !isCreator) return;

    const taskDate = task.due_date ? new Date(task.due_date) : null;
    if (taskDate) {
      taskDate.setHours(0, 0, 0, 0);
    }

    const createdDate = task.created_at ? new Date(task.created_at) : null;
    const isCompleted = task.status === 'completed';

    // 1. Task Overdue
    if (taskDate && taskDate < today && !isCompleted) {
      newNotifications.push({
        id: `overdue-${task.id}`,
        taskId: task.id,
        type: 'overdue',
        title: 'Task Overdue',
        message: `"${task.title || 'Untitled'}" is past its due date of ${task.due_date}.`,
        icon: '⚠️',
        color: '#ef4444',
        timestamp: task.due_date
      });
    }

    // 2. Daily Task (due today)
    if (taskDate && isSameDay(taskDate, today) && !isCompleted) {
      newNotifications.push({
        id: `daily-${task.id}`,
        taskId: task.id,
        type: 'daily',
        title: 'Daily Task',
        message: `"${task.title || 'Untitled'}" is due today!`,
        icon: '📅',
        color: '#2563eb',
        timestamp: task.due_date
      });
    }

    // 3. Task Completed
    if (isCompleted) {
      newNotifications.push({
        id: `completed-${task.id}`,
        taskId: task.id,
        type: 'completed',
        title: 'Task Completed',
        message: `"${task.title || 'Untitled'}" has been marked completed!`,
        icon: '✅',
        color: '#10b981',
        timestamp: task.updated_at || task.created_at
      });
    }

    // 4. New Task Added (created in the last 48 hours)
    if (createdDate && (new Date() - createdDate) < (48 * 60 * 60 * 1000) && !isCompleted) {
      newNotifications.push({
        id: `new-${task.id}`,
        taskId: task.id,
        type: 'new',
        title: 'New Task Added',
        message: `"${task.title || 'Untitled'}" has been added to your schedule.`,
        icon: '🚀',
        color: '#a855f7',
        timestamp: task.created_at
      });
    }
  });

  // Sort notifications by timestamp (newest first)
  newNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  notifications = newNotifications;
  renderNotifications();
}

/**
 * Render the notifications to the DOM
 */
export function renderNotifications() {
  const badge = document.getElementById('notificationBadge');
  const body = document.getElementById('notificationMenuBody');
  if (!body) return;

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  // Badge count display
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  if (notifications.length === 0) {
    body.innerHTML = '<div class="notification-empty">No new notifications</div>';
    return;
  }

  body.innerHTML = notifications.map(n => {
    const isUnread = !readIds.has(n.id);
    const dateStr = n.timestamp ? new Date(n.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '';

    return `
      <div class="notification-item ${isUnread ? 'unread' : ''}" 
           onclick="window.notificationHandlers.handleNotificationClick('${n.id}', '${n.taskId}')">
        <div class="notification-item-title">
          <span>${n.icon}</span>
          <span style="color: ${n.color}">${escapeHtml(n.title)}</span>
        </div>
        <div style="font-size: 12px; line-height: 1.4; color: #475569; margin: 2px 0;">
          ${escapeHtml(n.message)}
        </div>
        <div class="notification-item-time">${dateStr}</div>
      </div>
    `;
  }).join('');
}

/**
 * Setup Event Listeners and toggle states
 */
export function initNotifications() {
  // Setup window handlers so the DOM buttons can access them
  window.notificationHandlers = {
    toggleNotificationMenu(event) {
      event.stopPropagation();
      const menu = document.getElementById('notificationMenu');
      if (menu) {
        menu.classList.toggle('show');
        // Hide profile menu and logs menu if open
        const profileMenu = document.getElementById('profileMenu');
        if (profileMenu) profileMenu.classList.remove('show');
        const logsMenu = document.getElementById('logsMenu');
        if (logsMenu) logsMenu.classList.remove('show');
      }
    },

    markAllAsRead(event) {
      if (event) event.stopPropagation();
      notifications.forEach(n => readIds.add(n.id));
      saveReadIds();
      renderNotifications();
      window.showToast("All notifications marked as read", "success");
    },

    handleNotificationClick(notificationId, taskId) {
      // Mark as read
      readIds.add(notificationId);
      saveReadIds();
      renderNotifications();

      // Close menu
      const menu = document.getElementById('notificationMenu');
      if (menu) menu.classList.remove('show');

      // Navigate to task board and open edit modal
      const tabTasks = document.getElementById('tabTasks');
      if (tabTasks) tabTasks.click();

      // Set client select in workspace so that the task will render on board
      const task = store.allTasks.find(t => t.id === taskId);
      if (task && task.client_id) {
        const clientSelect = document.getElementById('clientSelect');
        if (clientSelect) {
          clientSelect.value = task.client_id;
          clientSelect.dispatchEvent(new Event('change'));
        }
      }

      // Open modal after a tiny delay so view switcher executes
      setTimeout(() => {
        if (window.taskHandlers && typeof window.taskHandlers.openEditModal === 'function') {
          window.taskHandlers.openEditModal(taskId);
        }
      }, 100);
    }
  };

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown && !dropdown.contains(e.target)) {
      const menu = document.getElementById('notificationMenu');
      if (menu) menu.classList.remove('show');
    }
  });

  console.log("[Notifications] Module successfully initialized");
  startNotificationPolling();
}

export function startNotificationPolling() {
  console.log("[Notifications] Starting background tasks polling (5s)...");
  setInterval(async () => {
    try {
      const currentUser = store.currentUser;
      if (!currentUser) return;

      const { data, error } = await supabaseClient
        .from('tasks')
        .select('*, clients(id, company_name), profiles:assigned_to(id, full_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        // Simple dirty check: only re-compute if the row count or top task's updated time changed
        const currentLength = store.allTasks ? store.allTasks.length : 0;
        const newLength = data.length;
        
        let hasChanges = currentLength !== newLength;
        if (!hasChanges && store.allTasks && store.allTasks.length > 0) {
          hasChanges = data[0].updated_at !== store.allTasks[0].updated_at || data[0].id !== store.allTasks[0].id;
        }

        if (hasChanges) {
          console.log("[Notifications] Background tasks changed. Recomputing notifications...");
          store.allTasks = data;
          computeNotifications();
        }
      }
    } catch (err) {
      console.error("[Notifications] Background task poll failed:", err);
    }
  }, 5000);
}
