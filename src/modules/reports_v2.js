import { supabaseClient } from '../config/supabase.js';
import { store } from '../state/store_v2.js';
import { escapeHtml } from '../utils/appUtils.js';

/**
 * REPORTS MODULE — BASIC ENGINE
 */

export async function loadReports() {
  const container = document.getElementById('reportsGrid');
  if (!container) return;

  container.innerHTML = '<div class="loading-state">Generating reports...</div>';

  try {
    // 1. Fetch Summary Data
    const { data: tasks } = await supabaseClient.from('tasks').select('status, priority');
    const { data: leads } = await supabaseClient.from('leads').select('status');
    const { data: clients } = await supabaseClient.from('clients').select('status');

    // 2. Calculate Stats
    const stats = {
      tasks: {
        total: tasks?.length || 0,
        completed: tasks?.filter(t => t.status === 'completed').length || 0,
        pending: tasks?.filter(t => t.status !== 'completed').length || 0,
      },
      leads: {
        total: leads?.length || 0,
        closed: leads?.filter(l => l.status === 'closed').length || 0,
        new: leads?.filter(l => l.status === 'new').length || 0,
      },
      clients: {
        total: clients?.length || 0,
        active: clients?.filter(c => c.status === 'active').length || 0,
      }
    };

    renderReports(stats);
  } catch (err) {
    console.error("[Reports] Load failed:", err);
    container.innerHTML = '<div class="error-state">Failed to load reports.</div>';
  }
}

function renderReports(stats) {
  const container = document.getElementById('reportsGrid');
  if (!container) return;

  const taskCompletion = stats.tasks.total > 0 ? Math.round((stats.tasks.completed / stats.tasks.total) * 100) : 0;
  const leadConversion = stats.leads.total > 0 ? Math.round((stats.leads.closed / stats.leads.total) * 100) : 0;

  container.innerHTML = `
    <div class="reports-dashboard">
      <!-- Row 1: Summary Cards -->
      <div class="reports-row">
        <div class="report-card">
          <div class="report-card-icon" style="background: #e0f2fe; color: #0369a1;">📊</div>
          <div class="report-card-data">
            <h4>Task Completion</h4>
            <div class="report-card-value">${taskCompletion}%</div>
            <div class="report-card-footer">${stats.tasks.completed} / ${stats.tasks.total} tasks done</div>
          </div>
        </div>
        <div class="report-card">
          <div class="report-card-icon" style="background: #f0fdf4; color: #15803d;">🤝</div>
          <div class="report-card-data">
            <h4>Lead Conversion</h4>
            <div class="report-card-value">${leadConversion}%</div>
            <div class="report-card-footer">${stats.leads.closed} leads closed</div>
          </div>
        </div>
        <div class="report-card">
          <div class="report-card-icon" style="background: #fef2f2; color: #b91c1c;">🚀</div>
          <div class="report-card-data">
            <h4>Active Clients</h4>
            <div class="report-card-value">${stats.clients.active}</div>
            <div class="report-card-footer">Currently managed</div>
          </div>
        </div>
      </div>

      <!-- Row 2: Charts/Breakdown (Simulated) -->
      <div class="reports-row" style="margin-top: 24px;">
        <div class="report-box" style="flex: 2;">
          <div class="report-box-header">
            <h3>Recent Performance</h3>
            <span>Last 30 Days</span>
          </div>
          <div class="report-box-content">
            <div style="height: 200px; display: flex; align-items: flex-end; gap: 12px; padding: 20px 0;">
              <!-- Simulated Bar Chart -->
              <div class="bar" style="height: 60%; flex: 1; background: #3b82f6; border-radius: 4px 4px 0 0;"></div>
              <div class="bar" style="height: 80%; flex: 1; background: #3b82f6; border-radius: 4px 4px 0 0;"></div>
              <div class="bar" style="height: 45%; flex: 1; background: #3b82f6; border-radius: 4px 4px 0 0;"></div>
              <div class="bar" style="height: 90%; flex: 1; background: #2563eb; border-radius: 4px 4px 0 0;"></div>
              <div class="bar" style="height: 70%; flex: 1; background: #3b82f6; border-radius: 4px 4px 0 0;"></div>
              <div class="bar" style="height: 85%; flex: 1; background: #3b82f6; border-radius: 4px 4px 0 0;"></div>
              <div class="bar" style="height: 100%; flex: 1; background: #2563eb; border-radius: 4px 4px 0 0;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; padding-top: 8px;">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
          </div>
        </div>
        <div class="report-box" style="flex: 1;">
          <div class="report-box-header">
            <h3>Leads Pipeline</h3>
          </div>
          <div class="report-box-content">
             <div class="pipeline-item">
               <span>New Leads</span>
               <span class="val">${stats.leads.new}</span>
             </div>
             <div class="pipeline-item">
               <span>Qualified</span>
               <span class="val">${Math.round(stats.leads.total * 0.4)}</span>
             </div>
             <div class="pipeline-item">
               <span>Converted</span>
               <span class="val">${stats.leads.closed}</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
