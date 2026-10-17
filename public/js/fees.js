// SPTC Student Fees Management & Payment Controller

const Fees = {
  currentStudentRegNo: '22201045', // Default loaded student (K. Vigneshwaran - CSE)
  currentFeeData: null,

  async init(regNo) {
    if (regNo) {
      this.currentStudentRegNo = regNo;
    }
    await this.loadStudentFeeDashboard();
  },

  async loadStudentFeeDashboard() {
    const container = document.getElementById('studentFeesDashboardContainer');
    if (!container) return;

    try {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: #64748b;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">⏳</div>
          <p>Loading student fee records from SPTC Institutional Server...</p>
        </div>
      `;

      const data = await API.getStudentFees(this.currentStudentRegNo);
      this.currentFeeData = data;
      const { student, summary, bills, receipts } = data;

      // Sort receipts latest first
      receipts.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Build Semester Bills HTML Rows
      let billsRows = '';
      bills.forEach(bill => {
        const isPaid = summary.outstandingBalance <= 0;
        const statusBadge = isPaid 
          ? `<span class="badge badge-success">✓ PAID</span>`
          : `<span class="badge badge-warning">PENDING DUES</span>`;

        billsRows += `
          <tr>
            <td>
              <strong>${bill.semester}</strong><br>
              <span style="font-size: 0.775rem; color: #64748b;">A.Y. ${bill.academicYear}</span>
            </td>
            <td>₹${(bill.tuitionFee || 0).toLocaleString('en-IN')}</td>
            <td>₹${(bill.labFee || 0).toLocaleString('en-IN')}</td>
            <td>${bill.busFee ? `₹${bill.busFee.toLocaleString('en-IN')}` : '<span style="color:#94a3b8;">-</span>'}</td>
            <td>${bill.hostelFee ? `₹${bill.hostelFee.toLocaleString('en-IN')}` : '<span style="color:#94a3b8;">-</span>'}</td>
            <td style="color: #059669; font-weight: 600;">
              ${bill.concession ? `-₹${bill.concession.toLocaleString('en-IN')}` : '₹0'}
            </td>
            <td>
              <strong style="color: #0a2558;">₹${bill.netPayable.toLocaleString('en-IN')}</strong>
            </td>
            <td><span style="font-size: 0.825rem; color: #64748b;">${bill.dueDate || 'N/A'}</span></td>
            <td>${statusBadge}</td>
          </tr>
        `;
      });

      // Build Old & Current Receipts HTML Rows
      let receiptsRows = '';
      if (receipts.length === 0) {
        receiptsRows = `<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No fee payment receipts recorded yet.</td></tr>`;
      } else {
        receipts.forEach(r => {
          const isTally = r.source && r.source.includes('Tally');
          receiptsRows += `
            <tr>
              <td>
                <strong style="font-family: monospace; color: #0a2558;">${r.receiptNo}</strong>
              </td>
              <td>${r.date}</td>
              <td>${r.academicYear} <br><span style="font-size: 0.75rem; color: #64748b;">${r.semester}</span></td>
              <td><strong style="color: #059669;">₹${r.amount.toLocaleString('en-IN')}</strong></td>
              <td>
                <span class="badge ${isTally ? 'badge-warning' : 'badge-success'}">
                  ${r.paymentMode}
                </span>
                ${isTally ? `<br><span class="receipt-tag-tally">📁 Migrated Tally PC</span>` : ''}
              </td>
              <td>
                <div style="display: flex; gap: 0.4rem;">
                  <button class="btn btn-sm btn-primary" onclick="Receipts.showReceiptModal('${r.receiptNo}')">
                    👁️ View Receipt
                  </button>
                  <button class="btn btn-sm btn-outline" onclick="Receipts.showReceiptModal('${r.receiptNo}'); setTimeout(() => Receipts.printReceipt(), 400);">
                    🖨️ PDF
                  </button>
                </div>
              </td>
            </tr>
          `;
        });
      }

      // Render full dashboard
      container.innerHTML = `
        <!-- Student Profile Banner -->
        <div class="student-profile-banner">
          <div class="student-meta-left">
            <div class="student-avatar">${student.name.charAt(0)}</div>
            <div class="student-details">
              <h2>${student.name}</h2>
              <p style="opacity: 0.9; font-size: 0.95rem;">
                DOTE Reg No: <strong style="color: var(--color-accent-gold-light);">${student.regNo}</strong> | 
                Admission No: ${student.admissionNo}
              </p>
              <div class="student-badges-row">
                <span class="badge badge-gold">🎓 ${student.department}</span>
                <span class="badge badge-white">📅 Year ${student.currentYear} (${student.currentSemester}th Sem)</span>
                <span class="badge badge-white">🏛️ Quota: ${student.quota}</span>
                <span class="badge badge-white">${student.isHosteller ? '🛏️ Hosteller' : '🚌 ' + student.busRoute}</span>
                ${student.concessionType && student.concessionType !== 'None' ? `
                  <span class="badge badge-success">✨ Concession: ${student.concessionType}</span>
                ` : ''}
              </div>
            </div>
          </div>

          <div class="student-quick-switch">
            <button class="btn btn-gold btn-sm" onclick="Fees.openPayFeesModal()">
              💳 Pay Outstanding Fee
            </button>
            <span style="font-size: 0.775rem; opacity: 0.8;">Instant UPI &amp; Card Receipt</span>
          </div>
        </div>

        <!-- Metric Cards -->
        <div class="metrics-grid">
          <div class="metric-card billed">
            <div class="metric-icon-wrap">📋</div>
            <div class="metric-label">Total Course Billed</div>
            <div class="metric-value">₹${summary.totalBilled.toLocaleString('en-IN')}</div>
            <div class="metric-subtitle">Across 6 Semesters DOTE Curriculum</div>
          </div>

          <div class="metric-card paid">
            <div class="metric-icon-wrap">✅</div>
            <div class="metric-label">Total Fees Paid</div>
            <div class="metric-value" style="color: var(--color-success);">
              ₹${summary.totalPaid.toLocaleString('en-IN')}
            </div>
            <div class="metric-subtitle">Verified in SPTC Central Accounts</div>
          </div>

          <div class="metric-card dues">
            <div class="metric-icon-wrap">⚠️</div>
            <div class="metric-label">Net Balance Due</div>
            <div class="metric-value" style="color: ${summary.outstandingBalance > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">
              ₹${summary.outstandingBalance.toLocaleString('en-IN')}
            </div>
            <div class="metric-subtitle">
              ${summary.outstandingBalance > 0 ? `Payment due before ${summary.nextDueDate}` : 'All fees up-to-date!'}
            </div>
          </div>

          <div class="metric-card receipts">
            <div class="metric-icon-wrap">🗄️</div>
            <div class="metric-label">Receipts in Vault</div>
            <div class="metric-value" style="color: #9333ea;">${summary.receiptCount}</div>
            <div class="metric-subtitle">Old Tally + Current Web Vouchers</div>
          </div>
        </div>

        <!-- Term-wise Fee Breakdown Table -->
        <div class="data-table-card">
          <div class="card-header-flex">
            <div>
              <h3>Term &amp; Semester Fee Ledger Breakdown</h3>
              <p style="font-size: 0.825rem; color: #64748b;">Itemized calculation of tuition, laboratory, transport, and government scholarship deductions</p>
            </div>
            ${summary.outstandingBalance > 0 ? `
              <button class="btn btn-sm btn-gold" onclick="Fees.openPayFeesModal()">
                💳 Pay Current Dues (₹${summary.outstandingBalance.toLocaleString('en-IN')})
              </button>
            ` : ''}
          </div>
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Semester / Term</th>
                  <th>Tuition Fee</th>
                  <th>Lab &amp; Amenities</th>
                  <th>Transport (Bus)</th>
                  <th>Hostel / Mess</th>
                  <th>Scholarship / Waiver</th>
                  <th>Net Payable</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${billsRows}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Old Receipts Vault -->
        <div class="data-table-card">
          <div class="card-header-flex">
            <div>
              <h3>Student Receipts Vault (Historical &amp; Present)</h3>
              <p style="font-size: 0.825rem; color: #64748b;">
                Every payment receipt (including old accounts migrated from the legacy office Tally system) can be viewed and printed with official verification QR codes.
              </p>
            </div>
            <span class="badge badge-gold" style="font-size: 0.8rem;">
              📁 ${receipts.length} Official Receipts Archived
            </span>
          </div>
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Receipt Number</th>
                  <th>Date Paid</th>
                  <th>Academic Term</th>
                  <th>Amount Paid</th>
                  <th>Payment Mode &amp; Source</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${receiptsRows}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('Error loading student fees:', err);
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem; color: var(--color-danger);">
          <p>Failed to load fee ledger details. Please verify the student registration number.</p>
        </div>
      `;
    }
  },

  // Open Payment Simulation Modal
  openPayFeesModal() {
    if (!this.currentFeeData) return;
    const { student, summary } = this.currentFeeData;
    const defaultAmount = summary.outstandingBalance > 0 ? summary.outstandingBalance : 5000;

    const modalContainer = document.getElementById('paymentModalContent');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div style="padding: 0.5rem 0;">
        <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
          <p style="font-size: 0.85rem; color: #1e40af;">
            Paying fee for <strong>${student.name}</strong> (Reg No: <strong>${student.regNo}</strong> - ${student.department})
          </p>
          <p style="font-size: 0.85rem; color: #1e40af; margin-top: 0.25rem;">
            Current Outstanding Balance: <strong style="color: #b91c1c; font-size: 1.05rem;">₹${summary.outstandingBalance.toLocaleString('en-IN')}</strong>
          </p>
        </div>

        <form id="onlineFeePaymentForm" onsubmit="Fees.handlePaymentSubmit(event)">
          <div class="form-group">
            <label class="form-label">Payment Amount (INR):</label>
            <input type="number" id="payAmountInput" class="form-control" value="${defaultAmount}" min="100" max="100000" required />
            <span style="font-size: 0.75rem; color: #64748b;">You can pay the full pending balance or enter a custom partial installment.</span>
          </div>

          <div class="form-group">
            <label class="form-label">Select Payment Gateway Mode:</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <label style="display: flex; align-items: center; gap: 0.5rem; border: 1.5px solid #cbd5e1; padding: 0.75rem; border-radius: 8px; cursor: pointer;">
                <input type="radio" name="payMethod" value="UPI" checked />
                <span>📱 <strong>UPI (GPay / PhonePe / Paytm)</strong></span>
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; border: 1.5px solid #cbd5e1; padding: 0.75rem; border-radius: 8px; cursor: pointer;">
                <input type="radio" name="payMethod" value="Debit / Credit Card" />
                <span>💳 <strong>Debit / RuPay / Visa Card</strong></span>
              </label>
            </div>
          </div>

          <!-- Dynamic UPI Preview -->
          <div id="upiPaymentPreview" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; text-align: center;">
            <p style="font-size: 0.85rem; font-weight: 600; color: #0a2558; margin-bottom: 0.5rem;">
              Instant Zero-MDR UPI Payment to Subramanian Polytechnic College Accounts
            </p>
            <div style="display: inline-block; padding: 8px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 0.5rem;">
              <div style="font-size: 0.75rem; color: #059669; font-weight: 700; margin-bottom: 4px;">SCAN ANY UPI APP</div>
              <div id="paymentUpiQrCode"></div>
            </div>
            <p style="font-size: 0.775rem; color: #64748b;">
              Virtual Payment Address (VPA): <code style="color: #0a2558;">sptc.college@iob</code>
            </p>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 1rem;">
            <button type="button" class="btn btn-outline" onclick="Fees.closePaymentModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="submitPaymentBtn">
              Confirm &amp; Generate Instant Receipt
            </button>
          </div>
        </form>
      </div>
    `;

    // Render payment QR preview
    const qrTarget = document.getElementById('paymentUpiQrCode');
    if (qrTarget) {
      qrTarget.innerHTML = Receipts.generateQrSvg(`upi://pay?pa=sptc.college@iob&pn=SPTC_Rayavaram&am=${defaultAmount}&cu=INR`);
    }

    const modal = document.getElementById('paymentModal');
    if (modal) modal.classList.add('active');
  },

  closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) modal.classList.remove('active');
  },

  async handlePaymentSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById('submitPaymentBtn');
    const amount = document.getElementById('payAmountInput').value;
    const method = document.querySelector('input[name="payMethod"]:checked').value;

    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = 'Processing Transaction &amp; Webhook...';

    try {
      const paymentData = {
        regNo: this.currentStudentRegNo,
        amount: parseFloat(amount),
        paymentMode: method,
        transactionRef: `UPI/WEB/${Date.now().toString().slice(-8)}`,
        remarks: 'Online fee payment by student via SPTC web portal'
      };

      const result = await API.submitPayment(paymentData);
      this.closePaymentModal();

      // Refresh dashboard
      await this.loadStudentFeeDashboard();

      // Automatically open the generated official receipt
      if (result.receipt && result.receipt.receiptNo) {
        Receipts.showReceiptModal(result.receipt.receiptNo);
      }
    } catch (err) {
      console.error('Payment error:', err);
      alert('Payment processing failed. Please try again.');
      btn.disabled = false;
      btn.innerHTML = 'Confirm &amp; Generate Instant Receipt';
    }
  }
};

window.Fees = Fees;
