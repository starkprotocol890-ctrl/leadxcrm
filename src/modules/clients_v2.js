import { supabaseClient } from '../config/supabase.js';
import { store } from '../state/store_v2.js';
import { escapeHtml, getFirstName, formatDateDDMMYYYY, formatServiceTag } from '../utils/appUtils.js';

/**
 * CLIENTS MODULE — REVERTED TO ORIGINAL UI
 */

export async function loadClients() {
  try {
    console.log("[Clients] Loading data...");
    let query = supabaseClient
      .from('clients')
      .select('*, leads(source, referral_name)');

    console.log("[Clients] Bypassing filters for dev mode");

    const { data, error } = await query.order('company_name');

    if (error) throw error;
    store.allClients = data || [];
    renderClients();
  } catch (err) {
    console.error("[Clients] Fetch failed:", err);
  }
}

/**
 * RESTORED ORIGINAL CARD STRUCTURE (Requested)
 */
export function renderClients() {
  const container = document.getElementById("clientsGrid");
  if (!container) return;

  const searchInput = document.getElementById("clientSearchInput");
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";

  let clients = store.allClients || [];
  console.log("[Clients] renderClients data size:", clients.length, "Search:", searchTerm, "Handlers Ready:", !!window.clientHandlers);

  // Filter by search
  if (searchTerm) {
    clients = clients.filter(c =>
      (c.company_name || "").toLowerCase().includes(searchTerm) ||
      (c.client_name || "").toLowerCase().includes(searchTerm)
    );
  }

  if (clients.length === 0) {
    container.innerHTML = `<div class="empty-state show"><p>${searchTerm ? 'No matching clients found.' : 'No clients found. Close a lead to see them here.'}</p></div>`;
    return;
  }

  container.innerHTML = clients.map(client => {
    const isPaused = client.status === 'paused';
    return `
      <div class="client-card ${isPaused ? 'paused' : ''}" onclick="window.clientHandlers.viewProfile('${client.id}')">
        <div class="client-card-header">
          <div class="client-card-title">${escapeHtml(client.company_name)}</div>
          ${isPaused ? '<span class="status-badge status-closed">Paused</span>' : '<span class="status-badge status-new" style="background:#f0fdf4; color:#16a34a;">Active</span>'}
        </div>
        <div class="client-card-body">
          <div class="client-info-item">
            <span class="label">Contact:</span> ${escapeHtml(client.client_name)}
          </div>
          <div class="client-info-item">
            <span class="label">Service:</span> ${formatServiceTag(client.service || 'N/A')}
          </div>
          <div class="client-info-item">
            <span class="label">Phone:</span> ${escapeHtml(client.phone || '-')}
          </div>
        </div>
        <div class="client-card-footer">
           <button class="btn-ghost" style="width:100%; font-size:12px;" onclick="event.stopPropagation(); window.clientHandlers.viewProfile('${client.id}')">View Profile</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * RESTORED INTERACTION FLOW (Requested)
 */
window.clientHandlers = {
  editingState: {
    isEditing: false,
    services: [],
    assignedTo: null,
    location: "",
    currentClientId: null
  },

  viewProfile: (id) => {
    try {
      console.log("[Clients] viewProfile triggered for ID:", id);

      // Ensure we start in view mode
      window.clientHandlers.cancelEdit();

      const clients = store.allClients || [];
      const client = clients.find(c => c.id === id);
      if (!client) {
        console.warn("[Clients] Client not found in store for ID:", id);
        return;
      }

      // Initialize state
      window.clientHandlers.editingState = {
        isEditing: false,
        services: (client.service || "").split(',').map(s => s.trim()).filter(s => s),
        assignedTo: client.assigned_to,
        location: client.location || "",
        currentClientId: id
      };

      // Helper to safely set text or value
      const setSafe = (id, val, attr = 'innerText') => {
        const el = document.getElementById(id);
        if (el) el[attr] = val;
        else console.warn(`[Clients] Element #${id} missing`);
      };

      setSafe("profileCompanyName", client.company_name);
      setSafe("profileViewClientName", client.client_name);
      setSafe("profileViewPhone", client.phone || "-");
      setSafe("profileViewJoinedDate", formatDateDDMMYYYY(client.created_at));
      setSafe("profileViewLocation", client.location || "Not specified");

      // Requirement 4: Show referral info
      const referralSection = document.getElementById("profileReferralSection");
      if (referralSection) {
        const lead = client.leads;
        if (lead && lead.source === 'Referral' && lead.referral_name) {
          referralSection.style.display = "block";
          setSafe("profileViewReferral", lead.referral_name);
        } else {
          referralSection.style.display = "none";
        }
      }

      const cycleText = (client.cycle_start_date && client.cycle_end_date)
        ? `${formatDateDDMMYYYY(client.cycle_start_date)} — ${formatDateDDMMYYYY(client.cycle_end_date)}`
        : "No cycle dates set";
      setSafe("profileViewDates", cycleText);

      setSafe("profileNotesHistory", client.notes || "No internal notes history.");
      setSafe("profileNewNoteInput", "", 'value');

      setSafe("profileEditClientName", client.client_name);
      setSafe("profileEditPhone", client.phone || "-");
      setSafe("profileLocationInput", client.location || "", 'value');
      setSafe("profileCycleStart", client.cycle_start_date || "", 'value');
      setSafe("profileCycleEnd", client.cycle_end_date || "", 'value');
      setSafe("profileNotes", client.notes || "", 'value');

      const isPaused = client.status === 'paused';
      const toggleBtn = document.getElementById("menuToggleStatus");
      const isCEO = store.currentUser?.role === 'ceo' || store.currentUser?.role === 'super_admin';

      if (toggleBtn) {
        if (isCEO) {
          toggleBtn.style.display = 'block';
          toggleBtn.innerHTML = isPaused ? "▶️ Resume Client" : "⏸ Pause Client";
          toggleBtn.onclick = () => window.clientHandlers.toggleStatus(client.id, isPaused);
        } else {
          toggleBtn.style.display = 'none';
        }
      }

      const deleteBtn = document.getElementById("menuDeleteClient");
      if (deleteBtn) deleteBtn.onclick = () => window.clientHandlers.deleteClient(client.id);

      const saveBtn = document.getElementById("btnSaveProfile");
      if (saveBtn) saveBtn.onclick = () => window.clientHandlers.saveProfile();

      window.clientHandlers.renderServiceChips();
      window.clientHandlers.renderAssigneeChip();

      console.log("[Clients] Opening modal...");
      window.openModal("clientProfileModal");

      // Async rollover check
      window.clientHandlers.checkCycleRollover(client);
    } catch (err) {
      console.error("[Clients] Critical error in viewProfile:", err);
      alert("Error opening profile. See console for details.");
    }
  },

  checkCycleRollover: async (client) => {
    if (!client.cycle_end_date) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(client.cycle_end_date);

    if (today > endDate) {
      console.log(`[Cycle] Rollover triggered for ${client.company_name}`);

      // Calculate next cycle (maximum 30 days)
      const newStart = new Date(client.cycle_end_date);
      newStart.setDate(newStart.getDate() + 1);

      const newEnd = new Date(newStart);
      newEnd.setDate(newEnd.getDate() + 29); // 30 days duration (including start date)

      try {
        const { error } = await supabaseClient
          .from('clients')
          .update({
            cycle_start_date: newStart.toISOString().split('T')[0],
            cycle_end_date: newEnd.toISOString().split('T')[0]
          })
          .eq('id', client.id);

        if (error) throw error;
        await loadClients(); // Refresh global store
      } catch (err) {
        console.error("[Cycle] Rollover failed:", err);
      }
    }
  },

  closeClientOptionsMenu: () => {
    console.log("[Clients] Closing options menu...");
    const dropdown = document.getElementById("clientProfileDropdown");
    if (dropdown) {
      dropdown.classList.remove("show");
    }
  },

  enterEditMode: (focusTarget) => {
    // Requirement 2: Close menu before entering edit mode
    window.clientHandlers.closeClientOptionsMenu();

    // Requirement: Hide Edit Profile in Edit Mode (via CSS class)
    const modal = document.getElementById("clientProfileModal");
    if (modal) modal.classList.add("is-editing");

    window.clientHandlers.editingState.isEditing = true;
    document.getElementById("profileViewMode").style.display = "none";
    document.getElementById("profileEditMode").style.display = "block";
    document.getElementById("profileViewFooter").style.display = "none";
    document.getElementById("profileEditFooter").style.display = "flex";

    // Refresh chips to show edit tools
    window.clientHandlers.renderServiceChips();
    window.clientHandlers.renderAssigneeChip();

    if (focusTarget === 'notes') {
      document.getElementById("profileNotes").focus();
    }
  },

  cancelEdit: () => {
    window.clientHandlers.editingState.isEditing = false;
    document.getElementById("profileViewMode").style.display = "block";
    document.getElementById("profileEditMode").style.display = "none";
    document.getElementById("profileViewFooter").style.display = "flex";
    document.getElementById("profileEditFooter").style.display = "none";

    // Requirement: Show Edit Profile in View Mode (via CSS class removal)
    const modal = document.getElementById("clientProfileModal");
    if (modal) modal.classList.remove("is-editing");

    // Refresh chips to hide edit tools
    window.clientHandlers.renderServiceChips();
    window.clientHandlers.renderAssigneeChip();
  },

  autoSaveNotes: async () => {
    const state = window.clientHandlers.editingState;
    const id = state.currentClientId;
    if (!id) return;

    const client = store.allClients.find(c => c.id === id);
    if (!client) return;

    let updatedNotes = client.notes || "";

    if (state.isEditing) {
      // If in full edit mode, we take the whole block from the history textarea
      updatedNotes = document.getElementById("profileNotes").value;
    } else {
      // If in view mode, we check for a NEW note to append
      const newNote = document.getElementById("profileNewNoteInput").value.trim();
      if (!newNote) return; // Nothing to add

      const timestamp = new Date().toLocaleDateString();
      updatedNotes = updatedNotes
        ? `${updatedNotes}\n\n[${timestamp}] ${newNote}`
        : `[${timestamp}] ${newNote}`;
    }

    try {
      await supabaseClient
        .from('clients')
        .update({ notes: updatedNotes })
        .eq('id', id);

      // Sync UI
      document.getElementById("profileNotesHistory").innerText = updatedNotes;
      document.getElementById("profileNotes").value = updatedNotes;
      document.getElementById("profileNewNoteInput").value = "";

      // Update store
      client.notes = updatedNotes;

    } catch (err) {
      console.error("[Notes] Auto-save failed:", err);
    }
  },

  renderServiceChips: () => {
    const isEditing = window.clientHandlers.editingState.isEditing;
    const viewContainer = document.getElementById("profileViewServiceChips");
    const editContainer = document.getElementById("profileEditServiceChips");

    const services = window.clientHandlers.editingState.services;
    const chipsHtml = services.map((s, index) => `
      <div class="chip ${isEditing ? 'removable' : ''}">
        ${escapeHtml(s)}
        ${isEditing ? `<span class="chip-remove" onclick="window.clientHandlers.removeService(${index})">&times;</span>` : ''}
      </div>
    `).join('');

    if (isEditing) {
      editContainer.innerHTML = chipsHtml + `<div class="chip add-btn" onclick="window.clientHandlers.showServiceSelector(event)">+ Add Service</div>`;
    } else {
      viewContainer.innerHTML = chipsHtml || '<span style="font-size: 13px; color: #94a3b8;">No services selected</span>';
    }
  },

  removeService: (index) => {
    window.clientHandlers.editingState.services.splice(index, 1);
    window.clientHandlers.renderServiceChips();
  },

  showServiceSelector: (event) => {
    const options = ["Social Media", "Performance Marketing", "SEO", "Website", "Content", "Other"];
    const content = options.map(opt => `
      <div class="dropdown-item" style="padding: 8px; cursor: pointer; font-size: 13px;" onclick="window.clientHandlers.addService('${opt}')">
        ${opt}
      </div>
    `).join('');
    window.clientHandlers.showPopover(event.target, content);
  },

  addService: (service) => {
    if (!window.clientHandlers.editingState.services.includes(service)) {
      window.clientHandlers.editingState.services.push(service);
      window.clientHandlers.renderServiceChips();
    }
    window.clientHandlers.hidePopover();
  },

  renderAssigneeChip: () => {
    const isEditing = window.clientHandlers.editingState.isEditing;
    const viewContainer = document.getElementById("profileViewAssigneeChip");
    const editContainer = document.getElementById("profileEditAssigneeChip");

    const userId = window.clientHandlers.editingState.assignedTo;
    const user = store.allOrgUsers.find(u => u.id === userId);
    const name = user ? user.full_name : "Not Assigned";

    const chipHtml = `
      <div class="chip employee" ${isEditing ? 'onclick="window.clientHandlers.showEmployeeSelector(event)"' : ''}>
        👤 ${escapeHtml(name)} ${isEditing ? '▾' : ''}
      </div>
    `;

    if (isEditing) {
      editContainer.innerHTML = chipHtml;
    } else {
      viewContainer.innerHTML = chipHtml;
    }
  },

  showEmployeeSelector: (event) => {
    const isManager = store.currentUser?.role === 'manager';
    let users = store.allOrgUsers || [];

    // Managers cannot assign clients to the CEO
    if (isManager) {
      users = users.filter(user => user.role !== 'ceo');
    }

    const content = users.map(user => `
      <div class="dropdown-item" style="padding: 8px; cursor: pointer; font-size: 13px;" onclick="window.clientHandlers.setAssignee('${user.id}')">
        ${escapeHtml(user.full_name)}
      </div>
    `).join('');
    window.clientHandlers.showPopover(event.target, content);
  },

  setAssignee: (id) => {
    window.clientHandlers.editingState.assignedTo = id;
    window.clientHandlers.renderAssigneeChip();
    window.clientHandlers.hidePopover();
  },

  toggleProfileMenu: (event) => {
    event.stopPropagation();
    const dropdown = document.getElementById("clientProfileDropdown");
    if (!dropdown) return;

    const isShowing = dropdown.classList.contains("show");

    // Close any other open menus first
    document.querySelectorAll('.dropdown-content.show').forEach(m => {
      if (m !== dropdown) m.classList.remove('show');
    });

    if (isShowing) {
      dropdown.classList.remove("show");
      console.log("[Clients] Menu closed via toggle");
    } else {
      dropdown.classList.add("show");
      console.log("[Clients] Menu opened");

      // Robust close on click anywhere (including items)
      const closeHandler = () => {
        dropdown.classList.remove("show");
        document.removeEventListener('click', closeHandler);
        console.log("[Clients] Menu closed via global listener");
      };

      // Delay adding listener to avoid immediate trigger from this click
      setTimeout(() => {
        document.addEventListener('click', closeHandler);
      }, 10);
    }
  },

  showPopover: (target, html) => {
    const popover = document.getElementById("popoverSelector");
    const content = document.getElementById("popoverContent");
    if (!popover || !content) return;

    const rect = target.getBoundingClientRect();
    content.innerHTML = html;
    popover.style.display = "block";
    popover.style.top = `${rect.bottom + 5}px`;
    popover.style.left = `${rect.left}px`;

    // Click outside listener
    const closeHandler = (e) => {
      if (!popover.contains(e.target) && e.target !== target) {
        window.clientHandlers.hidePopover();
        document.removeEventListener('click', closeHandler);
      }
    };

    // Use timeout to avoid immediate closure from the same click
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 10);
  },

  hidePopover: () => {
    const popover = document.getElementById("popoverSelector");
    if (popover) popover.style.display = "none";
  },

  saveProfile: async () => {
    window.confirmAction({
      title: "Update Client Profile",
      message: "Are you sure you want to save the changes to this client's profile?",
      confirmText: "Save Changes"
    }, async () => {
      const id = window.clientHandlers.editingState.currentClientId;
      const cycleStart = document.getElementById("profileCycleStart").value;
      const cycleEnd = document.getElementById("profileCycleEnd").value;

      if (cycleStart && cycleEnd) {
        const startDate = new Date(cycleStart);
        const endDate = new Date(cycleEnd);
        const diffTime = endDate - startDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          return alert("Service end date must be after start date.");
        }
        if (diffDays > 30) {
          return alert("Maximum cycle duration is 30 days.");
        }
      }

      const updateData = {
        client_name: document.getElementById("profileEditClientName").value,
        phone: document.getElementById("profileEditPhone").value,
        location: document.getElementById("profileLocationInput").value,
        cycle_start_date: cycleStart || null,
        cycle_end_date: cycleEnd || null,
        notes: document.getElementById("profileNotes").value,
        service: window.clientHandlers.editingState.services.join(', '),
        assigned_to: window.clientHandlers.editingState.assignedTo
      };

      if (store.currentUser?.role === 'manager') {
        const assignedUser = store.allOrgUsers.find(u => u.id === updateData.assigned_to);
        if (assignedUser && assignedUser.role === 'ceo') {
          return alert("Access Denied: Managers cannot assign clients to the CEO.");
        }
      }

      try {
        const { error } = await supabaseClient
          .from('clients')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;

        await loadClients();
        window.clientHandlers.cancelEdit(); // Exit edit mode
        window.clientHandlers.viewProfile(id); // Refresh view
        window.showToast("Client profile updated successfully", "success");
      } catch (err) {
        console.error("[Clients] Save failed:", err);
        alert("Failed to save changes.");
      }
    });
  },

  toggleStatus: async (id, currentlyPaused) => {
    if (store.currentUser?.role !== 'ceo' && store.currentUser?.role !== 'super_admin') {
      window.showToast("Only the CEO or Super Admin can pause or resume clients.", "error");
      return;
    }
    const newStatus = currentlyPaused ? 'active' : 'paused';
    try {
      const { error } = await supabaseClient
        .from('clients')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      await loadClients();
      window.clientHandlers.viewProfile(id);
    } catch (err) {
      console.error("[Clients] Status update failed:", err);
    }
  },

  deleteClient: async (id) => {
    window.confirmAction({
      title: "Delete Client",
      message: "Are you sure you want to permanently delete this client? This will also remove all associated tasks.",
      confirmText: "Delete",
      isDelete: true
    }, async () => {
      try {
        const { error } = await supabaseClient.from('clients').delete().eq('id', id);
        if (error) throw error;
        window.closeModal("clientProfileModal");
        await loadClients();
        window.showToast("Client deleted successfully", "success");
      } catch (err) {
        console.error("[Clients] Delete failed:", err);
        alert("Delete failed.");
      }
    });
  }
};

window.loadClients = loadClients;
window.renderClients = renderClients;
window.hidePopover = window.clientHandlers.hidePopover;
