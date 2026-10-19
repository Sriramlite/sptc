// ==========================================================================
// SPTC Cashier & Office Accounts Controller (Redesigned Institutional Desk)
// Subramanian Polytechnic College, Rayavaram (DOTE Institution: 331)
// ==========================================================================

const Cashier = {
  allStudents: [],
  filteredStudents: [],
  searchQuery: '',
  activeFilter: 'ALL', // 'ALL' | 'DUES' | 'SETTLED'
  selectedDept: 'ALL',
  recentTransactions: [],
  cashBookReport: null,
  activeStudentLedger: null,
  activeModalTab: 'feeSetup', // 'feeSetup' | 'history' | 'quickPay'

  async init() {
    await this.loadAllStudents();
    await this.loadRecentTransactions();
    await this.loadCashBookReport();
    this.renderCashierDesk();
  },

  async loadAllStudents() {
    try {
      const data = await API.getAllStudents();
      if (Array.isArray(data)) {
        this.allStudents = data;
        this.filteredStudents = [...data];
      } else {
        console.warn('getAllStudents returned non-array:', data);
        this.allStudents = [];
        this.filteredStudents = [];
      }
    } catch (err) {
      console.error('Error loading students for cashier:', err);
      this.allStudents = [];
      this.filteredStudents = [];
    }
  },

  async loadRecentTransactions() {
    try {
      // Fetch up to 10 recent transactions for the right-hand panel
      const res = await API.getTransactions({ page: 1, limit: 10 });
      if (res && res.success && Array.isArray(res.transactions)) {
        this.recentTransactions = res.transactions;
      } else {
        this.recentTransactions = [];
      }
    } catch (err) {
      console.error('Error loading recent transactions:', err);
      this.recentTransactions = [];
    }
  },

  async loadCashBookReport() {
    try {
      const report = await API.getCashBookReport();
      if (report && !report.error) {
        this.cashBookReport = report;
      }
    } catch (err) {
      console.error('Error loading cash book report:', err);
    }
  },

  // Main Dashboard Renderer
  renderCashierDesk() {
    const container = document.getElementById('cashierDeskContainer');
    if (!container) return;

    const totalStudents = this.allStudents.length;
    const studentsWithDues = this.allStudents.filter(s => (s.balanceDue || 0) > 0);
    const settledStudents = this.allStudents.filter(s => (s.balanceDue || 0) <= 0);
    const totalDuesAmount = studentsWithDues.reduce((sum, s) => sum + (s.balanceDue || 0), 0);
    const totalCollections = this.cashBookReport?.totalCollections || 
      this.allStudents.reduce((sum, s) => sum + (s.totalPaid || 0), 0);

    // Extract unique departments for filter dropdown
    const departments = Array.from(new Set(this.allStudents.map(s => s.department).filter(Boolean))).sort();
    const deptOptions = departments.map(d => `<option value="${d}">${d}</option>`).join('');

    // Quick POS student dropdown options
    const studentSelectOptions = this.allStudents.map(s => `
      <option value="${s.regNo}">
        ${s.regNo} - ${s.name} (${s.department} Yr ${s.currentYear}) - Due: ₹${(s.balanceDue || 0).toLocaleString('en-IN')}
      </option>
    `).join('');

    container.innerHTML = `
      <!-- 1. Quick Financial KPI Metrics Row -->
      <section class="cashier-metrics-strip">
        <div class="cashier-metric-tile">
          <div class="metric-icon-box metric-icon-green">
            <i data-lucide="wallet"></i>
          </div>
          <div>
            <div class="metric-data-title">Total Fee Collections</div>
            <div class="metric-data-value">₹${totalCollections.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div class="cashier-metric-tile">
          <div class="metric-icon-box metric-icon-blue">
            <i data-lucide="users"></i>
          </div>
          <div>
            <div class="metric-data-title">Enrolled Students</div>
            <div class="metric-data-value">${totalStudents} Students</div>
          </div>
        </div>

        <div class="cashier-metric-tile">
          <div class="metric-icon-box metric-icon-red">
            <i data-lucide="alert-circle"></i>
          </div>
          <div>
            <div class="metric-data-title">Pending Balances</div>
            <div class="metric-data-value">₹${totalDuesAmount.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div class="cashier-metric-tile">
          <div class="metric-icon-box metric-icon-gold">
            <i data-lucide="user-check"></i>
          </div>
          <div>
            <div class="metric-data-title">Students with Dues</div>
            <div class="metric-data-value">${studentsWithDues.length} of ${totalStudents}</div>
          </div>
        </div>
      </section>

      <!-- 2. Main Two-Column Cashier Grid -->
      <div class="cashier-desk-grid">
        <!-- LEFT COLUMN: Student Directory & Search Desk -->
        <div class="cashier-left-column">
          <div class="cashier-box">
            <div class="cashier-box-header">
              <h3 class="cashier-box-title">
                <i data-lucide="graduation-cap" style="color: var(--cashier-blue);"></i>
                Students Fee Directory
              </h3>
              <span class="badge badge-primary" id="studentResultsCountBadge">
                ${this.allStudents.length} Students
              </span>
            </div>

            <div class="cashier-box-body">
              <!-- Search Input with live icon -->
              <div class="student-search-bar">
                <i data-lucide="search" class="student-search-icon"></i>
                <input 
                  type="text" 
                  id="studentSearchInput" 
                  placeholder="Search students by Name, DOTE Reg No (e.g. 22201045), Department, or Year..." 
                  oninput="Cashier.onSearchInput(this.value)"
                  autocomplete="off"
                />
              </div>

              <!-- Filter Pills & Department Selector -->
              <div class="filter-pills-row">
                <button type="button" class="filter-pill active" id="filterPillAll" onclick="Cashier.setFilter('ALL')">
                  All Students (${totalStudents})
                </button>
                <button type="button" class="filter-pill" id="filterPillDues" onclick="Cashier.setFilter('DUES')">
                  Pending Dues (${studentsWithDues.length})
                </button>
                <button type="button" class="filter-pill" id="filterPillSettled" onclick="Cashier.setFilter('SETTLED')">
                  Settled (${settledStudents.length})
                </button>

                <div style="margin-left: auto; min-width: 160px;">
                  <select id="studentDeptFilter" class="form-control" style="padding: 0.35rem 0.65rem; font-size: 0.8rem;" onchange="Cashier.onDeptFilter(this.value)">
                    <option value="ALL">All Departments</option>
                    ${deptOptions}
                  </select>
                </div>
              </div>

              <!-- Students Scrollable Cards List -->
              <div class="students-scroll-list" id="studentsListContainer">
                <!-- Rendered dynamically by renderStudentList() -->
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Past Transactions (Last 10) + Quick POS + Legacy Migration -->
        <div class="cashier-right-column">
          <!-- Card A: Past Transactions (Last 10) -->
          <div class="cashier-box">
            <div class="cashier-box-header">
              <h3 class="cashier-box-title">
                <i data-lucide="receipt" style="color: var(--cashier-green);"></i>
                Past Transactions (Last 10)
              </h3>
              <span class="badge badge-gold" style="font-size: 0.725rem;">Live Feed</span>
            </div>

            <div class="cashier-box-body">
              <div class="recent-txns-list" id="recentTxnsContainer">
                <!-- Rendered dynamically by renderRecentTransactions() -->
              </div>

              <!-- Prominent "View More" button to open 20 rows/page page -->
              <div class="view-more-txns-wrap">
                <a href="/transactions.html" class="btn-view-more-txns" title="Open complete transactions journal paginated by 20 records per page">
                  <span>View More Transactions (20 per page)</span>
                  <i data-lucide="arrow-right"></i>
                </a>
              </div>
            </div>
          </div>

          <!-- Card B: Quick Counter Fee Collection POS -->
          <div class="cashier-box">
            <div class="cashier-box-header">
              <h3 class="cashier-box-title">
                <i data-lucide="banknote" style="color: var(--cashier-navy);"></i>
                Quick Counter Entry POS
              </h3>
            </div>
            <div class="cashier-box-body">
              <form id="quickCounterForm" onsubmit="Cashier.handleCounterPayment(event)">
                <div class="form-group">
                  <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Select Student:</label>
                  <select id="cashierStudentSelect" class="form-control" onchange="Cashier.onStudentSelect(this.value)" required>
                    <option value="">-- Choose Student --</option>
                    ${studentSelectOptions}
                  </select>
                </div>

                <div id="cashierStudentInfoBox" style="display: none; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.75rem 0.85rem; margin-bottom: 0.85rem;">
                  <!-- Dynamic selection summary -->
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                  <div class="form-group">
                    <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Amount (₹):</label>
                    <input type="number" id="cashierAmount" class="form-control" placeholder="Amount" min="1" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Mode:</label>
                    <select id="cashierPaymentMode" class="form-control" required>
                      <option value="Cash at Counter">Cash at Counter</option>
                      <option value="Office Counter QR UPI">Office Counter QR UPI</option>
                      <option value="Demand Draft (DD)">Demand Draft (DD)</option>
                      <option value="Bank Cheque">Bank Cheque</option>
                      <option value="NEFT / RTGS Challan">Bank NEFT / RTGS</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Voucher / Ref Number:</label>
                  <input type="text" id="cashierRefNo" class="form-control" placeholder="e.g. DD-041928 or Cash-Drawer" />
                </div>

                <button type="submit" class="btn btn-primary btn-block" id="collectFeeBtn">
                  <i data-lucide="printer"></i> Collect Fee &amp; Print Receipt
                </button>
              </form>
            </div>
          </div>

          <!-- Card C: Legacy Tally Migration Control -->
          <div class="cashier-box">
            <div class="cashier-box-header">
              <h3 class="cashier-box-title">
                <i data-lucide="download" style="color: #92400e;"></i>
                Legacy Tally XML Migration
              </h3>
            </div>
            <div class="cashier-box-body">
              <div class="tally-sync-banner" style="margin-bottom: 0.85rem;">
                <div class="tally-sync-icon"><i data-lucide="monitor"></i></div>
                <div>
                  <strong style="color: #92400e; font-size: 0.85rem;">Tally 9 Desktop PC Sync</strong>
                  <p style="font-size: 0.775rem; color: #78350f; margin-top: 0.2rem;">
                    Sync historical vouchers from old office accounts machine into active receipts archive.
                  </p>
                </div>
              </div>

              <button class="btn btn-gold btn-sm btn-block" onclick="Cashier.runTallyXmlImport()">
                <i data-lucide="zap"></i> Run Tally XML Migration Sync Now
              </button>
              <div id="tallySyncStatus" style="margin-top: 0.65rem; font-size: 0.8rem;"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize Lucide icons
    if (window.initLucideIcons) window.initLucideIcons(container);

    // Initial student selection in POS dropdown
    if (this.allStudents.length > 0) {
      this.onStudentSelect(this.allStudents[0].regNo);
      const sel = document.getElementById('cashierStudentSelect');
      if (sel) sel.value = this.allStudents[0].regNo;
    }

    // Render Student Directory Cards
    this.renderStudentList();

    // Render Recent Transactions (Last 10)
    this.renderRecentTransactions();
  },

  // Search Filter Handler with Debounce
  searchDebounceTimer: null,
  onSearchInput(val) {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.searchQuery = (val || '').trim().toLowerCase();
      this.filterStudents();
    }, 200);
  },

  setFilter(filterType) {
    this.activeFilter = filterType;
    // Update pill classes
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    if (filterType === 'ALL') document.getElementById('filterPillAll')?.classList.add('active');
    if (filterType === 'DUES') document.getElementById('filterPillDues')?.classList.add('active');
    if (filterType === 'SETTLED') document.getElementById('filterPillSettled')?.classList.add('active');
    this.filterStudents();
  },

  onDeptFilter(dept) {
    this.selectedDept = dept;
    this.filterStudents();
  },

  filterStudents() {
    let list = [...this.allStudents];

    // Filter by search query (Name, RegNo, Department, AdmissionNo)
    if (this.searchQuery) {
      list = list.filter(s => 
        (s.name && s.name.toLowerCase().includes(this.searchQuery)) ||
        (s.regNo && s.regNo.toLowerCase().includes(this.searchQuery)) ||
        (s.department && s.department.toLowerCase().includes(this.searchQuery)) ||
        (s.admissionNo && s.admissionNo.toLowerCase().includes(this.searchQuery)) ||
        (s.parentName && s.parentName.toLowerCase().includes(this.searchQuery))
      );
    }

    // Filter by dues status
    if (this.activeFilter === 'DUES') {
      list = list.filter(s => (s.balanceDue || 0) > 0);
    } else if (this.activeFilter === 'SETTLED') {
      list = list.filter(s => (s.balanceDue || 0) <= 0);
    }

    // Filter by department
    if (this.selectedDept && this.selectedDept !== 'ALL') {
      list = list.filter(s => s.department === this.selectedDept);
    }

    this.filteredStudents = list;
    this.renderStudentList();
  },

  // Render Student Directory Cards
  renderStudentList() {
    const container = document.getElementById('studentsListContainer');
    const badge = document.getElementById('studentResultsCountBadge');
    if (!container) return;

    if (badge) badge.textContent = `${this.filteredStudents.length} Found`;

    if (this.filteredStudents.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: #64748b;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          <strong style="color: var(--cashier-navy); font-size: 1rem;">No matching student profiles</strong>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Try adjusting your search terms or filter selection.</p>
        </div>
      `;
      return;
    }

    let html = '';
    this.filteredStudents.forEach(s => {
      const balance = s.balanceDue || 0;
      const hasDues = balance > 0;
      const firstLetter = (s.name || 'S').charAt(0).toUpperCase();

      html += `
        <div class="student-item-card" onclick="Cashier.openStudentModal('${s.regNo}')" title="Click to manage fee schedule and view payment history for ${s.name}">
          <div class="student-avatar-badge">${firstLetter}</div>
          
          <div class="student-info-main">
            <div class="student-name-row">
              <span class="student-name-text">${s.name}</span>
              <span class="student-reg-tag">${s.regNo}</span>
              <span class="badge badge-outline" style="font-size: 0.7rem; padding: 0.1rem 0.4rem;">${s.quota || 'Govt'}</span>
            </div>
            <div class="student-meta-sub">
              <span>${s.department} • Year ${s.currentYear || 1}</span>
              <span style="margin: 0 0.35rem;">•</span>
              <span>Billed: ₹${(s.totalBilled || 0).toLocaleString('en-IN')}</span>
              <span style="margin: 0 0.35rem;">•</span>
              <span style="color: var(--cashier-green);">Paid: ₹${(s.totalPaid || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div class="student-fee-badge-group">
            <div>
              ${hasDues 
                ? `<span class="balance-pill due">Due: ₹${balance.toLocaleString('en-IN')}</span>` 
                : `<span class="balance-pill settled">Settled: ₹0</span>`
              }
            </div>
            <button 
              type="button" 
              class="manage-btn-trigger" 
              onclick="event.stopPropagation(); Cashier.openStudentModal('${s.regNo}')"
            >
              <i data-lucide="user-cog" style="width: 14px; height: 14px;"></i>
              <span>Manage &amp; History</span>
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.initLucideIcons) window.initLucideIcons(container);
  },

  // Render Past Transactions (Last 10 on right side)
  renderRecentTransactions() {
    const container = document.getElementById('recentTxnsContainer');
    if (!container) return;

    if (!this.recentTransactions || this.recentTransactions.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 1.5rem 1rem; color: #64748b; font-size: 0.85rem;">
          No transactions logged yet.
        </div>
      `;
      return;
    }

    // Limit strictly to up to 10 transactions
    const top10 = this.recentTransactions.slice(0, 10);
    let html = '';

    top10.forEach(t => {
      const modeBadgeClass = this.getModeBadgeClass(t.paymentMode);
      const studentName = t.studentName || 'Student';
      const regNo = t.regNo || 'N/A';
      const amountStr = (t.amount || 0).toLocaleString('en-IN');

      html += `
        <div class="recent-txn-card" onclick="Receipts.showReceiptModal('${t.receiptNo}')" style="cursor: pointer;" title="Click to view verified official receipt ${t.receiptNo}">
          <div style="flex: 1; min-width: 0;">
            <div class="txn-student-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${studentName}
            </div>
            <div class="txn-student-reg">
              DOTE Reg: <code style="color: #3730a3; font-weight: 700;">${regNo}</code> • <span>${t.date || ''}</span>
            </div>
          </div>

          <div style="text-align: right; flex-shrink: 0;">
            <div class="txn-amount-val">₹${amountStr}</div>
            <div>
              <span class="mode-badge ${modeBadgeClass}" style="font-size: 0.685rem; padding: 0.15rem 0.45rem;">
                ${t.paymentMode || 'Counter'}
              </span>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.initLucideIcons) window.initLucideIcons(container);
  },

  getModeBadgeClass(mode) {
    if (!mode) return 'mode-cash';
    const m = mode.toLowerCase();
    if (m.includes('cash')) return 'mode-cash';
    if (m.includes('upi') || m.includes('gpay') || m.includes('phonepe') || m.includes('paytm')) return 'mode-upi';
    if (m.includes('draft') || m.includes('dd')) return 'mode-dd';
    if (m.includes('cheque')) return 'mode-cheque';
    if (m.includes('neft') || m.includes('rtgs')) return 'mode-neft';
    if (m.includes('tally')) return 'mode-tally';
    return 'mode-upi';
  },

  // Quick POS student selector change handler
  onStudentSelect(regNo) {
    const student = this.allStudents.find(s => s.regNo === regNo);
    const infoBox = document.getElementById('cashierStudentInfoBox');
    const amountInput = document.getElementById('cashierAmount');

    if (!student || !infoBox) return;

    infoBox.style.display = 'block';
    infoBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.825rem;">
        <div>
          <strong style="color: var(--cashier-navy);">${student.name}</strong> (${student.department})<br>
          <span style="color: #64748b;">Set Total: ₹${(student.totalBilled || 0).toLocaleString('en-IN')} | Paid: ₹${(student.totalPaid || 0).toLocaleString('en-IN')}</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.725rem; color: #64748b;">Balance Due:</span><br>
          <strong style="font-size: 1.1rem; color: ${(student.balanceDue || 0) > 0 ? '#dc2626' : '#059669'};">
            ₹${(student.balanceDue || 0).toLocaleString('en-IN')}
          </strong>
        </div>
      </div>
    `;

    if (amountInput) {
      amountInput.value = (student.balanceDue || 0) > 0 ? student.balanceDue : 5000;
    }
  },

  // Record Counter Payment from Quick POS
  async handleCounterPayment(event) {
    event.preventDefault();
    const btn = document.getElementById('collectFeeBtn');
    const regNo = document.getElementById('cashierStudentSelect').value;
    const amount = document.getElementById('cashierAmount').value;
    const mode = document.getElementById('cashierPaymentMode').value;
    const refNo = document.getElementById('cashierRefNo').value || `CTR-${Date.now().toString().slice(-6)}`;

    if (!regNo || !amount) {
      alert('Please select student and enter amount.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = 'Recording Counter Transaction...';

    try {
      const paymentData = {
        regNo,
        amount: parseFloat(amount),
        paymentMode: mode,
        transactionRef: refNo,
        remarks: 'Office counter fee collection'
      };

      const result = await API.submitPayment(paymentData);
      if (!result || !result.success) {
        alert(result?.error || 'Failed to record counter payment. Please check authorization.');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="printer"></i> Collect Fee &amp; Print Receipt';
        if (window.initLucideIcons) window.initLucideIcons(btn);
        return;
      }

      // Refresh data
      await this.loadAllStudents();
      await this.loadRecentTransactions();
      await this.loadCashBookReport();
      this.renderCashierDesk();

      // Show receipt modal
      if (result.receipt && result.receipt.receiptNo) {
        Receipts.showReceiptModal(result.receipt.receiptNo);
      }
    } catch (err) {
      console.error('Counter payment error:', err);
      alert('Failed to record payment. Please check inputs.');
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="printer"></i> Collect Fee &amp; Print Receipt';
      if (window.initLucideIcons) window.initLucideIcons(btn);
    }
  },

  // =========================================================================
  // STUDENT MANAGE & PAYMENT HISTORY MODAL CONTROLLER
  // =========================================================================

  async openStudentModal(regNo) {
    const modal = document.getElementById('studentManageModal');
    if (!modal) return;

    // Show loading state
    modal.classList.add('active');
    const content = document.getElementById('studentModalContainer');
    if (content) {
      content.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem; color: #64748b;">
          <i data-lucide="loader-2" class="animate-spin" style="width: 32px; height: 32px; margin-bottom: 0.75rem;"></i>
          <h4 style="color: var(--cashier-navy);">Loading Student Fee Ledger &amp; Payment History...</h4>
          <p style="font-size: 0.85rem;">Retrieving records for DOTE Reg: <code>${regNo}</code></p>
        </div>
      `;
      if (window.initLucideIcons) window.initLucideIcons(content);
    }

    try {
      const ledger = await API.getStudentLedger(regNo);
      if (!ledger || !ledger.success) {
        alert(ledger?.error || 'Failed to load student ledger.');
        modal.classList.remove('active');
        return;
      }

      this.activeStudentLedger = ledger;
      this.activeModalTab = 'feeSetup';
      this.renderStudentModal();
    } catch (err) {
      console.error('Error fetching student ledger:', err);
      alert('Failed to open student ledger. Please check network connection.');
      modal.classList.remove('active');
    }
  },

  closeStudentModal() {
    const modal = document.getElementById('studentManageModal');
    if (modal) modal.classList.remove('active');
    this.activeStudentLedger = null;
  },

  switchModalTab(tabId) {
    this.activeModalTab = tabId;
    this.renderStudentModal();
  },

  renderStudentModal() {
    const container = document.getElementById('studentModalContainer');
    if (!container || !this.activeStudentLedger) return;

    const { student, bills, receipts, summary } = this.activeStudentLedger;
    const totalBilled = summary?.totalBilled || 0;
    const totalPaid = summary?.totalPaid || 0;
    const balanceDue = summary?.balanceDue || 0;
    const hasDues = balanceDue > 0;

    // Latest bill or default template
    const currentBill = bills && bills.length > 0 ? bills[bills.length - 1] : {
      tuitionFee: student.quota === 'Management' ? 22000 : 14000,
      labFee: 3500,
      busFee: student.isHosteller ? 0 : 5000,
      hostelFee: student.isHosteller ? 16000 : 0,
      concession: student.concessionAmount || 0,
      netPayable: 22500,
      academicYear: '2025-2026',
      dueDate: '2026-11-30'
    };

    container.innerHTML = `
      <div class="student-manage-modal-dialog">
        <!-- Hero Header -->
        <div class="modal-header-hero">
          <div class="modal-hero-top">
            <div>
              <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--cashier-gold-light); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 0.25rem;">
                Subramanian Polytechnic College • Student Fee Management Terminal
              </div>
              <h2 style="font-family: var(--font-heading); font-size: 1.45rem; font-weight: 800; color: #ffffff; margin: 0;">
                ${student.name}
              </h2>
              <div style="font-size: 0.85rem; color: rgba(255,255,255,0.85); margin-top: 0.35rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span>DOTE Reg: <strong style="color: #ffffff; font-family: monospace;">${student.regNo}</strong></span>
                <span>•</span>
                <span>${student.department} (Year ${student.currentYear})</span>
                <span>•</span>
                <span class="badge badge-gold" style="font-size: 0.7rem;">${student.quota || 'Govt Quota'}</span>
                <span>•</span>
                <span>${student.isHosteller ? '🏠 Hosteller' : '🚌 Day Scholar'}</span>
              </div>
            </div>
            <button type="button" class="modal-hero-close" onclick="Cashier.closeStudentModal()" title="Close Window">&times;</button>
          </div>

          <!-- KPI Summary Strip -->
          <div class="student-modal-kpi-bar">
            <div class="kpi-modal-card">
              <div class="kpi-label">Set Total Fees</div>
              <div class="kpi-val" id="modalKpiTotalBilled">₹${totalBilled.toLocaleString('en-IN')}</div>
            </div>
            <div class="kpi-modal-card">
              <div class="kpi-label">Total Amount Paid</div>
              <div class="kpi-val" style="color: #4ade80;">₹${totalPaid.toLocaleString('en-IN')}</div>
            </div>
            <div class="kpi-modal-card" style="background: ${hasDues ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.25)'};">
              <div class="kpi-label">Pending Balance Due</div>
              <div class="kpi-val" id="modalKpiBalanceDue" style="color: ${hasDues ? '#fca5a5' : '#86efac'};">
                ₹${balanceDue.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <nav class="modal-nav-tabs">
          <button 
            type="button" 
            class="modal-tab-btn ${this.activeModalTab === 'feeSetup' ? 'active' : ''}" 
            onclick="Cashier.switchModalTab('feeSetup')"
          >
            <i data-lucide="sliders"></i> Set Total Fees Per Year
          </button>
          <button 
            type="button" 
            class="modal-tab-btn ${this.activeModalTab === 'history' ? 'active' : ''}" 
            onclick="Cashier.switchModalTab('history')"
          >
            <i data-lucide="history"></i> Payment History (${receipts ? receipts.length : 0})
          </button>
          <button 
            type="button" 
            class="modal-tab-btn ${this.activeModalTab === 'quickPay' ? 'active' : ''}" 
            onclick="Cashier.switchModalTab('quickPay')"
          >
            <i data-lucide="banknote"></i> Collect Payment Now
          </button>
        </nav>

        <!-- Tab Body -->
        <div class="modal-tab-content-area">
          ${this.renderActiveModalTabContent(currentBill, receipts, summary)}
        </div>
      </div>
    `;

    if (window.initLucideIcons) window.initLucideIcons(container);
  },

  renderActiveModalTabContent(bill, receipts, summary) {
    const student = this.activeStudentLedger.student;

    if (this.activeModalTab === 'feeSetup') {
      // TAB 1: Set Total Fees per Year
      return `
        <div>
          <div style="margin-bottom: 1.25rem;">
            <h4 style="font-family: var(--font-heading); color: var(--cashier-navy); font-size: 1.1rem; margin-bottom: 0.25rem;">
              Set &amp; Adjust Total Annual / Semester Fees
            </h4>
            <p style="font-size: 0.825rem; color: #64748b;">
              Configure institutional fee components for <strong>${student.name}</strong>. The pending balance will automatically recompute against payments already collected.
            </p>
          </div>

          <form id="setFeesForm" onsubmit="Cashier.handleSaveStudentFees(event)">
            <div class="fee-calc-grid">
              <div class="form-group">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Academic Year:</label>
                <input type="text" id="feeAcademicYear" class="form-control" value="${bill.academicYear || '2025-2026'}" required />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Semester / Label:</label>
                <input type="text" id="feeSemester" class="form-control" value="${bill.semester || `Semester ${student.currentSemester || 1}`}" required />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Annual Tuition Fee (₹):</label>
                <input 
                  type="number" 
                  id="feeTuition" 
                  class="form-control" 
                  value="${bill.tuitionFee || 14000}" 
                  min="0" 
                  oninput="Cashier.recalculateFeePreview()" 
                  required 
                />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Lab, Workshop &amp; Computer Fee (₹):</label>
                <input 
                  type="number" 
                  id="feeLab" 
                  class="form-control" 
                  value="${bill.labFee || 3500}" 
                  min="0" 
                  oninput="Cashier.recalculateFeePreview()" 
                  required 
                />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">College Bus / Transport Fee (₹):</label>
                <input 
                  type="number" 
                  id="feeBus" 
                  class="form-control" 
                  value="${bill.busFee !== undefined ? bill.busFee : (student.isHosteller ? 0 : 5000)}" 
                  min="0" 
                  oninput="Cashier.recalculateFeePreview()" 
                />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Hostel &amp; Mess Amenity Fee (₹):</label>
                <input 
                  type="number" 
                  id="feeHostel" 
                  class="form-control" 
                  value="${bill.hostelFee !== undefined ? bill.hostelFee : (student.isHosteller ? 16000 : 0)}" 
                  min="0" 
                  oninput="Cashier.recalculateFeePreview()" 
                />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Concession / Scholarship Waiver (₹):</label>
                <input 
                  type="number" 
                  id="feeConcession" 
                  class="form-control" 
                  value="${bill.concession || student.concessionAmount || 0}" 
                  min="0" 
                  oninput="Cashier.recalculateFeePreview()" 
                />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Payment Due Date:</label>
                <input type="date" id="feeDueDate" class="form-control" value="${bill.dueDate || '2026-11-30'}" required />
              </div>
            </div>

            <!-- Live Calculated Preview Banner -->
            <div class="fee-net-preview-box">
              <div>
                <span style="font-size: 0.775rem; color: #166534; font-weight: 700; text-transform: uppercase;">
                  Calculated Net Annual Total:
                </span>
                <div style="font-family: var(--font-heading); font-size: 1.45rem; font-weight: 800; color: #14532d;" id="previewNetPayable">
                  ₹${(bill.netPayable || 22500).toLocaleString('en-IN')}
                </div>
              </div>

              <div style="text-align: right;">
                <span style="font-size: 0.775rem; color: #166534; font-weight: 700; text-transform: uppercase;">
                  New Pending Balance:
                </span>
                <div style="font-family: var(--font-heading); font-size: 1.45rem; font-weight: 800; color: #b91c1c;" id="previewPendingBalance">
                  ₹${(summary?.balanceDue || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
              <button type="button" class="btn btn-outline btn-sm" onclick="Cashier.closeStudentModal()">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary" id="saveFeesSubmitBtn">
                <i data-lucide="check-circle-2"></i> Save &amp; Update Fee Schedule
              </button>
            </div>
          </form>
        </div>
      `;
    } else if (this.activeModalTab === 'history') {
      // TAB 2: Payment History
      if (!receipts || receipts.length === 0) {
        return `
          <div style="text-align: center; padding: 3rem 1rem; color: #64748b;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📜</div>
            <strong style="color: var(--cashier-navy); font-size: 1rem;">No payment records found</strong>
            <p style="font-size: 0.85rem; margin-top: 0.25rem;">No receipts have been issued to this student yet.</p>
            <button class="btn btn-gold btn-sm" style="margin-top: 1rem;" onclick="Cashier.switchModalTab('quickPay')">
              <i data-lucide="banknote"></i> Collect First Payment
            </button>
          </div>
        `;
      }

      let rows = '';
      receipts.forEach(r => {
        const modeBadgeClass = this.getModeBadgeClass(r.paymentMode);
        rows += `
          <tr>
            <td>
              <a href="javascript:void(0)" onclick="Receipts.showReceiptModal('${r.receiptNo}')" style="font-weight: 700; color: #1a56db; text-decoration: none;">
                ${r.receiptNo}
              </a>
            </td>
            <td style="white-space: nowrap; font-size: 0.825rem; color: #475569;">
              ${r.date || 'N/A'}
            </td>
            <td>
              <strong style="font-size: 0.95rem; color: #059669;">
                ₹${(r.amount || 0).toLocaleString('en-IN')}
              </strong>
            </td>
            <td>
              <span class="mode-badge ${modeBadgeClass}">
                ${r.paymentMode || 'Counter'}
              </span>
            </td>
            <td style="font-size: 0.775rem; color: #64748b;">
              <code>${r.transactionRef || 'N/A'}</code>
            </td>
            <td style="font-size: 0.775rem; color: #475569; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${r.remarks || r.source || ''}
            </td>
            <td style="text-align: right; white-space: nowrap;">
              <button class="btn btn-outline btn-sm" onclick="Receipts.showReceiptModal('${r.receiptNo}')" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
                <i data-lucide="printer"></i> Receipt
              </button>
            </td>
          </tr>
        `;
      });

      return `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
              <h4 style="font-family: var(--font-heading); color: var(--cashier-navy); font-size: 1.1rem; margin-bottom: 0.2rem;">
                Payment &amp; Voucher History
              </h4>
              <p style="font-size: 0.825rem; color: #64748b;">
                Showing all <strong>${receipts.length}</strong> official transaction receipts recorded for <strong>${student.name}</strong>.
              </p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="Cashier.switchModalTab('quickPay')">
              <i data-lucide="plus-circle"></i> New Payment
            </button>
          </div>

          <div class="table-responsive" style="border: 1px solid var(--cashier-border); border-radius: 10px; overflow: hidden;">
            <table class="custom-table" style="margin: 0;">
              <thead>
                <tr>
                  <th>Receipt No</th>
                  <th>Date</th>
                  <th>Amount (₹)</th>
                  <th>Mode</th>
                  <th>Reference</th>
                  <th>Remarks / Source</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (this.activeModalTab === 'quickPay') {
      // TAB 3: Immediate Fee Collection Form
      const pendingDue = summary?.balanceDue || 0;
      return `
        <div>
          <div style="margin-bottom: 1.25rem;">
            <h4 style="font-family: var(--font-heading); color: var(--cashier-navy); font-size: 1.1rem; margin-bottom: 0.25rem;">
              Collect Fee Payment for ${student.name}
            </h4>
            <p style="font-size: 0.825rem; color: #64748b;">
              Current pending balance: <strong style="color: ${pendingDue > 0 ? '#dc2626' : '#059669'};">₹${pendingDue.toLocaleString('en-IN')}</strong>. Recording this transaction generates an authentic digitally verified receipt immediately.
            </p>
          </div>

          <form id="modalPaymentForm" onsubmit="Cashier.handleModalPaymentSubmit(event)">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Amount Collected (₹):</label>
                <input 
                  type="number" 
                  id="modalPayAmount" 
                  class="form-control" 
                  value="${pendingDue > 0 ? pendingDue : 5000}" 
                  min="1" 
                  required 
                />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Payment Mode:</label>
                <select id="modalPayMode" class="form-control" required>
                  <option value="Cash at Counter">Cash at Counter</option>
                  <option value="Office Counter QR UPI">Office Counter QR UPI</option>
                  <option value="Demand Draft (DD)">Demand Draft (DD)</option>
                  <option value="Bank Cheque">Bank Cheque</option>
                  <option value="NEFT / RTGS Challan">Bank NEFT / RTGS</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Transaction Ref / Challan / DD / Cheque No:</label>
              <input type="text" id="modalPayRef" class="form-control" placeholder="e.g. DD-041928, UPI-9912048, or Cash-Drawer" />
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Office Ledger Remarks:</label>
              <input type="text" id="modalPayRemarks" class="form-control" placeholder="e.g. Term fee payment collected at counter desk" />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
              <button type="button" class="btn btn-outline btn-sm" onclick="Cashier.closeStudentModal()">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary" id="modalPaySubmitBtn">
                <i data-lucide="printer"></i> Record Payment &amp; Print Official Receipt
              </button>
            </div>
          </form>
        </div>
      `;
    }
  },

  // Recalculate Live Net Total and Balance in Modal
  recalculateFeePreview() {
    const tuition = parseFloat(document.getElementById('feeTuition')?.value) || 0;
    const lab = parseFloat(document.getElementById('feeLab')?.value) || 0;
    const bus = parseFloat(document.getElementById('feeBus')?.value) || 0;
    const hostel = parseFloat(document.getElementById('feeHostel')?.value) || 0;
    const concession = parseFloat(document.getElementById('feeConcession')?.value) || 0;

    const net = Math.max(0, tuition + lab + bus + hostel - concession);
    const totalPaid = this.activeStudentLedger?.summary?.totalPaid || 0;
    const newBalance = Math.max(0, net - totalPaid);

    const netEl = document.getElementById('previewNetPayable');
    const balEl = document.getElementById('previewPendingBalance');

    if (netEl) netEl.textContent = `₹${net.toLocaleString('en-IN')}`;
    if (balEl) {
      balEl.textContent = `₹${newBalance.toLocaleString('en-IN')}`;
      balEl.style.color = newBalance > 0 ? '#b91c1c' : '#15803d';
    }
  },

  // Save / Update Student Total Fees per Year
  async handleSaveStudentFees(event) {
    event.preventDefault();
    if (!this.activeStudentLedger) return;

    const regNo = this.activeStudentLedger.student.regNo;
    const btn = document.getElementById('saveFeesSubmitBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Updating Fee Schedule...';
    }

    const feeData = {
      academicYear: document.getElementById('feeAcademicYear')?.value,
      semester: document.getElementById('feeSemester')?.value,
      tuitionFee: parseFloat(document.getElementById('feeTuition')?.value) || 0,
      labFee: parseFloat(document.getElementById('feeLab')?.value) || 0,
      busFee: parseFloat(document.getElementById('feeBus')?.value) || 0,
      hostelFee: parseFloat(document.getElementById('feeHostel')?.value) || 0,
      concession: parseFloat(document.getElementById('feeConcession')?.value) || 0,
      dueDate: document.getElementById('feeDueDate')?.value
    };

    try {
      const result = await API.setStudentFees(regNo, feeData);
      if (!result || !result.success) {
        alert(result?.error || 'Failed to update student fees.');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i data-lucide="check-circle-2"></i> Save &amp; Update Fee Schedule';
          if (window.initLucideIcons) window.initLucideIcons(btn);
        }
        return;
      }

      // Success: Reload active ledger and overall student list
      await this.loadAllStudents();
      this.filterStudents();

      // Refresh modal ledger view
      const updatedLedger = await API.getStudentLedger(regNo);
      if (updatedLedger && updatedLedger.success) {
        this.activeStudentLedger = updatedLedger;
        this.renderStudentModal();
      }

      alert(`Fee structure updated successfully for ${this.activeStudentLedger.student.name}!\nPending balance is now ₹${(result.summary?.balanceDue || 0).toLocaleString('en-IN')}.`);
    } catch (err) {
      console.error('Error updating student fees:', err);
      alert('Network error while saving fees. Please try again.');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check-circle-2"></i> Save &amp; Update Fee Schedule';
        if (window.initLucideIcons) window.initLucideIcons(btn);
      }
    }
  },

  // Record Payment from inside Student Modal
  async handleModalPaymentSubmit(event) {
    event.preventDefault();
    if (!this.activeStudentLedger) return;

    const regNo = this.activeStudentLedger.student.regNo;
    const btn = document.getElementById('modalPaySubmitBtn');
    const amount = document.getElementById('modalPayAmount')?.value;
    const mode = document.getElementById('modalPayMode')?.value;
    const refNo = document.getElementById('modalPayRef')?.value || `CTR-${Date.now().toString().slice(-6)}`;
    const remarks = document.getElementById('modalPayRemarks')?.value || 'Counter fee collection';

    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Recording Payment...';
    }

    try {
      const paymentData = {
        regNo,
        amount: parseFloat(amount),
        paymentMode: mode,
        transactionRef: refNo,
        remarks: remarks
      };

      const result = await API.submitPayment(paymentData);
      if (!result || !result.success) {
        alert(result?.error || 'Failed to record payment.');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i data-lucide="printer"></i> Record Payment &amp; Print Official Receipt';
          if (window.initLucideIcons) window.initLucideIcons(btn);
        }
        return;
      }

      // Refresh everything
      await this.loadAllStudents();
      await this.loadRecentTransactions();
      await this.loadCashBookReport();
      this.renderRecentTransactions();
      this.filterStudents();

      // Refresh modal
      const updatedLedger = await API.getStudentLedger(regNo);
      if (updatedLedger && updatedLedger.success) {
        this.activeStudentLedger = updatedLedger;
        this.activeModalTab = 'history';
        this.renderStudentModal();
      }

      // Show receipt modal
      if (result.receipt && result.receipt.receiptNo) {
        Receipts.showReceiptModal(result.receipt.receiptNo);
      }
    } catch (err) {
      console.error('Modal payment error:', err);
      alert('Failed to record payment.');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="printer"></i> Record Payment &amp; Print Official Receipt';
        if (window.initLucideIcons) window.initLucideIcons(btn);
      }
    }
  },

  // Legacy Tally XML Import
  async runTallyXmlImport() {
    const statusDiv = document.getElementById('tallySyncStatus');
    if (statusDiv) {
      statusDiv.innerHTML = `<span style="color: #2563eb; display: inline-flex; align-items: center; gap: 0.35rem;"><i data-lucide="refresh-cw" class="animate-spin"></i> Connecting to legacy Tally dataset &amp; parsing XML envelopes...</span>`;
      if (window.initLucideIcons) window.initLucideIcons(statusDiv);
    }

    try {
      const res = await API.importTallyXml();
      if (res.success) {
        if (statusDiv) {
          statusDiv.innerHTML = `
            <span style="color: #059669; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;"><i data-lucide="check-circle-2"></i> Sync Complete!</span> 
            ${res.importedCount} legacy vouchers converted into active verifiable receipts.
          `;
          if (window.initLucideIcons) window.initLucideIcons(statusDiv);
        }
        alert(res.message);
        // Refresh
        await this.loadAllStudents();
        await this.loadRecentTransactions();
        await this.loadCashBookReport();
        this.renderCashierDesk();
      }
    } catch (err) {
      console.error('Tally import error:', err);
      if (statusDiv) {
        statusDiv.innerHTML = `<span style="color: #dc2626;">Error during Tally migration sync.</span>`;
      }
    }
  }
};

window.Cashier = Cashier;
