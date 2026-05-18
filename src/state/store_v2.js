/**
 * Centralized Application State Store
 * CLEAN RECOVERY VERSION
 */

export const store = {
  // Core App State
  selectedClientId: null,
  selectedCycle: null,
  currentUser: null,
  
  // System State
  currentUserId: null,
  currentUserRole: null, // Role Name (super_admin, ceo, etc)
  currentUserPermissions: [], // List of permission keys
  currentOrganizationId: null,
  currentView: 'leads',
  
  // Data Repositories
  allLeads: [],
  allClients: [],
  allTasks: [],
  allOrgUsers: [], 
  
  // Filters & UI State
  filters: {
    leads: {
      search: '',
      status: ''
    },
    tasks: {
      client: '',
      status: ''
    },
    calendar: { client: 'all' },
    planner: { date: new Date().toISOString().split('T')[0], department: '' }
  },
  
  // Role & Permission Helpers
  hasPermission(permKey) {
    if (this.currentUserRole === 'ceo') return true;
    return this.currentUserPermissions.includes(permKey);
  },

  isCEO() { return this.currentUserRole === 'ceo'; },
  isManager() { return this.currentUserRole === 'manager'; },
  isEmployee() { return this.currentUserRole === 'employee'; },
  isSales() { return this.currentUserRole === 'sales'; },
  
  isAdmin() { return this.isCEO(); },

  // Visibility Logic (Enterprise Standard)
  getVisibleTasks() {
    return this.allTasks.filter(task => {
      // 1. Tenant Isolation
      if (task.organization_id !== this.currentOrganizationId) return false;
      
      // 2. Ownership & Scope
      const isOwner = task.assigned_to === this.currentUserId || task.created_by === this.currentUserId;
      // If a manager does not have a department assigned, they have global department visibility
      const isDeptManager = this.isManager() && (!this.currentUser?.department_id || task.department_id === this.currentUser?.department_id);
      const isCEO = this.isCEO();

      return isOwner || isDeptManager || isCEO;
    });
  },

  // Hierarchy Tree Builder
  getOrgTree() {
    const users = this.allOrgUsers || [];
    const map = {};
    const tree = [];

    users.forEach(user => {
      map[user.id] = { ...user, children: [] };
    });

    users.forEach(user => {
      if (user.reports_to && map[user.reports_to]) {
        map[user.reports_to].children.push(map[user.id]);
      } else {
        tree.push(map[user.id]);
      }
    });

    return tree;
  },

  // State Machine Validation
  canTransition(from, to) {
    const allowed = {
      'todo': ['in_progress'],
      'in_progress': ['review_pending'],
      'review_pending': ['approved', 'revision_requested'],
      'revision_requested': ['in_progress'],
      'approved': ['completed'],
      'completed': []
    };
    return allowed[from]?.includes(to) || false;
  }
};
