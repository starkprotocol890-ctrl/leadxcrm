import { supabaseClient } from '../config/supabase.js';
import { store } from '../state/store_v2.js';
import { escapeHtml, formatMonthYear, formatDateDDMMYYYY } from '../utils/appUtils.js';

/**
 * CALENDAR MODULE — VIEW FIRST, THEN CREATE FLOW (FIXED MODAL CONFLICT)
 */

let currentCycle = null;
let calendarBaseDate = new Date();

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function showCalendarPage() {
  try {
    console.log("[Calendar] Synchronizing data...");
    
    if (!store.allClients || store.allClients.length === 0) {
      const { data: clients } = await supabaseClient
        .from('clients')
        .select('*');
      store.allClients = clients || [];
    }

    // Synchronize tasks from DB
    const { data: tasks, error: taskErr } = await supabaseClient
      .from('tasks')
      .select('*, clients(id, company_name)');
    
    if (taskErr) throw taskErr;
    store.allTasks = tasks || [];
    console.log("[Calendar] Tasks synced to store:", store.allTasks.length);
    
    populateClientFilter();
    populateAssigneeFilter();
    initCalendarListeners();
    
    onClientChange(document.getElementById("clientFilter")?.value || "all");
  } catch (err) {
    console.error("[Calendar] Sync failed:", err);
  }
}

function populateClientFilter() {
  const filter = document.getElementById("clientFilter");
  if (!filter) return;
  const currentVal = filter.value;
  filter.innerHTML = '<option value="all">All Clients Overview</option>';
  store.allClients.forEach(client => {
    const opt = document.createElement("option");
    opt.value = client.id;
    opt.textContent = client.company_name;
    filter.appendChild(opt);
  });
  filter.value = currentVal || "all";
}

function populateAssigneeFilter() {
  const filter = document.getElementById("assigneeFilter");
  if (!filter) return;
  const currentVal = filter.value;
  filter.innerHTML = '<option value="all">All Team Members</option>';
  
  if (store.allOrgUsers) {
    store.allOrgUsers.forEach(emp => {
      const opt = document.createElement("option");
      opt.value = emp.id;
      opt.textContent = emp.full_name;
      filter.appendChild(opt);
    });
  }
  filter.value = currentVal || "all";
}

function onClientChange(clientId) {
  console.log("[Calendar] Client filter changed:", clientId);
  store.filters.calendar.client = clientId;
  
  if (clientId !== "all") {
    currentCycle = getCurrentCycle(clientId);
  } else {
    currentCycle = null;
  }

  rebuildCalendar();
}

function getCurrentCycle(clientId) {
  const client = store.allClients.find(c => c.id === clientId);
  if (!client || !client.cycle_start_date || !client.cycle_end_date) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  const start = new Date(client.cycle_start_date);
  const end = new Date(client.cycle_end_date);
  if (today >= start && today <= end) {
    return { start_date: client.cycle_start_date, end_date: client.cycle_end_date };
  }
  return null;
}

function rebuildCalendar() {
  const grid = document.getElementById("calendarGrid");
  if (!grid) return;
  
  // Requirement 3: Clear existing cells
  grid.innerHTML = "";

  const selectedClientId = store.filters.calendar.client || "all";
  const assigneeId = document.getElementById("assigneeFilter")?.value || "all";
  const showTasks = document.getElementById("toggleTasks")?.checked !== false;
  const showDeadlines = document.getElementById("toggleDeadlines")?.checked !== false;

  console.log("[Calendar] Rebuilding with filters:", { selectedClientId, assigneeId, showTasks, showDeadlines });

  // Requirement 1 & 4: Single Source of Truth + Centralized Filtering
  const displayTasks = (store.allTasks || []).filter(task => {
    // 1. Client Filter
    if (selectedClientId !== "all" && task.client_id !== selectedClientId) return false;
    
    // 2. Assignee Filter
    if (assigneeId !== "all" && task.assigned_to !== assigneeId) return false;

    // 3. Status/Deadline Filters
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
    if (isOverdue && !showDeadlines) return false;
    if (!isOverdue && !showTasks) return false;

    return true;
  });

  console.log("[Calendar] Filtered Tasks count:", displayTasks.length);
  
  const eventMap = mapTasksToDates(displayTasks);
  updateHeader();

  if (selectedClientId === "all") {
    renderMonthCalendar(eventMap);
  } else {
    renderServiceCycleCalendar(selectedClientId, eventMap, true);
  }
}

function mapTasksToDates(tasks) {
  const map = {};
  tasks.forEach(task => {
    if (!task.due_date) return;
    const d = new Date(task.due_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map[key]) map[key] = [];
    map[key].push(task);
  });
  return map;
}

function renderServiceCycleCalendar(clientId, eventMap) {
  const container = document.getElementById("calendarGrid");
  const client = store.allClients.find(c => c.id === clientId);
  if (!client) return;

  const startStr = client.cycle_start_date;
  const endStr = client.cycle_end_date;

  if (!startStr || !endStr) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; width: 100%; color: #64748b;">Please set cycle start and end dates in Client Profile to view the cycle calendar.</div>';
    return;
  }

  const start = new Date(startStr);
  const end = new Date(endStr);
  const firstDayOffset = start.getDay();
  for (let i = 0; i < firstDayOffset; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day-cell empty";
    container.appendChild(emptyCell);
  }

  let current = new Date(start);
  while (current <= end) {
    const d = new Date(current);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const tasksForDay = eventMap[dateKey] || [];

    const cell = document.createElement("div");
    cell.className = "calendar-day-cell";
    cell.style.cursor = "pointer";
    cell.onclick = () => openDayDetailsModal(dateKey, clientId);

    const dateLabel = document.createElement("span");
    dateLabel.className = "calendar-day-num";
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const isPast = d < today;

    dateLabel.innerHTML = `<span>${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}</span>${!isPast ? '<span class="add-task-hint">+</span>' : ''}`;
    cell.appendChild(dateLabel);

    const taskList = document.createElement("div");
    taskList.className = "calendar-task-list";
    
    const now = new Date();
    now.setHours(0,0,0,0);

    // Show max 3 tasks
    const displayedTasks = tasksForDay.slice(0, 3);
    const remainingCount = tasksForDay.length - 3;

    displayedTasks.forEach(task => {
      const pill = document.createElement("div");
      pill.className = `task-pill priority-${task.priority || 'medium'}`;
      if (task.status === 'completed') pill.classList.add('task-completed');
      
      const clientData = store.allClients.find(c => c.id === task.client_id);
      if (clientData && clientData.status === 'paused') {
        pill.classList.add('paused-task');
      }
      
      const dueDate = new Date(task.due_date);
      if (dueDate < now && task.status !== 'completed') {
        pill.classList.add('task-overdue');
      }

      pill.innerText = task.title;
      pill.title = task.title;
      taskList.appendChild(pill);
    });

    if (remainingCount > 0) {
      const more = document.createElement("div");
      more.className = "more-indicator";
      more.style = "font-size: 10px; font-weight: 700; color: #64748b; margin-top: 2px; padding-left: 4px;";
      more.innerText = `+${remainingCount} more`;
      taskList.appendChild(more);
    }

    cell.appendChild(taskList);
    container.appendChild(cell);
    current.setDate(current.getDate() + 1);
  }
}

function renderMonthCalendar(eventMap) {
  const grid = document.getElementById("calendarGrid");
  const year = calendarBaseDate.getFullYear();
  const month = calendarBaseDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  // Clear previous grid
  grid.innerHTML = "";

  // Add weekday headers (JS generated to keep grid alignment)
  WEEKDAYS.forEach(day => {
    const header = document.createElement("div");
    header.className = "calendar-day-header";
    header.innerText = day;
    grid.appendChild(header);
  });

  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day-cell other-month";
    grid.appendChild(emptyCell);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  now.setHours(0,0,0,0);

  for (let day = 1; day <= totalDays; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateKey === todayStr;
    const dayTasks = eventMap[dateKey] || [];
    
    const cell = document.createElement("div");
    cell.className = `calendar-day-cell ${isToday ? 'today' : ''}`;
    cell.onclick = () => openDayDetailsModal(dateKey, "all");

    const dateLabel = document.createElement("div");
    dateLabel.className = "calendar-day-num";
    
    // Check if date is in past to hide add-hint
    const dObj = new Date(dateKey);
    dObj.setHours(0,0,0,0);
    const isPast = dObj < now;
    
    dateLabel.innerHTML = `<span>${day}</span>${!isPast ? '<span class="add-task-hint">+</span>' : ''}`;
    cell.appendChild(dateLabel);

    const taskList = document.createElement("div");
    taskList.className = "calendar-task-list";
    
    // Show max 3 tasks
    const displayedTasks = dayTasks.slice(0, 3);
    const remainingCount = dayTasks.length - 3;

    displayedTasks.forEach(task => {
      const pill = document.createElement("div");
      pill.className = `task-pill priority-${task.priority || 'medium'}`;
      if (task.status === 'completed') pill.classList.add('task-completed');
      
      const clientData = store.allClients.find(c => c.id === task.client_id);
      if (clientData && clientData.status === 'paused') {
        pill.classList.add('paused-task');
      }
      
      const dueDate = new Date(task.due_date);
      if (dueDate < now && task.status !== 'completed') {
        pill.classList.add('task-overdue');
      }

      pill.innerText = task.title;
      pill.title = task.title; // Tooltip
      taskList.appendChild(pill);
    });

    if (remainingCount > 0) {
      const more = document.createElement("div");
      more.className = "more-indicator";
      more.style = "font-size: 10px; font-weight: 700; color: #64748b; margin-top: 2px; padding-left: 4px;";
      more.innerText = `+${remainingCount} more`;
      taskList.appendChild(more);
    }

    // Add Client Cycle marker if applicable
    const selectedClientId = store.filters.calendar.client || "all";
    if (currentCycle && selectedClientId !== "all") {
      const d = new Date(dateKey);
      const start = new Date(currentCycle.start_date);
      const end = new Date(currentCycle.end_date);
      if (d >= start && d <= end) {
        const cyclePill = document.createElement("div");
        cyclePill.className = "task-pill event-cycle";
        cyclePill.innerText = "Active Cycle";
        taskList.appendChild(cyclePill);
      }
    }

    cell.appendChild(taskList);
    grid.appendChild(cell);
  }
}

/**
 * STEP 2 & 3: DAY DETAILS MODAL (VIEW FIRST)
 */
function openDayDetailsModal(dateKey, contextClientId) {
  const modal = document.getElementById("calendarDayModal");
  const list = document.getElementById("taskList");
  const subtitle = document.getElementById("calendarModalSubtitle");
  const createForm = document.getElementById("taskCreateForm");
  
  if (!modal || !list) {
    console.error("[Calendar] Modal or task list container not found!");
    return;
  }

  // Reset UI state
  window.openModal('calendarDayModal');
  createForm.style.display = "none";
  list.innerHTML = "";
  
  // Format Date for Header
  const dateObj = new Date(dateKey);
  subtitle.innerText = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // 1. Restriction: Check if context client is paused
  let isContextPaused = false;
  if (contextClientId !== "all") {
      const client = store.allClients.find(c => c.id === contextClientId);
      if (client && client.status === 'paused') isContextPaused = true;
  }

  const btnShowCreate = document.getElementById("btnShowCreateForm");
  if (btnShowCreate) {
    btnShowCreate.style.display = isContextPaused ? "none" : "block";
  }

  // 2. Filter Tasks (Fixed reference: using store.allTasks)
  const dayTasks = (store.allTasks || []).filter(t => {
    const d = new Date(t.due_date);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (contextClientId === "all") return k === dateKey;
    return k === dateKey && t.client_id === contextClientId;
  });

  if (dayTasks.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
        <div style="font-size: 24px; margin-bottom: 8px;">📅</div>
        <div style="font-size: 13px;">No tasks scheduled for this day.</div>
      </div>
    `;
  } else {
    if (contextClientId === "all") {
      const grouped = {};
      dayTasks.forEach(t => {
        const cid = t.client_id || 'unassigned';
        if (!grouped[cid]) grouped[cid] = [];
        grouped[cid].push(t);
      });

      Object.keys(grouped).forEach(cid => {
        const tasks = grouped[cid];
        const client = store.allClients.find(c => c.id === cid);
        const clientName = client?.company_name || tasks[0]?.clients?.company_name || "Unknown Client";

        const header = document.createElement("div");
        header.style = "font-size: 11px; font-weight: 800; color: #475569; margin-top: 12px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;";
        header.innerHTML = `<span style="width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;"></span> ${clientName}`;
        list.appendChild(header);

        tasks.forEach(t => list.appendChild(createTaskItem(t)));
      });
    } else {
      dayTasks.forEach(t => list.appendChild(createTaskItem(t)));
    }
  }

  modal.dataset.date = dateKey;
  modal.dataset.client = contextClientId;
}

function createTaskItem(task) {
  const item = document.createElement("div");
  const clientData = store.allClients.find(c => c.id === task.client_id);
  const isPaused = clientData && clientData.status === 'paused';
  
  item.className = "sidebar-card" + (isPaused ? " paused-task" : "");
  item.style.cursor = isPaused ? "not-allowed" : "pointer";
  item.style.marginBottom = "12px";
  item.style.padding = "16px";
  item.style.transition = "transform 0.2s, box-shadow 0.2s";
  
  if (!isPaused) {
      item.onmouseenter = () => {
        item.style.transform = "translateY(-2px)";
        item.style.boxShadow = "var(--shadow-md)";
      };
      item.onmouseleave = () => {
        item.style.transform = "none";
        item.style.boxShadow = "var(--shadow-sm)";
      };
  }

  item.onclick = () => {
    if (isPaused) {
        window.showToast("This client is paused. Tasks are read-only.", "error");
        return;
    }
    if (window.taskHandlers?.edit) {
      window.taskHandlers.edit(task.id);
    }
  };

  const assignee = store.allOrgUsers?.find(e => e.id === task.assigned_to);
  const initials = assignee ? assignee.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';

  item.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
      <span style="font-weight: 700; color: #0f172a; font-size: 14px; line-height: 1.4;">${escapeHtml(task.title)}</span>
      <span class="status-badge priority-${task.priority || 'medium'}" style="font-size: 9px;">${task.priority || 'medium'}</span>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 24px; height: 24px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #64748b;" title="${assignee?.full_name || 'Unassigned'}">
          ${initials}
        </div>
        <span style="font-size: 12px; color: #64748b;">${assignee?.full_name || 'Unassigned'}</span>
      </div>
      <span class="status-badge status-${task.status || 'todo'}" style="font-size: 10px; border-radius: 4px;">${task.status || 'todo'}</span>
    </div>
  `;
  return item;
}

window.calendarHandlers = {
  showCreateForm: () => {
    const form = document.getElementById("taskCreateForm");
    const modal = document.getElementById("calendarDayModal");
    const clientGroup = document.getElementById("modalClientSelectorGroup");
    const clientSelect = document.getElementById("modalClientSelect");
    
    form.style.display = "block";
    form.scrollIntoView({ behavior: 'smooth' });

    if (modal.dataset.client === "all") {
      clientGroup.style.display = "block";
      populateModalClientSelect(clientSelect);
    } else {
      clientGroup.style.display = "none";
    }
  },
  hideCreateForm: () => {
    document.getElementById("taskCreateForm").style.display = "none";
  }
};

function populateModalClientSelect(select) {
  select.innerHTML = "";
  store.allClients.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    const isPaused = c.status === 'paused';
    if (isPaused) {
      opt.disabled = true;
      opt.textContent = `${c.company_name} (Paused)`;
    } else {
      opt.textContent = c.company_name;
    }
    select.appendChild(opt);
  });
}

async function saveTaskFromModal() {
  const modal = document.getElementById("calendarDayModal");
  const input = document.getElementById("taskInput");
  const clientSelect = document.getElementById("modalClientSelect");
  const date = modal.dataset.date;
  const contextClientId = modal.dataset.client;
  const title = input.value.trim();

  if (!title) return;

  // Allowed saving backdated tasks from calendar

  try {
    let finalClientId = contextClientId;
    if (contextClientId === "all") {
      finalClientId = clientSelect.value;
    }

    const clientData = store.allClients.find(c => c.id === finalClientId);
    if (clientData && clientData.status === 'paused') {
        window.showToast("Cannot create tasks for a paused client.", "error");
        return;
    }

    const { data, error } = await supabaseClient
      .from('tasks')
      .insert([{
        title,
        due_date: date,
        client_id: finalClientId,
        organization_id: store.currentOrganizationId,
        status: 'todo',
        priority: 'medium'
      }])
      .select();

    if (error) throw error;
    
    // Refresh data
    const { data: updatedTasks } = await supabaseClient
      .from('tasks')
      .select('*, clients(id, company_name)');
    store.allTasks = updatedTasks || [];
    
    rebuildCalendar();
    window.calendarHandlers.hideCreateForm();
    input.value = "";
    
    // Refresh modal list without re-opening/flickering
    openDayDetailsModal(date, contextClientId);
    
    window.showToast("Task created successfully", "success");
    
  } catch (err) {
    console.error("[Calendar] Save error:", err);
  }
}

function updateHeader() {
  const header = document.getElementById("calendarHeaderText");
  if (!header) return;

  const selectedClientId = store.filters.calendar.client || "all";
  if (selectedClientId === "all") {
    header.innerText = formatMonthYear(calendarBaseDate);
  } else {
    const client = store.allClients.find(c => c.id === selectedClientId);
    if (client && client.cycle_start_date && client.cycle_end_date) {
      header.innerText = `${client.company_name} — ${formatDateDDMMYYYY(client.cycle_start_date)} to ${formatDateDDMMYYYY(client.cycle_end_date)}`;
    } else if (client) {
      header.innerText = `${client.company_name}`;
    }
  }
}

function initCalendarListeners() {
  const toggles = ["toggleTasks", "toggleDeadlines", "toggleMyTasks", "toggleTeamTasks"];
  toggles.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.listener) {
      el.onchange = () => rebuildCalendar();
      el.dataset.listener = "true";
    }
  });

  const filter = document.getElementById("clientFilter");
  if (filter && !filter.dataset.listener) {
    filter.addEventListener("change", (e) => onClientChange(e.target.value));
    filter.dataset.listener = "true";
  }

  const assigneeFilter = document.getElementById("assigneeFilter");
  if (assigneeFilter && !assigneeFilter.dataset.listener) {
    assigneeFilter.addEventListener("change", () => rebuildCalendar());
    assigneeFilter.dataset.listener = "true";
  }

  const prevBtn = document.getElementById("btnPrevMonth");
  const nextBtn = document.getElementById("btnNextMonth");
  if (prevBtn && !prevBtn.dataset.listener) {
    prevBtn.onclick = () => {
      calendarBaseDate.setMonth(calendarBaseDate.getMonth() - 1);
      rebuildCalendar();
    };
    prevBtn.dataset.listener = "true";
  }
  if (nextBtn && !nextBtn.dataset.listener) {
    nextBtn.onclick = () => {
      calendarBaseDate.setMonth(calendarBaseDate.getMonth() + 1);
      rebuildCalendar();
    };
    nextBtn.dataset.listener = "true";
  }

  const todayBtn = document.getElementById("btnToday");
  if (todayBtn && !todayBtn.dataset.listener) {
    todayBtn.onclick = () => {
      calendarBaseDate = new Date();
      rebuildCalendar();
    };
    todayBtn.dataset.listener = "true";
  }

  const viewMonthBtn = document.getElementById("viewMonth");
  const viewWeekBtn = document.getElementById("viewWeek");
  if (viewMonthBtn && !viewMonthBtn.dataset.listener) {
    viewMonthBtn.onclick = () => {
      viewMonthBtn.classList.add("active");
      viewWeekBtn.classList.remove("active");
      rebuildCalendar();
    };
    viewMonthBtn.dataset.listener = "true";
  }
  if (viewWeekBtn && !viewWeekBtn.dataset.listener) {
    viewWeekBtn.onclick = () => {
      viewWeekBtn.classList.add("active");
      viewMonthBtn.classList.remove("active");
      window.showToast("Week view coming soon!", "info");
    };
    viewWeekBtn.dataset.listener = "true";
  }
  const saveTaskBtn = document.getElementById("btnSaveTask");
  if (saveTaskBtn && !saveTaskBtn.dataset.listener) {
    saveTaskBtn.onclick = saveTaskFromModal;
    saveTaskBtn.dataset.listener = "true";
  }
}

window.showCalendarPage = showCalendarPage;
