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

  // Standalone QR code visual pattern generator (creates high-contrast standard image with SVG fallback)
  generateQrSvg(text) {
    if (!text) return '';
    const safeText = encodeURIComponent(text);
    return `<img src="/api/qr?text=${safeText}" alt="SPTC Verification QR Code" style="width: 100%; height: 100%; object-fit: contain; display: block;" onerror="this.outerHTML=Receipts.generateQrSvgFallback('${text.replace(/'/g, "\\'")}')" />`;
  },

  // Fallback inline deterministic matrix pattern if offline or API unavailable
  generateQrSvgFallback(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    
    const size = 25;
    let rects = '';
    
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

  // Core Template Builder for Official Receipt
  buildReceiptHtml(data) {
    const { college = {}, student = {}, receipt = {}, verifyUrl } = data;
    const origin = window.location.origin;
    const finalVerifyUrl = verifyUrl || `${origin}/verify/${receipt.verificationHash}`;
    const qrCodeElement = this.generateQrSvg(finalVerifyUrl);
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
          <td style="text-align: right;">₹${(receipt.amount || 0).toLocaleString('en-IN')}</td>
        </tr>
      `;
    }

    return `
      <div class="official-receipt-doc" id="printableReceiptDoc">
        <div class="receipt-watermark">SPTC OFFICIAL</div>
        
        <div class="receipt-header">
          <img src="/assets/logo.svg" alt="SPTC Logo" class="receipt-logo" />
          <div class="receipt-college-title">
            <h2>${college.name || 'Subramanian Polytechnic College'}</h2>
            <p><strong>${college.code || 'DOTE Institution Code: 331'}</strong> | Approved by AICTE, New Delhi</p>
            <p>${college.location || 'Rayavaram, Pudukkottai District, Tamil Nadu – 622 506'}</p>
            <p>Ph: ${college.phone || '+91 6382391625 / 04333-272226'} | Web: sptc.org.in</p>
          </div>
        </div>

        <div class="receipt-badge-title">
          <span>OFFICIAL STUDENT FEE RECEIPT</span>
        </div>

        <div class="receipt-info-grid">
          <div class="receipt-info-row">
            <strong>Receipt No:</strong>
            <span style="font-family: monospace; font-weight: 700; color: #0a2558;">${receipt.receiptNo || 'N/A'}</span>
          </div>
          <div class="receipt-info-row">
            <strong>Receipt Date:</strong>
            <span>${receipt.date || 'N/A'}</span>
          </div>
          <div class="receipt-info-row">
            <strong>Student Name:</strong>
            <span style="font-weight: 700;">${student.name || 'Student'}</span>
          </div>
          <div class="receipt-info-row">
            <strong>DOTE Reg No:</strong>
            <span style="font-family: monospace; font-weight: 700;">${receipt.regNo || student.regNo || 'N/A'}</span>
          </div>
          <div class="receipt-info-row">
            <strong>Department:</strong>
            <span>${student.department || 'Diploma in Engineering'}</span>
          </div>
          <div class="receipt-info-row">
            <strong>Academic Year / Sem:</strong>
            <span>${receipt.academicYear || '2026-2027'} (${receipt.semester || 'Semester Fee'})</span>
          </div>
          <div class="receipt-info-row">
            <strong>Payment Mode:</strong>
            <span><span class="badge ${receipt.source && receipt.source.includes('Tally') ? 'badge-warning' : 'badge-success'}">${receipt.paymentMode || 'Online'}</span></span>
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
                <strong>₹${(receipt.amount || 0).toLocaleString('en-IN')}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <div style="margin-bottom: 1rem; font-size: 0.85rem; font-style: italic; background: #f8fafc; padding: 0.6rem; border-radius: 4px; border: 1px solid #e2e8f0;">
          <strong>Amount in Words:</strong> ${amountInWords}
        </div>

        <div class="receipt-footer-grid">
          <div class="qr-verification-box">
            <div class="qr-code-canvas">
              ${qrCodeElement}
            </div>
            <div style="font-size: 0.775rem; color: #64748b;">
              <p style="font-weight: 700; color: #059669; margin-bottom: 2px; display: flex; align-items: center; gap: 0.35rem;"><i data-lucide="check-circle-2"></i> Verified Digital Receipt</p>
              <p>Hash: <code style="font-size: 0.72rem; color: #0a2558; font-weight: 700;">${receipt.verificationHash || 'N/A'}</code></p>
              <p style="margin-top: 3px; font-size: 0.72rem;">Scan with any phone camera to verify authenticity via SPTC DOTE Accounts Ledger.</p>
              <div style="margin-top: 5px;">
                <a href="${finalVerifyUrl}" target="_blank" style="color: #0a2558; font-size: 0.72rem; font-weight: 700; text-decoration: underline; word-break: break-all; display: inline-flex; align-items: center; gap: 0.35rem;">
                  <i data-lucide="link-2"></i> ${finalVerifyUrl}
                </a>
              </div>
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
          <div style="margin-top: 1rem; padding: 0.4rem 0.8rem; background: #fffbeb; border: 1px dashed #d97706; border-radius: 4px; font-size: 0.75rem; color: #92400e; display: flex; align-items: center; gap: 0.35rem;">
            <i data-lucide="info"></i> <span><strong>Legacy Ledger Notice:</strong> This historical receipt was automatically migrated and digitally archived from the legacy Tally 9 accounts desktop computer.</span>
          </div>
        ` : ''}
      </div>
    `;
  },

  // Open & Render Official Receipt in Modal
  async showReceiptModal(receiptNo) {
    try {
      const data = await API.getReceiptDetails(receiptNo);
      if (!data || !data.receipt) {
        alert(data?.error || 'Receipt could not be retrieved from the college records.');
        return;
      }

      const modalContainer = document.getElementById('receiptModalContent');
      if (!modalContainer) return;

      modalContainer.innerHTML = this.buildReceiptHtml(data);
      if (window.initLucideIcons) window.initLucideIcons(modalContainer);

      const modal = document.getElementById('receiptModal');
      if (modal) modal.classList.add('active');
    } catch (err) {
      console.error('Error fetching receipt:', err);
      alert('Could not load receipt details. Please try again.');
    }
  },

  // Render Official Receipt directly inside a page container (e.g. verify.html)
  renderReceiptDoc(data, container) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    el.innerHTML = this.buildReceiptHtml(data);
    if (window.initLucideIcons) window.initLucideIcons(el);
  },

  closeReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (modal) modal.classList.remove('active');
  },

  printReceipt() {
    const receiptEl = document.getElementById('printableReceiptDoc');
    if (!receiptEl) {
      window.print();
      return;
    }

    try {
      // Remove any previously created print iframe
      let printFrame = document.getElementById('receiptPrintIframe');
      if (printFrame) {
        printFrame.remove();
      }

      printFrame = document.createElement('iframe');
      printFrame.id = 'receiptPrintIframe';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      printFrame.style.visibility = 'hidden';
      document.body.appendChild(printFrame);

      const receiptHtml = receiptEl.outerHTML;
      const frameDoc = printFrame.contentWindow || printFrame.contentDocument;
      const doc = frameDoc.document || frameDoc;

      doc.open();
      doc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SPTC_Official_Fee_Receipt</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #ffffff;
      color: #0f172a;
      margin: 0;
      padding: 0;
    }
    .official-receipt-doc {
      background: #ffffff;
      border: 2.5px solid #0a2558;
      border-radius: 8px;
      padding: 1.5rem 1.75rem;
      position: relative;
      width: 100%;
      max-width: 100%;
    }
    .receipt-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-family: 'Outfit', sans-serif;
      font-size: 4.5rem;
      font-weight: 800;
      color: rgba(10, 37, 88, 0.05);
      pointer-events: none;
      text-transform: uppercase;
      white-space: nowrap;
      z-index: 1;
    }
    .receipt-header {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #d4af37;
      margin-bottom: 1.25rem;
      position: relative;
      z-index: 2;
    }
    .receipt-logo {
      width: 60px;
      height: 60px;
      flex-shrink: 0;
    }
    .receipt-college-title h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      color: #0a2558;
      font-weight: 800;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .receipt-college-title p {
      font-size: 0.775rem;
      color: #475569;
      margin-top: 2px;
    }
    .receipt-badge-title {
      text-align: center;
      margin-bottom: 1.25rem;
      position: relative;
      z-index: 2;
    }
    .receipt-badge-title span {
      display: inline-block;
      background: #0a2558;
      color: #ffffff;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.3rem 1.25rem;
      border-radius: 9999px;
      letter-spacing: 1px;
      font-family: 'Outfit', sans-serif;
    }
    .receipt-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.55rem 1.5rem;
      background: #f8fafc;
      padding: 0.85rem 1.15rem;
      border-radius: 6px;
      margin-bottom: 1.25rem;
      border: 1px solid #e2e8f0;
      position: relative;
      z-index: 2;
    }
    .receipt-info-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 0.25rem;
    }
    .receipt-info-row strong {
      color: #475569;
    }
    .badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
    }
    .badge-success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .badge-warning { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .receipt-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1.25rem;
      position: relative;
      z-index: 2;
    }
    .receipt-table th, .receipt-table td {
      padding: 0.55rem 0.85rem;
      border: 1px solid #cbd5e1;
      font-size: 0.825rem;
    }
    .receipt-table th {
      background: #f1f5f9;
      font-weight: 700;
      color: #0a2558;
    }
    .receipt-total-row td {
      font-weight: 700;
      font-size: 0.95rem;
      background: #f8fafc;
    }
    .receipt-footer-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 1.5rem;
      align-items: center;
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px dashed #94a3b8;
      position: relative;
      z-index: 2;
    }
    .qr-verification-box {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      background: #f8fafc;
      padding: 0.65rem;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .qr-code-canvas {
      width: 72px;
      height: 72px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 3px;
      flex-shrink: 0;
    }
    .signature-box {
      text-align: center;
    }
    .seal-stamp {
      width: 76px;
      height: 76px;
      border: 2px dashed #059669;
      border-radius: 50%;
      margin: 0 auto 0.4rem auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6rem;
      font-weight: 800;
      color: #059669;
      text-transform: uppercase;
      transform: rotate(-10deg);
      line-height: 1.2;
    }
    .receipt-actions {
      display: none !important;
    }
  </style>
</head>
<body>
  ${receiptHtml}
</body>
</html>`);
      doc.close();

      setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      }, 300);
    } catch (e) {
      console.warn('Iframe print error, falling back to window.print():', e);
      window.print();
    }
  }
};

window.Receipts = Receipts;
