/**
 * Subramanian Polytechnic College (SPTC)
 * Unified Common Navbar & Navigation Drawer Component
 * 
 * Usage in any HTML page:
 * 1. Place <div id="sptcNavbar"></div> right after <body>
 * 2. Include <script src="/js/navbar.js"></script>
 */

(function () {
  'use strict';

  function getCurrentActiveKey() {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    if (hash === '#placements' || (path.includes('facilities') && hash === '#placements')) {
      return 'placements';
    }
    if (path.includes('facilities')) {
      return 'facilities';
    }
    if (path.includes('departments')) {
      return 'departments';
    }
    if (path.includes('gallery')) {
      return 'gallery';
    }
    if (path.includes('verify')) {
      return 'verify';
    }
    if (hash === '#about') return 'about';
    if (hash === '#compliance') return 'compliance';
    if (hash === '#contact') return 'contact';
    
    // Default to home for root or index.html
    if (path === '/' || path.endsWith('/index.html') || path === '') {
      return 'home';
    }
    return '';
  }

  function getNavbarHtml(activeKey) {
    const isHome = activeKey === 'home';
    const isAbout = activeKey === 'about';
    const isDept = activeKey === 'departments';
    const isGallery = activeKey === 'gallery';
    const isFacilities = activeKey === 'facilities';
    const isPlacements = activeKey === 'placements';
    const isCompliance = activeKey === 'compliance';
    const isContact = activeKey === 'contact';

    return `
  <!-- ======================== 1. TOP ANNOUNCEMENT STRIP ======================== -->
  <aside class="top-bar">
    <div class="container top-bar-inner">
      <div class="top-bar-left">
        <div class="top-bar-item">
          <i data-lucide="map-pin"></i> <span>Rayavaram, Pudukkottai – 622 506</span>
        </div>
        <div class="top-bar-item">
          <i data-lucide="phone"></i> <span>04333-272226 / +91 6382391625</span>
        </div>
        <div class="top-bar-item">
          <i data-lucide="landmark"></i> <strong>DOTE: 331</strong> | AICTE Approved
        </div>
      </div>
      <div class="top-bar-right">
        <a href="/departments.html" style="color: #fce076; font-weight: 600;"><i data-lucide="award"></i> Admissions 2026-27</a>
        <span style="color: rgba(255,255,255,0.3);">|</span>
        <a href="/verify.html" style="color: #ffffff; font-weight: 600;"><i data-lucide="file-check-2"></i> Verify Receipt</a>
        <span style="color: rgba(255,255,255,0.3);">|</span>
        <a href="/login.html" style="color: #93c5fd; font-weight: 600;"><i data-lucide="lock"></i> Portal Login</a>
      </div>
    </div>
  </aside>

  <!-- ======================== 2. MAIN HEADER & NAVBAR ======================== -->
  <header class="main-header">
    <div class="container navbar">
      <a href="/index.html#home" class="brand-link">
        <img src="/assets/logo.svg" alt="SPTC Crest" class="brand-logo-img" loading="lazy" decoding="async">
        <div class="brand-text">
          <h1 class="brand-name">Subramanian Polytechnic College</h1>
          <p class="brand-sub">Rayavaram, Pudukkottai • Estd. 1983 (DOTE: 331)</p>
        </div>
      </a>

      <nav>
        <ul class="nav-links">
          <li><a href="/index.html#home" class="${isHome ? 'active' : ''}">Home</a></li>
          <li><a href="/index.html#about" class="${isAbout ? 'active' : ''}">About</a></li>
          <li><a href="/departments.html" class="${isDept ? 'active' : ''}">Departments</a></li>
          <li><a href="/gallery.html" class="${isGallery ? 'active' : ''}">Gallery</a></li>
          <li><a href="/facilities.html" class="${isFacilities ? 'active' : ''}">Facilities</a></li>
          <li><a href="/facilities.html#placements" class="${isPlacements ? 'active' : ''}">Placements</a></li>
          <li><a href="/index.html#compliance" class="${isCompliance ? 'active' : ''}">Compliance</a></li>
          <li><a href="/index.html#contact" class="${isContact ? 'active' : ''}">Contact</a></li>
        </ul>
      </nav>

      <div class="nav-actions">
        <button class="btn btn-gold btn-sm hide-on-mobile" onclick="window.openAdmissionModal()">
          Admission
        </button>
        <div id="navbarAuthContainer" style="display: flex; align-items: center;">
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
                    <a href="/principal-dashboard.html" class="portal-link-item" role="menuitem">
                      <div class="portal-link-icon staff-bg" style="background: rgba(124, 58, 237, 0.12); color: #7c3aed;">
                        <i data-lucide="crown"></i>
                      </div>
                      <div class="portal-link-info">
                        <span class="portal-link-title">Principal's Desk</span>
                        <span class="portal-link-sub">Faculty &amp; student governance</span>
                      </div>
                    </a>
                    <a href="/hod-dashboard.html" class="portal-link-item" role="menuitem">
                      <div class="portal-link-icon staff-bg" style="background: rgba(37, 99, 235, 0.12); color: #2563eb;">
                        <i data-lucide="book-open"></i>
                      </div>
                      <div class="portal-link-info">
                        <span class="portal-link-title">HOD Department Portal</span>
                        <span class="portal-link-sub">3-Year batches &amp; student registry</span>
                      </div>
                    </a>
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
        </div>
        <!-- Mobile Navigation Hamburger Button -->
        <button class="mobile-menu-toggle" id="mobileMenuToggle" aria-label="Toggle navigation menu" aria-expanded="false" onclick="window.toggleMobileMenu()">
          <i data-lucide="menu" id="menuToggleIconOpen"></i>
          <i data-lucide="x" id="menuToggleIconClose" style="display: none;"></i>
        </button>
      </div>
    </div>
  </header>

  <!-- Mobile Navigation Drawer Backdrop & Drawer Panel (Direct Child of Body) -->
  <div class="mobile-nav-backdrop" id="mobileNavBackdrop" onclick="window.toggleMobileMenu(false)"></div>
  <aside class="mobile-nav-drawer" id="mobileNavDrawer" aria-hidden="true">
    <div class="mobile-drawer-header">
      <div class="mobile-drawer-brand">
        <img src="/assets/logo.svg" alt="SPTC Crest" class="mobile-drawer-logo" loading="lazy" decoding="async">
        <div class="mobile-drawer-brand-text">
          <strong>SPTC Rayavaram</strong>
          <small>DOTE: 331 • AICTE Approved</small>
        </div>
      </div>
      <button class="mobile-drawer-close" aria-label="Close menu" onclick="window.toggleMobileMenu(false)">
        <i data-lucide="x"></i>
      </button>
    </div>

    <div class="mobile-drawer-body">
      <div class="mobile-drawer-group-label">Navigation Menu</div>
      <ul class="mobile-nav-menu">
        <li>
          <a href="/index.html#home" class="mobile-menu-item ${isHome ? 'active' : ''}" onclick="window.toggleMobileMenu(false)">
            <i data-lucide="building"></i>
            <span>Home</span>
          </a>
        </li>
        <li>
          <a href="/index.html#about" class="mobile-menu-item ${isAbout ? 'active' : ''}" onclick="window.toggleMobileMenu(false)">
            <i data-lucide="info"></i>
            <span>About SPTC</span>
          </a>
        </li>
        <li>
          <a href="/departments.html" class="mobile-menu-item ${isDept ? 'active' : ''}">
            <i data-lucide="laptop"></i>
            <span>Academic Departments</span>
            <span class="drawer-pill-tag">9 Wings</span>
          </a>
        </li>
        <li>
          <a href="/gallery.html" class="mobile-menu-item ${isGallery ? 'active' : ''}">
            <i data-lucide="sparkles"></i>
            <span>Campus &amp; Event Gallery</span>
            <span class="drawer-pill-tag gold">Photos</span>
          </a>
        </li>
        <li>
          <a href="/facilities.html" class="mobile-menu-item ${isFacilities ? 'active' : ''}">
            <i data-lucide="building-2"></i>
            <span>Facilities &amp; Transport</span>
          </a>
        </li>
        <li>
          <a href="/facilities.html#placements" class="mobile-menu-item ${isPlacements ? 'active' : ''}">
            <i data-lucide="briefcase"></i>
            <span>Training &amp; Placements</span>
          </a>
        </li>
        <li>
          <a href="/index.html#compliance" class="mobile-menu-item ${isCompliance ? 'active' : ''}" onclick="window.toggleMobileMenu(false)">
            <i data-lucide="shield-check"></i>
            <span>AICTE &amp; DOTE Compliance</span>
          </a>
        </li>
        <li>
          <a href="/index.html#contact" class="mobile-menu-item ${isContact ? 'active' : ''}" onclick="window.toggleMobileMenu(false)">
            <i data-lucide="phone"></i>
            <span>Contact &amp; Location</span>
          </a>
        </li>
      </ul>

      <div class="mobile-drawer-group-label" style="margin-top: 1.5rem;">Institutional Portals</div>
      <div class="mobile-drawer-actions">
        <a href="/principal-dashboard.html" class="btn btn-outline btn-block" style="border-color: #7c3aed; color: #7c3aed;">
          <i data-lucide="crown"></i> Principal's Executive Desk
        </a>
        <a href="/hod-dashboard.html" class="btn btn-outline btn-block" style="border-color: #2563eb; color: #2563eb;">
          <i data-lucide="book-open"></i> HOD Department Portal
        </a>
        <a href="/dashboard.html" class="btn btn-primary btn-block">
          <i data-lucide="graduation-cap"></i> Student Fees Vault
        </a>
        <a href="/cashier-dashboard.html" class="btn btn-outline btn-block">
          <i data-lucide="briefcase"></i> Accounts &amp; Cashier POS Desk
        </a>
        <div class="mobile-auth-grid">
          <a href="/login.html" class="btn btn-secondary">
            <i data-lucide="lock"></i> Sign In
          </a>
          <a href="/register.html" class="btn btn-gold">
            <i data-lucide="user-plus"></i> Register
          </a>
        </div>
        <button class="btn btn-gold btn-block" onclick="window.toggleMobileMenu(false); window.openAdmissionModal();" style="margin-top: 0.5rem;">
          <i data-lucide="file-text"></i> Online Admission Enquiry
        </button>
      </div>

      <div class="mobile-drawer-footer">
        <div><i data-lucide="map-pin"></i> Rayavaram, Pudukkottai – 622 506</div>
      </div>
    </div>
  </aside>

  <!-- ======================== 3. DIPLOMA ADMISSION ENQUIRY MODAL ======================== -->
  <div class="modal-overlay" id="admissionModal">
    <div class="modal-box" style="max-width: 500px; background: #ffffff; border-radius: var(--radius-xl); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);">
      <div class="modal-header">
        <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="file-text"></i> Diploma Admission Enquiry 2026-27</h3>
        <button class="modal-close-btn" onclick="window.closeAdmissionModal()">&times;</button>
      </div>
      <div class="modal-body">
        <form onsubmit="window.handleAdmissionSubmit(event)">
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label" style="display: block; margin-bottom: 0.4rem; font-weight: 600; color: #1e293b;">Candidate Full Name *</label>
            <input type="text" id="admName" class="form-control" placeholder="e.g. R. Karthikeyan" required />
          </div>
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label" style="display: block; margin-bottom: 0.4rem; font-weight: 600; color: #1e293b;">Parent / Contact Mobile Number *</label>
            <input type="tel" id="admPhone" class="form-control" placeholder="10-digit mobile number" required />
          </div>
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label" style="display: block; margin-bottom: 0.4rem; font-weight: 600; color: #1e293b;">Preferred Diploma Department *</label>
            <select id="admDept" class="form-control" required>
              <option value="Computer Engineering">Computer Engineering (CSE)</option>
              <option value="Artificial Intelligence and Machine Learning">Artificial Intelligence &amp; ML (AI&amp;ML)</option>
              <option value="Mechanical Engineering">Mechanical Engineering (MECH)</option>
              <option value="Electrical & Electronics">Electrical &amp; Electronics (EEE)</option>
              <option value="Electronics & Communication">Electronics &amp; Communication (ECE)</option>
              <option value="Civil Engineering">Civil Engineering (CIVIL)</option>
              <option value="Biomedical Engineering">Biomedical Engineering (BME)</option>
              <option value="Medical Laboratory Technology">Medical Laboratory Technology (MLT)</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label" style="display: block; margin-bottom: 0.4rem; font-weight: 600; color: #1e293b;">Hostel / Bus Requirement:</label>
            <select id="admResidence" class="form-control">
              <option>Day Scholar (College Bus Needed)</option>
              <option>Hosteller (Boarding Needed)</option>
              <option>Self Conveyance</option>
            </select>
          </div>
          <button type="submit" class="btn btn-gold" style="width: 100%; justify-content: center; font-weight: 700; padding: 0.75rem 1rem;">
            Submit Admission Enquiry to Principal Office
          </button>
        </form>
      </div>
    </div>
  </div>
    `;
  }

  // Define global handlers if not already defined
  if (!window.openAdmissionModal) {
    window.openAdmissionModal = function () {
      const modal = document.getElementById('admissionModal');
      if (modal) modal.classList.add('active');
    };
  }

  if (!window.closeAdmissionModal) {
    window.closeAdmissionModal = function () {
      const modal = document.getElementById('admissionModal');
      if (modal) modal.classList.remove('active');
    };
  }

  if (!window.handlePortalBtnClick) {
    window.handlePortalBtnClick = function (e) {
      if (e) e.stopPropagation();
      const menu = document.getElementById('portalDropdownMenu');
      const btn = document.getElementById('portalDropdownBtn');
      if (!menu) return;
      const isOpen = menu.classList.contains('active');
      if (isOpen) {
        menu.classList.remove('active');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      } else {
        menu.classList.add('active');
        if (btn) btn.setAttribute('aria-expanded', 'true');
      }
    };

    document.addEventListener('click', function (e) {
      const menu = document.getElementById('portalDropdownMenu');
      const btn = document.getElementById('portalDropdownBtn');
      if (!menu) return;
      if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
        menu.classList.remove('active');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (!window.toggleMobileMenu) {
    window.toggleMobileMenu = function (forceState) {
      const drawer = document.getElementById('mobileNavDrawer');
      const backdrop = document.getElementById('mobileNavBackdrop');
      const toggleBtn = document.getElementById('mobileMenuToggle');
      const iconOpen = document.getElementById('menuToggleIconOpen');
      const iconClose = document.getElementById('menuToggleIconClose');
      if (!drawer || !backdrop) return;

      const willOpen = typeof forceState === 'boolean'
        ? forceState
        : !drawer.classList.contains('active');

      if (willOpen) {
        drawer.classList.add('active');
        backdrop.classList.add('active');
        document.body.classList.add('drawer-open');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
        if (iconOpen) iconOpen.style.display = 'none';
        if (iconClose) iconClose.style.display = 'block';
      } else {
        drawer.classList.remove('active');
        backdrop.classList.remove('active');
        document.body.classList.remove('drawer-open');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
        if (iconOpen) iconOpen.style.display = 'block';
        if (iconClose) iconClose.style.display = 'none';
      }
    };
  }

  window.renderSPTCNavbar = function (targetSelector, activeKeyOverride) {
    const target = typeof targetSelector === 'string'
      ? document.querySelector(targetSelector)
      : (targetSelector || document.getElementById('sptcNavbar'));

    if (!target) return;

    const activeKey = activeKeyOverride || getCurrentActiveKey();
    target.innerHTML = getNavbarHtml(activeKey);

    // Initialize Lucide icons on newly inserted navbar elements
    if (window.initLucideIcons) {
      window.initLucideIcons(target);
    } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    // Refresh auth state in the navbar
    if (window.Auth && typeof window.Auth.updateAuthUi === 'function') {
      window.Auth.updateAuthUi();
    }
  };

  // Auto-mount if #sptcNavbar container is present
  function autoInit() {
    const mount = document.getElementById('sptcNavbar');
    if (mount) {
      window.renderSPTCNavbar(mount);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // Update active status when hash changes (e.g., clicking #placements)
  window.addEventListener('hashchange', function () {
    const mount = document.getElementById('sptcNavbar');
    if (mount) {
      window.renderSPTCNavbar(mount);
    }
  });

})();
