/**
 * Analytics Module
 */
import { store } from '../state/store_v2.js';
import { escapeHtml, formatUserRole } from '../utils/appUtils.js';

export function generateFullAnalyticsDashboard() {
  const container = document.getElementById("analyticsView");
  if (!container) return;

  const totalLeads = (store.allLeads || []).length;
  const closedLeads = (store.allLeads || []).filter(l => l.status === 'closed').length;
  const leadConv = totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(1) : 0;
  
  const totalTasks = (store.allTasks || []).length;
  const doneTasks = (store.allTasks || []).filter(t => t.status === 'completed').length;
  const taskEff = totalTasks > 0 ? ((doneTasks / totalTasks) * 100).toFixed(1) : 0;

  const employeeRows = (store.allOrgUsers || []).map(emp => {
    const assignedLeads = (store.allLeads || []).filter(l => l.assigned_to === emp.id);
    const closedEmpLeads = assignedLeads.filter(l => l.status === 'closed').length;
    const empLeadConv = assignedLeads.length > 0 ? Math.round((closedEmpLeads / assignedLeads.length) * 100) : 0;

    const assignedTasks = (store.allTasks || []).filter(t => t.assigned_to === emp.id);
    const doneEmpTasks = assignedTasks.filter(t => t.status === 'completed').length;
    const empTaskEff = assignedTasks.length > 0 ? Math.round((doneEmpTasks / assignedTasks.length) * 100) : 0;

    return `
      <tr>
        <td>
          <strong>${escapeHtml(emp.full_name)}</strong> 
          <div style="margin-top: 4px;">
            <span class="role-badge role-${(emp.role || 'employee').replace('_', '-')}" style="font-size: 9px; padding: 2px 6px;">
              ${formatUserRole(emp.role, emp.tag)}
            </span>
          </div>
        </td>
        <td>${assignedLeads.length}</td>
        <td><span class="metric-pill">${empLeadConv}%</span></td>
        <td>${assignedTasks.length}</td>
        <td><span class="metric-pill">${empTaskEff}%</span></td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="analytics-header"><h2>Analytics Dashboard</h2></div>
    <div class="analytics-grid">
      <div class="analytics-card">
        <h4>CRM Pipeline</h4>
        <div style="font-size: 24px; font-weight: bold;">${leadConv}% <span style="font-size: 14px; color: #64748b;">Conv. Rate</span></div>
      </div>
      <div class="analytics-card">
        <h4>Task Efficiency</h4>
        <div style="font-size: 24px; font-weight: bold;">${taskEff}% <span style="font-size: 14px; color: #64748b;">Completion</span></div>
      </div>
    </div>
    <div class="analytics-card" style="margin-top: 20px;">
      <h4>Associate Matrix</h4>
      <table class="analytics-table">
        <thead><tr><th>Associate</th><th>Leads</th><th>Conv.</th><th>Tasks</th><th>Eff.</th></tr></thead>
        <tbody>${employeeRows}</tbody>
      </table>
    </div>
  `;
}
