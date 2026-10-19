/**
 * SPTC Principal Executive & Governance Controller
 * Subramanian Polytechnic College (Rayavaram) - DOTE Code: 331
 * Author: Antigravity AI
 */

const Principal = {
  state: {
    currentTab: 'overview',
    overview: null,
    staff: [],
    students: [],
    filters: {
      staffSearch: '',
      staffDept: 'ALL',
      staffRole: 'ALL',
      studentSearch: '',
      studentDept: 'ALL',
      studentYear: 'ALL',
      studentStatus: 'ALL'
    },
    activeStaffModalMode: 'add', // 'add' | 'edit'
    activeStaffId: null,
    activeStudentModalMode: 'add', // 'add' | 'edit'
    activeStudentRegNo: null,
    deleteTarget: null // { type: 'staff'|'student', id: string, name: string }
  },

  // Format currency in Indian Rupees
  formatINR(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  },

  // Toast Notification System
  showToast(message, type = 'success') {
    const container = document.getElementById('principalToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    
    let iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    if (type === 'warning') iconName = 'alert-circle';
    if (type === 'info') iconName = 'info';

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.6rem;">
        <i data-lucide="${iconName}"></i>
        <span style="font-weight: 600; font-size: 0.875rem;">${message}</span>
      </div>
    `;

    container.appendChild(toast);
    if (window.initLucideIcons) window.initLucideIcons(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      setTimeout(() => toast.remove(), 250);
    }, 3800);
  },

  // Initialize Dashboard
  async init() {
    this.setupEventListeners();
    await this.refreshAllData();
  },

  // Fetch all necessary data from server
  async refreshAllData() {
    this.showLoadingState(true);
    try {
      const [overviewRes, staffRes, studentsRes] = await Promise.all([
        API.getPrincipalOverview(),
        API.getPrincipalStaff(),
        API.getStudents()
      ]);

      if (overviewRes && overviewRes.kpis) {
        this.state.overview = overviewRes;
        this.updateKpiCards(overviewRes.kpis);
      }

      if (Array.isArray(staffRes)) {
        this.state.staff = staffRes;
        const staffBadge = document.getElementById('tabCountStaff');
        if (staffBadge) staffBadge.textContent = staffRes.length;
      }

      if (Array.isArray(studentsRes)) {
        this.state.students = studentsRes;
        const studentBadge = document.getElementById('tabCountStudents');
        if (studentBadge) studentBadge.textContent = studentsRes.length;
      }

      this.renderCurrentTab();
    } catch (err) {
      console.error('Failed to load Principal data:', err);
      this.showToast('Failed to fetch institutional metrics. Please retry.', 'error');
    } finally {
      this.showLoadingState(false);
    }
  },

  // Update 4 Top KPI metric tiles
  updateKpiCards(kpis) {
    const elStudents = document.getElementById('kpiTotalStudents');
    const elStaff = document.getElementById('kpiTotalStaff');
    const elRevenue = document.getElementById('kpiTotalRevenue');
    const elDues = document.getElementById('kpiOutstandingDues');

    if (elStudents) elStudents.textContent = kpis.totalEnrolledStudents || 0;
    if (elStaff) elStaff.textContent = kpis.totalStaffMembers || 0;
    if (elRevenue) elRevenue.textContent = this.formatINR(kpis.totalFeesCollected);
    if (elDues) elDues.textContent = this.formatINR(kpis.totalOutstandingDues);

    const subStudents = document.getElementById('kpiSubStudents');
    if (subStudents && this.state.overview?.studentsBreakdown) {
      const b = this.state.overview.studentsBreakdown;
      subStudents.textContent = `Govt Quota: ${b.govtQuota || 0} • Mgt Quota: ${b.mgtQuota || 0}`;
    }

    const subStaff = document.getElementById('kpiSubStaff');
    if (subStaff && this.state.overview?.staffBreakdown) {
      const s = this.state.overview.staffBreakdown;
      subStaff.textContent = `HODs: ${s.hodCount || 0} • Faculty: ${s.facultyCount || 0} • Admin/Accounts: ${s.adminAccountsCount || 0}`;
    }
  },

  // Tab Switching
  switchTab(tabId) {
    this.state.currentTab = tabId;

    // Update active tab button style
    document.querySelectorAll('.principal-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    this.renderCurrentTab();
  },

  // Render current active tab content
  renderCurrentTab() {
    const container = document.getElementById('principalTabContent');
    if (!container) return;

    switch (this.state.currentTab) {
      case 'overview':
        this.renderOverviewTab(container);
        break;
      case 'staff':
        this.renderStaffTab(container);
        break;
      case 'students':
        this.renderStudentsTab(container);
        break;
      case 'departments':
        this.renderDepartmentsTab(container);
        break;
      case 'reports':
        this.renderReportsTab(container);
        break;
      default:
        this.renderOverviewTab(container);
    }

    if (window.initLucideIcons) {
      window.initLucideIcons(container);
    }
  },

  // ==========================================
  // TAB 1: EXECUTIVE OVERVIEW
  // ==========================================
  renderOverviewTab(container) {
    const ov = this.state.overview || {};
    const depts = ov.departmentSummary || [];
    const recentStudents = ov.recentEnrollments || [];
    const recentTx = ov.recentCollections || [];

    let deptRowsHtml = '';
    if (depts.length === 0) {
      deptRowsHtml = `<tr><td colspan="5" class="empty-state">No department statistics available</td></tr>`;
    } else {
      deptRowsHtml = depts.map(d => `
        <tr>
          <td>
            <div style="font-weight: 700; color: #0a2558;">${d.department}</div>
            <div style="font-size: 0.725rem; color: #64748b;">DOTE Approved • 3-Yr Diploma</div>
          </td>
          <td>
            <span class="dept-exec-code">${d.deptCode.toUpperCase()}</span>
          </td>
          <td>
            <div style="font-weight: 700; color: #1e293b;">${d.enrolledStudents} Students</div>
            <div style="font-size: 0.725rem; color: #64748b;">${d.hostellers} Hostellers • ${d.busUsers} Bus</div>
          </td>
          <td>
            <span class="role-badge role-faculty">${d.facultyCount} Faculty</span>
          </td>
          <td style="text-align: right;">
            <button class="btn-icon-action" onclick="Principal.filterByDepartment('${d.department}')">
              <i data-lucide="eye"></i> View Registry
            </button>
          </td>
        </tr>
      `).join('');
    }

    let recentStudentsHtml = '';
    if (recentStudents.length === 0) {
      recentStudentsHtml = `<div class="empty-state">No recent admissions found.</div>`;
    } else {
      recentStudentsHtml = recentStudents.map(s => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9;">
          <div>
            <div style="font-weight: 700; color: #0a2558; font-size: 0.885rem;">${s.name}</div>
            <div style="font-size: 0.75rem; color: #64748b;">Reg: ${s.regNo} • ${s.department} (Yr ${s.currentYear})</div>
          </div>
          <div style="text-align: right;">
            <span class="badge ${s.quota === 'Government' ? 'badge-primary' : 'badge-gold'}" style="font-size: 0.7rem;">${s.quota}</span>
            <div style="font-size: 0.7rem; color: #059669; margin-top: 2px;">Admitted: ${s.admissionNo}</div>
          </div>
        </div>
      `).join('');
    }

    let recentTxHtml = '';
    if (recentTx.length === 0) {
      recentTxHtml = `<div class="empty-state">No fee receipts recorded yet.</div>`;
    } else {
      recentTxHtml = recentTx.map(t => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9;">
          <div>
            <div style="font-weight: 700; color: #0a2558; font-size: 0.885rem;">${t.receiptNo} • ${t.studentName}</div>
            <div style="font-size: 0.75rem; color: #64748b;">${t.paymentMode} • ${t.date}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; color: #059669; font-size: 0.925rem;">${this.formatINR(t.amountPaid)}</div>
            <div style="font-size: 0.7rem; color: #64748b;">Cashier: ${t.cashierName || 'Accounts Desk'}</div>
          </div>
        </div>
      `).join('');
    }

    container.innerHTML = `
      <!-- Governance Actions Banner -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.5rem; margin-bottom: 1.75rem; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 42px; height: 42px; border-radius: 10px; background: #f3e8ff; color: #7c3aed; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
            <i data-lucide="crown"></i>
          </div>
          <div>
            <h3 style="font-family: var(--font-heading); font-size: 1.05rem; color: #0a2558; margin: 0;">Institutional Executive Oversight</h3>
            <p style="font-size: 0.775rem; color: #64748b; margin: 0;">Supervising 10 Staff Members &amp; ${this.state.students.length} Enrolled Diploma Students across 8 AICTE Programs</p>
          </div>
        </div>
        <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" onclick="Principal.openAddStaffModal()">
            <i data-lucide="user-plus"></i> + Add Faculty
          </button>
          <button class="btn btn-gold btn-sm" onclick="Principal.openAddStudentModal()">
            <i data-lucide="graduation-cap"></i> + Enroll Student
          </button>
          <button class="btn btn-outline btn-sm" onclick="Principal.refreshAllData()">
            <i data-lucide="refresh-cw"></i> Refresh
          </button>
        </div>
      </div>

      <!-- Main Overview Grid: Department Breakdown Left, Recent Activity Right -->
      <div style="display: grid; grid-template-columns: 1.7fr 1.3fr; gap: 1.5rem;" class="overview-responsive-grid">
        
        <!-- Left: Department Capacity & Faculty Strength -->
        <div class="governance-card" style="margin-bottom: 0;">
          <div class="governance-card-header">
            <h4 class="governance-card-title">
              <i data-lucide="building-2"></i> Departmental Academic Strength
            </h4>
            <span class="badge badge-primary">9 Departments</span>
          </div>
          <div class="governance-card-body" style="padding: 0;">
            <div style="overflow-x: auto;">
              <table class="table" style="margin: 0;">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Code</th>
                    <th>Students</th>
                    <th>Faculty</th>
                    <th style="text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${deptRowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Right: Recent Admissions & Fee Transactions Stream -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Recent Admissions -->
          <div class="governance-card" style="margin-bottom: 0;">
            <div class="governance-card-header">
              <h4 class="governance-card-title">
                <i data-lucide="user-check"></i> Recent Student Enrollments
              </h4>
              <button class="btn-icon-action" onclick="Principal.switchTab('students')">View All</button>
            </div>
            <div class="governance-card-body" style="padding: 1rem 1.25rem;">
              ${recentStudentsHtml}
            </div>
          </div>

          <!-- Recent Fee Receipts Stream -->
          <div class="governance-card" style="margin-bottom: 0;">
            <div class="governance-card-header">
              <h4 class="governance-card-title">
                <i data-lucide="receipt"></i> Recent Fee Collections (Cashier Desk)
              </h4>
              <a href="/transactions.html" class="btn-icon-action">Journal</a>
            </div>
            <div class="governance-card-body" style="padding: 1rem 1.25rem;">
              ${recentTxHtml}
            </div>
          </div>

        </div>

      </div>
    `;
  },

  // Helper from Overview to jump to filtered students
  filterByDepartment(deptName) {
    this.state.filters.studentDept = deptName;
    this.state.filters.staffDept = deptName;
    this.switchTab('students');
  },

  // ==========================================
  // TAB 2: STAFF & FACULTY DIRECTORY
  // ==========================================
  renderStaffTab(container) {
    const sSearch = this.state.filters.staffSearch.toLowerCase().trim();
    const sDept = this.state.filters.staffDept;
    const sRole = this.state.filters.staffRole;

    const filtered = this.state.staff.filter(st => {
      const matchSearch = !sSearch || 
        st.name.toLowerCase().includes(sSearch) || 
        st.username.toLowerCase().includes(sSearch) || 
        (st.title && st.title.toLowerCase().includes(sSearch)) || 
        (st.email && st.email.toLowerCase().includes(sSearch)) || 
        (st.phone && st.phone.includes(sSearch));

      const matchDept = sDept === 'ALL' || st.department === sDept;
      const matchRole = sRole === 'ALL' || st.role === sRole;

      return matchSearch && matchDept && matchRole;
    });

    let rowsHtml = '';
    if (filtered.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="7" class="empty-state">
            <i data-lucide="users" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
            No faculty or staff members match the selected filters.
          </td>
        </tr>
      `;
    } else {
      rowsHtml = filtered.map(st => {
        let roleBadgeClass = 'role-faculty';
        if (st.role === 'PRINCIPAL') roleBadgeClass = 'role-principal';
        else if (st.role === 'HOD') roleBadgeClass = 'role-hod';
        else if (st.role === 'CASHIER') roleBadgeClass = 'role-cashier';

        const isPrincipalSelf = st.role === 'PRINCIPAL' || st.username === 'principal';

        return `
          <tr>
            <td>
              <span style="font-family: monospace; font-weight: 700; color: #475569; background: #f1f5f9; padding: 0.2rem 0.45rem; border-radius: 4px;">${st.id}</span>
            </td>
            <td>
              <div style="font-weight: 700; color: #0a2558;">${st.name}</div>
              <div style="font-size: 0.775rem; color: #64748b;">${st.title || 'Faculty Member'}</div>
            </td>
            <td>
              <span style="font-size: 0.85rem; color: #334155; font-weight: 500;">${st.department}</span>
            </td>
            <td>
              <span class="role-badge ${roleBadgeClass}">${st.role}</span>
            </td>
            <td>
              <div style="font-size: 0.825rem; color: #0a2558; font-weight: 600;">${st.phone || '—'}</div>
              <div style="font-size: 0.725rem; color: #64748b;">${st.email || '—'}</div>
            </td>
            <td>
              <span class="status-pill ${st.status === 'Inactive' ? 'status-inactive' : (st.status === 'On Leave' ? 'status-leave' : 'status-active')}">
                ● ${st.status || 'Active'}
              </span>
            </td>
            <td>
              <div class="action-btn-group">
                <button class="btn-icon-action" onclick="Principal.openEditStaffModal('${st.id}')" title="Edit Staff Profile">
                  <i data-lucide="edit-3"></i> Edit
                </button>
                <button class="btn-icon-action" onclick="Principal.openResetPasswordModal('${st.id}')" title="Reset Staff Password">
                  <i data-lucide="key"></i> Password
                </button>
                ${!isPrincipalSelf ? `
                  <button class="btn-icon-action danger" onclick="Principal.confirmDeleteStaff('${st.id}', '${st.name.replace(/'/g, "\\'")}')" title="Remove Staff Member">
                    <i data-lucide="trash-2"></i>
                  </button>
                ` : `
                  <button class="btn-icon-action" disabled title="Principal Account is Master Guarded" style="opacity: 0.4; cursor: not-allowed;">
                    <i data-lucide="shield-check"></i>
                  </button>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    container.innerHTML = `
      <div class="governance-card">
        <div class="governance-card-header">
          <div>
            <h3 class="governance-card-title">
              <i data-lucide="users"></i> Faculty &amp; Staff Directory
            </h3>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0.2rem 0 0;">
              Total Registered: ${this.state.staff.length} Personnel • Displaying ${filtered.length} Records
            </p>
          </div>
          <div style="display: flex; gap: 0.65rem;">
            <button class="btn btn-outline btn-sm" onclick="Principal.exportStaffCsv()">
              <i data-lucide="download"></i> Export CSV
            </button>
            <button class="btn btn-primary btn-sm" onclick="Principal.openAddStaffModal()">
              <i data-lucide="user-plus"></i> + Add New Faculty / Staff
            </button>
          </div>
        </div>

        <div class="governance-card-body">
          <!-- Filter Controls -->
          <div class="filter-toolbar">
            <div class="search-box-wrap">
              <i data-lucide="search" class="search-box-icon"></i>
              <input type="text" placeholder="Search by faculty name, username, title, phone or email..." 
                value="${this.state.filters.staffSearch}" 
                oninput="Principal.handleStaffSearch(this.value)">
            </div>
            <div>
              <select class="form-control" style="font-size: 0.85rem; padding: 0.65rem 1rem;" onchange="Principal.handleStaffDeptFilter(this.value)">
                <option value="ALL">All Departments (9)</option>
                <option value="College Administration" ${sDept === 'College Administration' ? 'selected' : ''}>College Administration</option>
                <option value="Accounts & Fee Collection Office" ${sDept === 'Accounts & Fee Collection Office' ? 'selected' : ''}>Accounts & Fee Collection Office</option>
                <option value="Computer Engineering" ${sDept === 'Computer Engineering' ? 'selected' : ''}>Computer Engineering</option>
                <option value="Mechanical Engineering" ${sDept === 'Mechanical Engineering' ? 'selected' : ''}>Mechanical Engineering</option>
                <option value="Electrical & Electronics Engineering" ${sDept === 'Electrical & Electronics Engineering' ? 'selected' : ''}>Electrical & Electronics</option>
                <option value="Electronics & Communication Engineering" ${sDept === 'Electronics & Communication Engineering' ? 'selected' : ''}>Electronics & Communication</option>
                <option value="Civil Engineering" ${sDept === 'Civil Engineering' ? 'selected' : ''}>Civil Engineering</option>
                <option value="Artificial Intelligence & Machine Learning" ${sDept === 'Artificial Intelligence & Machine Learning' ? 'selected' : ''}>AI & Machine Learning</option>
                <option value="Biomedical Engineering" ${sDept === 'Biomedical Engineering' ? 'selected' : ''}>Biomedical Engineering</option>
                <option value="Medical Laboratory Technology" ${sDept === 'Medical Laboratory Technology' ? 'selected' : ''}>Medical Laboratory Tech</option>
              </select>
            </div>
            <div>
              <select class="form-control" style="font-size: 0.85rem; padding: 0.65rem 1rem;" onchange="Principal.handleStaffRoleFilter(this.value)">
                <option value="ALL">All Roles</option>
                <option value="PRINCIPAL" ${sRole === 'PRINCIPAL' ? 'selected' : ''}>Principal</option>
                <option value="HOD" ${sRole === 'HOD' ? 'selected' : ''}>Head of Department (HOD)</option>
                <option value="CASHIER" ${sRole === 'CASHIER' ? 'selected' : ''}>Accounts Officer / Cashier</option>
                <option value="FACULTY" ${sRole === 'FACULTY' ? 'selected' : ''}>Teaching Faculty</option>
              </select>
            </div>
          </div>

          <!-- Staff Table -->
          <div style="overflow-x: auto;">
            <table class="table">
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Faculty &amp; Title</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Contact Info</th>
                  <th>Status</th>
                  <th style="text-align: right;">Administrative Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  handleStaffSearch(val) {
    this.state.filters.staffSearch = val;
    this.renderStaffTab(document.getElementById('principalTabContent'));
    if (window.initLucideIcons) window.initLucideIcons(document.getElementById('principalTabContent'));
  },

  handleStaffDeptFilter(val) {
    this.state.filters.staffDept = val;
    this.renderStaffTab(document.getElementById('principalTabContent'));
    if (window.initLucideIcons) window.initLucideIcons(document.getElementById('principalTabContent'));
  },

  handleStaffRoleFilter(val) {
    this.state.filters.staffRole = val;
    this.renderStaffTab(document.getElementById('principalTabContent'));
    if (window.initLucideIcons) window.initLucideIcons(document.getElementById('principalTabContent'));
  },

  // ==========================================
  // TAB 3: STUDENT REGISTRY & FEES
  // ==========================================
  renderStudentsTab(container) {
    const qSearch = this.state.filters.studentSearch.toLowerCase().trim();
    const qDept = this.state.filters.studentDept;
    const qYear = this.state.filters.studentYear;
    const qStatus = this.state.filters.studentStatus;

    const filtered = this.state.students.filter(st => {
      const matchSearch = !qSearch ||
        st.name.toLowerCase().includes(qSearch) ||
        st.regNo.toLowerCase().includes(qSearch) ||
        (st.admissionNo && st.admissionNo.toLowerCase().includes(qSearch)) ||
        (st.parentName && st.parentName.toLowerCase().includes(qSearch));

      const matchDept = qDept === 'ALL' || st.department === qDept;
      const matchYear = qYear === 'ALL' || String(st.currentYear) === String(qYear);
      
      let matchStatus = true;
      if (qStatus === 'PAID') {
        matchStatus = (st.balanceDue !== undefined && st.balanceDue <= 0);
      } else if (qStatus === 'DUE') {
        matchStatus = (st.balanceDue === undefined || st.balanceDue > 0);
      }

      return matchSearch && matchDept && matchYear && matchStatus;
    });

    let rowsHtml = '';
    if (filtered.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="7" class="empty-state">
            <i data-lucide="graduation-cap" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
            No student records match the active filter criteria.
          </td>
        </tr>
      `;
    } else {
      rowsHtml = filtered.map(st => {
        const balance = st.balanceDue !== undefined ? st.balanceDue : (st.totalBilled ? st.totalBilled - (st.totalPaid || 0) : 0);
        const hasDue = balance > 0;

        return `
          <tr>
            <td>
              <div style="font-family: monospace; font-weight: 800; color: #0a2558; font-size: 0.95rem;">${st.regNo}</div>
              <div style="font-size: 0.725rem; color: #64748b;">Adm: ${st.admissionNo || 'SPTC/24/GEN'}</div>
            </td>
            <td>
              <div style="font-weight: 700; color: #0a2558;">${st.name}</div>
              <div style="font-size: 0.75rem; color: #64748b;">Parent: ${st.parentName || 'Guardian'} ${st.parentPhone ? '(' + st.parentPhone + ')' : ''}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: #1e293b; font-size: 0.85rem;">${st.department}</div>
              <div style="font-size: 0.75rem; color: #64748b;">Year ${st.currentYear} • Semester ${st.currentSemester || (st.currentYear * 2)}</div>
            </td>
            <td>
              <div>
                <span class="badge ${st.quota === 'Government' ? 'badge-primary' : 'badge-gold'}" style="font-size: 0.7rem;">${st.quota}</span>
              </div>
              <div style="font-size: 0.725rem; color: #475569; margin-top: 3px;">
                ${st.isHosteller ? '🏢 Hosteller' : `🚌 ${st.busRoute || 'Day Scholar'}`}
              </div>
            </td>
            <td>
              <div style="font-weight: 800; font-size: 0.9rem; color: ${hasDue ? '#d97706' : '#059669'};">
                ${hasDue ? this.formatINR(balance) + ' Due' : '✓ Fees Cleared'}
              </div>
              <div style="font-size: 0.725rem; color: #64748b;">
                Paid: ${this.formatINR(st.totalPaid || 0)}
              </div>
            </td>
            <td>
              <span class="status-pill ${st.status === 'Discontinued' ? 'status-inactive' : 'status-active'}">
                ● ${st.status || 'Active'}
              </span>
            </td>
            <td>
              <div class="action-btn-group">
                <button class="btn-icon-action" onclick="Principal.openAuditLedgerModal('${st.regNo}')" title="Inspect Full Fee Ledger & Verified Receipts">
                  <i data-lucide="file-text"></i> Audit Ledger
                </button>
                <button class="btn-icon-action" onclick="Principal.openEditStudentModal('${st.regNo}')" title="Edit Student Profile">
                  <i data-lucide="edit-3"></i>
                </button>
                <button class="btn-icon-action danger" onclick="Principal.confirmDeleteStudent('${st.regNo}', '${st.name.replace(/'/g, "\\'")}')" title="Delete Student Record">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    container.innerHTML = `
      <div class="governance-card">
        <div class="governance-card-header">
          <div>
            <h3 class="governance-card-title">
              <i data-lucide="graduation-cap"></i> Student Registry &amp; Fee Status
            </h3>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0.2rem 0 0;">
              Total Enrolled: ${this.state.students.length} Students • Displaying ${filtered.length} Filtered Records
            </p>
          </div>
          <div style="display: flex; gap: 0.65rem;">
            <button class="btn btn-outline btn-sm" onclick="Principal.exportStudentsCsv()">
              <i data-lucide="download"></i> Export Registry (CSV)
            </button>
            <button class="btn btn-gold btn-sm" onclick="Principal.openAddStudentModal()">
              <i data-lucide="user-plus"></i> + Enroll New Student
            </button>
          </div>
        </div>

        <div class="governance-card-body">
          <!-- Student Filter Toolbar -->
          <div class="filter-toolbar">
            <div class="search-box-wrap">
              <i data-lucide="search" class="search-box-icon"></i>
              <input type="text" placeholder="Search by student name, DOTE reg no, admission no, parent name..." 
                value="${this.state.filters.studentSearch}" 
                oninput="Principal.handleStudentSearch(this.value)">
            </div>
            <div>
              <select class="form-control" style="font-size: 0.85rem; padding: 0.65rem 1rem;" onchange="Principal.handleStudentDeptFilter(this.value)">
                <option value="ALL">All Departments</option>
                <option value="Computer Engineering" ${qDept === 'Computer Engineering' ? 'selected' : ''}>Computer Engineering</option>
                <option value="Mechanical Engineering" ${qDept === 'Mechanical Engineering' ? 'selected' : ''}>Mechanical Engineering</option>
                <option value="Electrical & Electronics Engineering" ${qDept === 'Electrical & Electronics Engineering' ? 'selected' : ''}>Electrical & Electronics</option>
                <option value="Electronics & Communication Engineering" ${qDept === 'Electronics & Communication Engineering' ? 'selected' : ''}>Electronics & Communication</option>
                <option value="Civil Engineering" ${qDept === 'Civil Engineering' ? 'selected' : ''}>Civil Engineering</option>
                <option value="Artificial Intelligence & Machine Learning" ${qDept === 'Artificial Intelligence & Machine Learning' ? 'selected' : ''}>AI & Machine Learning</option>
                <option value="Biomedical Engineering" ${qDept === 'Biomedical Engineering' ? 'selected' : ''}>Biomedical Engineering</option>
                <option value="Medical Laboratory Technology" ${qDept === 'Medical Laboratory Technology' ? 'selected' : ''}>Medical Laboratory Tech</option>
              </select>
            </div>
            <div>
              <select class="form-control" style="font-size: 0.85rem; padding: 0.65rem 1rem;" onchange="Principal.handleStudentYearFilter(this.value)">
                <option value="ALL">All Academic Years</option>
                <option value="1" ${qYear === '1' ? 'selected' : ''}>1st Year (Sem 1 & 2)</option>
                <option value="2" ${qYear === '2' ? 'selected' : ''}>2nd Year (Sem 3 & 4)</option>
                <option value="3" ${qYear === '3' ? 'selected' : ''}>3rd Year (Sem 5 & 6)</option>
              </select>
            </div>
            <div>
              <select class="form-control" style="font-size: 0.85rem; padding: 0.65rem 1rem;" onchange="Principal.handleStudentStatusFilter(this.value)">
                <option value="ALL">All Fee Status</option>
                <option value="DUE" ${qStatus === 'DUE' ? 'selected' : ''}>Outstanding Balance Due</option>
                <option value="PAID" ${qStatus === 'PAID' ? 'selected' : ''}>Fully Cleared (Paid)</option>
              </select>
            </div>
          </div>

          <!-- Students Table -->
          <div style="overflow-x: auto;">
            <table class="table">
              <thead>
                <tr>
                  <th>DOTE Reg No</th>
                  <th>Student &amp; Parent</th>
                  <th>Department &amp; Year</th>
                  <th>Quota &amp; Residence</th>
                  <th>Fee Position</th>
                  <th>Status</th>
                  <th style="text-align: right;">Administrative Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  handleStudentSearch(val) {
    this.state.filters.studentSearch = val;
    this.renderStudentsTab(document.getElementById('principalTabContent'));
    if (window.initLucideIcons) window.initLucideIcons(document.getElementById('principalTabContent'));
  },

  handleStudentDeptFilter(val) {
    this.state.filters.studentDept = val;
    this.renderStudentsTab(document.getElementById('principalTabContent'));
    if (window.initLucideIcons) window.initLucideIcons(document.getElementById('principalTabContent'));
  },

  handleStudentYearFilter(val) {
    this.state.filters.studentYear = val;
    this.renderStudentsTab(document.getElementById('principalTabContent'));
    if (window.initLucideIcons) window.initLucideIcons(document.getElementById('principalTabContent'));
  },

  handleStudentStatusFilter(val) {
    this.state.filters.studentStatus = val;
    this.renderStudentsTab(document.getElementById('principalTabContent'));
    if (window.initLucideIcons) window.initLucideIcons(document.getElementById('principalTabContent'));
  },

  // ==========================================
  // TAB 4: ACADEMIC DEPARTMENTS
  // ==========================================
  renderDepartmentsTab(container) {
    const deptsList = [
      {
        name: 'Computer Engineering',
        code: 'CSE',
        doteCode: '1052',
        hod: 'Mr. K. Senthil Kumar, M.E.',
        phone: '9788123456',
        desc: 'Advanced software development, cloud networking, cyber security, and database engineering laboratories.'
      },
      {
        name: 'Mechanical Engineering',
        code: 'MECH',
        doteCode: '1020',
        hod: 'Mr. P. Muthukumar, M.E.',
        phone: '9842789012',
        desc: 'CNC machinery, thermal engineering, robotics, CAD/CAM drafting, and state-of-the-art manufacturing workshops.'
      },
      {
        name: 'Electrical & Electronics Engineering',
        code: 'EEE',
        doteCode: '1030',
        hod: 'Tmt. P. Chithraleka, M.E.',
        phone: '9443210987',
        desc: 'Power electronics, electric vehicle drives, high voltage machinery, and renewable solar installations.'
      },
      {
        name: 'Electronics & Communication Engineering',
        code: 'ECE',
        doteCode: '1040',
        hod: 'Mr. V. Arumugam, B.Tech.',
        phone: '9842998877',
        desc: 'VLSI design, embedded microcontrollers, IoT sensor telemetry, and modern telecommunication systems.'
      },
      {
        name: 'Civil Engineering',
        code: 'CIVIL',
        doteCode: '1010',
        hod: 'Mr. S. Sathiyamoorthy, B.E.',
        phone: '9488112233',
        desc: 'Structural engineering, total station GPS surveying, geotechnical analysis, and concrete strength testing.'
      },
      {
        name: 'Artificial Intelligence & Machine Learning',
        code: 'AIML',
        doteCode: '1054',
        hod: 'Dr. R. Ramasamy, M.E., Ph.D.',
        phone: '9842145611',
        desc: 'Deep learning neural models, computer vision systems, natural language processing, and automation algorithms.'
      },
      {
        name: 'Biomedical Engineering',
        code: 'BME',
        doteCode: '1075',
        hod: 'Mr. M. Suthir, B.E.',
        phone: '9790445566',
        desc: 'Medical instrumentation, biosignal analysis, patient monitoring equipment, and hospital healthcare technology.'
      },
      {
        name: 'Medical Laboratory Technology',
        code: 'MLT',
        doteCode: '1080',
        hod: 'Tmt. S. Vijayalakshmi, B.E.',
        phone: '9894778899',
        desc: 'Clinical biochemistry, hematological diagnostics, pathology culture analysis, and biomedical instrumentation.'
      }
    ];

    const cardsHtml = deptsList.map(d => {
      const studentCount = this.state.students.filter(s => s.department === d.name).length;
      const facultyCount = this.state.staff.filter(s => s.department === d.name).length;

      return `
        <div class="dept-exec-card">
          <div class="dept-exec-header">
            <div>
              <span class="dept-exec-code">DOTE CODE: ${d.doteCode}</span>
              <h4 style="font-family: var(--font-heading); font-size: 1.15rem; color: #0a2558; margin: 0.4rem 0 0.2rem;">${d.name}</h4>
              <span class="badge badge-primary" style="font-size: 0.7rem;">${d.code}</span>
            </div>
          </div>
          <p style="font-size: 0.8rem; color: #64748b; line-height: 1.5; margin-bottom: 1rem;">
            ${d.desc}
          </p>
          <div style="background: #f8fafc; border-radius: 8px; padding: 0.75rem 1rem; border: 1px solid #e2e8f0; margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Head of Department</div>
            <div style="font-weight: 700; color: #0a2558; font-size: 0.885rem; margin-top: 2px;">${d.hod}</div>
            <div style="font-size: 0.75rem; color: #475569;">📞 ${d.phone}</div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 0.75rem;">
            <div style="font-size: 0.8rem; color: #475569;">
              <strong>${studentCount}</strong> Students • <strong>${facultyCount}</strong> Faculty
            </div>
            <button class="btn-icon-action" onclick="Principal.filterByDepartment('${d.name}')">
              <i data-lucide="arrow-right"></i> Open
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="governance-card">
        <div class="governance-card-header">
          <div>
            <h3 class="governance-card-title">
              <i data-lucide="layers"></i> Academic Departments &amp; Laboratories
            </h3>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0.2rem 0 0;">
              8 AICTE Approved 3-Year Diploma Programs under Directorate of Technical Education (DOTE TN)
            </p>
          </div>
          <a href="/departments.html" target="_blank" class="btn btn-outline btn-sm">
            <i data-lucide="external-link"></i> Public Departments Page
          </a>
        </div>
        <div class="governance-card-body">
          <div class="dept-summary-grid">
            ${cardsHtml}
          </div>
        </div>
      </div>
    `;
  },

  // ==========================================
  // TAB 5: REPORTS & COMPLIANCE
  // ==========================================
  renderReportsTab(container) {
    const kpis = this.state.overview?.kpis || {};
    const students = this.state.students || [];
    const staff = this.state.staff || [];

    const govtCount = students.filter(s => s.quota === 'Government').length;
    const mgtCount = students.filter(s => s.quota === 'Management').length;
    const hostellerCount = students.filter(s => s.isHosteller).length;
    const busCount = students.filter(s => !s.isHosteller).length;

    container.innerHTML = `
      <div class="governance-card">
        <div class="governance-card-header">
          <div>
            <h3 class="governance-card-title">
              <i data-lucide="file-check"></i> Institutional Compliance &amp; Executive Summary
            </h3>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0.2rem 0 0;">
              Audited data report for DOTE Tamil Nadu, AICTE Mandatory Disclosure &amp; Governing Council Review
            </p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.print()">
            <i data-lucide="printer"></i> Print Executive Audit
          </button>
        </div>

        <div class="governance-card-body">
          <!-- Institutional Profile -->
          <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem;">
              <div>
                <span class="kpi-label-text">Institution Name</span>
                <div style="font-weight: 800; color: #0a2558; font-size: 1rem; margin-top: 0.25rem;">Subramanian Polytechnic College</div>
                <div style="font-size: 0.775rem; color: #64748b;">Rayavaram, Pudukkottai – 622 506</div>
              </div>
              <div>
                <span class="kpi-label-text">Regulatory Affiliation</span>
                <div style="font-weight: 800; color: #0a2558; font-size: 1rem; margin-top: 0.25rem;">DOTE Code: 331</div>
                <div style="font-size: 0.775rem; color: #64748b;">AICTE Permanent Institute ID: 1-475294121</div>
              </div>
              <div>
                <span class="kpi-label-text">Principal In-Charge</span>
                <div style="font-weight: 800; color: #0a2558; font-size: 1rem; margin-top: 0.25rem;">Thiru. R. Ramaswamy, M.E., M.B.A.</div>
                <div style="font-size: 0.775rem; color: #64748b;">Principal &amp; Ex-Officio Trustee</div>
              </div>
            </div>
          </div>

          <!-- Academic & Admission Distribution -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 1.25rem 1.5rem;">
              <h4 style="font-family: var(--font-heading); color: #0a2558; font-size: 1.05rem; margin-bottom: 1rem;">
                <i data-lucide="pie-chart"></i> Admission Quota Distribution
              </h4>
              <div style="display: flex; justify-content: space-between; padding: 0.65rem 0; border-bottom: 1px solid #f1f5f9;">
                <span style="color: #475569;">Government Single Window Quota</span>
                <strong style="color: #0a2558;">${govtCount} Students (${students.length ? Math.round((govtCount/students.length)*100) : 0}%)</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 0.65rem 0; border-bottom: 1px solid #f1f5f9;">
                <span style="color: #475569;">Management Quota</span>
                <strong style="color: #0a2558;">${mgtCount} Students (${students.length ? Math.round((mgtCount/students.length)*100) : 0}%)</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 0.65rem 0;">
                <span style="color: #475569;">Hostel vs Day Scholar</span>
                <strong style="color: #0a2558;">${hostellerCount} Hostel • ${busCount} Bus</strong>
              </div>
            </div>

            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 1.25rem 1.5rem;">
              <h4 style="font-family: var(--font-heading); color: #0a2558; font-size: 1.05rem; margin-bottom: 1rem;">
                <i data-lucide="credit-card"></i> Financial Collection Performance
              </h4>
              <div style="display: flex; justify-content: space-between; padding: 0.65rem 0; border-bottom: 1px solid #f1f5f9;">
                <span style="color: #475569;">Total Revenue Collected</span>
                <strong style="color: #059669;">${this.formatINR(kpis.totalFeesCollected)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 0.65rem 0; border-bottom: 1px solid #f1f5f9;">
                <span style="color: #475569;">Outstanding Pending Dues</span>
                <strong style="color: #dc2626;">${this.formatINR(kpis.totalOutstandingDues)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 0.65rem 0;">
                <span style="color: #475569;">Cashier Collection Efficiency</span>
                <strong style="color: #0a2558;">
                  ${(kpis.totalFeesCollected && (kpis.totalFeesCollected + kpis.totalOutstandingDues) > 0)
                    ? Math.round((kpis.totalFeesCollected / (kpis.totalFeesCollected + kpis.totalOutstandingDues)) * 100)
                    : 100}%
                </strong>
              </div>
            </div>
          </div>

          <!-- Quick Actions & Exports -->
          <div style="display: flex; gap: 0.85rem; justify-content: flex-end; flex-wrap: wrap;">
            <button class="btn btn-outline btn-sm" onclick="Principal.exportStaffCsv()">
              <i data-lucide="file-spreadsheet"></i> Export Staff Directory (CSV)
            </button>
            <button class="btn btn-outline btn-sm" onclick="Principal.exportStudentsCsv()">
              <i data-lucide="file-spreadsheet"></i> Export Student Registry (CSV)
            </button>
            <a href="/transactions.html" class="btn btn-primary btn-sm">
              <i data-lucide="book-open"></i> Full Transactions Journal
            </a>
          </div>
        </div>
      </div>
    `;
  },

  // ==========================================
  // MODALS: STAFF MANAGEMENT
  // ==========================================
  openAddStaffModal() {
    this.state.activeStaffModalMode = 'add';
    this.state.activeStaffId = null;

    document.getElementById('staffModalTitle').innerHTML = `
      <i data-lucide="user-plus"></i> Add New Faculty / Staff Member
    `;
    document.getElementById('staffForm').reset();
    document.getElementById('staffUsernameGroup').style.display = 'block';
    document.getElementById('staffPasswordGroup').style.display = 'block';
    document.getElementById('staffUsernameInput').disabled = false;
    document.getElementById('staffPasswordInput').required = true;

    this.openModal('staffModal');
  },

  openEditStaffModal(staffId) {
    const staff = this.state.staff.find(s => s.id === staffId);
    if (!staff) {
      this.showToast('Staff member not found', 'error');
      return;
    }

    this.state.activeStaffModalMode = 'edit';
    this.state.activeStaffId = staffId;

    document.getElementById('staffModalTitle').innerHTML = `
      <i data-lucide="edit-3"></i> Edit Staff Profile: ${staff.name}
    `;

    document.getElementById('staffNameInput').value = staff.name || '';
    document.getElementById('staffTitleInput').value = staff.title || '';
    document.getElementById('staffDeptSelect').value = staff.department || 'Computer Engineering';
    document.getElementById('staffRoleSelect').value = staff.role || 'FACULTY';
    document.getElementById('staffPhoneInput').value = staff.phone || '';
    document.getElementById('staffEmailInput').value = staff.email || '';
    document.getElementById('staffStatusSelect').value = staff.status || 'Active';

    // Hide username / password on regular profile edit
    document.getElementById('staffUsernameGroup').style.display = 'none';
    document.getElementById('staffPasswordGroup').style.display = 'none';
    document.getElementById('staffPasswordInput').required = false;

    this.openModal('staffModal');
  },

  async handleStaffFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveStaffBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const payload = {
      name: document.getElementById('staffNameInput').value.trim(),
      title: document.getElementById('staffTitleInput').value.trim(),
      department: document.getElementById('staffDeptSelect').value,
      role: document.getElementById('staffRoleSelect').value,
      phone: document.getElementById('staffPhoneInput').value.trim(),
      email: document.getElementById('staffEmailInput').value.trim(),
      status: document.getElementById('staffStatusSelect').value
    };

    try {
      if (this.state.activeStaffModalMode === 'add') {
        payload.username = document.getElementById('staffUsernameInput').value.trim();
        payload.password = document.getElementById('staffPasswordInput').value.trim();

        if (!payload.username || !payload.password) {
          this.showToast('Username and password are required for new staff', 'error');
          btn.disabled = false;
          btn.textContent = 'Save Faculty';
          return;
        }

        const res = await API.createStaff(payload);
        if (res.success) {
          this.showToast(res.message || 'Staff member created successfully.');
          this.closeModal('staffModal');
          await this.refreshAllData();
        } else {
          this.showToast(res.error || 'Failed to create staff member.', 'error');
        }
      } else {
        const res = await API.updateStaff(this.state.activeStaffId, payload);
        if (res.success) {
          this.showToast(res.message || 'Staff profile updated successfully.');
          this.closeModal('staffModal');
          await this.refreshAllData();
        } else {
          this.showToast(res.error || 'Failed to update staff profile.', 'error');
        }
      }
    } catch (err) {
      console.error('Save staff error:', err);
      this.showToast('Server error while saving staff.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Faculty';
    }
  },

  openResetPasswordModal(staffId) {
    const staff = this.state.staff.find(s => s.id === staffId);
    if (!staff) return;

    this.state.activeStaffId = staffId;
    document.getElementById('resetStaffTargetName').textContent = `${staff.name} (${staff.username})`;
    document.getElementById('newStaffPasswordInput').value = '';

    this.openModal('resetStaffPasswordModal');
  },

  async handleResetPasswordSubmit(e) {
    e.preventDefault();
    const newPass = document.getElementById('newStaffPasswordInput').value.trim();
    if (!newPass || newPass.length < 4) {
      this.showToast('Password must be at least 4 characters long', 'warning');
      return;
    }

    const btn = document.getElementById('submitResetPasswordBtn');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
      const res = await API.resetStaffPassword(this.state.activeStaffId, newPass);
      if (res.success) {
        this.showToast(res.message || 'Password reset successfully.');
        this.closeModal('resetStaffPasswordModal');
      } else {
        this.showToast(res.error || 'Failed to reset password.', 'error');
      }
    } catch (err) {
      this.showToast('Server error while resetting password.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Reset Password';
    }
  },

  confirmDeleteStaff(staffId, staffName) {
    this.state.deleteTarget = {
      type: 'staff',
      id: staffId,
      name: staffName
    };

    document.getElementById('deleteConfirmMessage').innerHTML = `
      Are you sure you want to remove <strong>${staffName}</strong> (ID: <code>${staffId}</code>) from the institutional faculty directory?
      <br><br>
      <span style="color: #dc2626; font-size: 0.8rem;">Note: This will revoke their access to internal college systems.</span>
    `;

    this.openModal('deleteConfirmModal');
  },

  // ==========================================
  // MODALS: STUDENT MANAGEMENT
  // ==========================================
  openAddStudentModal() {
    this.state.activeStudentModalMode = 'add';
    this.state.activeStudentRegNo = null;

    document.getElementById('studentModalTitle').innerHTML = `
      <i data-lucide="user-plus"></i> Enroll New Student
    `;
    document.getElementById('studentForm').reset();
    document.getElementById('studentRegNoInput').disabled = false;
    document.getElementById('studentAnnualTuitionGroup').style.display = 'block';

    this.openModal('studentModal');
  },

  openEditStudentModal(regNo) {
    const student = this.state.students.find(s => s.regNo === regNo);
    if (!student) {
      this.showToast('Student record not found', 'error');
      return;
    }

    this.state.activeStudentModalMode = 'edit';
    this.state.activeStudentRegNo = regNo;

    document.getElementById('studentModalTitle').innerHTML = `
      <i data-lucide="edit-3"></i> Edit Student Profile: ${student.name}
    `;

    document.getElementById('studentRegNoInput').value = student.regNo;
    document.getElementById('studentRegNoInput').disabled = true;
    document.getElementById('studentNameInput').value = student.name || '';
    document.getElementById('studentDeptSelect').value = student.department || 'Computer Engineering';
    document.getElementById('studentYearSelect').value = student.currentYear || 1;
    document.getElementById('studentSemSelect').value = student.currentSemester || 1;
    document.getElementById('studentQuotaSelect').value = student.quota || 'Government';
    document.getElementById('studentAdmissionNoInput').value = student.admissionNo || '';
    document.getElementById('studentHostellerCheck').checked = !!student.isHosteller;
    document.getElementById('studentBusRouteInput').value = student.busRoute || '';
    document.getElementById('studentParentNameInput').value = student.parentName || '';
    document.getElementById('studentParentPhoneInput').value = student.parentPhone || '';
    document.getElementById('studentEmailInput').value = student.email || '';
    document.getElementById('studentConcessionSelect').value = student.concessionType || 'None';
    document.getElementById('studentConcessionAmountInput').value = student.concessionAmount || 0;
    document.getElementById('studentStatusSelect').value = student.status || 'Active';

    // Hide tuition fee on basic profile edit
    document.getElementById('studentAnnualTuitionGroup').style.display = 'none';

    this.openModal('studentModal');
  },

  async handleStudentFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveStudentBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const payload = {
      regNo: document.getElementById('studentRegNoInput').value.trim(),
      name: document.getElementById('studentNameInput').value.trim(),
      department: document.getElementById('studentDeptSelect').value,
      currentYear: parseInt(document.getElementById('studentYearSelect').value) || 1,
      currentSemester: parseInt(document.getElementById('studentSemSelect').value) || 1,
      quota: document.getElementById('studentQuotaSelect').value,
      admissionNo: document.getElementById('studentAdmissionNoInput').value.trim(),
      isHosteller: document.getElementById('studentHostellerCheck').checked,
      busRoute: document.getElementById('studentBusRouteInput').value.trim(),
      parentName: document.getElementById('studentParentNameInput').value.trim(),
      parentPhone: document.getElementById('studentParentPhoneInput').value.trim(),
      email: document.getElementById('studentEmailInput').value.trim(),
      concessionType: document.getElementById('studentConcessionSelect').value,
      concessionAmount: parseFloat(document.getElementById('studentConcessionAmountInput').value) || 0,
      status: document.getElementById('studentStatusSelect').value
    };

    try {
      if (this.state.activeStudentModalMode === 'add') {
        payload.annualTuitionFee = parseFloat(document.getElementById('studentTuitionInput').value) || 14000;
        const res = await API.enrollStudent(payload);
        if (res.success) {
          this.showToast(res.message || 'Student enrolled successfully.');
          this.closeModal('studentModal');
          await this.refreshAllData();
        } else {
          this.showToast(res.error || 'Failed to enroll student.', 'error');
        }
      } else {
        const res = await API.updateStudent(this.state.activeStudentRegNo, payload);
        if (res.success) {
          this.showToast(res.message || 'Student profile updated successfully.');
          this.closeModal('studentModal');
          await this.refreshAllData();
        } else {
          this.showToast(res.error || 'Failed to update student.', 'error');
        }
      }
    } catch (err) {
      console.error('Save student error:', err);
      this.showToast('Server error while saving student record.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Student';
    }
  },

  confirmDeleteStudent(regNo, studentName) {
    this.state.deleteTarget = {
      type: 'student',
      id: regNo,
      name: studentName
    };

    document.getElementById('deleteConfirmMessage').innerHTML = `
      Are you sure you want to delete student <strong>${studentName}</strong> (DOTE Reg: <code>${regNo}</code>)?
      <br><br>
      <span style="color: #dc2626; font-size: 0.8rem;">Warning: All associated fee bills and student profile records will be permanently removed.</span>
    `;

    this.openModal('deleteConfirmModal');
  },

  async executeDelete() {
    const target = this.state.deleteTarget;
    if (!target) return;

    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.textContent = 'Deleting...';

    try {
      if (target.type === 'staff') {
        const res = await API.deleteStaff(target.id);
        if (res.success) {
          this.showToast(res.message || 'Staff removed successfully.');
        } else {
          this.showToast(res.error || 'Failed to delete staff.', 'error');
        }
      } else if (target.type === 'student') {
        const res = await API.deleteStudent(target.id);
        if (res.success) {
          this.showToast(res.message || 'Student deleted successfully.');
        } else {
          this.showToast(res.error || 'Failed to delete student.', 'error');
        }
      }

      this.closeModal('deleteConfirmModal');
      await this.refreshAllData();
    } catch (err) {
      this.showToast('Error executing delete action.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirm Delete';
      this.state.deleteTarget = null;
    }
  },

  // ==========================================
  // MODAL: AUDIT STUDENT LEDGER
  // ==========================================
  async openAuditLedgerModal(regNo) {
    this.openModal('studentAuditModal');
    const container = document.getElementById('studentAuditBody');
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem;">
        <i data-lucide="loader-2" class="spin-icon" style="font-size: 2rem; color: #7c3aed; margin-bottom: 0.75rem;"></i>
        <p style="color: #64748b; font-weight: 600;">Fetching student fee ledger and verified payment records...</p>
      </div>
    `;
    if (window.initLucideIcons) window.initLucideIcons(container);

    try {
      const ledger = await API.getStudentLedger(regNo);
      if (ledger.error || !ledger.student) {
        container.innerHTML = `<div class="empty-state">${ledger.error || 'Failed to retrieve ledger.'}</div>`;
        return;
      }

      const s = ledger.student;
      const billedItems = ledger.billedItems || [];
      const receipts = ledger.receipts || [];
      const balance = ledger.balanceDue || 0;
      const isCleared = balance <= 0;

      let billsHtml = billedItems.map(b => `
        <tr>
          <td><strong>${b.semester}</strong><div style="font-size: 0.725rem; color: #64748b;">${b.academicYear}</div></td>
          <td>${this.formatINR(b.tuitionFee)}</td>
          <td>${this.formatINR(b.labFee)}</td>
          <td>${this.formatINR(b.busFee)}</td>
          <td>${this.formatINR(b.hostelFee)}</td>
          <td style="color: #dc2626;">-${this.formatINR(b.concession)}</td>
          <td style="font-weight: 800; color: #0a2558;">${this.formatINR(b.netPayable)}</td>
        </tr>
      `).join('');

      let receiptsHtml = receipts.map(r => `
        <tr>
          <td>
            <strong style="color: #0a2558;">${r.receiptNo}</strong>
            <div style="font-size: 0.725rem; color: #64748b;">${r.date}</div>
          </td>
          <td>${r.semester || 'All Semesters'}</td>
          <td><span class="badge badge-primary">${r.paymentMode}</span></td>
          <td style="font-weight: 800; color: #059669;">${this.formatINR(r.amountPaid)}</td>
          <td style="font-size: 0.775rem; color: #475569;">${r.collectedBy || 'Accounts Desk'}</td>
        </tr>
      `).join('');

      if (receipts.length === 0) {
        receiptsHtml = `<tr><td colspan="5" class="empty-state">No payment receipts issued yet.</td></tr>`;
      }

      container.innerHTML = `
        <!-- Student Header Summary -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-size: 0.775rem; text-transform: uppercase; color: #64748b; font-weight: 700;">DOTE REGISTRATION NO: ${s.regNo}</div>
            <h3 style="font-family: var(--font-heading); color: #0a2558; font-size: 1.25rem; margin: 0.2rem 0;">${s.name}</h3>
            <div style="font-size: 0.8rem; color: #475569;">
              ${s.department} • Year ${s.currentYear} (${s.quota} Quota) • ${s.isHosteller ? '🏢 Hosteller' : `🚌 ${s.busRoute || 'Day Scholar'}`}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Outstanding Fee Status</div>
            <div style="font-family: var(--font-heading); font-size: 1.45rem; font-weight: 800; color: ${isCleared ? '#059669' : '#dc2626'};">
              ${isCleared ? '✓ Cleared (₹0)' : this.formatINR(balance) + ' Pending'}
            </div>
            <span class="badge ${isCleared ? 'badge-primary' : 'badge-gold'}" style="margin-top: 3px;">
              ${isCleared ? 'Eligible for DOTE Exam Hall Ticket' : 'Accounts Dues Notice Active'}
            </span>
          </div>
        </div>

        <!-- 3 Metric Cards for this student -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; text-align: center;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">TOTAL BILLED FEES</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #0a2558; margin-top: 2px;">${this.formatINR(ledger.totalBilled)}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; text-align: center;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">TOTAL PAID</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #059669; margin-top: 2px;">${this.formatINR(ledger.totalPaid)}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; text-align: center;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">NET BALANCE DUE</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: ${isCleared ? '#059669' : '#dc2626'}; margin-top: 2px;">${this.formatINR(balance)}</div>
          </div>
        </div>

        <!-- Billed Items Table -->
        <h4 style="font-family: var(--font-heading); color: #0a2558; font-size: 1.05rem; margin-bottom: 0.65rem;">
          Semester Fee Billing Schedule
        </h4>
        <div style="overflow-x: auto; margin-bottom: 1.5rem;">
          <table class="table" style="font-size: 0.85rem;">
            <thead>
              <tr>
                <th>Semester</th>
                <th>Tuition</th>
                <th>Lab / Workshop</th>
                <th>Bus / Transport</th>
                <th>Hostel / Mess</th>
                <th>Concession</th>
                <th>Net Payable</th>
              </tr>
            </thead>
            <tbody>
              ${billsHtml}
            </tbody>
          </table>
        </div>

        <!-- Receipts History Table -->
        <h4 style="font-family: var(--font-heading); color: #0a2558; font-size: 1.05rem; margin-bottom: 0.65rem;">
          Verified Payment Receipts Issued
        </h4>
        <div style="overflow-x: auto;">
          <table class="table" style="font-size: 0.85rem;">
            <thead>
              <tr>
                <th>Receipt No &amp; Date</th>
                <th>Term</th>
                <th>Mode</th>
                <th>Amount Paid</th>
                <th>Issued By</th>
              </tr>
            </thead>
            <tbody>
              ${receiptsHtml}
            </tbody>
          </table>
        </div>
      `;

      if (window.initLucideIcons) window.initLucideIcons(container);
    } catch (err) {
      container.innerHTML = `<div class="empty-state">Error loading student ledger.</div>`;
    }
  },

  // ==========================================
  // EXPORT UTILITIES (CSV)
  // ==========================================
  exportStaffCsv() {
    const headers = ['Staff ID', 'Name', 'Title', 'Department', 'Role', 'Phone', 'Email', 'Status'];
    const rows = this.state.staff.map(s => [
      s.id,
      `"${s.name}"`,
      `"${s.title || ''}"`,
      `"${s.department || ''}"`,
      s.role,
      s.phone || '',
      s.email || '',
      s.status || 'Active'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SPTC_Staff_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    this.showToast('Faculty & Staff CSV downloaded.');
  },

  exportStudentsCsv() {
    const headers = ['DOTE Reg No', 'Admission No', 'Name', 'Department', 'Year', 'Semester', 'Quota', 'Hosteller', 'Parent Name', 'Parent Phone', 'Total Billed', 'Total Paid', 'Balance Due', 'Status'];
    const rows = this.state.students.map(s => [
      s.regNo,
      s.admissionNo || '',
      `"${s.name}"`,
      `"${s.department || ''}"`,
      s.currentYear,
      s.currentSemester || '',
      s.quota || 'Government',
      s.isHosteller ? 'YES' : 'NO',
      `"${s.parentName || ''}"`,
      s.parentPhone || '',
      s.totalBilled || 0,
      s.totalPaid || 0,
      s.balanceDue !== undefined ? s.balanceDue : ((s.totalBilled || 0) - (s.totalPaid || 0)),
      s.status || 'Active'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SPTC_Student_Registry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    this.showToast('Student Registry CSV downloaded.');
  },

  // Modal helpers
  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add('active');
      document.body.style.overflow = 'hidden';
      if (window.initLucideIcons) window.initLucideIcons(el);
    }
  },

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  showLoadingState(loading) {
    // Can toggle loading indicators if needed
  },

  setupEventListeners() {
    // Tab buttons
    document.querySelectorAll('.principal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // Close modals on backdrop click or close button
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.classList.contains('close-modal-btn')) {
          overlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    });

    // Escape key closes modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
          m.classList.remove('active');
        });
        document.body.style.overflow = '';
      }
    });

    // Form Submissions
    const staffForm = document.getElementById('staffForm');
    if (staffForm) staffForm.addEventListener('submit', (e) => this.handleStaffFormSubmit(e));

    const resetPassForm = document.getElementById('resetStaffPasswordForm');
    if (resetPassForm) resetPassForm.addEventListener('submit', (e) => this.handleResetPasswordSubmit(e));

    const studentForm = document.getElementById('studentForm');
    if (studentForm) studentForm.addEventListener('submit', (e) => this.handleStudentFormSubmit(e));

    const deleteBtn = document.getElementById('confirmDeleteBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => this.executeDelete());
  }
};

window.Principal = Principal;
