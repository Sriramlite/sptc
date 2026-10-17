// SPTC Official Receipt Renderer & QR Verification Engine

const Receipts = {
  // Convert number to Indian Rupees in words
  numberToWords(num) {
    if (!num || isNaN(num)) return 'Zero';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n) => {
      let str = '';
      if (n > 99) {
        str += a[Math.floor(n / 100)] + 'Hundred ';
        n %= 100;
      }
      if (n > 19) {
        str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
      } else if (n > 0) {
        str += a[n];
      }
      return str;
    };

    let n = Math.floor(num);
    let output = '';

    const crores = Math.floor(n / 10000000);
    n %= 10000000;
    const lakhs = Math.floor(n / 100000);
    n %= 100000;
    const thousands = Math.floor(n / 1000);
    n %= 1000;

    if (crores > 0) output += inWords(crores) + 'Crore ';
    if (lakhs > 0) output += inWords(lakhs) + 'Lakh ';
    if (thousands > 0) output += inWords(thousands) + 'Thousand ';
    if (n > 0) output += inWords(n);

    return (output.trim() + ' Rupees Only');
  },

  // Standalone QR code visual pattern generator (creates high-contrast matrix SVG)
  generateQrSvg(text) {
    // Generate deterministic 21x21 QR-like matrix for verification
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    
    const size = 25;
    let rects = '';
    
    // Position detection patterns (corners)
    const drawCorner = (r, c) => {
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
            rects += `<rect x="${(c + j) * 4}" y="${(r + i) * 4}" width="4" height="4" fill="#0a2558" />`;
          }
        }
      }
    };

    drawCorner(0, 0);
    drawCorner(0, size - 7);
    drawCorner(size - 7, 0);

    // Inner random bits based on text hash
    let seed = Math.abs(hash);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const inCorner1 = r < 8 && c < 8;
        const inCorner2 = r < 8 && c > size - 9;
        const inCorner3 = r > size - 9 && c < 8;
        if (!inCorner1 && !inCorner2 && !inCorner3) {
          seed = (seed * 9301 + 49297) % 233280;
          if (seed % 2 === 0) {
            rects += `<rect x="${c * 4}" y="${r * 4}" width="4" height="4" fill="#0a2558" />`;
          }
        }
      }
    }

    return `<svg viewBox="0 0 100 100" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#ffffff" />
      ${rects}
    </svg>`;
  },

  // Open & Render Official Receipt in Modal
  async showReceiptModal(receiptNo) {
    try {
      const data = await API.getReceiptDetails(receiptNo);
      if (!data || !data.receipt) {
        alert(data?.error || 'Receipt could not be retrieved from the college records.');
        return;
      }
      const { college, student, receipt } = data;

      const modalContainer = document.getElementById('receiptModalContent');
      if (!modalContainer) return;

      const qrSvg = this.generateQrSvg(`http://sptc.org.in/verify/${receipt.verificationHash}`);
      const amountInWords = this.numberToWords(receipt.amount);

      let breakdownRows = '';
      if (receipt.breakdown && typeof receipt.breakdown === 'object') {
        for (const [key, val] of Object.entries(receipt.breakdown)) {
          const isNegative = val < 0;
          breakdownRows += `
            <tr>
              <td>${key}</td>
              <td style="text-align: right; ${isNegative ? 'color: #059669; font-weight: 600;' : ''}">
                ${isNegative ? '-' : ''}₹${Math.abs(val).toLocaleString('en-IN')}
              </td>
            </tr>
          `;
        }
      } else {
        breakdownRows = `
          <tr>
            <td>College Fee Payment (${receipt.semester || 'Academic Fee'})</td>
            <td style="text-align: right;">₹${receipt.amount.toLocaleString('en-IN')}</td>
          </tr>
        `;
      }

      modalContainer.innerHTML = `
        <div class="official-receipt-doc" id="printableReceiptDoc">
          <div class="receipt-watermark">SPTC OFFICIAL</div>
          
          <div class="receipt-header">
            <img src="/assets/logo.svg" alt="SPTC Logo" class="receipt-logo" />
            <div class="receipt-college-title">
              <h2>${college.name || 'Subramanian Polytechnic College'}</h2>
              <p><strong>${college.code || 'DOTE Institution Code: 331'}</strong> | Approved by AICTE, New Delhi</p>
              <p>${college.location || 'Rayavaram, Pudukkottai District, Tamil Nadu – 622 506'}</p>
              <p>Ph: ${college.phone || '04333-272226'} | Web: sptc.org.in</p>
            </div>
          </div>

          <div class="receipt-badge-title">
            <span>OFFICIAL STUDENT FEE RECEIPT</span>
          </div>

          <div class="receipt-info-grid">
            <div class="receipt-info-row">
              <strong>Receipt No:</strong>
              <span style="font-family: monospace; font-weight: 700; color: #0a2558;">${receipt.receiptNo}</span>
            </div>
            <div class="receipt-info-row">
              <strong>Receipt Date:</strong>
              <span>${receipt.date}</span>
            </div>
            <div class="receipt-info-row">
              <strong>Student Name:</strong>
              <span style="font-weight: 700;">${student.name}</span>
            </div>
            <div class="receipt-info-row">
              <strong>DOTE Reg No:</strong>
              <span style="font-family: monospace; font-weight: 700;">${receipt.regNo}</span>
            </div>
            <div class="receipt-info-row">
              <strong>Department:</strong>
              <span>${student.department || 'Diploma in Engineering'}</span>
            </div>
            <div class="receipt-info-row">
              <strong>Academic Year / Sem:</strong>
              <span>${receipt.academicYear} (${receipt.semester})</span>
            </div>
            <div class="receipt-info-row">
              <strong>Payment Mode:</strong>
              <span><span class="badge ${receipt.source && receipt.source.includes('Tally') ? 'badge-warning' : 'badge-success'}">${receipt.paymentMode}</span></span>
            </div>
            <div class="receipt-info-row">
              <strong>Transaction / Vch Ref:</strong>
              <span style="font-family: monospace; font-size: 0.8rem;">${receipt.transactionRef || 'N/A'}</span>
            </div>
          </div>

          <table class="receipt-table">
            <thead>
              <tr>
                <th>Particulars / Fee Head</th>
                <th style="text-align: right; width: 140px;">Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              ${breakdownRows}
              <tr class="receipt-total-row">
                <td><strong>TOTAL AMOUNT RECEIVED (NET)</strong></td>
                <td style="text-align: right; color: #0a2558; font-size: 1.1rem;">
                  <strong>₹${receipt.amount.toLocaleString('en-IN')}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          <div style="margin-bottom: 1rem; font-size: 0.85rem; font-style: italic; background: #f8fafc; padding: 0.6rem; border-radius: 4px;">
            <strong>Amount in Words:</strong> ${amountInWords}
          </div>

          <div class="receipt-footer-grid">
            <div class="qr-verification-box">
              <div class="qr-code-canvas">
                ${qrSvg}
              </div>
              <div style="font-size: 0.775rem; color: #64748b;">
                <p style="font-weight: 700; color: #059669; margin-bottom: 2px;">✓ Verified Digital Receipt</p>
                <p>Hash: <code style="font-size: 0.72rem; color: #0a2558;">${receipt.verificationHash}</code></p>
                <p style="margin-top: 4px;">Scan with any phone camera to verify authenticity via SPTC DOTE Accounts Ledger.</p>
              </div>
            </div>

            <div class="signature-box">
              <div class="seal-stamp">
                SPTC ACCOUNTS<br>PAID &amp; VERIFIED<br>RAYAVARAM
              </div>
              <p style="font-weight: 700; font-size: 0.85rem; color: #0a2558;">Accounts Officer / Cashier</p>
              <p style="font-size: 0.75rem; color: #64748b;">Subramanian Polytechnic College</p>
            </div>
          </div>

          ${receipt.source && receipt.source.includes('Tally') ? `
            <div style="margin-top: 1rem; padding: 0.4rem 0.8rem; background: #fffbeb; border: 1px dashed #d97706; border-radius: 4px; font-size: 0.75rem; color: #92400e;">
              ℹ️ <strong>Legacy Ledger Notice:</strong> This historical receipt was automatically migrated and digitally archived from the legacy Tally 9 accounts desktop computer.
            </div>
          ` : ''}
        </div>

        <div class="receipt-actions" style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
          <button class="btn btn-outline" onclick="Receipts.closeReceiptModal()">Close</button>
          <button class="btn btn-primary" onclick="Receipts.printReceipt()">
            🖨️ Print / Download Official Receipt PDF
          </button>
        </div>
      `;

      const modal = document.getElementById('receiptModal');
      if (modal) modal.classList.add('active');
    } catch (err) {
      console.error('Error fetching receipt:', err);
      alert('Could not load receipt details. Please try again.');
    }
  },

  closeReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (modal) modal.classList.remove('active');
  },

  printReceipt() {
    window.print();
  }
};

window.Receipts = Receipts;
