// SPTC Data Store & API Client

const API = {
  async getCollegeInfo() {
    const res = await fetch('/api/college-info');
    return await res.json();
  },

  async getAllStudents() {
    const res = await fetch('/api/students');
    return await res.json();
  },

  async studentLogin(regNo, pin) {
    const res = await fetch('/api/auth/student-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regNo, pin })
    });
    return await res.json();
  },

  async getStudentFees(regNo) {
    const res = await fetch(`/api/student/${regNo}/fees`);
    return await res.json();
  },

  async getStudentReceipts(regNo) {
    const res = await fetch(`/api/student/${regNo}/receipts`);
    return await res.json();
  },

  async getReceiptDetails(receiptNo) {
    const res = await fetch(`/api/receipts/${encodeURIComponent(receiptNo)}`);
    return await res.json();
  },

  async submitPayment(paymentData) {
    const res = await fetch('/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    return await res.json();
  },

  async importTallyXml(xmlContent) {
    const res = await fetch('/api/tally/import-xml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xmlContent })
    });
    return await res.json();
  },

  async getCashBookReport() {
    const res = await fetch('/api/reports/cash-book');
    return await res.json();
  },

  async verifyHash(hash) {
    const res = await fetch(`/api/verify/${hash}`);
    return await res.json();
  }
};

window.API = API;
