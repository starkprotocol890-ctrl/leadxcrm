import { supabaseClient, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';
import { store } from '../state/store_v2.js';
import { escapeHtml, formatUserRole } from '../utils/appUtils.js';

/**
 * TEAM MANAGEMENT MODULE — FULL SCREEN VERSION
 */

export async function loadEmployeeList() {
  try {
    console.log("[Associates] Fetching associates...");
    const { data, error } = await supabaseClient.from("profiles").select("*").order("full_name");

    if (error) throw error;
    store.allOrgUsers = data || [];
    renderEmployeeTable();
    populateDeptFilter();
  } catch (err) {
    console.error("[Associates] Fetch failed:", err);
  }
}

function populateDeptFilter() {
  const select = document.getElementById('filterDeptSelect');
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

  const current = select.value;
  select.innerHTML = '<option value="all">All Departments</option>';
  departments.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
  select.value = current || "all";
}

export function renderEmployeeTable() {
  const addBtn = document.querySelector(".people-actions button.btn-primary");
  if (addBtn) {
    addBtn.style.display = store.currentUser?.role === 'ceo' ? 'block' : 'none';
  }

  const tbody = document.getElementById("employeesTableBody");
  if (!tbody) return;

  const search = document.getElementById('employeeSearchInput')?.value.toLowerCase() || '';
  const roleFilter = document.getElementById('filterRoleSelect')?.value || 'all';
  const deptFilter = document.getElementById('filterDeptSelect')?.value || 'all';

  let employees = store.allOrgUsers || [];

  // Privacy filter (keep extensible, but currently no super admin exists)
  employees = employees.filter(e => e.role !== 'super_admin');

  // Apply filters
  if (search) {
    employees = employees.filter(e =>
      (e.full_name && e.full_name.toLowerCase().includes(search)) ||
      (e.email && e.email.toLowerCase().includes(search))
    );
  }
  if (roleFilter !== 'all') {
    employees = employees.filter(e => e.role === roleFilter);
  }
  if (deptFilter !== 'all') {
    employees = employees.filter(e => e.team === deptFilter);
  }

  // Custom Sorting Logic
  const rolePriority = { 'ceo': 1, 'manager': 2, 'associate': 3 };

  employees.sort((a, b) => {
    const priorityA = rolePriority[a.role] || 4;
    const priorityB = rolePriority[b.role] || 4;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Alphabetical secondary sort
    const nameA = (a.full_name || '').toLowerCase();
    const nameB = (b.full_name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  if (employees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding: 40px; text-align: center; color: #64748b;">No matching team members found.</td></tr>';
    return;
  }

  tbody.innerHTML = employees.map(emp => {
    const initials = (emp.full_name || "?").split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const status = (emp.status || 'active').toLowerCase();

    return `
      <tr>
        <td>
          <div class="name-cell">
            <div class="mgmt-avatar">${initials}</div>
            <div class="name-details">
              <div class="full-name">${escapeHtml(emp.full_name || "Unknown")}</div>
              <div class="email">${escapeHtml(emp.email || "No Email")}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-role role-${emp.role}">${escapeHtml(formatUserRole(emp.role))}</span></td>
        <td><span class="badge badge-dept">${escapeHtml(emp.team || "Unassigned")}</span></td>
        <td><span class="designation-text" style="font-size: 13px; color: #475569;">${escapeHtml(emp.designation || "-")}</span></td>
        <td><span class="badge badge-status ${status}">${status}</span></td>
        <td class="actions-cell">
          ${(store.currentUser?.role === 'ceo' && emp.role !== 'ceo') ? `
          <div class="action-menu">
            <div class="action-dots" onclick="window.employeeHandlers.toggleMenu(event, '${emp.id}')">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>
            </div>
            <div id="emp-dropdown-${emp.id}" class="dropdown-content" style="right: 0; top: 100%;">
              <button class="dropdown-item" onclick="window.employeeHandlers.openEditModal('${emp.id}')">
                <span>👤</span> Edit Profile
              </button>
              <button class="dropdown-item delete" onclick="window.employeeHandlers.deleteEmployee('${emp.id}')">
                <span>🗑</span> Delete
              </button>
              <button class="dropdown-item" onclick="window.employeeHandlers.toggleDeactivateEmployee('${emp.id}')">
                <span>${(emp.status || 'active').toLowerCase() === 'inactive' ? '✅' : '🚫'}</span> ${(emp.status || 'active').toLowerCase() === 'inactive' ? 'Activate' : 'Deactivate'}
              </button>
            </div>
          </div>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

window.employeeHandlers = {
  filterTable: () => renderEmployeeTable(),

  openAddModal: () => {
    if (store.currentUser?.role !== 'ceo') {
      alert("Access Denied: Only the CEO is authorized to add new associates.");
      return;
    }
    const form = document.getElementById('addEmployeeForm');
    if (form) form.reset();
    window.openModal('addEmployeeModal');
  },

  saveEmployee: async (e) => {
    e.preventDefault();
    if (store.currentUser?.role !== 'ceo') {
      alert("Access Denied: Only the CEO is authorized to add new associates.");
      return;
    }
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    try {
      console.log("[Associates] Registering new user in Auth...");

      // 1. Create a temporary client that doesn't persist the session to sessionStorage
      const tempClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      // 2. Create Auth User using the temporary client
      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: payload.email,
        password: 'leadXkochi',
        options: {
          data: {
            full_name: payload.full_name,
            role: payload.role,
            team: payload.team
          }
        }
      });

      if (authError) throw authError;

      // 2. Profile is usually created by a DB trigger on signup, 
      // but we update it here to ensure designation and other fields are set.
      if (authData.user) {
        const { error: profileError } = await supabaseClient
          .from('profiles')
          .update({
            full_name: payload.full_name,
            role: payload.role,
            team: payload.team || null,
            designation: payload.designation || null
          })
          .eq('id', authData.user.id);

        // If update fails (e.g. trigger didn't finish), try insert
        if (profileError) {
          await supabaseClient.from('profiles').insert([{
            id: authData.user.id,
            full_name: payload.full_name,
            role: payload.role,
            team: payload.team || null,
            designation: payload.designation || null,
            email: payload.email
          }]);
        }
      }

      window.showToast("Associate registered! Password: leadXkochi", "success");
      window.closeModal('addEmployeeModal');
      await loadEmployeeList();
    } catch (err) {
      console.error("Save associate failed:", err);
      window.showToast("Registration failed: " + err.message, "error");
    }
  },

  toggleMenu: (e, empId) => {
    e.stopPropagation();
    const dropdown = document.getElementById(`emp-dropdown-${empId}`);
    if (!dropdown) return;

    const isShowing = dropdown.classList.contains("show");

    // Close all other dropdowns
    document.querySelectorAll(".dropdown-content.show").forEach(d => d.classList.remove("show"));

    if (!isShowing) {
      dropdown.classList.add("show");
    }
  },

  showActions: (e, empId) => {
    // Legacy support or fallback
    window.employeeHandlers.toggleMenu(e, empId);
  },

  // Helper to enforce hierarchy
  checkHierarchy: (targetEmpId) => {
    const currentUserRole = store.currentUser?.role || '';
    
    if (currentUserRole !== 'ceo') {
      alert("Access Denied: Only the CEO has authorization to manage employee profiles.");
      return false;
    }

    if (targetEmpId === store.currentUser?.id) {
      alert("Security Policy: You cannot modify your own administrative profile.");
      return false;
    }
    return true;
  },

  openEditModal: (empId) => {
    if (!window.employeeHandlers.checkHierarchy(empId)) return;

    const emp = store.allOrgUsers.find(u => u.id === empId);
    if (!emp) return;

    document.getElementById('editEmpId').value = emp.id;
    document.getElementById('editFullName').value = emp.full_name || '';
    document.getElementById('editTeam').value = emp.team || '';
    document.getElementById('editDesignation').value = emp.designation || '';
    document.getElementById('editRole').value = emp.role || 'associate';

    // Only CEO can change Department/Team and Designation
    const isCEO = store.currentUser?.role === 'ceo';
    const teamSelect = document.getElementById('editTeam');
    const designationInput = document.getElementById('editDesignation');
    if (teamSelect) teamSelect.disabled = !isCEO;
    if (designationInput) designationInput.disabled = !isCEO;

    window.openModal('editEmployeeModal');
  },

  saveProfileUpdate: async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());
    const empId = payload.id;

    if (!window.employeeHandlers.checkHierarchy(empId)) return;

    const emp = store.allOrgUsers.find(u => u.id === empId);

    window.confirmAction({
      title: "Update Profile",
      message: `Are you sure you want to save changes to ${payload.full_name}'s profile?`,
      confirmText: "Update Profile"
    }, async () => {
      try {
        const isCEO = store.currentUser?.role === 'ceo';
        const updateData = {
          full_name: payload.full_name,
          role: payload.role
        };

        if (isCEO) {
          updateData.team = payload.team || null;
          updateData.designation = payload.designation || null;
        } else if (emp) {
          updateData.team = emp.team || null;
          updateData.designation = emp.designation || null;
        }

        const { error } = await supabaseClient.from('profiles').update(updateData).eq('id', empId);

        if (error) throw error;

        window.showToast("Profile updated successfully", "success");
        window.closeModal('editEmployeeModal');
        await loadEmployeeList();
      } catch (err) {
        window.showToast("Update failed: " + err.message, "error");
      }
    });
  },

  deleteEmployee: async (empId) => {
    if (!window.employeeHandlers.checkHierarchy(empId)) return;

    window.confirmAction({
      title: "Remove Associate",
      message: "Are you sure you want to permanently remove this associate from the organization?",
      confirmText: "Remove",
      isDelete: true
    }, async () => {
      try {
        const { error } = await supabaseClient.from('profiles').delete().eq('id', empId);
        if (error) throw error;
        window.showToast("Associate removed", "success");
        await loadEmployeeList();
      } catch (err) {
        window.showToast("Delete failed: " + err.message, "error");
      }
    });
  },

  toggleDeactivateEmployee: async (empId) => {
    if (!window.employeeHandlers.checkHierarchy(empId)) return;

    const emp = store.allOrgUsers.find(u => u.id === empId);
    if (!emp) return;

    const currentStatus = (emp.status || 'active').toLowerCase();
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const label = nextStatus === 'active' ? 'activate' : 'deactivate';

    window.confirmAction({
      title: `${label.charAt(0).toUpperCase() + label.slice(1)} Associate`,
      message: `Are you sure you want to ${label} this associate?`,
      confirmText: label.charAt(0).toUpperCase() + label.slice(1),
      isDelete: currentStatus === 'active'
    }, async () => {
      try {
        const { error } = await supabaseClient
          .from('profiles')
          .update({ status: nextStatus })
          .eq('id', empId);

        if (error) throw error;

        window.showToast(`Associate ${nextStatus === 'active' ? 'activated' : 'deactivated'} successfully`, "success");
        await loadEmployeeList();
      } catch (err) {
        window.showToast("Action failed: " + err.message, "error");
      }
    });
  }
};

window.loadEmployeeList = loadEmployeeList;
window.renderEmployeeList = renderEmployeeTable;
