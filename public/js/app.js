// SPTC Main Web Application Controller & Authentication Engine

const Auth = {
  currentUser: null,

  init() {
    try {
      const saved = localStorage.getItem('sptc_auth_session');
      if (saved) {
        this.currentUser = JSON.parse(saved);
      } else {
        // Default initialized session for seamless preview
        this.currentUser = {
          role: 'STUDENT',
          userType: 'STUDENT',
          token: 'demo_token_vignesh',
          profile: {
            regNo: '22201045',
            name: 'K. Vigneshwaran',
            department: 'Computer Engineering',
            currentYear: 3,
            currentSemester: 6
          }
        };
      }
    } catch (e) {
      console.warn('Failed to parse saved auth session:', e);
      this.currentUser = null;
    }
    this.updateAuthUi();
  },

  async login(identifier, password, roleType = 'STUDENT') {
    try {
      const res = await API.login(identifier, password, roleType);
      if (res.success) {
        this.currentUser = {
          role: res.role,
          userType: res.userType,
          token: res.token,
          profile: res.profile
        };
        localStorage.setItem('sptc_auth_session', JSON.stringify(this.currentUser));
        this.updateAuthUi();
        
        // Route according to role
        if (res.userType === 'STAFF') {
          window.switchView('cashier');
          Cashier.init();
        } else {
          Fees.init(res.profile.regNo);
          window.switchView('fees');
          const demoSelect = document.getElementById('demoStudentSelect');
          if (demoSelect) demoSelect.value = res.profile.regNo;
        }

        window.closeLoginModal();
        alert(res.message || 'Login successful!');
        return { success: true };
      } else {
        alert(res.error || 'Authentication failed. Please verify credentials.');
        return { success: false, error: res.error };
      }
    } catch (err) {
      console.error('Auth login error:', err);
      alert('Unable to authenticate. Please verify network connection or credentials.');
      return { success: false, error: err.message };
    }
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('sptc_auth_session');
    this.updateAuthUi();
    window.switchView('public');
    alert('You have been signed out from the SPTC Institutional Portal.');
  },

  updateAuthUi() {
    const authStatusContainer = document.getElementById('navbarAuthContainer');
    const heroProfileWidget = document.getElementById('heroProfileWidget');
    if (!authStatusContainer) return;

    if (this.currentUser) {
      const isStaff = this.currentUser.userType === 'STAFF';
      const name = this.currentUser.profile.name;
      const subtitle = isStaff 
        ? `${this.currentUser.profile.title || 'College Staff'}` 
        : `DOTE Reg: ${this.currentUser.profile.regNo} (${this.currentUser.profile.department})`;

      const roleBadge = isStaff
        ? `<span class="badge ${this.currentUser.role === 'PRINCIPAL' ? 'badge-gold' : 'badge-primary'}">${this.currentUser.role}</span>`
        : `<span class="badge badge-success">STUDENT</span>`;

      authStatusContainer.innerHTML = `
        <div class="user-profile-badge" style="display: flex; align-items: center; gap: 0.65rem; background: #f8fafc; border: 1.5px solid #cbd5e1; padding: 0.35rem 0.75rem; border-radius: 8px;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: ${isStaff ? 'var(--color-primary)' : 'var(--color-accent-gold)'}; color: ${isStaff ? '#fff' : '#0a2558'}; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">
            ${name.charAt(0)}
          </div>
          <div style="line-height: 1.15; text-align: left;">
            <div style="font-size: 0.825rem; font-weight: 700; color: #0a2558; display: flex; align-items: center; gap: 0.35rem;">
              <span>${name}</span>
              ${roleBadge}
            </div>
            <div style="font-size: 0.7rem; color: #64748b;">${subtitle}</div>
          </div>
          <button onclick="Auth.logout()" class="btn btn-sm btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.725rem; border-color: #cbd5e1; color: #b91c1c; margin-left: 0.25rem;" title="Sign Out">
            🚪 Logout
          </button>
        </div>
      `;

      if (heroProfileWidget) {
        heroProfileWidget.innerHTML = `
          <div style="font-size: 0.775rem; color: #64748b; margin-bottom: 4px;">CURRENTLY LOGGED IN:</div>
          <div style="font-weight: 700; color: #0a2558; display: flex; align-items: center; gap: 0.5rem;">
            <span>${name}</span> ${roleBadge}
          </div>
          <div style="font-size: 0.8rem; color: #059669; font-weight: 600;">${subtitle}</div>
        `;
      }
    } else {
      authStatusContainer.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="window.openLoginModal('student')">
          🎓 Student Login
        </button>
        <button class="btn btn-outline btn-sm" onclick="window.openLoginModal('staff')">
          👔 Staff Login
        </button>
      `;

      if (heroProfileWidget) {
        heroProfileWidget.innerHTML = `
          <div style="font-size: 0.775rem; color: #64748b; margin-bottom: 4px;">AUTHENTICATION REQUIRED:</div>
          <div style="font-weight: 700; color: #0a2558;">Please Sign In</div>
          <div style="font-size: 0.8rem; color: #64748b;">Sign in with your DOTE Register Number or Staff ID to view ledgers and receipts.</div>
        `;
      }
    }
  }
};

window.Auth = Auth;

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Auth
  Auth.init();

  // Initialize Core Services
  try {
    const studentRegNo = Auth.currentUser && Auth.currentUser.userType === 'STUDENT'
      ? Auth.currentUser.profile.regNo
      : '22201045';

    await Fees.init(studentRegNo);
    await Cashier.init();
    populateDemoStudentSwitcher();
  } catch (err) {
    console.error('App init error:', err);
  }

  // Navigation handler for smooth scrolling and view switching
  window.navigateTo = function(sectionId, event) {
    if (event) {
      event.preventDefault();
    }

    const publicSection = document.getElementById('publicCollegeSection');
    const studentSection = document.getElementById('studentFeesSection');
    const cashierSection = document.getElementById('cashierDeskSection');

    // Update active class on nav links
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.remove('active');
      if (a.getAttribute('href') === `#${sectionId}`) {
        a.classList.add('active');
      }
    });

    if (sectionId === 'fees') {
      window.switchView('fees', true);
      return;
    }

    if (sectionId === 'cashier') {
      // Role protection check
      if (Auth.currentUser && Auth.currentUser.userType === 'STUDENT') {
        const confirmSwitch = confirm('The Cashier & Accounts Desk is restricted to College Accounts Staff.\n\nWould you like to log in with an authorized Staff account (e.g. Cashier / Principal)?');
        if (confirmSwitch) {
          window.openLoginModal('staff');
        }
        return;
      }
      window.switchView('cashier', true);
      return;
    }

    // Ensure public section is visible
    publicSection.style.display = 'block';
    studentSection.style.display = 'none';
    cashierSection.style.display = 'none';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-view="public"]')?.classList.add('active');

    if (sectionId === 'home' || !sectionId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      history.pushState(null, null, '#home');
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        const header = document.querySelector('.main-header');
        const headerHeight = header ? header.offsetHeight + 15 : 85;
        const elementPosition = el.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
        history.pushState(null, null, `#${sectionId}`);
      }
    }
  };

  // Navigation tab switcher
  window.switchView = function(viewName, shouldScroll = true) {
    const publicSection = document.getElementById('publicCollegeSection');
    const studentSection = document.getElementById('studentFeesSection');
    const cashierSection = document.getElementById('cashierDeskSection');
    const tabBtns = document.querySelectorAll('.tab-btn');

    // Role check when switching manually
    if (viewName === 'cashier' && Auth.currentUser && Auth.currentUser.userType === 'STUDENT') {
      const confirmSwitch = confirm('The Accounts Desk is reserved for authorized Accounts Office Staff.\n\nWould you like to switch to a Staff Account (e.g. Cashier / Principal)?');
      if (confirmSwitch) {
        window.openLoginModal('staff');
        return;
      }
    }

    tabBtns.forEach(btn => btn.classList.remove('active'));

    if (viewName === 'public') {
      publicSection.style.display = 'block';
      studentSection.style.display = 'none';
      cashierSection.style.display = 'none';
      document.querySelector('[data-view="public"]')?.classList.add('active');
    } else if (viewName === 'fees') {
      publicSection.style.display = 'none';
      studentSection.style.display = 'block';
      cashierSection.style.display = 'none';
      document.querySelector('[data-view="fees"]')?.classList.add('active');
      Fees.loadStudentFeeDashboard();
    } else if (viewName === 'cashier') {
      publicSection.style.display = 'none';
      studentSection.style.display = 'none';
      cashierSection.style.display = 'block';
      document.querySelector('[data-view="cashier"]')?.classList.add('active');
      Cashier.init();
    }

    if (shouldScroll) {
      const portalArea = document.getElementById('portal-area');
      if (portalArea) {
        const header = document.querySelector('.main-header');
        const headerHeight = header ? header.offsetHeight + 10 : 80;
        const elementPosition = portalArea.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    }
  };

  // Populate Demo Student Switcher in top navigation
  async function populateDemoStudentSwitcher() {
    const select = document.getElementById('demoStudentSelect');
    if (!select) return;

    const students = await API.getAllStudents();
    select.innerHTML = students.map(s => `
      <option value="${s.regNo}">
        ${s.name} (${s.regNo}) - ${s.department}
      </option>
    `).join('');

    if (Auth.currentUser && Auth.currentUser.userType === 'STUDENT') {
      select.value = Auth.currentUser.profile.regNo;
    }
  }

  window.onDemoStudentChange = function(regNo) {
    Fees.init(regNo);
    // Update current active student session
    if (Auth.currentUser && Auth.currentUser.userType === 'STUDENT') {
      Auth.currentUser.profile.regNo = regNo;
      localStorage.setItem('sptc_auth_session', JSON.stringify(Auth.currentUser));
      Auth.updateAuthUi();
    }
    window.switchView('fees');
  };

  // Unified Login Modal Controls
  window.openLoginModal = function(defaultTab = 'student') {
    const modal = document.getElementById('portalLoginModal');
    if (modal) {
      modal.classList.add('active');
      window.switchLoginTab(defaultTab);
    }
  };

  window.closeLoginModal = function() {
    const modal = document.getElementById('portalLoginModal');
    if (modal) modal.classList.remove('active');
  };

  window.switchLoginTab = function(tabName) {
    const studentTabBtn = document.getElementById('loginTabStudentBtn');
    const staffTabBtn = document.getElementById('loginTabStaffBtn');
    const studentForm = document.getElementById('studentLoginForm');
    const staffForm = document.getElementById('staffLoginForm');

    if (tabName === 'staff') {
      studentTabBtn?.classList.remove('active');
      staffTabBtn?.classList.add('active');
      if (studentForm) studentForm.style.display = 'none';
      if (staffForm) staffForm.style.display = 'block';
    } else {
      studentTabBtn?.classList.add('active');
      staffTabBtn?.classList.remove('active');
      if (studentForm) studentForm.style.display = 'block';
      if (staffForm) staffForm.style.display = 'none';
    }
  };

  // Student Login Form Submission
  window.handleStudentLoginSubmit = async function(e) {
    e.preventDefault();
    const regNo = document.getElementById('studentLoginRegNo').value.trim();
    const pin = document.getElementById('studentLoginPin').value.trim();
    const btn = document.getElementById('studentLoginBtn');

    if (!regNo || !pin) {
      alert('Please enter your DOTE Registration Number and Date of Birth / PIN');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = 'Verifying DOTE Records...';

    await Auth.login(regNo, pin, 'STUDENT');
    btn.disabled = false;
    btn.innerHTML = 'Sign In as Student';
  };

  // Staff Login Form Submission
  window.handleStaffLoginSubmit = async function(e) {
    e.preventDefault();
    const username = document.getElementById('staffLoginUsername').value.trim();
    const password = document.getElementById('staffLoginPassword').value.trim();
    const btn = document.getElementById('staffLoginBtn');

    if (!username || !password) {
      alert('Please enter your employee username and password');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = 'Authenticating Staff Access...';

    await Auth.login(username, password, 'STAFF');
    btn.disabled = false;
    btn.innerHTML = 'Sign In to Staff Desk';
  };

  // 1-Click Quick Demo Credentials Helper
  window.quickFillStudent = function(regNo, pin) {
    document.getElementById('studentLoginRegNo').value = regNo;
    document.getElementById('studentLoginPin').value = pin;
  };

  window.quickFillStaff = function(username, password) {
    document.getElementById('staffLoginUsername').value = username;
    document.getElementById('staffLoginPassword').value = password;
  };

  // Admission Enquiry Modal
  window.openAdmissionModal = function() {
    const modal = document.getElementById('admissionModal');
    if (modal) modal.classList.add('active');
  };

  window.closeAdmissionModal = function() {
    const modal = document.getElementById('admissionModal');
    if (modal) modal.classList.remove('active');
  };

  window.handleAdmissionSubmit = function(e) {
    e.preventDefault();
    const name = document.getElementById('admName').value;
    const phone = document.getElementById('admPhone').value;
    const dept = document.getElementById('admDept').value;
    alert(`Thank you, ${name}! Your admission enquiry for ${dept} has been submitted to the Principal's office at Rayavaram. Our admission team will contact ${phone} shortly.`);
    closeAdmissionModal();
  };
});
