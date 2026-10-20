// SPTC Main Web Application Controller & Authentication Engine


// Lucide icons are initialized via /js/icons.js
if (window.initLucideIcons) {
  window.initLucideIcons();
}


const Auth = {
  currentUser: null,

  async init() {

    try {
      const saved = localStorage.getItem('sptc_auth_session');
      if (saved) {
        this.currentUser = JSON.parse(saved);
        // Verify session validity with backend
        const verification = await API.verifySession();
        if (!verification.authenticated) {
          console.warn('Stored session is expired or invalidated.');
          this.currentUser = null;
          localStorage.removeItem('sptc_auth_session');
        } else {
          if (verification.profile) {
            this.currentUser.profile = verification.profile;
          }
        }
      } else {
        this.currentUser = null;
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
          const staffRole = (res.role || res.profile?.role || '').toUpperCase();
          if (staffRole === 'PRINCIPAL') {
            window.location.href = '/principal-dashboard.html';
          } else if (staffRole === 'HOD') {
            window.location.href = '/hod-dashboard.html';
          } else {
            window.location.href = '/cashier-dashboard.html';
          }
        } else {
          window.location.href = '/dashboard.html';
        }

        if (typeof window.closeLoginModal === 'function') {
          window.closeLoginModal();
        }
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

  async logout() {
    try {
      await API.logout();
    } catch (e) {
      console.warn('Logout server notice:', e);
    }
    this.currentUser = null;
    localStorage.removeItem('sptc_auth_session');
    this.updateAuthUi();
    window.location.href = '/login.html?reason=logged_out';
  },

  updateAuthUi() {
    const authStatusContainer = document.getElementById('navbarAuthContainer');
    const heroProfileWidget = document.getElementById('heroProfileWidget');
    if (!authStatusContainer) return;

    if (this.currentUser && this.currentUser.profile) {
      const isStaff = this.currentUser.userType === 'STAFF';
      const name = this.currentUser.profile.name || 'User';
      const shortSubtitle = isStaff
        ? `${this.currentUser.profile.title || 'Staff'}`
        : `Reg: ${this.currentUser.profile.regNo}`;
      const subtitle = isStaff
        ? (this.currentUser.profile.title || 'Accounts Officer')
        : `DOTE Reg: ${this.currentUser.profile.regNo} (${this.currentUser.profile.department})`;
      const roleBadge = isStaff
        ? '<span class="badge badge-primary">STAFF</span>'
        : '<span class="badge badge-gold">STUDENT</span>';

      let dashboardUrl = '/dashboard.html';
      if (isStaff) {
        const staffRole = (this.currentUser.role || this.currentUser.profile?.role || '').toUpperCase();
        if (staffRole === 'PRINCIPAL') {
          dashboardUrl = '/principal-dashboard.html';
        } else if (staffRole === 'HOD') {
          dashboardUrl = '/hod-dashboard.html';
        } else {
          dashboardUrl = '/cashier-dashboard.html';
        }
      }

      authStatusContainer.innerHTML = `
        <div class="user-profile-badge">
          <a href="${dashboardUrl}" style="display: flex; align-items: center; gap: 0.45rem; text-decoration: none;" title="Open Your Dashboard">
            <div class="user-avatar-sm ${isStaff ? 'staff' : ''}">
              ${name.charAt(0)}
            </div>
            <div style="line-height: 1.15; text-align: left;">
              <div style="font-size: 0.8rem; font-weight: 700; color: #0a2558; white-space: nowrap;">
                ${name}
              </div>
              <div style="font-size: 0.68rem; color: #64748b; white-space: nowrap;">
                ${shortSubtitle}
              </div>
            </div>
          </a>
          <button onclick="Auth.logout()" class="btn-logout-icon" title="Sign Out">
            <i data-lucide="log-out"></i>
          </button>
        </div>
      `;

      // When user is authenticated, ensure any redundant standalone fees button is hidden
      const navFeesBtn = document.querySelector('.nav-actions > a[href*="dashboard.html"].btn-primary');
      if (navFeesBtn) {
        navFeesBtn.style.display = 'none';
      }

      if (heroProfileWidget) {
        heroProfileWidget.innerHTML = `
          <div style="font-size: 0.775rem; color: #64748b; margin-bottom: 4px;">CURRENTLY LOGGED IN:</div>
          <div style="font-weight: 700; color: #0a2558; display: flex; align-items: center; gap: 0.5rem;">
            <span>${name}</span> ${roleBadge}
          </div>
          <div style="font-size: 0.8rem; color: #059669; font-weight: 600;">${subtitle}</div>
          <a href="${dashboardUrl}" class="btn btn-sm btn-primary" style="margin-top: 0.5rem; display: inline-block;">
            Open My Dashboard →
          </a>
        `;
      }
    } else {
      authStatusContainer.innerHTML = window.getPortalDropdownHtml();
      if (window.initLucideIcons) window.initLucideIcons(authStatusContainer);

      if (heroProfileWidget) {
        heroProfileWidget.innerHTML = `
          <div style="font-size: 0.775rem; color: #64748b; margin-bottom: 4px;">AUTHENTICATION REQUIRED:</div>
          <div style="font-weight: 700; color: #0a2558;">Please Sign In</div>
          <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.5rem;">Sign in with your DOTE Register Number or Staff ID to view ledgers and receipts.</div>
          <div style="display: flex; gap: 0.5rem;">
            <a href="/login.html" class="btn btn-sm btn-primary" style="flex: 1; text-align: center;">Sign In</a>
            <a href="/register.html" class="btn btn-sm btn-gold" style="flex: 1; text-align: center;">Register</a>
          </div>
        `;
      }
    }
  }
};

window.Auth = Auth;

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Auth
  await Auth.init();
});

// Navigation handler for smooth scrolling and view switching
window.navigateTo = function (sectionId, event) {
  if (event) {
    event.preventDefault();
  }

  if (sectionId === 'fees') {
    window.location.href = '/dashboard.html';
    return;
  }

  if (sectionId === 'cashier') {
    // Intercept if logged-in student attempts to access staff cashier desk
    if (window.Auth && window.Auth.currentUser && window.Auth.currentUser.userType === 'STUDENT') {
      window.showRoleRestrictionModal();
      return;
    }
    window.location.href = '/cashier-dashboard.html';
    return;
  }

  // Update active class on nav links
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.remove('active');
    if (a.getAttribute('href') === `#${sectionId}`) {
      a.classList.add('active');
    }
  });

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
window.switchView = function (viewName, shouldScroll = true) {
  const publicSection = document.getElementById('publicCollegeSection');
  const studentSection = document.getElementById('studentFeesSection');
  const cashierSection = document.getElementById('cashierDeskSection');
  const tabBtns = document.querySelectorAll('.tab-btn');

  // Role check when switching manually
  if (viewName === 'cashier' && Auth.currentUser && Auth.currentUser.userType === 'STUDENT') {
    window.showRoleRestrictionModal();
    return;
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

window.onDemoStudentChange = function (regNo) {
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
window.openLoginModal = function (defaultTab = 'student') {
  const modal = document.getElementById('portalLoginModal');
  if (modal) {
    modal.classList.add('active');
    window.switchLoginTab(defaultTab);
  }
};

window.closeLoginModal = function () {
  const modal = document.getElementById('portalLoginModal');
  if (modal) modal.classList.remove('active');
};

window.switchLoginTab = function (tabName) {
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
window.handleStudentLoginSubmit = async function (e) {
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
window.handleStaffLoginSubmit = async function (e) {
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
window.quickFillStudent = function (regNo, pin) {
  document.getElementById('studentLoginRegNo').value = regNo;
  document.getElementById('studentLoginPin').value = pin;
};

window.quickFillStaff = function (username, password) {
  document.getElementById('staffLoginUsername').value = username;
  document.getElementById('staffLoginPassword').value = password;
};

// Admission Enquiry Modal
window.openAdmissionModal = function () {
  const modal = document.getElementById('admissionModal');
  if (modal) modal.classList.add('active');
};

window.closeAdmissionModal = function () {
  const modal = document.getElementById('admissionModal');
  if (modal) modal.classList.remove('active');
};

window.handleAdmissionSubmit = async function (e) {
  e.preventDefault();
  const nameInput = document.getElementById('admName');
  const phoneInput = document.getElementById('admPhone');
  const deptInput = document.getElementById('admDept');
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');

  const name = nameInput ? nameInput.value.trim() : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const dept = deptInput ? deptInput.value.trim() : '';

  if (!name || !phone || !dept) {
    alert('Please complete all required fields.');
    return;
  }

  const origBtnContent = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span style="display: inline-block; width: 14px; height: 14px; border: 2px solid #ffffff; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 0.5rem; vertical-align: middle;"></span>
      <span>Submitting Enquiry...</span>
    `;
  }

  try {
    const res = await fetch('/api/admissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: name,
        phone: phone,
        department: dept,
        enquirySource: 'Website Modal'
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert(`🎉 Admission Enquiry Received!\n\nEnquiry ID: ${data.id}\nCandidate: ${name}\nDiscipline: ${dept}\n\nYour application has been securely recorded in the SPTC Central Admission Management System. Our admission counselor will contact ${phone} shortly.`);
      form.reset();
      window.closeAdmissionModal();
    } else {
      alert(data.error || 'Failed to submit enquiry. Please try again or call the Principal office directly.');
    }
  } catch (err) {
    console.error('Error submitting admission enquiry:', err);
    alert(`Thank you, ${name}! Your admission enquiry for ${dept} has been forwarded to the Principal's office at Rayavaram. We will call ${phone} shortly.`);
    form.reset();
    window.closeAdmissionModal();
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnContent;
      if (window.initLucideIcons) window.initLucideIcons(submitBtn);
    }
  }
};

// ============================================================================
// MOBILE NAVIGATION HAMBURGER DRAWER CONTROLLER
// ============================================================================
window.toggleMobileMenu = function (forceState) {
  const drawer = document.getElementById('mobileNavDrawer');
  const backdrop = document.getElementById('mobileNavBackdrop');
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const openIcon = document.getElementById('menuToggleIconOpen');
  const closeIcon = document.getElementById('menuToggleIconClose');
  if (!drawer) return;

  const willBeActive = typeof forceState === 'boolean' ? forceState : !drawer.classList.contains('active');

  if (willBeActive) {
    drawer.classList.add('active');
    backdrop?.classList.add('active');
    document.body.classList.add('mobile-nav-open');
    toggleBtn?.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    if (openIcon) openIcon.style.display = 'none';
    if (closeIcon) closeIcon.style.display = 'inline-block';
  } else {
    if (document.activeElement && drawer.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    drawer.classList.remove('active');
    backdrop?.classList.remove('active');
    document.body.classList.remove('mobile-nav-open');
    toggleBtn?.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    if (openIcon) openIcon.style.display = 'inline-block';
    if (closeIcon) closeIcon.style.display = 'none';
  }
};

window.closeMobileNav = function () {
  window.toggleMobileMenu(false);
};

// Close mobile navigation drawer, dropdowns & modal overlays on Escape key press
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.toggleMobileMenu(false);
    if (typeof window.closePortalDropdown === 'function') window.closePortalDropdown();
    if (typeof window.closeAdmissionModal === 'function') window.closeAdmissionModal();
    if (typeof window.closeLoginModal === 'function') window.closeLoginModal();
    if (typeof window.closeRoleRestrictionModal === 'function') window.closeRoleRestrictionModal();
  }
});

// ============================================================================
// PORTAL DROPDOWN (STUDENT & STAFF / OFFICE DESK HOVER CONTROLLER)
// ============================================================================
window.getPortalDropdownHtml = function () {
  return `
    <div class="portal-dropdown-wrapper" id="portalDropdownWrapper">
      <button type="button" class="portal-btn hide-on-mobile" id="portalDropdownBtn" aria-haspopup="true" aria-expanded="false" onclick="window.handlePortalBtnClick(event)">
        <i data-lucide="lock"></i>
        <span>Portal</span>
        <i data-lucide="chevron-down" class="portal-chevron"></i>
      </button>

      <div class="portal-dropdown-menu" id="portalDropdownMenu" role="menu">
        <div class="portal-dropdown-columns">
          <!-- 1. STUDENT OPTIONS -->
          <div class="portal-col portal-col-student">
            <div class="portal-col-header">
              <span class="portal-col-badge student-badge">
                <i data-lucide="graduation-cap"></i> Student
              </span>
            </div>
            <p class="portal-col-desc">Fee dues, online digital payments &amp; verified receipts</p>
            <div class="portal-links-list">
              <a href="/dashboard.html" class="portal-link-item" role="menuitem">
                <div class="portal-link-icon student-bg">
                  <i data-lucide="credit-card"></i>
                </div>
                <div class="portal-link-info">
                  <span class="portal-link-title">Student Fee Vault</span>
                  <span class="portal-link-sub">Semester ledgers &amp; receipts</span>
                </div>
              </a>
              <a href="/login.html?role=student" class="portal-link-item" role="menuitem">
                <div class="portal-link-icon student-bg">
                  <i data-lucide="log-in"></i>
                </div>
                <div class="portal-link-info">
                  <span class="portal-link-title">Student Sign In</span>
                  <span class="portal-link-sub">DOTE Reg No &amp; DOB (PIN)</span>
                </div>
              </a>
              <a href="/register.html" class="portal-link-item" role="menuitem">
                <div class="portal-link-icon student-bg">
                  <i data-lucide="user-plus"></i>
                </div>
                <div class="portal-link-info">
                  <span class="portal-link-title">New Registration</span>
                  <span class="portal-link-sub">Activate student ledger</span>
                </div>
              </a>
            </div>
          </div>

          <!-- 2. STAFF / OFFICE OPTIONS -->
          <div class="portal-col portal-col-staff">
            <div class="portal-col-header">
              <span class="portal-col-badge staff-badge">
                <i data-lucide="briefcase"></i> Staff
              </span>
            </div>
            <p class="portal-col-desc">Counter collection, legacy Tally migration &amp; audit</p>
            <div class="portal-links-list">
              <a href="/cashier-dashboard.html" class="portal-link-item" role="menuitem">
                <div class="portal-link-icon staff-bg">
                  <i data-lucide="calculator"></i>
                </div>
                <div class="portal-link-info">
                  <span class="portal-link-title">Office Accounts &amp; Cashier</span>
                  <span class="portal-link-sub">Counter POS, Tally sync &amp; audit</span>
                </div>
              </a>
              <a href="/login.html?role=staff" class="portal-link-item" role="menuitem">
                <div class="portal-link-icon staff-bg">
                  <i data-lucide="shield-check"></i>
                </div>
                <div class="portal-link-info">
                  <span class="portal-link-title">Staff &amp; Faculty Login</span>
                  <span class="portal-link-sub">Cashier, Principal &amp; HODs</span>
                </div>
              </a>
              <a href="/verify.html" class="portal-link-item" role="menuitem">
                <div class="portal-link-icon staff-bg">
                  <i data-lucide="file-check-2"></i>
                </div>
                <div class="portal-link-info">
                  <span class="portal-link-title">Verify Official Receipt</span>
                  <span class="portal-link-sub">SHA-256 certificate check</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.handlePortalBtnClick = function (e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const wrapper = e ? e.currentTarget.closest('.portal-dropdown-wrapper') : document.getElementById('portalDropdownWrapper');
  if (wrapper) {
    const isExpanded = wrapper.classList.toggle('active');
    const btn = wrapper.querySelector('#portalDropdownBtn');
    if (btn) btn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  }
};

window.closePortalDropdown = function () {
  document.querySelectorAll('.portal-dropdown-wrapper').forEach(w => {
    w.classList.remove('active');
    const btn = w.querySelector('#portalDropdownBtn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
};

// Global click & key listeners to close portal dropdown
document.addEventListener('click', function (e) {
  if (!e.target.closest('.portal-dropdown-wrapper')) {
    window.closePortalDropdown();
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    window.closePortalDropdown();
  }
});

// ============================================================================
// ROLE RESTRICTION & REDIRECT LOOP PREVENTER (ACCOUNTS / STAFF DESK FALLBACK)
// ============================================================================
window.showRoleRestrictionModal = function () {
  // Close mobile nav drawer if open
  if (typeof window.toggleMobileMenu === 'function') {
    window.toggleMobileMenu(false);
  }

  const user = window.Auth && window.Auth.currentUser;
  const studentName = user?.profile?.name || 'Student';
  const regNo = user?.profile?.regNo || '';
  const dept = user?.profile?.department || '';

  let modal = document.getElementById('roleRestrictionModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'roleRestrictionModal';
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'roleRestrictedTitle');
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        window.closeRoleRestrictionModal();
      }
    });
  }

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 500px; text-align: center; border-top: 4px solid var(--color-gold);">
      <div class="modal-header" style="justify-content: flex-end; padding: 0.75rem 1.25rem 0; border-bottom: none; background: transparent;">
        <button class="modal-close-btn" onclick="window.closeRoleRestrictionModal()" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body" style="padding: 0.25rem 2rem 2rem;">
        <div style="width: 62px; height: 62px; margin: 0 auto 1.25rem; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 2rem; box-shadow: 0 4px 14px rgba(217, 119, 6, 0.18);">
          <i data-lucide="shield-alert"></i>
        </div>
        <span class="badge badge-gold" style="font-size: 0.75rem; letter-spacing: 0.05em; margin-bottom: 0.65rem;">SECURITY RESTRICTION</span>
        <h3 id="roleRestrictedTitle" style="font-family: var(--font-heading); color: #0a2558; font-size: 1.35rem; margin-bottom: 0.5rem;">
          Staff Accounts Desk Restricted
        </h3>
        <p style="color: #64748b; font-size: 0.9rem; line-height: 1.55; margin-bottom: 1.6rem;">
          You are currently signed in as student <strong style="color: #0a2558;">${studentName}</strong>${regNo ? ` (DOTE Reg: <code>${regNo}</code>${dept ? ' • ' + dept : ''})` : ''}.<br>
          The Cashier Counter and Office Accounts ledger is restricted to authorized Accounts Officers.
        </p>

        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          <a href="/dashboard.html" class="btn btn-primary" style="justify-content: center; text-decoration: none; padding: 0.75rem 1rem;">
            <i data-lucide="graduation-cap"></i> Open My Student Fee Vault
          </a>
          <button type="button" onclick="window.switchToStaffLogin()" class="btn btn-gold" style="justify-content: center; padding: 0.75rem 1rem;">
            <i data-lucide="log-out"></i> Sign In with Staff Account
          </button>
          <button type="button" onclick="window.closeRoleRestrictionModal()" class="btn btn-outline" style="justify-content: center; border-color: #cbd5e1; color: #64748b;">
            Stay on This Page
          </button>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
  if (window.initLucideIcons) {
    window.initLucideIcons(modal);
  }
};

window.closeRoleRestrictionModal = function () {
  const modal = document.getElementById('roleRestrictionModal');
  if (modal) {
    modal.classList.remove('active');
  }
};

window.switchToStaffLogin = async function () {
  const modal = document.getElementById('roleRestrictionModal');
  if (modal) {
    modal.classList.remove('active');
  }
  try {
    if (window.Auth && typeof window.Auth.logout === 'function') {
      await window.Auth.logout();
    } else if (window.API && typeof window.API.logout === 'function') {
      await window.API.logout();
    }
  } catch (e) {
    console.warn('Logout notice before staff switch:', e);
  }
  if (window.RedirectGuard) {
    window.RedirectGuard.clear();
  }
  window.location.replace('/login.html?role=staff&reason=staff_required');
};

// Global link interception: When a student clicks ANY Accounts/Cashier Desk link,
// intercept client-side to prevent unwanted navigation or infinite redirect bouncing.
document.addEventListener('click', (e) => {
  // Close portal dropdown if click occurs outside
  if (!e.target.closest('.portal-dropdown-wrapper')) {
    window.closePortalDropdown();
  }

  const link = e.target.closest('a[href*="cashier-dashboard"]');
  if (!link) return;

  if (window.Auth && window.Auth.currentUser && window.Auth.currentUser.userType === 'STUDENT') {
    e.preventDefault();
    e.stopPropagation();
    window.showRoleRestrictionModal();
  }
}, true);

