import { supabaseClient } from '../config/supabase.js';
import { store } from '../state/store_v2.js';
import { escapeHtml } from '../utils/appUtils.js';
import { computeNotifications } from './notifications_v2.js?v=session_isolation_v5';

/**
 * TASKS MODULE — KANBAN BOARD
 * Full CRUD with drag-and-drop status changes
 */

// ─── DATA ──────────────────────────────────────────────

export async function loadTasks() {
  try {
    console.log("[Tasks] Loading tasks from Supabase...");

    const { data, error } = await supabaseClient
      .from('tasks')
      .select('*, clients(id, company_name), profiles:assigned_to(id, full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("[Tasks] Fetch error details:", error);
      throw error;
    }

    store.allTasks = data || [];
    console.log("[Tasks] Successfully loaded:", store.allTasks.length, "tasks");
    renderKanban();
    if (typeof computeNotifications === 'function') {
      computeNotifications();
    }
  } catch (err) {
    console.error("[Tasks] Fetch failed:", err);
  }
}

// ─── CLIENT FILTER ─────────────────────────────────────

function populateClientFilter() {
  const select = document.getElementById('clientSelect');
  if (!select) return;

  const clients = store.allClients || [];
  const currentValue = select.value;

  select.innerHTML = '<option value="">Select a client</option>';
  clients.forEach(c => {
    const selected = c.id === currentValue ? 'selected' : '';
    select.innerHTML += `<option value="${c.id}" ${selected}>${escapeHtml(c.company_name)}</option>`;
  });
}

function getFilteredTasks() {
  const clientFilter = document.getElementById('clientSelect')?.value || '';
  let tasks = store.allTasks || [];

  if (clientFilter) {
    tasks = tasks.filter(t => t.client_id === clientFilter);
  } else {
    return []; // Return empty if no client selected
  }

  return tasks;
}

// ─── RENDER (STRICT BUILD) ──────────────────────────────

function createTaskCard(task, isPaused = false) {
  const card = document.createElement("div");
  card.className = "task-card";
  if (isPaused) card.classList.add("paused-task");

  card.setAttribute('data-id', task.id); // Essential for the store/drop logic

  // Maintain CRM functionality unless paused
  card.onclick = () => {
    if (isPaused) {
      window.showToast("This client is paused. Tasks are read-only.", "error");
      return;
    }
    window.taskHandlers.openEditModal(task.id);
  };
  card.draggable = !isPaused;
  if (!isPaused) {
    card.ondragstart = (e) => window.taskHandlers.onDragStart(e, task.id);
  }

  const header = document.createElement("div");
  header.className = "task-header";

  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title || "Untitled";

  const priority = document.createElement("span");
  const level = task.priority || "medium";
  priority.className = `priority ${level}`;
  priority.textContent = level.toUpperCase();

  header.appendChild(title);
  header.appendChild(priority);

  const date = document.createElement("div");
  date.className = "task-date";

  if (task.due_date) {
    const d = new Date(task.due_date);
    date.textContent = "📅 " + d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  card.appendChild(header);
  card.appendChild(date);

  return card;
}

export function renderKanban() {
  populateClientFilter();

  const clientSelect = document.getElementById("clientSelect");
  const emptyState = document.getElementById("emptyState");
  const kanban = document.getElementById("kanbanContainer");
  const newTaskBtn = document.getElementById("newTaskBtn");
  const workspaceTitle = document.getElementById("workspaceTitle");
  const tasksHeader = document.getElementById("tasksHeader");
  const headerContainer = document.getElementById("clientSelectHeaderContainer");
  const emptyContainer = document.getElementById("clientSelectEmptyContainer");

  if (!clientSelect) return;
  const value = clientSelect.value;

  if (!value) {
    if (emptyState) emptyState.style.display = "flex";
    if (kanban) kanban.style.display = "none";
    if (tasksHeader) tasksHeader.style.display = "none";
    if (emptyContainer && clientSelect.parentElement !== emptyContainer) {
      emptyContainer.appendChild(clientSelect);
    }
    return;
  } else {
    if (emptyState) emptyState.style.display = "none";
    if (kanban) kanban.style.display = "grid";
    if (tasksHeader) tasksHeader.style.display = "flex";
    if (headerContainer && clientSelect.parentElement !== headerContainer) {
      headerContainer.appendChild(clientSelect);
    }
    if (workspaceTitle) {
      workspaceTitle.style.display = "block";
      workspaceTitle.textContent = "Workspace: " + clientSelect.options[clientSelect.selectedIndex].text;
    }

    // Check if client is paused
    const clientData = store.allClients.find(c => c.id === value);
    const isPaused = clientData && clientData.status === 'paused';

    // Manage New Task button visibility and Paused Banner
    let existingBanner = document.getElementById("kanbanPausedBanner");
    if (existingBanner) existingBanner.remove();

    if (isPaused) {
      if (newTaskBtn) newTaskBtn.style.display = "none";
      const banner = document.createElement("div");
      banner.id = "kanbanPausedBanner";
      banner.className = "paused-banner";
      banner.innerHTML = "⏸ This client is paused. Tasks cannot be added or modified.";
      workspaceTitle.appendChild(banner);
    } else {
      if (newTaskBtn) newTaskBtn.style.display = "block";
    }
  }

  const tasks = getFilteredTasks();
  const todo = document.getElementById("todo");
  const progress = document.getElementById("inprogress");
  const completed = document.getElementById("completed");

  if (!todo || !progress || !completed) return;

  todo.innerHTML = "";
  progress.innerHTML = "";
  completed.innerHTML = "";

  const clientData = store.allClients.find(c => c.id === value);
  const isPaused = clientData && clientData.status === 'paused';

  tasks.forEach(task => {
    const card = createTaskCard(task, isPaused);
    if (task.status === "todo") {
      todo.appendChild(card);
    } else if (task.status === "in_progress") {
      progress.appendChild(card);
    } else {
      completed.appendChild(card);
    }
  });

  document.getElementById("todo-count").textContent = tasks.filter(t => t.status === "todo").length;
  document.getElementById("progress-count").textContent = tasks.filter(t => t.status === "in_progress").length;
  document.getElementById("completed-count").textContent = tasks.filter(t => t.status === "completed").length;
}

// ─── HANDLERS ──────────────────────────────────────────

window.taskHandlers = {
  draggedTaskId: null,

  // Alias for compatibility with calendar module
  edit(taskId) {
    this.openEditModal(taskId);
  },

  onDragStart(event, taskId) {
    window.taskHandlers.draggedTaskId = taskId;
    event.dataTransfer.effectAllowed = 'move';
    event.target.classList.add('dragging');
  },

  onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('drag-over');
  },

  onDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
  },

  async onDrop(event, newStatus) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    const taskId = window.taskHandlers.draggedTaskId;
    if (!taskId) return;

    const task = store.allTasks.find(t => t.id === taskId);
    if (!task) return;

    // Requirement: Prevent moving if client is paused
    const clientData = store.allClients.find(c => c.id === task.client_id);
    if (clientData && clientData.status === 'paused') {
      window.showToast("Cannot move tasks for a paused client.", "error");
      window.taskHandlers.draggedTaskId = null;
      return;
    }

    // Removed restriction preventing moving backdated tasks out of Completed

    try {
      const { error } = await supabaseClient
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;

      task.status = newStatus;
      renderKanban();
    } catch (err) {
      console.error("[Tasks] Drop failed:", err);
    }
    window.taskHandlers.draggedTaskId = null;
  },

  openNewTaskModal() {
    const clientSelect = document.getElementById('clientSelect');
    if (!clientSelect || !clientSelect.value) {
      alert("Please select a client before creating a task.");
      return;
    }

    const clientData = store.allClients.find(c => c.id === clientSelect.value);
    if (clientData && clientData.status === 'paused') {
      window.showToast("Cannot create tasks for a paused client.", "error");
      return;
    }

    const form = document.getElementById('taskForm');
    if (form) form.reset();

    const selectedClientId = clientSelect.value;
    const selectedClientName = clientSelect.options[clientSelect.selectedIndex].text;

    document.getElementById('taskId').value = '';
    document.getElementById('taskModalHeader').textContent = `Create Task for ${selectedClientName}`;
    document.getElementById('modalDeleteTask').style.display = 'none';

    // Populate dropdowns & Auto-select Client
    const modalClientSelect = document.getElementById('taskClient');
    const clientGroup = document.getElementById('taskModalClientGroup');
    if (modalClientSelect) {
      modalClientSelect.innerHTML = `<option value="${selectedClientId}" selected>${escapeHtml(selectedClientName)}</option>`;
      // Keep it visible but potentially disabled or just hidden
      if (clientGroup) clientGroup.style.display = 'none';
    }

    const assigneeSelect = document.getElementById('taskAssignedTo');
    if (assigneeSelect) {
      assigneeSelect.innerHTML = '<option value="">-- Unassigned --</option>';
      const rolePriority = { 'super_admin': 4, 'ceo': 3, 'manager': 2, 'associate': 1 };
      const userPriority = rolePriority[store.currentUser?.role] || 1;

      (store.allOrgUsers || []).forEach(u => {
        const targetPriority = rolePriority[u.role] || 1;
        // Managers (2) can only assign to Employees (1)
        // CEO (3) can assign to Managers (2) and Employees (1)
        if (userPriority > targetPriority) {
          assigneeSelect.innerHTML += `<option value="${u.id}">${escapeHtml(u.full_name)}</option>`;
        }
      });
    }

    const dateInput = document.getElementById('taskDueDate');
    if (dateInput) {
      const todayStr = new Date().toISOString().split('T')[0];
      dateInput.value = todayStr;
    }

    const sublist = document.getElementById('subtasksList');
    if (sublist) sublist.innerHTML = '';

    window.openModal('taskModal');
  },

  async openEditModal(taskId) {
    const task = store.allTasks.find(t => t.id === taskId);
    if (!task) return;

    const clientData = store.allClients.find(c => c.id === task.client_id);
    if (clientData && clientData.status === 'paused') {
      window.showToast("This client is paused. Tasks are read-only.", "error");
      return;
    }

    document.getElementById('taskId').value = task.id;
    document.getElementById('taskModalHeader').textContent = 'Edit Task';
    document.getElementById('modalDeleteTask').style.display = 'block';

    document.getElementById('taskTitle').value = task.title || '';
    document.getElementById('taskDesc').value = task.description || '';
    document.getElementById('taskStatus').value = task.status || 'todo';
    document.getElementById('taskDueDate').value = task.due_date || '';
    document.getElementById('taskPriority').value = task.priority || 'medium';
    if (document.getElementById('taskType')) {
      document.getElementById('taskType').value = task.task_type || '';
    }

    // Populate dropdowns
    const modalClientSelect = document.getElementById('taskClient');
    const clientGroup = document.getElementById('taskModalClientGroup');
    if (modalClientSelect) {
      modalClientSelect.innerHTML = '<option value="">-- Select Client --</option>';
      (store.allClients || []).forEach(c => {
        const selected = c.id === task.client_id ? 'selected' : '';
        const isPaused = c.status === 'paused';
        const disabledAttr = (isPaused && !selected) ? 'disabled' : '';
        const pauseTag = isPaused ? ' (Paused)' : '';
        modalClientSelect.innerHTML += `<option value="${c.id}" ${selected} ${disabledAttr}>${escapeHtml(c.company_name)}${pauseTag}</option>`;
      });
      // Show client selector in edit mode if it was hidden
      if (clientGroup) clientGroup.style.display = 'block';
    }

    const assigneeSelect = document.getElementById('taskAssignedTo');
    if (assigneeSelect) {
      assigneeSelect.innerHTML = '<option value="">-- Unassigned --</option>';
      const rolePriority = { 'super_admin': 4, 'ceo': 3, 'manager': 2, 'associate': 1 };
      const userPriority = rolePriority[store.currentUser?.role] || 1;

      (store.allOrgUsers || []).forEach(u => {
        const targetPriority = rolePriority[u.role] || 1;

        // Show if higher priority OR if they are already assigned (to avoid breaking existing data)
        if (userPriority > targetPriority || u.id === task.assigned_to) {
          const selected = u.id === task.assigned_to ? 'selected' : '';
          assigneeSelect.innerHTML += `<option value="${u.id}" ${selected}>${escapeHtml(u.full_name)}</option>`;
        }
      });
    }

    await loadSubtasks(task.id);

    // Removed min-date restriction for edit mode

    window.openModal('taskModal');
  },

  async saveTask(event) {
    event.preventDefault();
    const taskId = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDesc').value.trim();
    const status = document.getElementById('taskStatus').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const clientId = document.getElementById('taskClient').value || null;
    const assignedTo = document.getElementById('taskAssignedTo').value || null;
    const priority = document.getElementById('taskPriority').value || 'medium';
    const taskType = document.getElementById('taskType')?.value || null;

    if (!title) return alert('Task title is required.');
    if (!dueDate) return alert('Due date is required.');

    if (clientId) {
      const clientData = store.allClients.find(c => c.id === clientId);
      if (clientData && clientData.status === 'paused') {
        window.showToast("Cannot save tasks for a paused client.", "error");
        return;
      }
    }

    // Requirement: Enforce hierarchical assignment
    if (assignedTo) {
      const rolePriority = { 'super_admin': 4, 'ceo': 3, 'manager': 2, 'associate': 1 };
      const userPriority = rolePriority[store.currentUser?.role] || 1;
      const targetUser = store.allOrgUsers.find(u => u.id === assignedTo);
      const targetPriority = rolePriority[targetUser?.role] || 1;

      if (userPriority <= targetPriority) {
        return alert(`Hierarchy Violation: As a ${store.currentUser?.role}, you can only assign tasks to roles lower than yours.`);
      }
    }

    // Removed past dates restriction as requested by user

    const payload = {
      title,
      description,
      status,
      priority,
      task_type: taskType,
      due_date: dueDate,
      client_id: clientId,
      assigned_to: assignedTo,
      updated_at: new Date().toISOString()
    };

    const performSave = async () => {
      try {
        if (taskId) {
          const { error } = await supabaseClient.from('tasks').update(payload).eq('id', taskId);
          if (error) throw error;
        } else {
          payload.organization_id = store.currentOrganizationId || null;
          payload.created_by = store.currentUserId || null;
          const { data, error } = await supabaseClient.from('tasks').insert(payload).select().single();
          if (error) throw error;

          // Save pending subtasks
          const pending = Array.from(document.querySelectorAll('.subtask-item[data-pending="true"]'));
          for (const item of pending) {
            const stTitle = item.querySelector('span').textContent;
            await supabaseClient.from('subtasks').insert({ task_id: data.id, title: stTitle });
          }
        }
        window.closeModal('taskModal');
        await loadTasks();
        window.showToast("Task saved successfully", "success");
      } catch (err) {
        console.error("[Tasks] Save failed:", err);
        alert('Save failed: ' + err.message);
      }
    };

    if (taskId) {
      window.confirmAction({
        title: "Update Task",
        message: "Are you sure you want to save the changes to this task?",
        confirmText: "Save Changes"
      }, performSave);
    } else {
      performSave();
    }
  },

  async deleteTask() {
    const taskId = document.getElementById('taskId').value;
    if (!taskId) return;

    const task = store.allTasks.find(t => t.id === taskId);
    if (task) {
      const clientData = store.allClients.find(c => c.id === task.client_id);
      if (clientData && clientData.status === 'paused') {
        window.showToast("Cannot delete tasks for a paused client.", "error");
        return;
      }
    }

    window.confirmAction({
      title: "Delete Task",
      message: "Are you sure you want to permanently delete this task?",
      confirmText: "Delete",
      isDelete: true
    }, async () => {
      try {
        const { error } = await supabaseClient.from('tasks').delete().eq('id', taskId);
        if (error) throw error;
        window.closeModal('taskModal');
        await loadTasks();
        if (window.showCalendarPage) await window.showCalendarPage();
        window.showToast("Task deleted successfully", "success");
      } catch (err) {
        console.error("[Tasks] Delete failed:", err);
        window.showToast("Delete failed: " + err.message, "error");
      }
    });
  },

  async addSubtask() {
    const taskId = document.getElementById('taskId').value;
    const input = document.getElementById('newSubtaskTitle');
    const title = input?.value.trim();
    if (!title) return;

    if (!taskId) {
      const list = document.getElementById('subtasksList');
      list.innerHTML += `
        <div class="subtask-item" data-pending="true">
          <label style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" disabled>
            <span style="font-size: 13px;">${escapeHtml(title)}</span>
          </label>
        </div>`;
      input.value = '';
      return;
    }

    try {
      await supabaseClient.from('subtasks').insert({ task_id: taskId, title });
      input.value = '';
      await loadSubtasks(taskId);
    } catch (err) {
      console.error("[Subtasks] Add failed:", err);
    }
  },

  async toggleSubtask(id, done) {
    try {
      await supabaseClient.from('subtasks').update({ is_completed: done }).eq('id', id);
      const taskId = document.getElementById('taskId').value;
      if (taskId) await loadSubtasks(taskId);
    } catch (err) {
      console.error("[Subtasks] Toggle failed:", err);
    }
  },

  async deleteSubtask(id) {
    window.confirmAction({
      title: "Delete Subtask",
      message: "Are you sure you want to delete this subtask?",
      confirmText: "Delete",
      isDelete: true
    }, async () => {
      try {
        await supabaseClient.from('subtasks').delete().eq('id', id);
        const taskId = document.getElementById('taskId').value;
        if (taskId) await loadSubtasks(taskId);
        window.showToast("Subtask deleted", "info");
      } catch (err) {
        console.error("[Subtasks] Delete failed:", err);
      }
    });
  }
};

async function loadSubtasks(taskId) {
  const list = document.getElementById('subtasksList');
  if (!list) return;
  try {
    const { data } = await supabaseClient.from('subtasks').select('*').eq('task_id', taskId).order('created_at');
    list.innerHTML = (data || []).map(st => `
      <div class="subtask-item ${st.is_completed ? 'done' : ''}">
        <label style="display: flex; align-items: center; gap: 8px; flex: 1; cursor: pointer;">
          <input type="checkbox" ${st.is_completed ? 'checked' : ''} onchange="window.taskHandlers.toggleSubtask('${st.id}', this.checked)">
          <span style="font-size: 13px; ${st.is_completed ? 'text-decoration: line-through; color: #94a3b8;' : ''}">${escapeHtml(st.title)}</span>
        </label>
        <button class="subtask-delete" onclick="event.stopPropagation(); window.taskHandlers.deleteSubtask('${st.id}')">&times;</button>
      </div>`).join('');
  } catch (err) {
    console.error("[Subtasks] Load failed:", err);
  }
}

export function initTasksView() {
  const form = document.getElementById('taskForm');
  if (form && !form.dataset.listener) {
    form.addEventListener('submit', window.taskHandlers.saveTask);
    form.dataset.listener = 'true';
  }

  const deleteBtn = document.getElementById('modalDeleteTask');
  if (deleteBtn && !deleteBtn.dataset.listener) {
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.taskHandlers.deleteTask();
    });
    deleteBtn.dataset.listener = 'true';
  }

  const addSubBtn = document.getElementById('btnAddSubtask');
  if (addSubBtn && !addSubBtn.dataset.listener) {
    addSubBtn.addEventListener('click', window.taskHandlers.addSubtask);
    addSubBtn.dataset.listener = 'true';
  }

  const clientSelect = document.getElementById('clientSelect');
  if (clientSelect && !clientSelect.dataset.listener) {
    clientSelect.addEventListener('change', function () {
      renderKanban();
    });
    clientSelect.dataset.listener = 'true';
  }

  const newTaskBtn = document.getElementById('newTaskBtn');
  if (newTaskBtn && !newTaskBtn.dataset.listener) {
    newTaskBtn.addEventListener('click', window.taskHandlers.openNewTaskModal);
    newTaskBtn.dataset.listener = 'true';
  }
}

window.loadTasks = loadTasks;
window.initTasksView = initTasksView;
