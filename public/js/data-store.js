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

  async login(identifier, password, roleType = 'STUDENT') {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, roleType })
    });
    return await res.json();
  },

  async studentLogin(regNo, pin) {
    return this.login(regNo, pin, 'STUDENT');
  },

  async staffLogin(usernameOrEmail, password) {
    return this.login(usernameOrEmail, password, 'STAFF');
  },

  async checkSession(regNo, username) {
    const params = new URLSearchParams();
    if (regNo) params.append('regNo', regNo);
    if (username) params.append('username', username);
    const res = await fetch(`/api/auth/me?${params.toString()}`);
    return await res.json();
  },

  async changePassword(identifier, currentPassword, newPassword, userType) {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, currentPassword, newPassword, userType })
    });
    return await res.json();
  },

  async getStaffDirectory() {
    const res = await fetch('/api/staff');
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
