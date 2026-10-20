/**
 * Subramanian Polytechnic College (SPTC)
 * Unified Common Footer Component
 * 
 * Usage:
 * Place <div id="sptcFooter"></div> where the footer should appear,
 * and include <script src="/js/footer.js"></script>.
 */

(function () {
  'use strict';

  function getFooterHtml() {
    return `
  <footer class="main-footer">
    <div class="container footer-grid">
      <div class="footer-col">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
          <img src="/assets/logo.svg" alt="SPTC Logo" style="width: 44px; height: 44px;" loading="lazy" decoding="async">
          <h4 style="margin: 0; padding: 0;">SPTC Rayavaram</h4>
        </div>
        <p>
          Subramanian Polytechnic College is a leading technical diploma institution in Pudukkottai, affiliated with
          DOTE Chennai (Code: 331) and approved by AICTE New Delhi.
        </p>
        <p style="font-size: 0.8rem; color: var(--color-accent-gold);">
          Official Web Portal &amp; Cloud Student Fee Vault (Replacing Legacy Tally Desktop).
        </p>
      </div>

      <div class="footer-col">
        <h4>Academic Wings</h4>
        <ul class="footer-links">
          <li><a href="/departments.html#cse">Computer Engineering (CSE)</a></li>
          <li><a href="/departments.html#aiml">Artificial Intelligence &amp; ML (AI&amp;ML)</a></li>
          <li><a href="/departments.html#mech">Mechanical Engineering (MECH)</a></li>
          <li><a href="/departments.html#eee">Electrical &amp; Electronics (EEE)</a></li>
          <li><a href="/departments.html#ece">Electronics &amp; Communication (ECE)</a></li>
          <li><a href="/departments.html#civil">Civil Engineering (CIVIL)</a></li>
          <li><a href="/departments.html#bme">Biomedical Engineering (BME)</a></li>
          <li><a href="/departments.html#mlt">Medical Laboratory Tech (MLT)</a></li>
          <li><a href="/departments.html#basic">Basic Engineering (1st Year)</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Quick Portals &amp; Media</h4>
        <ul class="footer-links">
          <li><a href="/departments.html"><i data-lucide="laptop"></i> All 9 Academic Departments</a></li>
          <li><a href="/gallery.html"><i data-lucide="sparkles"></i> Campus &amp; Event Gallery</a></li>
          <li><a href="/facilities.html"><i data-lucide="building-2"></i> Campus Facilities</a></li>
          <li><a href="/facilities.html#placements"><i data-lucide="briefcase"></i> Placements &amp; Recruiters</a></li>
          <li><a href="/dashboard.html"><i data-lucide="graduation-cap"></i> Student Fees Dashboard</a></li>
          <li><a href="/cashier-dashboard.html"><i data-lucide="briefcase"></i> Accounts &amp; Cashier Desk</a></li>
          <li><a href="/login.html"><i data-lucide="lock"></i> Institutional Sign In</a></li>
          <li><a href="/register.html"><i data-lucide="file-text"></i> Student Portal Registration</a></li>
          <li><a href="/index.html#compliance"><i data-lucide="shield-check"></i> AICTE &amp; DOTE Compliance</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Campus Office</h4>
        <p>Rayavaram, Pudukkottai District,<br>Tamil Nadu, India – 622 506</p>
        <p>Ph: +91 6382391625<br>Email: principal@sptc.org.in</p>
      </div>
    </div>

    <div class="container footer-bottom">
      <p>© 2026 Subramanian Polytechnic College (SPTC), Rayavaram. All Rights Reserved. Affiliated to DOTE Chennai.</p>
    </div>
  </footer>
    `;
  }

  window.renderSPTCFooter = function (targetSelector) {
    const target = typeof targetSelector === 'string'
      ? document.querySelector(targetSelector)
      : (targetSelector || document.getElementById('sptcFooter'));

    if (!target) return;
    target.innerHTML = getFooterHtml();

    if (window.initLucideIcons) {
      window.initLucideIcons(target);
    } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  };

  function autoInitFooter() {
    const mount = document.getElementById('sptcFooter');
    if (mount) {
      window.renderSPTCFooter(mount);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitFooter);
  } else {
    autoInitFooter();
  }
})();
