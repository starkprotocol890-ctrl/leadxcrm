console.log("[Leads] LOADING ENGINE V2.1 (FINAL SYNC)");
import { supabaseClient } from '../config/supabase.js';
import { store } from '../state/store_v2.js';
import { escapeHtml, getFirstName, formatBudget, formatServiceTag } from '../utils/appUtils.js';

/**
 * LEADS MODULE — FULL UI RECOVERY (Step 1 - 8 Fixed)
 */

export async function loadLeads() {
  try {
    console.log("[Leads] Fetching data...");
    let query = supabaseClient.from("leads").select("*");

    // TEMPORARY DEV MODE: Fetch ALL data without filtering
    console.log("[Leads] Bypassing role/org filters for dev mode");

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    // STEP 1 — FIX DATA FLOW
    store.allLeads = data || [];
    updateLeadStats(store.allLeads);
    renderLeadsTable(store.allLeads);

    initLeadsListeners();
  } catch (err) {
    console.error("[Leads] Fetch failed:", err);
  }
}

/**
 * STEP 2 — FIX STATS CALCULATION
 */
export function updateLeadStats(leads) {
  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    meeting: leads.filter(l => l.status === 'meeting').length,
    proposal: leads.filter(l => l.status === 'proposal').length,
    closed: leads.filter(l => l.status === 'closed').length
  };

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal("stat-total", stats.total);
  setVal("stat-new", stats.new);
  setVal("stat-contacted", stats.contacted);
  setVal("stat-meeting", stats.meeting);
  setVal("stat-proposal", stats.proposal);
  setVal("stat-closed", stats.closed);
}

/**
 * STEP 3 — FIX TABLE RENDER
 */
export function renderLeadsTable(dataToRender = null) {
  const tbody = document.getElementById("leadsTableBody");
  if (!tbody) return;

  // STEP 3 — Clear previous table before rendering
  tbody.innerHTML = "";

  let leads = dataToRender || store.allLeads || [];

  // STEP 7 — Search & Filter Logic
  const query = (store.filters.leads.search || "").toLowerCase();
  const status = store.filters.leads.status;

  if (query) {
    leads = leads.filter(l =>
      (l.name && l.name.toLowerCase().includes(query)) ||
      (l.phone && l.phone.toLowerCase().includes(query)) ||
      (l.company_name && l.company_name.toLowerCase().includes(query))
    );
  }

  if (status) {
    leads = leads.filter(l => l.status === status);
  } else {
    // Default: Show all active leads (exclude closed unless specifically filtered)
    leads = leads.filter(l => l.status !== "closed");
  }

  const emptyState = document.getElementById("leadsEmptyState");
  if (leads.length === 0) {
    if (emptyState) emptyState.classList.add("show");
  } else {
    if (emptyState) emptyState.classList.remove("show");
    tbody.innerHTML = leads.map(lead => renderLeadRow(lead)).join('');
  }
}

function renderLeadRow(lead) {
  const assignedUser = store.allOrgUsers.find(u => u.id === lead.assigned_to);
  const assignedName = assignedUser ? getFirstName(assignedUser.full_name) : "Unassigned";

  // STEP 3 — Map each lead correctly with proper fields
  return `
    <tr>
      <td>
        <div style="font-weight: 600; color: #1e293b;">${escapeHtml(lead.company_name || "-")}</div>
      </td>
      <td>${escapeHtml(lead.phone || "-")}</td>
      <td>${escapeHtml(lead.name)}</td>
      <td>${escapeHtml(lead.source || "-")}</td>
      <td>${formatServiceTag(lead.service_interest)}</td>
      <td>${escapeHtml(formatBudget(lead.budget))}</td>
      <td><span class="status-badge status-${lead.status}">${lead.status}</span></td>
      <td class="notes-cell" onclick="window.leadHandlers.showNotes('${lead.id}')">
        <div class="notes-preview">
          ${escapeHtml(lead.notes || "No notes available")}
        </div>
      </td>
      <td class="table-actions">
        <div style="display: flex; gap: 12px; align-items: center; justify-content: flex-end;">
          <button class="btn-action" onclick="window.leadHandlers.convert('${lead.id}')" style="background: #f0fdf4; color: #16a34a; border-color: #dcfce7; padding: 6px 12px; font-size: 12px;">
            <span>🤝</span> Convert
          </button>
          
          <div class="action-menu">
            <button class="btn-menu" onclick="window.leadHandlers.toggleMenu(event, '${lead.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
            </button>
            <div id="dropdown-${lead.id}" class="dropdown-content">
              <button class="dropdown-item" onclick="window.leadHandlers.edit('${lead.id}')">
                <span>✎</span> Edit Lead
              </button>
              <button class="dropdown-item delete" onclick="window.leadHandlers.delete('${lead.id}')">
                <span>🗑</span> Delete Lead
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `;
}

/**
 * STEP 7 — Search + Filter + Form Binding
 */
function initLeadsListeners() {
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("filterStatus");
  const leadForm = document.getElementById("leadForm");

  if (searchInput && !searchInput.dataset.listener) {
    searchInput.addEventListener("input", (e) => {
      store.filters.leads.search = e.target.value;
      renderLeadsTable();
    });
    searchInput.dataset.listener = "true";
  }

  if (statusFilter && !statusFilter.dataset.listener) {
    statusFilter.addEventListener("change", (e) => {
      store.filters.leads.status = e.target.value;
      renderLeadsTable();
    });
    statusFilter.dataset.listener = "true";
  }

  if (leadForm && !leadForm.dataset.listener) {
    leadForm.addEventListener("submit", addLead);
    leadForm.dataset.listener = "true";
  }

  const serviceCycleForm = document.getElementById("serviceCycleForm");
  if (serviceCycleForm && !serviceCycleForm.dataset.listener) {
    serviceCycleForm.addEventListener("submit", saveConversion);
    serviceCycleForm.dataset.listener = "true";
  }

  const editLeadForm = document.getElementById("editLeadForm");
  if (editLeadForm && !editLeadForm.dataset.listener) {
    editLeadForm.addEventListener("submit", (e) => {
      e.preventDefault();
      leadHandlers.saveEdit();
    });
    editLeadForm.dataset.listener = "true";
  }

  // GLOBAL CLICK LISTENER FOR DROPDOWNS
  if (!document.body.dataset.dropdownListener) {
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".action-menu")) {
        document.querySelectorAll(".dropdown-content.show").forEach(d => d.classList.remove("show"));
      }
    });
    document.body.dataset.dropdownListener = "true";
  }

  // NOTES MODAL LISTENER
  const saveNoteBtn = document.getElementById("modalSave");
  if (saveNoteBtn && !saveNoteBtn.dataset.listener) {
    saveNoteBtn.addEventListener("click", () => {
      const id = saveNoteBtn.dataset.leadId;
      if (id) window.leadHandlers.saveNote(id);
    });
    saveNoteBtn.dataset.listener = "true";
  }

  // CONDITIONAL REFERRAL FIELD (Requirement 2)
  const sourceDropdown = document.getElementById("source");
  const referralGroup = document.getElementById("referralFieldGroup");
  const referralInput = document.getElementById("referral");

  if (sourceDropdown && referralGroup && !sourceDropdown.dataset.listener) {
    sourceDropdown.addEventListener("change", (e) => {
      if (e.target.value === "Referral") {
        referralGroup.style.display = "block";
        // Small delay to allow display:block to take effect for transition
        setTimeout(() => {
          referralGroup.style.opacity = "1";
          referralGroup.style.transform = "translateY(0)";
        }, 10);
      } else {
        referralGroup.style.opacity = "0";
        referralGroup.style.transform = "translateY(-10px)";
        setTimeout(() => {
          referralGroup.style.display = "none";
          if (referralInput) referralInput.value = "";
        }, 300);
      }
    });
    sourceDropdown.dataset.listener = "true";
  }
}

/**
 * STEP 4 — FIX ADD LEAD FLOW
 */
export async function addLead(event) {
  if (event) event.preventDefault();

  // STEP 8 — Safety Null Checks
  const company = document.getElementById("company")?.value;
  const name = document.getElementById("name")?.value;
  const phone = document.getElementById("phone")?.value;

  if (!name || !phone) return alert("Name and Phone are required.");

  const formData = {
    company_name: company,
    name: name,
    phone: phone,
    email: document.getElementById("email")?.value,
    source: document.getElementById("source")?.value,
    service_interest: document.getElementById("service")?.value,
    budget: document.getElementById("budget")?.value,
    referral_name: document.getElementById("referral")?.value,
    status: document.getElementById("status")?.value || 'new',
    notes: document.getElementById("notes")?.value,
    organization_id: store.currentOrganizationId,
    user_id: store.currentUserId
  };

  try {
    const { error } = await supabaseClient.from("leads").insert([formData]);
    if (error) throw error;

    // STEP 4 — Reset Form & Reload (Do NOT manually push into UI)
    document.getElementById("leadForm").reset();
    await loadLeads();
  } catch (err) {
    console.error("[Leads] Add failed:", err);
    alert("Failed to add lead: " + err.message);
  }
}

/**
 * STEP 2 & 7 — CONVERT LEAD TO CLIENT
 */
export async function saveConversion(event) {
  if (event) event.preventDefault();

  const leadId = document.getElementById("serviceCycleLeadId")?.value;
  const cycleStart = document.getElementById("cycleStart")?.value;
  const cycleEnd = document.getElementById("cycleEnd")?.value;
  const service = document.getElementById("convertService")?.value;

  if (!leadId || !cycleStart || !cycleEnd || !service) {
    return alert("Please fill all required fields.");
  }

  // Set maximum cycle duration as 30 days
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

  const lead = store.allLeads.find(l => l.id === leadId);
  if (!lead) return alert("Lead not found.");

  try {
    console.log("[Leads] Starting conversion for:", lead.company_name);

    // STEP 7 — DUPLICATE PREVENTION
    const { data: existingClients, error: checkError } = await supabaseClient
      .from("clients")
      .select("id")
      .or(`phone.eq.${lead.phone},company_name.eq.${lead.company_name}`);

    if (checkError) throw checkError;
    if (existingClients && existingClients.length > 0) {
      return alert("Conversion failed: A client with this company name or phone already exists.");
    }

    // 1. UPDATE LEAD STATUS
    const { error: updateError } = await supabaseClient
      .from("leads")
      .update({
        status: "closed",
        service_start: cycleStart,
        service_end: cycleEnd
      })
      .eq("id", leadId);

    if (updateError) throw updateError;

    // 2. CREATE CLIENT RECORD
    const clientData = {
      lead_id: lead.id,
      organization_id: lead.organization_id,
      company_name: lead.company_name,
      client_name: lead.name,
      phone: lead.phone,
      service: service,
      cycle_start_date: cycleStart,
      cycle_end_date: cycleEnd,
      assigned_to: lead.assigned_to,
      notes: lead.notes,
      status: "active"
    };

    const { error: insertError } = await supabaseClient
      .from("clients")
      .insert([clientData]);

    if (insertError) throw insertError;

    console.log("[Leads] Conversion successful.");

    // STEP 4 & 5 — UI UPDATE & CLOSE
    window.closeModal("serviceCycleModal");

    // Update local lead status
    lead.status = "closed";

    // Refresh Lead UI
    updateLeadStats(store.allLeads);
    renderLeadsTable();

    // Refresh Client UI (instantly)
    if (window.loadClients) await window.loadClients();

    alert("Lead successfully converted to Client!");

  } catch (err) {
    console.error("[Leads] Conversion failed:", err);
    alert("Conversion failed. Please try again.");
  }
}

/**
 * STEP 5 — FIX EVENT BINDING (Handlers)
 */
export const leadHandlers = {
  edit: (id) => {
    const lead = store.allLeads.find(l => l.id === id);
    if (!lead) return;

    // Fill Edit Modal Fields
    document.getElementById("editLeadId").value = lead.id;
    document.getElementById("editName").value = lead.name || "";
    document.getElementById("editPhone").value = lead.phone || "";
    document.getElementById("editEmail").value = lead.email || "";
    document.getElementById("editCompany").value = lead.company_name || "";
    document.getElementById("editSource").value = lead.source || "";
    document.getElementById("editService").value = lead.service_interest || "";
    document.getElementById("editBudget").value = lead.budget || "";
    document.getElementById("editStatus").value = lead.status || "new";
    document.getElementById("editNotes").value = lead.notes || "";

    window.openModal("editLeadModal");
  },
  saveEdit: async () => {
    window.confirmAction({
      title: "Update Lead",
      message: "Are you sure you want to save the changes to this lead?",
      confirmText: "Save Changes"
    }, async () => {
      const id = document.getElementById("editLeadId").value;
      const updateData = {
        name: document.getElementById("editName").value,
        phone: document.getElementById("editPhone").value,
        email: document.getElementById("editEmail").value,
        company_name: document.getElementById("editCompany").value,
        source: document.getElementById("editSource").value,
        service_interest: document.getElementById("editService").value,
        budget: document.getElementById("editBudget").value,
        status: document.getElementById("editStatus").value,
        notes: document.getElementById("editNotes").value,
      };

      try {
        const { error } = await supabaseClient
          .from("leads")
          .update(updateData)
          .eq("id", id);

        if (error) throw error;
        window.closeModal("editLeadModal");
        await loadLeads();
        window.showToast("Lead updated successfully", "success");
      } catch (err) {
        console.error("[Leads] Update failed:", err);
        alert("Failed to update lead: " + err.message);
      }
    });
  },
  delete: async (id) => {
    window.confirmAction({
      title: "Delete Lead",
      message: "Are you sure you want to permanently delete this lead?",
      confirmText: "Delete",
      isDelete: true
    }, async () => {
      try {
        const { error } = await supabaseClient.from("leads").delete().eq("id", id);
        if (error) throw error;
        await loadLeads();
        window.showToast("Lead deleted successfully", "success");
      } catch (err) {
        console.error("[Leads] Delete failed:", err);
      }
    });
  },
  convert: (id) => {
    const lead = store.allLeads.find(l => l.id === id);
    if (!lead) return;

    const input = document.getElementById("serviceCycleLeadId");
    if (input) input.value = id;

    const serviceSelect = document.getElementById("convertService");
    if (serviceSelect) serviceSelect.value = lead.service || "";

    window.openModal("serviceCycleModal");
  },
  toggleMenu: (event, id) => {
    event.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${id}`);
    const isShowing = dropdown.classList.contains("show");

    // Close all others
    document.querySelectorAll(".dropdown-content.show").forEach(d => d.classList.remove("show"));

    if (!isShowing) dropdown.classList.add("show");
  },
  showNotes: (id) => {
    const lead = store.allLeads.find(l => l.id === id);
    if (!lead) return;

    const displayArea = document.getElementById("notesDisplayArea");
    const nameArea = document.getElementById("modalLeadName");
    const saveBtn = document.getElementById("modalSave");

    if (nameArea) nameArea.textContent = `Notes: ${lead.company_name || lead.name}`;
    if (displayArea) displayArea.textContent = lead.notes || "";
    if (saveBtn) saveBtn.dataset.leadId = id;

    window.openModal("notesModal");
  },
  saveNote: async (id) => {
    const textarea = document.getElementById("modalNotesText");
    const newNote = textarea?.value.trim();
    if (!newNote) return;

    const lead = store.allLeads.find(l => l.id === id);
    if (!lead) return;

    const updatedNotes = lead.notes
      ? `${lead.notes}\n\n[${new Date().toLocaleDateString()}] ${newNote}`
      : `[${new Date().toLocaleDateString()}] ${newNote}`;

    try {
      const { error } = await supabaseClient
        .from("leads")
        .update({ notes: updatedNotes })
        .eq("id", id);

      if (error) throw error;

      // Update Local Store
      lead.notes = updatedNotes;

      // Update Modal UI
      document.getElementById("notesDisplayArea").textContent = updatedNotes;
      textarea.value = "";

      // Update Table UI (instantly)
      renderLeadsTable();
    } catch (err) {
      console.error("[Leads] Save note failed:", err);
      alert("Failed to save note: " + err.message);
    }
  }
};

window.leadHandlers = leadHandlers;
window.addLead = addLead;
window.loadLeads = loadLeads;
window.saveConversion = saveConversion;
window.leadHandlers = leadHandlers;
window.addLead = addLead;
window.loadLeads = loadLeads;
window.saveConversion = saveConversion;
window.saveConversion = saveConversion;
window.leadHandlers = leadHandlers;
window.addLead = addLead;
window.loadLeads = loadLeads;
window.saveConversion = saveConversion;
