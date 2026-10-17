// SPTC Main Web Application Controller

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Core Services
  try {
    await Fees.init('22201045');
    await Cashier.init();
    populateDemoStudentSwitcher();
  } catch (err) {
    console.error('App init error:', err);
  }

  // Navigation tab switcher
  window.switchView = function(viewName) {
    const publicSection = document.getElementById('publicCollegeSection');
    const studentSection = document.getElementById('studentFeesSection');
    const cashierSection = document.getElementById('cashierDeskSection');
    const tabBtns = document.querySelectorAll('.tab-btn');

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

    window.scrollTo({ top: 380, behavior: 'smooth' });
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

    select.value = Fees.currentStudentRegNo;
  }

  window.onDemoStudentChange = function(regNo) {
    Fees.init(regNo);
    window.switchView('fees');
  };

  // Student Login Modal Trigger
  window.openStudentLoginModal = function() {
    const modal = document.getElementById('studentLoginModal');
    if (modal) modal.classList.add('active');
  };

  window.closeStudentLoginModal = function() {
    const modal = document.getElementById('studentLoginModal');
    if (modal) modal.classList.remove('active');
  };

  window.handleStudentLogin = async function(e) {
    e.preventDefault();
    const regNo = document.getElementById('loginRegNo').value.trim();
    const pin = document.getElementById('loginPin').value.trim();
    const btn = document.getElementById('loginSubmitBtn');

    if (!regNo) {
      alert('Please enter your DOTE Register Number');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = 'Verifying with SPTC Database...';

    try {
      const res = await API.studentLogin(regNo, pin);
      if (res.success) {
        closeStudentLoginModal();
        Fees.init(regNo);
        window.switchView('fees');
        document.getElementById('demoStudentSelect').value = regNo;
      } else {
        alert(res.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      alert('Login error. Please check DOTE Reg No (e.g., 22201045)');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Sign In to Student Vault';
    }
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
