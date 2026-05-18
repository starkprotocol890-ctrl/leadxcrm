import { supabaseClient } from '../config/supabase.js';
import { store } from '../state/store_v2.js';
import { escapeHtml } from '../utils/appUtils.js';

let activeEmployeeId = null;

export async function initPlanner() {
    const dateInput = document.getElementById('plannerDateInput');
    const monthSelect = document.getElementById('plannerMonthSelect');
    const deptFilter = document.getElementById('plannerDepartmentFilter');
    const viewModeSelect = document.getElementById('plannerViewMode');

    if (!dateInput) {
        console.warn("[Planner] dateInput not found");
        return;
    }

    if (!dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    if (monthSelect) {
        monthSelect.value = new Date().getMonth();
    }

    const initialMode = viewModeSelect?.value || 'monthly';
    const label = document.getElementById('plannerDateLabel');
    if (label) {
        if (initialMode === 'daily') label.innerText = "Date";
        else if (initialMode === 'weekly') label.innerText = "Week of";
        else label.innerText = "Month";
    }
    if (initialMode === 'monthly') {
        if (dateInput) dateInput.style.display = 'none';
        if (monthSelect) monthSelect.style.display = 'block';
    } else {
        if (dateInput) dateInput.style.display = 'block';
        if (monthSelect) monthSelect.style.display = 'none';
    }

    updateDateLabel();
    populateDepartments();

    // Attach listeners
    if (!dateInput.dataset.listener) {
        dateInput.addEventListener('change', () => {
            updateDateLabel();
            renderEmployeeList();
            if (activeEmployeeId) renderTaskDetails(activeEmployeeId);
        });
        dateInput.dataset.listener = "true";
    }

    if (monthSelect && !monthSelect.dataset.listener) {
        monthSelect.addEventListener('change', () => {
            updateDateLabel();
            renderEmployeeList();
            if (activeEmployeeId) renderTaskDetails(activeEmployeeId);
        });
        monthSelect.dataset.listener = "true";
    }

    if (!deptFilter.dataset.listener) {
        deptFilter.addEventListener('change', () => {
            renderEmployeeList();
        });
        deptFilter.dataset.listener = "true";
    }

    if (viewModeSelect && !viewModeSelect.dataset.listener) {
        viewModeSelect.addEventListener('change', () => {
            const label = document.getElementById('plannerDateLabel');
            const mode = viewModeSelect.value;

            if (label) {
                if (mode === 'daily') label.innerText = "Date";
                else if (mode === 'weekly') label.innerText = "Week of";
                else label.innerText = "Month";
            }

            if (mode === 'monthly') {
                dateInput.style.display = 'none';
                monthSelect.style.display = 'block';
            } else {
                dateInput.style.display = 'block';
                monthSelect.style.display = 'none';
            }

            updateDateLabel();
            renderEmployeeList();
            if (activeEmployeeId) renderTaskDetails(activeEmployeeId);
        });
        viewModeSelect.dataset.listener = "true";
    }

    renderEmployeeList();
}

/**
 * HELPER: Get Date Range for current View Mode
 */
function getSelectedRange() {
    const dateInput = document.getElementById('plannerDateInput');
    const monthSelect = document.getElementById('plannerMonthSelect');
    const viewMode = document.getElementById('plannerViewMode')?.value || 'monthly';
    if (!dateInput || !dateInput.value) return null;

    const baseDate = new Date(dateInput.value);
    const start = new Date(baseDate);
    const end = new Date(baseDate);

    if (viewMode === 'daily') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'weekly') {
        // Monday as start of week
        const day = baseDate.getDay(); // 0 is Sun, 1 is Mon
        const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);

        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'monthly' && monthSelect) {
        const selectedMonth = parseInt(monthSelect.value);
        const year = baseDate.getFullYear();
        start.setFullYear(year, selectedMonth, 1);
        start.setHours(0, 0, 0, 0);

        end.setFullYear(year, selectedMonth + 1, 0);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end };
}

function updateDateLabel() {
    const range = getSelectedRange();
    const label = document.getElementById('currentPlannerDateLabel');
    const viewMode = document.getElementById('plannerViewMode')?.value || 'monthly';

    if (label && range) {
        if (viewMode === 'daily') {
            label.innerText = range.start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        } else if (viewMode === 'weekly') {
            const startStr = range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = range.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            label.innerText = `${startStr} — ${endStr}`;
        } else if (viewMode === 'monthly') {
            label.innerText = range.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
    }
}

function populateDepartments() {
    const select = document.getElementById('plannerDepartmentFilter');
    if (!select) return;

    const departments = [
        "HR Department",
        "Social Media Department",
        "Content Department",
        "Designer Department",
        "SEO Department",
        "Performance Marketing Department",
        "Production Department",
        "Sales Department"
    ];

    const currentVal = select.value;
    select.innerHTML = '<option value="all">All Departments</option>';
    departments.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept;
        opt.textContent = dept;
        select.appendChild(opt);
    });
    select.value = currentVal || "all";
}

export function renderEmployeeList() {
    const list = document.getElementById('plannerEmployeeList');
    const countLabel = document.getElementById('plannerEmployeeCount');
    const deptFilterEl = document.getElementById('plannerDepartmentFilter');
    const dateInputEl = document.getElementById('plannerDateInput');
    const sortByEl = document.getElementById('plannerSortBy');

    if (!list || !deptFilterEl || !dateInputEl) return;

    const deptFilter = deptFilterEl.value;
    const sortBy = sortByEl?.value || 'tasks_desc';

    let employees = store.allOrgUsers || [];

    // PRIVACY: Hide Super Admin from non-Super Admin users
    const isSuperAdmin = store.currentUser?.role === 'super_admin';
    if (!isSuperAdmin) {
        employees = employees.filter(e => e.role !== 'super_admin');
    }
    if (deptFilter !== 'all') {
        employees = employees.filter(e => e.team === deptFilter);
    }

    if (countLabel) countLabel.innerText = employees.length;
    list.innerHTML = "";

    if (employees.length === 0) {
        list.innerHTML = `<div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">No associates in this department</div>`;
        return;
    }

    const range = getSelectedRange();
    if (!range) return;

    // 1. Calculate counts
    const empData = employees.map(emp => {
        const taskCount = (store.allTasks || []).filter(t => {
            if (t.assigned_to !== emp.id) return false;
            const taskDate = new Date(t.due_date);
            return taskDate >= range.start && taskDate <= range.end;
        }).length;
        return { emp, taskCount };
    });

    // 2. Sort
    empData.sort((a, b) => {
        if (sortBy === 'name') {
            return a.emp.full_name.localeCompare(b.emp.full_name);
        } else if (sortBy === 'tasks_desc') {
            return b.taskCount - a.taskCount;
        } else if (sortBy === 'tasks_asc') {
            return a.taskCount - b.taskCount;
        }
        return 0;
    });

    // 3. Render
    empData.forEach(({ emp, taskCount }) => {
        const row = document.createElement('div');
        row.className = `employee-row ${activeEmployeeId === emp.id ? 'active' : ''}`;
        row.onclick = () => {
            activeEmployeeId = emp.id;
            renderEmployeeList();
            renderTaskDetails(emp.id);
        };

        const initials = emp.full_name ? emp.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '??';

        row.innerHTML = `
            <div class="employee-info">
                <div class="row-avatar">${initials}</div>
                <span class="row-name">${escapeHtml(emp.full_name)}</span>
            </div>
            <span class="task-badge">${taskCount}</span>
        `;
        list.appendChild(row);
    });
}

function renderTaskDetails(empId) {
    const header = document.getElementById('plannerTaskHeader');
    const list = document.getElementById('plannerTaskList');
    const dateInputEl = document.getElementById('plannerDateInput');

    if (!header || !list || !dateInputEl) return;

    const selectedDate = dateInputEl.value;
    const emp = store.allOrgUsers.find(u => u.id === empId);
    if (!emp) return;

    header.style.display = "flex";
    document.getElementById('activeEmployeeName').innerText = emp.full_name;
    document.getElementById('activeEmployeeRole').innerText = emp.team || "No Department";

    const initials = emp.full_name ? emp.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '??';
    const avatarEl = document.getElementById('activeEmployeeAvatar');
    if (avatarEl) avatarEl.innerText = initials;

    const range = getSelectedRange();
    if (!range) return;

    const tasks = (store.allTasks || []).filter(t => {
        if (t.assigned_to !== empId) return false;
        const taskDate = new Date(t.due_date);
        return taskDate >= range.start && taskDate <= range.end;
    });

    const statLabel = document.getElementById('statTotalTasks');
    if (statLabel) statLabel.innerText = `${tasks.length} Task${tasks.length !== 1 ? 's' : ''}`;

    if (tasks.length === 0) {
        list.innerHTML = `
            <div class="planner-empty-state">
                <div class="empty-icon">☕</div>
                <p>${emp.full_name} has no tasks assigned for this date.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = "";
    tasks.forEach(task => {
        const client = store.allClients.find(c => c.id === task.client_id);
        const clientName = client ? client.company_name : (task.clients?.company_name || "Internal");

        const isPaused = client && client.status === 'paused';
        const card = document.createElement('div');
        card.className = "planner-task-card" + (isPaused ? " paused-task" : "");
        card.style.cursor = isPaused ? "not-allowed" : "pointer";
        card.onclick = () => {
            if (isPaused) {
                window.showToast("This client is paused. Tasks are read-only.", "error");
                return;
            }
            if (window.taskHandlers && window.taskHandlers.openEditModal) {
                window.taskHandlers.openEditModal(task.id);
            }
        };
        card.innerHTML = `
            <div class="task-main-info">
                <span class="task-client-name">${escapeHtml(clientName)}</span>
                <span class="task-title-text">${escapeHtml(task.title)}</span>
            </div>
            <div class="task-meta-pills">
                <span class="meta-pill status-${task.status}">${task.status.replace('_', ' ')}</span>
                <span class="meta-pill priority-${task.priority}">${task.priority}</span>
            </div>
        `;
        list.appendChild(card);
    });
}

window.initPlanner = initPlanner;
window.renderEmployeeList = renderEmployeeList;
