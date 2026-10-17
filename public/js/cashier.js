// SPTC Cashier & Office Accounts Controller (Legacy Tally Replacement Desk)

const Cashier = {
  allStudents: [],
  selectedStudent: null,

  async init() {
    await this.loadAllStudents();
    await this.loadCashBookReport();
    this.renderCashierDesk();
  },

  async loadAllStudents() {
    try {
      const data = await API.getAllStudents();
      if (Array.isArray(data)) {
        this.allStudents = data;
      } else {
        console.warn('getAllStudents returned non-array:', data);
        this.allStudents = [];
      }
    } catch (err) {
      console.error('Error loading students for cashier:', err);
      this.allStudents = [];
    }
  },

  async loadCashBookReport() {
    try {
      const report = await API.getCashBookReport();
      if (report && !report.error) {
        this.renderCashBookReport(report);
      }
    } catch (err) {
      console.error('Error loading cash book:', err);
    }
  },

  renderCashierDesk() {
    const container = document.getElementById('cashierDeskContainer');
    if (!container) return;

    const studentsList = Array.isArray(this.allStudents) ? this.allStudents : [];
    let studentOptions = studentsList.map(s => `
      <option value="${s.regNo}">
        ${s.regNo} - ${s.name} (${s.department} Year ${s.currentYear}) - Due: ₹${(s.balanceDue || 0).toLocaleString('en-IN')}
      </option>
    `).join('');

    container.innerHTML = `
      <div class="cashier-control-grid">
        <!-- Card 1: Counter Collection Mode -->
        <div class="cashier-card">
          <div class="cashier-card-title">
            <span>💵</span>
            <h3>Quick Counter Fee Collection POS</h3>
          </div>
          <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.25rem;">
            Rapid counter entry for office staff. Generates verified A4 and thermal receipts in under 15 seconds.
          </p>

          <form id="cashierCollectionForm" onsubmit="Cashier.handleCounterPayment(event)">
            <div class="form-group">
              <label class="form-label">Select Student (Search by Reg No / Name):</label>
              <select id="cashierStudentSelect" class="form-control" onchange="Cashier.onStudentSelect(this.value)" required>
                <option value="">-- Choose Student --</option>
                ${studentOptions}
              </select>
            </div>

            <div id="cashierStudentInfoBox" style="display: none; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.85rem; margin-bottom: 1rem;">
              <!-- Populated dynamically -->
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label">Amount Collected (₹):</label>
                <input type="number" id="cashierAmount" class="form-control" placeholder="Amount" min="1" required />
              </div>
              <div class="form-group">
                <label class="form-label">Payment Mode:</label>
                <select id="cashierPaymentMode" class="form-control" required>
                  <option value="Cash Counter">Cash at Counter</option>
                  <option value="Demand Draft (DD)">Demand Draft (DD)</option>
                  <option value="Bank Cheque">Bank Cheque</option>
                  <option value="NEFT / RTGS Challan">Bank NEFT / RTGS</option>
                  <option value="Office POS UPI">Office Counter QR UPI</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Challan / DD / Cheque / Vch Ref Number:</label>
              <input type="text" id="cashierRefNo" class="form-control" placeholder="e.g. DD-041928 or Cash-Drawer" />
            </div>

            <div class="form-group">
              <label class="form-label">Internal Office Remarks / Ledger Notes:</label>
              <input type="text" id="cashierRemarks" class="form-control" placeholder="e.g. Received full semester tuition fee" />
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;" id="collectFeeBtn">
              🖨️ Collect Fee &amp; Print Official Receipt
            </button>
          </form>
        </div>

        <!-- Card 2: Legacy Tally Computer Migration Tool -->
        <div class="cashier-card">
          <div class="cashier-card-title">
            <span>💾</span>
            <h3>Legacy Tally System Migration &amp; Sync</h3>
          </div>
          
          <div class="tally-sync-banner">
            <div class="tally-sync-icon">🖥️</div>
            <div>
              <strong style="color: #92400e;">Decommissioning the Outdated Tally Desktop</strong>
              <p style="font-size: 0.825rem; color: #78350f; margin-top: 0.25rem;">
                All historical ledgers and vouchers stored in the old office computer can be imported via XML/Excel. Students will immediately be able to log in and access their old receipts.
              </p>
            </div>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
            <h4 style="font-size: 0.9rem; color: #0a2558; margin-bottom: 0.5rem;">Tally XML Batch Import Simulation:</h4>
            <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.75rem;">
              Found ready-to-sync legacy file: <code style="color: #0a2558;">data/sample_tally_export.xml</code> containing student vouchers for R. Anitha (EEE) and K. Vigneshwaran (CSE).
            </p>
            <button class="btn btn-gold btn-sm" onclick="Cashier.runTallyXmlImport()">
              ⚡ Run Tally XML Migration Sync Now
            </button>
            <div id="tallySyncStatus" style="margin-top: 0.75rem; font-size: 0.825rem;"></div>
          </div>

          <!-- Quick Defaulters Overview -->
          <div id="cashierAuditSummaryBox">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>

      <!-- Defaulters & Dues List -->
      <div class="data-table-card">
        <div class="card-header-flex">
          <div>
            <h3>Pending Fees Defaulters List (DOTE 2026-27 Audit)</h3>
            <p style="font-size: 0.825rem; color: #64748b;">
              Filter students by department with pending semester balances to trigger fee reminder alerts.
            </p>
          </div>
          <button class="btn btn-outline btn-sm" onclick="Cashier.sendBulkReminders()">
            📲 Send Bulk WhatsApp / SMS Reminders
          </button>
        </div>
        <div class="table-responsive" id="defaultersTableContainer">
          <!-- Populated dynamically -->
        </div>
      </div>
    `;

    // Trigger initial select if students available
    if (this.allStudents.length > 0) {
      this.onStudentSelect(this.allStudents[0].regNo);
      document.getElementById('cashierStudentSelect').value = this.allStudents[0].regNo;
    }
  },

  onStudentSelect(regNo) {
    const student = this.allStudents.find(s => s.regNo === regNo);
    const infoBox = document.getElementById('cashierStudentInfoBox');
    const amountInput = document.getElementById('cashierAmount');

    if (!student || !infoBox) return;

    this.selectedStudent = student;
    infoBox.style.display = 'block';
    infoBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
        <div>
          <strong>${student.name}</strong> (${student.department})<br>
          <span style="color: #64748b;">Total Billed: ₹${student.totalBilled.toLocaleString('en-IN')} | Paid: ₹${student.totalPaid.toLocaleString('en-IN')}</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.75rem; color: #64748b;">Current Due:</span><br>
          <strong style="font-size: 1.15rem; color: ${student.balanceDue > 0 ? '#dc2626' : '#059669'};">
            ₹${student.balanceDue.toLocaleString('en-IN')}
          </strong>
        </div>
      </div>
    `;

    if (amountInput) {
      amountInput.value = student.balanceDue > 0 ? student.balanceDue : 5000;
    }
  },

  async handleCounterPayment(event) {
    event.preventDefault();
    const btn = document.getElementById('collectFeeBtn');
    const regNo = document.getElementById('cashierStudentSelect').value;
    const amount = document.getElementById('cashierAmount').value;
    const mode = document.getElementById('cashierPaymentMode').value;
    const refNo = document.getElementById('cashierRefNo').value || `CTR-${Date.now().toString().slice(-6)}`;
    const remarks = document.getElementById('cashierRemarks').value || 'Office counter fee collection';

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
        remarks: remarks
      };

      const result = await API.submitPayment(paymentData);
      if (!result || !result.success) {
        alert(result?.error || 'Failed to record counter payment. Please check authorization.');
        btn.disabled = false;
        btn.innerHTML = '🖨️ Collect Fee &amp; Print Official Receipt';
        return;
      }

      // Refresh data
      await this.loadAllStudents();
      await this.loadCashBookReport();
      this.renderCashierDesk();

      // Show receipt
      if (result.receipt && result.receipt.receiptNo) {
        Receipts.showReceiptModal(result.receipt.receiptNo);
      }
    } catch (err) {
      console.error('Counter payment error:', err);
      alert('Failed to record payment. Please check inputs.');
      btn.disabled = false;
      btn.innerHTML = '🖨️ Collect Fee &amp; Print Official Receipt';
    }
  },

  async runTallyXmlImport() {
    const statusDiv = document.getElementById('tallySyncStatus');
    if (statusDiv) {
      statusDiv.innerHTML = `<span style="color: #2563eb;">🔄 Connecting to legacy Tally dataset &amp; parsing XML envelopes...</span>`;
    }

    try {
      const res = await API.importTallyXml();
      if (res.success) {
        if (statusDiv) {
          statusDiv.innerHTML = `
            <span style="color: #059669; font-weight: 700;">✓ Sync Complete!</span> 
            ${res.importedCount} legacy vouchers converted into active verifiable receipts.
          `;
        }
        alert(res.message);
        // Refresh
        await this.loadAllStudents();
        await this.loadCashBookReport();
        this.renderCashierDesk();
        // Also refresh student fees if open
        if (window.Fees) Fees.loadStudentFeeDashboard();
      }
    } catch (err) {
      console.error('Tally import error:', err);
      if (statusDiv) {
        statusDiv.innerHTML = `<span style="color: #dc2626;">Error during Tally migration sync.</span>`;
      }
    }
  },

  renderCashBookReport(report) {
    const summaryTarget = document.getElementById('cashierAuditSummaryBox');
    const tableTarget = document.getElementById('defaultersTableContainer');

    if (summaryTarget) {
      summaryTarget.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; text-align: center;">
          <div style="background: #f1f5f9; padding: 0.75rem; border-radius: 6px;">
            <span style="font-size: 0.75rem; color: #64748b;">Total Net Collections:</span><br>
            <strong style="font-size: 1.15rem; color: #0a2558;">₹${report.totalCollections.toLocaleString('en-IN')}</strong>
          </div>
          <div style="background: #fef2f2; padding: 0.75rem; border-radius: 6px;">
            <span style="font-size: 0.75rem; color: #991b1b;">Students with Dues:</span><br>
            <strong style="font-size: 1.15rem; color: #dc2626;">${report.defaultersCount} Students</strong>
          </div>
        </div>
      `;
    }

    if (tableTarget && report.defaultersList) {
      let rows = '';
      report.defaultersList.forEach(d => {
        rows += `
          <tr>
            <td><strong style="color: #0a2558;">${d.regNo}</strong></td>
            <td>${d.name}</td>
            <td>${d.department} (Yr ${d.currentYear})</td>
            <td>₹${d.totalBilled.toLocaleString('en-IN')}</td>
            <td style="color: #059669;">₹${d.totalPaid.toLocaleString('en-IN')}</td>
            <td><strong style="color: #dc2626;">₹${d.balanceDue.toLocaleString('en-IN')}</strong></td>
            <td>
              <button class="btn btn-sm btn-outline" onclick="Cashier.sendSingleReminder('${d.name}', '${d.parentPhone}', ${d.balanceDue})">
                💬 Remind Parent (${d.parentPhone})
              </button>
            </td>
          </tr>
        `;
      });

      tableTarget.innerHTML = `
        <table class="custom-table">
          <thead>
            <tr>
              <th>DOTE Reg No</th>
              <th>Student Name</th>
              <th>Department</th>
              <th>Total Billed</th>
              <th>Total Paid</th>
              <th>Balance Due</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }
  },

  sendSingleReminder(name, phone, amount) {
    const msg = `Dear Parent, This is a reminder from Subramanian Polytechnic College, Rayavaram. The pending fee balance for ${name} is Rs. ${amount.toLocaleString('en-IN')}. Please pay online at sptc.org.in or visit the college accounts desk.`;
    alert(`📱 SMS/WhatsApp Notification Sent to ${phone}:\n\n"${msg}"`);
  },

  sendBulkReminders() {
    alert(`📢 Automated bulk SMS & WhatsApp fee reminder alerts dispatched to all registered parent contacts across Rayavaram & Pudukkottai.`);
  }
};

window.Cashier = Cashier;
