/**
 * SPTC Head of Department (HOD) Portal Controller
 * Subramanian Polytechnic College (Rayavaram) - DOTE Code: 331
 * Group students by batches (3 years) & Manage Students (Add / Edit)
 */

const HOD = {
  state: {
    user: null,
    department: 'Computer Engineering',
    overview: null,
    students: [],
    batches: {
      year1: null,
      year2: null,
      year3: null
    },
    activeViewMode: 'batches', // 'batches' | 'list'
    filters: {
      search: '',
      year: 'ALL',
      quota: 'ALL',
      status: 'ALL'
    },
    modalMode: 'add', // 'add' | 'edit'
    activeStudentRegNo: null,
    availableDepartments: [
      { code: 'CSE', name: 'Computer Engineering' },
      { code: 'MECH', name: 'Mechanical Engineering' },
      { code: 'EEE', name: 'Electrical & Electronics Engineering' },
      { code: 'ECE', name: 'Electronics & Communication Engineering' },
      { code: 'CIVIL', name: 'Civil Engineering' },
      { code: 'AIML', name: 'Artificial Intelligence & Machine Learning' },
      { code: 'BME', name: 'Biomedical Engineering' },
      { code: 'MLT', name: 'Medical Laboratory Technology' }
    ]
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
    const container = document.getElementById('hodToastContainer');
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

  // Initialize HOD Portal
  async init(userSession) {
    this.state.user = userSession;
    const rawDept = userSession.department || userSession.profile?.department || 'Computer Engineering';
    this.state.department = rawDept;

    this.setupEventListeners();
    await this.refreshAllData();
  },

  // Fetch department overview and students
  async refreshAllData() {
    this.showLoading(true);
    try {
      const data = await API.getHodOverview(this.state.department);
      if (data && data.success) {
        this.state.overview = data;
        this.state.students = data.students || [];
        this.state.batches = data.batches || {};
        this.state.department = data.department || this.state.department;

        this.updateHeaderProfile();
        this.updateKpiTiles();
        this.renderMainContent();
      } else {
        this.showToast(data.error || 'Failed to load department records.', 'error');
      }
    } catch (err) {
      console.error('HOD data refresh error:', err);
      this.showToast('Could not connect to institutional server.', 'error');
    } finally {
      this.showLoading(false);
    }
  },

  // Update Header with HOD Name and Department
  updateHeaderProfile() {
    const ov = this.state.overview;
    const u = this.state.user;
    const name = ov?.hodName || u?.name || u?.profile?.name || 'Head of Department';
    const dept = ov?.department || this.state.department;

    const elTitle = document.getElementById('hodHeroTitle');
    if (elTitle) elTitle.innerHTML = `<i data-lucide="book-open"></i> Department of ${dept}`;

    const elDesc = document.getElementById('hodHeroDesc');
    if (elDesc) elDesc.textContent = `HOD: ${name} • DOTE Code: 331 • 3-Year Diploma Batches, Student Enrolment, and Academic Records Governance.`;

    const elBadge = document.getElementById('hodHeaderBadge');
    if (elBadge) {
      elBadge.innerHTML = `
        <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #1e40af); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem;">
          ${name.charAt(0)}
        </div>
        <div style="line-height: 1.15; text-align: left;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #071739; display: flex; align-items: center; gap: 0.4rem;">
            <span>${name}</span>
            <span class="role-badge" style="background: #dbeafe; color: #1e40af; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 800;">HOD</span>
          </div>
          <div style="font-size: 0.7rem; color: #64748b;">${dept}</div>
        </div>
      `;
    }

    // If Principal viewing, show department switcher dropdown
    const isPrincipal = (u?.role === 'PRINCIPAL' || u?.profile?.role === 'PRINCIPAL');
    const deptSwitchContainer = document.getElementById('hodDeptSwitchWrap');
    if (deptSwitchContainer) {
      if (isPrincipal) {
        deptSwitchContainer.style.display = 'block';
        const select = document.getElementById('hodDeptSelectDropdown');
        if (select) {
          select.value = dept;
        }
      } else {
        deptSwitchContainer.style.display = 'none';
      }
    }
  },

  // Update Top KPI Cards
  updateKpiTiles() {
    const ov = this.state.overview;
    const b = this.state.batches;

    const elTotal = document.getElementById('kpiTotalDeptStudents');
    if (elTotal) elTotal.textContent = ov?.totalStudents || 0;

    const elSubTotal = document.getElementById('kpiSubTotalStudents');
    if (elSubTotal) {
      const gQuota = (b.year1?.govtQuota || 0) + (b.year2?.govtQuota || 0) + (b.year3?.govtQuota || 0);
      const mQuota = (b.year1?.mgtQuota || 0) + (b.year2?.mgtQuota || 0) + (b.year3?.mgtQuota || 0);
      elSubTotal.textContent = `Govt: ${gQuota} • Mgt: ${mQuota}`;
    }

    const elY1 = document.getElementById('kpiBatch1Count');
    if (elY1) elY1.textContent = b.year1?.count || 0;

    const elY2 = document.getElementById('kpiBatch2Count');
    if (elY2) elY2.textContent = b.year2?.count || 0;

    const elY3 = document.getElementById('kpiBatch3Count');
    if (elY3) elY3.textContent = b.year3?.count || 0;
  },

  // Switch between 3-Year Batches View and Flat List View
  switchViewMode(mode) {
    this.state.activeViewMode = mode;
    const btnBatches = document.getElementById('viewModeBtnBatches');
    const btnList = document.getElementById('viewModeBtnList');

    if (btnBatches) btnBatches.classList.toggle('active', mode === 'batches');
    if (btnList) btnList.classList.toggle('active', mode === 'list');

    this.renderMainContent();
  },

  // Render content according to activeViewMode
  renderMainContent() {
    const container = document.getElementById('hodMainContent');
    if (!container) return;

    if (this.state.activeViewMode === 'batches') {
      this.renderBatchesView(container);
    } else {
      this.renderListView(container);
    }

    if (window.initLucideIcons) window.initLucideIcons(container);
  },

  // ==========================================
  // VIEW 1: 3-YEAR BATCHES GROUPED VIEW
  // ==========================================
  renderBatchesView(container) {
    const b = this.state.batches;
    const q = this.state.filters.search.toLowerCase().trim();

    // Helper to filter students within a batch by search
    const filterBatchStudents = (list) => {
      if (!list) return [];
      if (!q) return list;
      return list.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.regNo.toLowerCase().includes(q) ||
        (s.admissionNo && s.admissionNo.toLowerCase().includes(q)) ||
        (s.parentName && s.parentName.toLowerCase().includes(q))
      );
    };

    const b3List = filterBatchStudents(b.year3?.students);
    const b2List = filterBatchStudents(b.year2?.students);
    const b1List = filterBatchStudents(b.year1?.students);

    container.innerHTML = `
      <!-- Toolbar with Search and Fast Actions -->
      <div class="view-mode-bar">
        <div class="search-box-wrap" style="flex: 1; max-width: 440px;">
          <i data-lucide="search" class="search-box-icon"></i>
          <input type="text" placeholder="Search students across all 3 batches by name, reg no, admission no..." 
            value="${this.state.filters.search}" 
            oninput="HOD.handleSearch(this.value)">
        </div>

        <div style="display: flex; gap: 0.65rem; align-items: center;">
          <div class="segmented-view-toggle">
            <button type="button" id="viewModeBtnBatches" class="segmented-view-btn active" onclick="HOD.switchViewMode('batches')">
              <i data-lucide="layers"></i> 3-Year Batches
            </button>
            <button type="button" id="viewModeBtnList" class="segmented-view-btn" onclick="HOD.switchViewMode('list')">
              <i data-lucide="list"></i> All Students List
            </button>
          </div>

          <button class="btn btn-outline btn-sm" onclick="HOD.exportCsv()">
            <i data-lucide="download"></i> Export Department CSV
          </button>
          <button class="btn btn-primary btn-sm" onclick="HOD.openAddStudentModal()">
            <i data-lucide="user-plus"></i> + Add Student
          </button>
        </div>
      </div>

      <!-- ================= BATCH 3: FINAL YEAR SENIORS ================= -->
      <div class="batch-section-card">
        <div class="batch-header batch-header-year3">
          <div class="batch-title-group">
            <h3>
              <i data-lucide="award" style="color: #7c3aed;"></i>
              ${b.year3?.batchLabel || 'Batch 2023–2026 (3rd Year Final)'}
            </h3>
            <p>Graduating Class • Semesters 5 &amp; 6 • Board Examination &amp; Campus Placements</p>
          </div>
          <div class="batch-meta-chips">
            <span class="batch-chip batch-chip-purple">
              <i data-lucide="users"></i> ${b.year3?.count || 0} Students
            </span>
            <span class="batch-chip batch-chip-purple">
              Govt: ${b.year3?.govtQuota || 0} | Mgt: ${b.year3?.mgtQuota || 0}
            </span>
            <button class="btn btn-sm btn-outline" style="border-color: #a855f7; color: #7c3aed;" onclick="HOD.openAddStudentModal(3)">
              <i data-lucide="user-plus"></i> + Add to Batch 2023–2026
            </button>
          </div>
        </div>

        ${this.renderBatchStudentsTable(b3List, 3)}
      </div>

      <!-- ================= BATCH 2: INTERMEDIATE YEAR ================= -->
      <div class="batch-section-card">
        <div class="batch-header batch-header-year2">
          <div class="batch-title-group">
            <h3>
              <i data-lucide="book-open" style="color: #2563eb;"></i>
              ${b.year2?.batchLabel || 'Batch 2024–2027 (2nd Year Intermediate)'}
            </h3>
            <p>Core Engineering Curriculum • Semesters 3 &amp; 4 • Practical Workshops &amp; Labs</p>
          </div>
          <div class="batch-meta-chips">
            <span class="batch-chip batch-chip-blue">
              <i data-lucide="users"></i> ${b.year2?.count || 0} Students
            </span>
            <span class="batch-chip batch-chip-blue">
              Govt: ${b.year2?.govtQuota || 0} | Mgt: ${b.year2?.mgtQuota || 0}
            </span>
            <button class="btn btn-sm btn-outline" style="border-color: #3b82f6; color: #1d4ed8;" onclick="HOD.openAddStudentModal(2)">
              <i data-lucide="user-plus"></i> + Add to Batch 2024–2027
            </button>
          </div>
        </div>

        ${this.renderBatchStudentsTable(b2List, 2)}
      </div>

      <!-- ================= BATCH 1: FRESHERS ================= -->
      <div class="batch-section-card">
        <div class="batch-header batch-header-year1">
          <div class="batch-title-group">
            <h3>
              <i data-lucide="sparkles" style="color: #059669;"></i>
              ${b.year1?.batchLabel || 'Batch 2025–2028 (1st Year Freshers)'}
            </h3>
            <p>Freshers Class • Semesters 1 &amp; 2 • Foundational Engineering &amp; Applied Sciences</p>
          </div>
          <div class="batch-meta-chips">
            <span class="batch-chip batch-chip-green">
              <i data-lucide="users"></i> ${b.year1?.count || 0} Students
            </span>
            <span class="batch-chip batch-chip-green">
              Govt: ${b.year1?.govtQuota || 0} | Mgt: ${b.year1?.mgtQuota || 0}
            </span>
            <button class="btn btn-sm btn-outline" style="border-color: #10b981; color: #047857;" onclick="HOD.openAddStudentModal(1)">
              <i data-lucide="user-plus"></i> + Add to Batch 2025–2028
            </button>
          </div>
        </div>

        ${this.renderBatchStudentsTable(b1List, 1)}
      </div>
    `;
  },

  // Render Table for a Specific Batch
  renderBatchStudentsTable(students, year) {
    if (!students || students.length === 0) {
      return `
        <div style="padding: 2.5rem 1.5rem; text-align: center; color: #64748b;">
          <i data-lucide="graduation-cap" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 0.5rem; display: block;"></i>
          No students currently enrolled in this 3-year batch.
          <div style="margin-top: 0.75rem;">
            <button class="btn btn-sm btn-primary" onclick="HOD.openAddStudentModal(${year})">
              <i data-lucide="user-plus"></i> Enroll Student into this Batch
            </button>
          </div>
        </div>
      `;
    }

    const rows = students.map(st => {
      const balance = st.balanceDue !== undefined ? st.balanceDue : 0;
      const hasDue = balance > 0;

      return `
        <tr>
          <td>
            <div style="font-family: monospace; font-weight: 800; color: #0c2340; font-size: 0.95rem;">${st.regNo}</div>
            <div style="font-size: 0.725rem; color: #64748b;">Adm: ${st.admissionNo || 'SPTC/DOTE'}</div>
          </td>
          <td>
            <div style="font-weight: 700; color: #0c2340;">${st.name}</div>
            <div style="font-size: 0.75rem; color: #64748b;">
              Parent: ${st.parentName || 'Guardian'} ${st.parentPhone ? '(' + st.parentPhone + ')' : ''}
            </div>
          </td>
          <td>
            <div>
              <span class="badge ${st.quota === 'Government' ? 'badge-primary' : 'badge-gold'}" style="font-size: 0.7rem;">
                ${st.quota}
              </span>
            </div>
            <div style="font-size: 0.725rem; color: #475569; margin-top: 3px;">
              ${st.isHosteller ? '🏢 Hosteller' : `🚌 ${st.busRoute || 'Day Scholar'}`}
            </div>
          </td>
          <td>
            <div style="font-weight: 700; font-size: 0.85rem; color: #1e293b;">
              Semester ${st.currentSemester || (year * 2 - 1)}
            </div>
            <div style="font-size: 0.725rem; color: #64748b;">
              ${st.concessionType && st.concessionType !== 'None' ? 'Waiver: ' + st.concessionType : 'Regular'}
            </div>
          </td>
          <td>
            <div style="font-weight: 800; font-size: 0.9rem; color: ${hasDue ? '#d97706' : '#059669'};">
              ${hasDue ? this.formatINR(balance) + ' Due' : '✓ Cleared'}
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
          <td style="text-align: right;">
            <div class="action-btn-group" style="justify-content: flex-end;">
              <button class="btn-icon-action" onclick="HOD.openEditStudentModal('${st.regNo}')" title="Edit Student Details">
                <i data-lucide="edit-3"></i> Edit
              </button>
              <button class="btn-icon-action" onclick="HOD.openAuditLedgerModal('${st.regNo}')" title="Inspect Fee Ledger & Receipts">
                <i data-lucide="file-text"></i> Ledger
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div style="overflow-x: auto;">
        <table class="table" style="margin-bottom: 0;">
          <thead>
            <tr>
              <th>DOTE Reg No</th>
              <th>Student &amp; Parent Details</th>
              <th>Quota &amp; Mode</th>
              <th>Academic Semester</th>
              <th>Fee Status</th>
              <th>Status</th>
              <th style="text-align: right;">Department Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  },

  // ==========================================
  // VIEW 2: FLAT ALL STUDENTS LIST VIEW
  // ==========================================
  renderListView(container) {
    const qSearch = this.state.filters.search.toLowerCase().trim();
    const qYear = this.state.filters.year;
    const qQuota = this.state.filters.quota;
    const qStatus = this.state.filters.status;

    const filtered = this.state.students.filter(st => {
      const matchSearch = !qSearch ||
        st.name.toLowerCase().includes(qSearch) ||
        st.regNo.toLowerCase().includes(qSearch) ||
        (st.admissionNo && st.admissionNo.toLowerCase().includes(qSearch)) ||
        (st.parentName && st.parentName.toLowerCase().includes(qSearch));

      const matchYear = qYear === 'ALL' || String(st.currentYear) === String(qYear);
      const matchQuota = qQuota === 'ALL' || st.quota === qQuota;

      let matchStatus = true;
      if (qStatus === 'PAID') {
        matchStatus = (st.balanceDue !== undefined && st.balanceDue <= 0);
      } else if (qStatus === 'DUE') {
        matchStatus = (st.balanceDue === undefined || st.balanceDue > 0);
      }

      return matchSearch && matchYear && matchQuota && matchStatus;
    });

    let rowsHtml = '';
    if (filtered.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="7" style="padding: 3rem 1.5rem; text-align: center; color: #64748b;">
            <i data-lucide="graduation-cap" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
            No students found matching your filter criteria.
          </td>
        </tr>
      `;
    } else {
      rowsHtml = filtered.map(st => {
        const balance = st.balanceDue !== undefined ? st.balanceDue : 0;
        const hasDue = balance > 0;
        const batchLabel = st.batch || `Batch ${st.currentYear === 3 ? '2023–2026' : (st.currentYear === 2 ? '2024–2027' : '2025–2028')}`;

        return `
          <tr>
            <td>
              <div style="font-family: monospace; font-weight: 800; color: #0c2340; font-size: 0.95rem;">${st.regNo}</div>
              <div style="font-size: 0.725rem; color: #64748b;">Adm: ${st.admissionNo || 'SPTC/DOTE'}</div>
            </td>
            <td>
              <div style="font-weight: 700; color: #0c2340;">${st.name}</div>
              <div style="font-size: 0.75rem; color: #64748b;">Parent: ${st.parentName || 'Guardian'} ${st.parentPhone ? '(' + st.parentPhone + ')' : ''}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: #1e293b; font-size: 0.85rem;">${batchLabel}</div>
              <div style="font-size: 0.725rem; color: #64748b;">Year ${st.currentYear} • Sem ${st.currentSemester || (st.currentYear * 2 - 1)}</div>
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
                ${hasDue ? this.formatINR(balance) + ' Due' : '✓ Cleared'}
              </div>
              <div style="font-size: 0.725rem; color: #64748b;">Paid: ${this.formatINR(st.totalPaid || 0)}</div>
            </td>
            <td>
              <span class="status-pill ${st.status === 'Discontinued' ? 'status-inactive' : 'status-active'}">
                ● ${st.status || 'Active'}
              </span>
            </td>
            <td style="text-align: right;">
              <div class="action-btn-group" style="justify-content: flex-end;">
                <button class="btn-icon-action" onclick="HOD.openEditStudentModal('${st.regNo}')" title="Edit Student Details">
                  <i data-lucide="edit-3"></i> Edit
                </button>
                <button class="btn-icon-action" onclick="HOD.openAuditLedgerModal('${st.regNo}')" title="Inspect Fee Ledger">
                  <i data-lucide="file-text"></i> Ledger
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    container.innerHTML = `
      <div class="view-mode-bar">
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; flex: 1;">
          <div class="search-box-wrap" style="flex: 1; min-width: 260px;">
            <i data-lucide="search" class="search-box-icon"></i>
            <input type="text" placeholder="Search by name, reg no, admission no..." 
              value="${this.state.filters.search}" 
              oninput="HOD.handleSearch(this.value)">
          </div>

          <div>
            <select class="form-control" style="font-size: 0.85rem; padding: 0.65rem 1rem;" onchange="HOD.handleYearFilter(this.value)">
              <option value="ALL">All Batches (3 Years)</option>
              <option value="1" ${qYear === '1' ? 'selected' : ''}>Batch 2025–2028 (1st Yr)</option>
              <option value="2" ${qYear === '2' ? 'selected' : ''}>Batch 2024–2027 (2nd Yr)</option>
              <option value="3" ${qYear === '3' ? 'selected' : ''}>Batch 2023–2026 (3rd Yr)</option>
            </select>
          </div>

          <div>
            <select class="form-control" style="font-size: 0.85rem; padding: 0.65rem 1rem;" onchange="HOD.handleQuotaFilter(this.value)">
              <option value="ALL">All Quotas</option>
              <option value="Government" ${qQuota === 'Government' ? 'selected' : ''}>Government Quota</option>
              <option value="Management" ${qQuota === 'Management' ? 'selected' : ''}>Management Quota</option>
            </select>
          </div>

          <div>
            <select class="form-control" style="font-size: 0.85rem; padding: 0.65rem 1rem;" onchange="HOD.handleStatusFilter(this.value)">
              <option value="ALL">All Fee Status</option>
              <option value="DUE" ${qStatus === 'DUE' ? 'selected' : ''}>Outstanding Balance Due</option>
              <option value="PAID" ${qStatus === 'PAID' ? 'selected' : ''}>Fully Cleared</option>
            </select>
          </div>
        </div>

        <div style="display: flex; gap: 0.65rem; align-items: center;">
          <div class="segmented-view-toggle">
            <button type="button" id="viewModeBtnBatches" class="segmented-view-btn" onclick="HOD.switchViewMode('batches')">
              <i data-lucide="layers"></i> 3-Year Batches
            </button>
            <button type="button" id="viewModeBtnList" class="segmented-view-btn active" onclick="HOD.switchViewMode('list')">
              <i data-lucide="list"></i> All Students List
            </button>
          </div>

          <button class="btn btn-outline btn-sm" onclick="HOD.exportCsv()">
            <i data-lucide="download"></i> Export CSV
          </button>
          <button class="btn btn-primary btn-sm" onclick="HOD.openAddStudentModal()">
            <i data-lucide="user-plus"></i> + Add Student
          </button>
        </div>
      </div>

      <div class="governance-card" style="background: #ffffff; border: 1.5px solid var(--hod-border); border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(12, 35, 64, 0.04);">
        <div style="overflow-x: auto;">
          <table class="table" style="margin-bottom: 0;">
            <thead>
              <tr>
                <th>DOTE Reg No</th>
                <th>Student &amp; Parent Details</th>
                <th>Batch &amp; Year</th>
                <th>Quota &amp; Residence</th>
                <th>Fee Status</th>
                <th>Status</th>
                <th style="text-align: right;">Department Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // Handlers for Filters
  handleSearch(val) {
    this.state.filters.search = val;
    this.renderMainContent();
  },

  handleYearFilter(val) {
    this.state.filters.year = val;
    this.renderMainContent();
  },

  handleQuotaFilter(val) {
    this.state.filters.quota = val;
    this.renderMainContent();
  },

  handleStatusFilter(val) {
    this.state.filters.status = val;
    this.renderMainContent();
  },

  handleDepartmentSwitch(dept) {
    this.state.department = dept;
    this.refreshAllData();
  },

  // Compute 3-Year Diploma Batch Label from Year
  computeBatchLabel(year) {
    const yr = parseInt(year) || 1;
    if (yr === 3) return 'Batch 2023–2026 (3rd Year Final)';
    if (yr === 2) return 'Batch 2024–2027 (2nd Year Intermediate)';
    return 'Batch 2025–2028 (1st Year Freshers)';
  },

  // Dynamic Batch Label update when year is changed in Modal
  onModalYearChange() {
    const yr = document.getElementById('hodStudentYearSelect').value;
    const batchInput = document.getElementById('hodStudentBatchInput');
    const semSelect = document.getElementById('hodStudentSemSelect');
    
    if (batchInput) {
      batchInput.value = this.computeBatchLabel(yr);
    }
    if (semSelect) {
      const defaultSem = parseInt(yr) * 2 - 1;
      semSelect.value = defaultSem;
    }
  },

  // Open Add Student Modal
  openAddStudentModal(defaultYear = 1) {
    this.state.modalMode = 'add';
    this.state.activeStudentRegNo = null;

    const modal = document.getElementById('hodStudentModal');
    const title = document.getElementById('hodStudentModalTitle');
    const form = document.getElementById('hodStudentForm');
    if (!modal || !form) return;

    form.reset();
    title.innerHTML = '<i data-lucide="user-plus"></i> Enroll Student in Department';

    // Lock department to HOD's department
    const deptInput = document.getElementById('hodStudentDeptInput');
    if (deptInput) deptInput.value = this.state.department;

    // Reg No enabled
    const regInput = document.getElementById('hodStudentRegNoInput');
    if (regInput) {
      regInput.readOnly = false;
      regInput.style.backgroundColor = '#ffffff';
    }

    // Set default year and batch
    const yearSelect = document.getElementById('hodStudentYearSelect');
    if (yearSelect) yearSelect.value = String(defaultYear);
    this.onModalYearChange();

    // Default tuition
    const tuitionInput = document.getElementById('hodStudentTuitionInput');
    if (tuitionInput) tuitionInput.value = '14000';

    modal.classList.add('active');
    if (window.initLucideIcons) window.initLucideIcons(modal);
  },

  // Open Edit Student Modal
  openEditStudentModal(regNo) {
    const student = this.state.students.find(s => s.regNo === regNo);
    if (!student) {
      this.showToast(`Student with Reg No ${regNo} not found.`, 'error');
      return;
    }

    this.state.modalMode = 'edit';
    this.state.activeStudentRegNo = regNo;

    const modal = document.getElementById('hodStudentModal');
    const title = document.getElementById('hodStudentModalTitle');
    if (!modal) return;

    title.innerHTML = `<i data-lucide="edit-3"></i> Edit Student: ${student.name} (${student.regNo})`;

    // Reg No locked in edit mode
    const regInput = document.getElementById('hodStudentRegNoInput');
    if (regInput) {
      regInput.value = student.regNo;
      regInput.readOnly = true;
      regInput.style.backgroundColor = '#f1f5f9';
    }

    document.getElementById('hodStudentAdmissionNoInput').value = student.admissionNo || '';
    document.getElementById('hodStudentNameInput').value = student.name || '';
    document.getElementById('hodStudentDeptInput').value = student.department || this.state.department;
    document.getElementById('hodStudentYearSelect').value = String(student.currentYear || 1);
    document.getElementById('hodStudentSemSelect').value = String(student.currentSemester || (student.currentYear * 2 - 1));
    document.getElementById('hodStudentBatchInput').value = student.batch || this.computeBatchLabel(student.currentYear);
    document.getElementById('hodStudentQuotaSelect').value = student.quota || 'Government';
    document.getElementById('hodStudentStatusSelect').value = student.status || 'Active';
    document.getElementById('hodStudentHostellerCheck').checked = !!student.isHosteller;
    document.getElementById('hodStudentBusRouteInput').value = student.busRoute || '';
    document.getElementById('hodStudentParentNameInput').value = student.parentName || '';
    document.getElementById('hodStudentParentPhoneInput').value = student.parentPhone || '';
    document.getElementById('hodStudentEmailInput').value = student.email || '';
    document.getElementById('hodStudentConcessionSelect').value = student.concessionType || 'None';
    document.getElementById('hodStudentTuitionInput').value = student.annualTuition || 14000;

    modal.classList.add('active');
    if (window.initLucideIcons) window.initLucideIcons(modal);
  },

  // Close Modal
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  // Save Student (Add or Edit)
  async handleStudentFormSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById('hodSubmitStudentBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="spin-icon"></i> Saving...`;

    const regNo = document.getElementById('hodStudentRegNoInput').value.trim();
    const name = document.getElementById('hodStudentNameInput').value.trim();
    const admissionNo = document.getElementById('hodStudentAdmissionNoInput').value.trim();
    const currentYear = parseInt(document.getElementById('hodStudentYearSelect').value) || 1;
    const currentSemester = parseInt(document.getElementById('hodStudentSemSelect').value) || (currentYear * 2 - 1);
    const batch = document.getElementById('hodStudentBatchInput').value.trim() || this.computeBatchLabel(currentYear);
    const quota = document.getElementById('hodStudentQuotaSelect').value;
    const status = document.getElementById('hodStudentStatusSelect').value;
    const isHosteller = document.getElementById('hodStudentHostellerCheck').checked;
    const busRoute = isHosteller ? 'Hosteller (No Bus)' : document.getElementById('hodStudentBusRouteInput').value.trim();
    const parentName = document.getElementById('hodStudentParentNameInput').value.trim();
    const parentPhone = document.getElementById('hodStudentParentPhoneInput').value.trim();
    const email = document.getElementById('hodStudentEmailInput').value.trim();
    const concessionType = document.getElementById('hodStudentConcessionSelect').value;
    const annualTuition = parseFloat(document.getElementById('hodStudentTuitionInput').value) || 14000;

    const payload = {
      regNo,
      name,
      admissionNo,
      department: this.state.department,
      currentYear,
      currentSemester,
      batch,
      quota,
      status,
      isHosteller,
      busRoute,
      parentName,
      parentPhone,
      email,
      concessionType,
      annualTuition
    };

    try {
      let res;
      if (this.state.modalMode === 'add') {
        res = await fetch('/api/hod/students', {
          method: 'POST',
          headers: API.getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        }).then(r => r.json());
      } else {
        res = await fetch(`/api/hod/students/${encodeURIComponent(regNo)}`, {
          method: 'PUT',
          headers: API.getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        }).then(r => r.json());
      }

      if (res && res.success) {
        this.closeModal('hodStudentModal');
        this.showToast(res.message || (this.state.modalMode === 'add' ? 'Student enrolled successfully!' : 'Student updated successfully!'), 'success');
        await this.refreshAllData();
      } else {
        this.showToast(res.error || 'Failed to save student details.', 'error');
      }
    } catch (err) {
      console.error('Save student error:', err);
      this.showToast('Network error while saving student details.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  // Open Audit Ledger Modal
  async openAuditLedgerModal(regNo) {
    const modal = document.getElementById('hodLedgerModal');
    const content = document.getElementById('hodLedgerModalContent');
    if (!modal || !content) return;

    modal.classList.add('active');
    content.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <i data-lucide="loader-2" class="spin-icon" style="font-size: 2rem; color: #2563eb;"></i>
        <p style="color: #64748b; margin-top: 0.5rem;">Loading verified student ledger...</p>
      </div>
    `;
    if (window.initLucideIcons) window.initLucideIcons(content);

    try {
      const data = await API.getStudentLedger(regNo);
      if (!data || !data.success) {
        content.innerHTML = `<div class="alert alert-danger">${data?.error || 'Could not load ledger'}</div>`;
        return;
      }

      const st = data.student;
      const bTotal = data.totalBilled || 0;
      const pTotal = data.totalPaid || 0;
      const due = data.balanceDue || 0;

      const billsHtml = (data.billedItems || []).map(b => `
        <tr>
          <td><div style="font-weight: 700;">${b.feeName}</div><small style="color: #64748b;">${b.category}</small></td>
          <td>${b.academicYear} / Sem ${b.semester}</td>
          <td style="font-weight: 700;">${this.formatINR(b.netPayable)}</td>
          <td><span class="badge ${b.status === 'Paid' ? 'badge-success' : 'badge-gold'}">${b.status}</span></td>
        </tr>
      `).join('') || '<tr><td colspan="4" style="text-align: center; color: #64748b;">No bills found.</td></tr>';

      const receiptsHtml = (data.receipts || []).map(r => `
        <tr>
          <td style="font-family: monospace; font-weight: 800; color: #0c2340;">${r.receiptNo}</td>
          <td>${r.date || 'N/A'}</td>
          <td style="font-weight: 700; color: #059669;">${this.formatINR(r.amount)}</td>
          <td><span class="badge badge-primary">${r.paymentMode || 'Cash'}</span></td>
          <td style="font-family: monospace; font-size: 0.7rem; color: #64748b;">${r.hash ? r.hash.substring(0, 16) + '...' : 'Verified'}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="text-align: center; color: #64748b;">No receipts issued yet.</td></tr>';

      content.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h4 style="font-family: var(--font-heading); color: #0c2340; margin: 0; font-size: 1.15rem;">
                ${st.name} <span style="font-family: monospace; font-size: 0.95rem; color: #2563eb;">(${st.regNo})</span>
              </h4>
              <p style="font-size: 0.8rem; color: #64748b; margin: 0.2rem 0 0;">
                ${st.department} • Year ${st.currentYear} • ${st.batch || HOD.computeBatchLabel(st.currentYear)}
              </p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <div style="text-align: right;">
                <small style="color: #64748b; font-size: 0.7rem; display: block;">OUTSTANDING BALANCE</small>
                <strong style="font-size: 1.2rem; color: ${due > 0 ? '#d97706' : '#059669'};">${this.formatINR(due)}</strong>
              </div>
            </div>
          </div>
        </div>

        <h5 style="color: #0c2340; font-weight: 800; margin: 1rem 0 0.5rem;">Fee Breakdown</h5>
        <div style="overflow-x: auto; margin-bottom: 1.5rem;">
          <table class="table" style="font-size: 0.85rem;">
            <thead>
              <tr><th>Fee Head</th><th>Term</th><th>Net Payable</th><th>Status</th></tr>
            </thead>
            <tbody>${billsHtml}</tbody>
          </table>
        </div>

        <h5 style="color: #0c2340; font-weight: 800; margin: 1rem 0 0.5rem;">Payment Receipts &amp; Cryptographic Verification</h5>
        <div style="overflow-x: auto;">
          <table class="table" style="font-size: 0.85rem;">
            <thead>
              <tr><th>Receipt No</th><th>Date</th><th>Amount Paid</th><th>Payment Mode</th><th>256-Bit SHA Hash</th></tr>
            </thead>
            <tbody>${receiptsHtml}</tbody>
          </table>
        </div>
      `;
      if (window.initLucideIcons) window.initLucideIcons(content);
    } catch (e) {
      console.error('Audit ledger error:', e);
      content.innerHTML = `<div class="alert alert-danger">Failed to fetch ledger details.</div>`;
    }
  },

  // Export CSV
  exportCsv() {
    const list = this.state.students;
    if (list.length === 0) {
      this.showToast('No student records to export.', 'warning');
      return;
    }

    const headers = ['DOTE Reg No', 'Admission No', 'Student Name', 'Department', 'Academic Year', 'Batch', 'Semester', 'Quota', 'Day Scholar / Hosteller', 'Parent Name', 'Parent Phone', 'Total Billed', 'Total Paid', 'Balance Due', 'Status'];
    const rows = list.map(s => [
      `"${s.regNo}"`,
      `"${s.admissionNo || ''}"`,
      `"${s.name}"`,
      `"${s.department}"`,
      s.currentYear,
      `"${s.batch || this.computeBatchLabel(s.currentYear)}"`,
      s.currentSemester,
      `"${s.quota}"`,
      s.isHosteller ? 'Hosteller' : 'Day Scholar',
      `"${s.parentName || ''}"`,
      `"${s.parentPhone || ''}"`,
      s.totalBilled || 0,
      s.totalPaid || 0,
      s.balanceDue || 0,
      `"${s.status || 'Active'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SPTC_${this.state.department.replace(/\s+/g, '_')}_Students_3YearBatches.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Department student registry exported successfully.', 'success');
  },

  // Setup Event Listeners and Modal Delegation
  setupEventListeners() {
    // Form submission
    const studentForm = document.getElementById('hodStudentForm');
    if (studentForm) {
      studentForm.addEventListener('submit', (e) => this.handleStudentFormSubmit(e));
    }

    // Modal close clicks with delegation
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('.close-modal-btn') || e.target.closest('.modal-close-btn');
      if (closeBtn) {
        const modal = closeBtn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
        return;
      }
      if (e.target.classList && e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
      }
    });

    // Escape key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      }
    });
  },

  showLoading(loading) {
    const el = document.getElementById('hodLoadingIndicator');
    if (el) el.style.display = loading ? 'block' : 'none';
  }
};

window.HOD = HOD;
