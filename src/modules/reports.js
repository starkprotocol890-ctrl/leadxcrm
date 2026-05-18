/**
 * Reports & Approvals Module
 */
import { supabaseClient, handleSupabaseError } from '../config/supabase.js';
import { store } from '../state/store.js';
import { escapeHtml } from '../utils/appUtils.js';

export async function loadReports() {
  if (!store.currentUser) return;
  const { data, error } = await supabaseClient
    .from("reports")
    .select(`*, report_approvals ( id, approver_id, level, action, comments, created_at )`)
    .order("created_at", { ascending: false });

  if (error) { handleSupabaseError(error, "loadReports"); return; }
  store.allReports = data || [];
  renderReports();
}

export function renderReports() {
  const grid = document.getElementById("reportsGrid");
  if (!grid) return;
  if (!store.allReports) return;

  let filtered = store.allReports;
  if (store.reportTypeFilterVal) filtered = filtered.filter(r => r.type === store.reportTypeFilterVal);
  if (store.reportStatusFilterVal) filtered = filtered.filter(r => r.status === store.reportStatusFilterVal);
  if (store.reportClientFilterVal) filtered = filtered.filter(r => r.client_name?.toLowerCase().includes(store.reportClientFilterVal));

  grid.innerHTML = filtered.length === 0
    ? '<div class="empty-state show"><p>No reports found.</p></div>'
    : filtered.map(report => renderReportCard(report)).join('');
}

function renderReportCard(report) {
  const statusLabels = {
    draft: 'Draft', submitted: 'Submitted',
    level1_approved: 'L1 Approved', level2_approved: 'L2 Approved',
    approved: 'Approved', rejected: 'Rejected'
  };
  const typeLabels = { social_media_plan: 'Social Media', monthly_report: 'Monthly', campaign_plan: 'Campaign' };

  return `
    <div class="report-card" onclick="window.reports.openReportDetail('${report.id}')">
      <div class="report-card-header">
        <div>
          <div class="report-card-title">${escapeHtml(report.title)}</div>
          <span class="report-type-badge ${report.type}">${typeLabels[report.type] || report.type}</span>
        </div>
        <span class="report-status-badge ${report.status}">${statusLabels[report.status] || report.status}</span>
      </div>
      <div class="report-card-meta">
        <span>By ${escapeHtml(store.employeeNameById[report.submitted_by] || 'Unknown')}</span>
        <span>${new Date(report.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  `;
}

export async function saveReport(status) {
  const payload = {
    title: document.getElementById("reportTitle").value.trim(),
    type: document.getElementById("reportType").value,
    client_name: document.getElementById("reportClientName").value.trim(),
    content: document.getElementById("reportContent").value.trim(),
    status,
    submitted_by: store.currentUserId,
    organization_id: store.currentOrganizationId,
    user_id: store.currentUserId
  };

  const { error } = await supabaseClient.from("reports").insert([payload]);
  if (error) alert("Error saving report: " + error.message);
  else {
    window.closeModal("reportModal");
    await loadReports();
  }
}

export async function handleApprovalAction(action) {
  const report = store.allReports.find(r => r.id === store.activeReportId);
  if (!report) return;

  let level = 1;
  if (report.status === 'level1_approved') level = 2;
  else if (report.status === 'level2_approved') level = 3;

  await supabaseClient.from("report_approvals").insert([{
    report_id: store.activeReportId,
    approver_id: store.currentUserId,
    level,
    action,
    comments: document.getElementById("approvalComments").value,
    organization_id: store.currentOrganizationId
  }]);

  let newStatus = action === 'approve' ? (level === 3 ? 'approved' : `level${level}_approved`) : action;
  await supabaseClient.from("reports").update({ status: newStatus }).eq("id", store.activeReportId);

  await loadReports();
  window.closeModal("reportDetailModal");
}

export function openReportDetail(id) {
  const report = store.allReports.find(r => r.id === id);
  if (!report) return;

  store.activeReportId = id;
  document.getElementById("reportDetailTitle").textContent = report.title;
  document.getElementById("reportDetailClient").textContent = report.client_name || "N/A";
  document.getElementById("reportDetailType").textContent = report.type;
  document.getElementById("reportDetailContent").innerHTML = escapeHtml(report.content).replace(/\n/g, '<br>');

  // Approvals list
  const appList = document.getElementById("approvalList");
  if (appList) {
    appList.innerHTML = (report.report_approvals || []).map(app => `
      <div style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">
        <strong>${store.employeeNameById[app.approver_id] || 'User'}:</strong> ${app.action} - ${escapeHtml(app.comments || '')}
      </div>
    `).join("");
  }

  window.openModal("reportDetailModal");
}

window.reports = {
  loadReports,
  saveReport,
  openReportDetail,
  handleApprovalAction
};
