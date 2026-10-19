// SPTC Data Store & API Client with Strict Authentication Controls

// ============================================================================
// REDIRECT LOOP PROTECTION & ROLE FALLBACK CIRCUIT BREAKER
// ============================================================================
const RedirectGuard = {
  KEY: 'sptc_redirect_hops',
  MAX_HOPS: 2,
  WINDOW_MS: 4000,

  recordHop(targetUrl) {
    try {
      const now = Date.now();
      const raw = sessionStorage.getItem(this.KEY);
      let list = raw ? JSON.parse(raw) : [];
      // Clean up hops older than WINDOW_MS
      list = list.filter(item => (now - item.time) < this.WINDOW_MS);
      list.push({ path: targetUrl || window.location.pathname, time: now });
      sessionStorage.setItem(this.KEY, JSON.stringify(list));

      if (list.length > this.MAX_HOPS) {
        console.warn('[RedirectGuard] Circuit breaker tripped! Potential redirect loop prevented:', list);
        return false; // Loop detected!
      }
      return true; // Safe
    } catch (e) {
      return true;
    }
  },

  clear() {
    try {
      sessionStorage.removeItem(this.KEY);
    } catch (e) {}
  },

  isLooping() {
    try {
      const now = Date.now();
      const raw = sessionStorage.getItem(this.KEY);
      if (!raw) return false;
      const list = JSON.parse(raw).filter(item => (now - item.time) < this.WINDOW_MS);
      return list.length >= this.MAX_HOPS;
    } catch (e) {
      return false;
    }
  }
};

window.RedirectGuard = RedirectGuard;

const API = {
  // Retrieve token from local session storage
  getToken() {
    try {
      const saved = localStorage.getItem('sptc_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.token || null;
      }
    } catch (e) {
      console.warn('Failed to read auth token from storage:', e);
    }
    return null;
  },

  // Build standard authenticated headers
  getAuthHeaders(customHeaders = {}) {
    const headers = { ...customHeaders };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  // Public: College Info
  async getCollegeInfo() {
    const res = await fetch('/api/college-info');
    return await res.json();
  },

  // Protected: Staff Only - All Students with balances
  async getAllStudents() {
    const res = await fetch('/api/students', {
      headers: this.getAuthHeaders()
    });
    if (res.status === 401 || res.status === 403) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Access denied. Administrative staff credentials required.', unauthorized: true };
    }
    return await res.json();
  },

  // Alias for getAllStudents
  async getStudents() {
    return this.getAllStudents();
  },

  // Authentication: Unified Login
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

  // Strict Server-Side Session Verification
  async verifySession() {
    const token = this.getToken();
    if (!token) {
      return { authenticated: false, error: 'No active session token found' };
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: this.getAuthHeaders()
      });

      if (!res.ok) {
        // If 401 Unauthorized or expired, clean up stale local token
        localStorage.removeItem('sptc_auth_session');
        return { authenticated: false, error: 'Session expired or invalidated' };
      }

      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Session verification network error:', err);
      return { authenticated: false, error: 'Network error verifying session' };
    }
  },

  // Strict Server-Side Logout
  async logout() {
    const token = this.getToken();
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: this.getAuthHeaders({ 'Content-Type': 'application/json' })
        });
      }
    } catch (e) {
      console.warn('Logout network notice:', e);
    } finally {
      localStorage.removeItem('sptc_auth_session');
    }
    return { success: true };
  },

  // Protected: Change Password / PIN
  async changePassword(currentPassword, newPassword) {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ currentPassword, newPassword })
    });
    return await res.json();
  },

  // Public: Staff Directory
  async getStaffDirectory() {
    const res = await fetch('/api/staff');
    return await res.json();
  },

  // Protected: Student Fees (Student can only view their own; Staff can view any)
  async getStudentFees(regNo) {
    const res = await fetch(`/api/student/${regNo}/fees`, {
      headers: this.getAuthHeaders()
    });
    if (res.status === 401 || res.status === 403) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Access denied or session expired.', unauthorized: true };
    }
    return await res.json();
  },

  // Protected: Student Receipts
  async getStudentReceipts(regNo) {
    const res = await fetch(`/api/student/${regNo}/receipts`, {
      headers: this.getAuthHeaders()
    });
    if (res.status === 401 || res.status === 403) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Access denied or session expired.', unauthorized: true };
    }
    return await res.json();
  },

  // Public/Shared: Receipt Details for print/view
  async getReceiptDetails(receiptNo) {
    const res = await fetch(`/api/receipts/${encodeURIComponent(receiptNo)}`, {
      headers: this.getAuthHeaders()
    });
    return await res.json();
  },

  // Public/Shared: Verify receipt by SHA-256 hash or token (Publicly accessible)
  async verifyReceipt(hash) {
    const res = await fetch(`/api/verify/${encodeURIComponent(hash)}`, {
      headers: { 'Accept': 'application/json' }
    });
    return await res.json();
  },

  // Protected: Submit Payment (Requires authenticated session)
  async submitPayment(paymentData) {
    const res = await fetch('/api/payments/create', {
      method: 'POST',
      headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(paymentData)
    });
    return await res.json();
  },

  // Protected: Staff Only - Import Tally XML
  async importTallyXml(xmlContent) {
    const res = await fetch('/api/tally/import-xml', {
      method: 'POST',
      headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ xmlContent })
    });
    return await res.json();
  },

  // Protected: Staff Only - Daily Cash Book
  async getCashBookReport() {
    const res = await fetch('/api/reports/cash-book', {
      headers: this.getAuthHeaders()
    });
    if (res.status === 401 || res.status === 403) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Access denied.', unauthorized: true };
    }
    return await res.json();
  },

  // Protected: Staff Only - Paginated Past Transactions (20 rows per page default)
  async getTransactions({ page = 1, limit = 20, search = '', paymentMode = '', regNo = '' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    if (search) params.append('search', search);
    if (paymentMode) params.append('paymentMode', paymentMode);
    if (regNo) params.append('regNo', regNo);

    const res = await fetch(`/api/transactions?${params.toString()}`, {
      headers: this.getAuthHeaders()
    });
    if (res.status === 401 || res.status === 403) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Access denied.', unauthorized: true };
    }
    return await res.json();
  },

  // Protected: Staff Only - Set / Adjust Student Total Fees per Year
  async setStudentFees(regNo, feeData) {
    const res = await fetch(`/api/students/${encodeURIComponent(regNo)}/set-fees`, {
      method: 'POST',
      headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(feeData)
    });
    return await res.json();
  },

  // Protected: Staff Only - Full Student Ledger and Payment History
  async getStudentLedger(regNo) {
    const res = await fetch(`/api/students/${encodeURIComponent(regNo)}/ledger`, {
      headers: this.getAuthHeaders()
    });
    if (res.status === 401 || res.status === 403) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Access denied.', unauthorized: true };
    }
    return await res.json();
  },

  // Protected: Principal Only - Overview & Institutional Statistics
  async getPrincipalOverview() {
    const res = await fetch('/api/principal/overview', {
      headers: this.getAuthHeaders()
    });
    if (res.status === 401 || res.status === 403) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Principal authorization required.', unauthorized: true };
    }
    return await res.json();
  },

  // Protected: HOD / Principal - Department Overview & 3-Year Batch Grouping
  async getHodOverview(department = '') {
    const url = department ? `/api/hod/overview?department=${encodeURIComponent(department)}` : '/api/hod/overview';
    const res = await fetch(url, {
      headers: this.getAuthHeaders()
    });
    if (res.status === 401 || res.status === 403) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'HOD or Principal authorization required.', unauthorized: true };
    }
    return await res.json();
  },

  // Protected: Principal Only - Full Staff Directory
  async getPrincipalStaff() {
    const res = await fetch('/api/principal/staff', {
      headers: this.getAuthHeaders()
    });
    if (res.status === 401 || res.status === 403) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Access denied.', unauthorized: true };
    }
    return await res.json();
  },

  // Protected: Principal Only - Add New Staff Member
  async createStaff(staffData) {
    const res = await fetch('/api/principal/staff', {
      method: 'POST',
      headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(staffData)
    });
    return await res.json();
  },

  // Protected: Principal Only - Update Staff Member
  async updateStaff(id, staffData) {
    const res = await fetch(`/api/principal/staff/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(staffData)
    });
    return await res.json();
  },

  // Protected: Principal Only - Reset Staff Password
  async resetStaffPassword(id, newPassword) {
    const res = await fetch(`/api/principal/staff/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ newPassword })
    });
    return await res.json();
  },

  // Protected: Principal Only - Delete Staff Member
  async deleteStaff(id) {
    const res = await fetch(`/api/principal/staff/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return await res.json();
  },

  // Protected: Principal Only - Enroll New Student
  async enrollStudent(studentData) {
    const res = await fetch('/api/principal/students', {
      method: 'POST',
      headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(studentData)
    });
    return await res.json();
  },

  // Protected: Principal Only - Update Student Profile
  async updateStudent(regNo, studentData) {
    const res = await fetch(`/api/principal/students/${encodeURIComponent(regNo)}`, {
      method: 'PUT',
      headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(studentData)
    });
    return await res.json();
  },

  // Protected: Principal Only - Delete Student
  async deleteStudent(regNo) {
    const res = await fetch(`/api/principal/students/${encodeURIComponent(regNo)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return await res.json();
  },

  // Public: Verify Hash
  async verifyHash(hash) {
    const res = await fetch(`/api/verify/${hash}`);
    return await res.json();
  }
};

window.API = API;
