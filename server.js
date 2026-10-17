const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to load database
function loadDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading database:', err);
    return { college: {}, departments: [], students: [], feeBilledItems: [], receipts: [] };
  }
}

// Helper to save database
function saveDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving database:', err);
    return false;
  }
}

// Helper to generate verification hash
function generateReceiptHash(receiptNo, regNo, amount, date) {
  return crypto.createHash('sha256').update(`${receiptNo}-${regNo}-${amount}-${date}-SPTC-RAYAVARAM`).digest('hex').substring(0, 16);
}

// ======================== API ROUTES ========================

// 1. College Info & Departments
app.get('/api/college-info', (req, res) => {
  const db = loadDb();
  res.json({
    college: db.college,
    departments: db.departments
  });
});

// 2. All Students (for Cashier & Demo Switcher)
app.get('/api/students', (req, res) => {
  const db = loadDb();
  const studentsWithDues = db.students.map(s => {
    const studentBills = db.feeBilledItems.filter(b => b.regNo === s.regNo);
    const studentReceipts = db.receipts.filter(r => r.regNo === s.regNo);
    const totalBilled = studentBills.reduce((acc, b) => acc + (b.netPayable || 0), 0);
    const totalPaid = studentReceipts.reduce((acc, r) => acc + (r.amount || 0), 0);
    const balanceDue = Math.max(0, totalBilled - totalPaid);

    return {
      ...s,
      totalBilled,
      totalPaid,
      balanceDue,
      receiptCount: studentReceipts.length
    };
  });
  res.json(studentsWithDues);
});

// 3. Unified Authentication (Student & Staff/Faculty)
app.post('/api/auth/login', (req, res) => {
  const { identifier, password, roleType } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter both your login identifier and password.' });
  }

  const db = loadDb();
  const trimmedId = identifier.trim().toLowerCase();

  // A. Staff Authentication Check
  if (roleType === 'STAFF' || roleType === 'CASHIER' || roleType === 'PRINCIPAL' || roleType === 'HOD' || trimmedId.includes('@sptc.org.in') || trimmedId === 'cashier' || trimmedId === 'principal' || trimmedId.startsWith('hod')) {
    const staffMember = (db.staff || []).find(s => 
      s.username.toLowerCase() === trimmedId || 
      s.email.toLowerCase() === trimmedId
    );

    if (!staffMember) {
      return res.status(404).json({ error: 'Staff account not found. Please verify your employee username or email.' });
    }

    if (staffMember.password !== password.trim()) {
      return res.status(401).json({ error: 'Incorrect staff password. Please try again or contact IT support.' });
    }

    const token = crypto.createHash('sha256').update(`${staffMember.id}-${staffMember.role}-${Date.now()}-SPTC-STAFF`).digest('hex');

    return res.json({
      success: true,
      role: staffMember.role,
      userType: 'STAFF',
      token,
      profile: {
        id: staffMember.id,
        username: staffMember.username,
        email: staffMember.email,
        name: staffMember.name,
        role: staffMember.role,
        title: staffMember.title,
        department: staffMember.department,
        phone: staffMember.phone
      },
      message: `Welcome, ${staffMember.name} (${staffMember.title})`
    });
  }

  // B. Student Authentication Check
  const student = db.students.find(s => 
    s.regNo.trim() === identifier.trim() || 
    s.admissionNo.toLowerCase() === trimmedId ||
    (s.email && s.email.toLowerCase() === trimmedId)
  );

  if (!student) {
    return res.status(404).json({ error: 'Student registration number not found in SPTC records.' });
  }

  // Verify PIN / Password
  if (student.pin && student.pin !== password.trim()) {
    return res.status(401).json({ error: 'Invalid PIN / Date of Birth. Default format: DDMMYYYY' });
  }

  const token = crypto.createHash('sha256').update(`${student.regNo}-STUDENT-${Date.now()}-SPTC-STUDENT`).digest('hex');

  return res.json({
    success: true,
    role: 'STUDENT',
    userType: 'STUDENT',
    token,
    profile: {
      regNo: student.regNo,
      admissionNo: student.admissionNo,
      name: student.name,
      department: student.department,
      deptCode: student.deptCode,
      currentYear: student.currentYear,
      currentSemester: student.currentSemester,
      quota: student.quota,
      isHosteller: student.isHosteller,
      busRoute: student.busRoute,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      email: student.email,
      concessionType: student.concessionType,
      concessionAmount: student.concessionAmount
    },
    message: `Welcome, ${student.name} (${student.department})`
  });
});

// Backward-compatible student login endpoint
app.post('/api/auth/student-login', (req, res) => {
  const { regNo, pin } = req.body;
  req.body.identifier = regNo;
  req.body.password = pin;
  req.body.roleType = 'STUDENT';
  
  const db = loadDb();
  const student = db.students.find(s => s.regNo.trim() === regNo?.trim());
  if (!student) {
    return res.status(404).json({ error: 'Student registration number not found in SPTC records.' });
  }
  if (pin && student.pin && student.pin !== pin.trim()) {
    return res.status(401).json({ error: 'Invalid PIN / Date of Birth. Format: DDMMYYYY' });
  }

  res.json({
    success: true,
    message: 'Authentication successful',
    role: 'STUDENT',
    student: {
      regNo: student.regNo,
      admissionNo: student.admissionNo,
      name: student.name,
      department: student.department,
      deptCode: student.deptCode,
      currentYear: student.currentYear,
      currentSemester: student.currentSemester,
      quota: student.quota,
      isHosteller: student.isHosteller,
      busRoute: student.busRoute,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      email: student.email,
      concessionType: student.concessionType,
      concessionAmount: student.concessionAmount
    }
  });
});

// Get Current User Session Info
app.get('/api/auth/me', (req, res) => {
  const { regNo, username } = req.query;
  const db = loadDb();

  if (username) {
    const staff = (db.staff || []).find(s => s.username === username || s.email === username);
    if (staff) {
      return res.json({
        authenticated: true,
        userType: 'STAFF',
        role: staff.role,
        profile: {
          id: staff.id,
          username: staff.username,
          email: staff.email,
          name: staff.name,
          role: staff.role,
          title: staff.title,
          department: staff.department
        }
      });
    }
  }

  if (regNo) {
    const student = db.students.find(s => s.regNo === regNo);
    if (student) {
      return res.json({
        authenticated: true,
        userType: 'STUDENT',
        role: 'STUDENT',
        profile: student
      });
    }
  }

  res.json({ authenticated: false, message: 'No active session' });
});

// Change Password for Student or Staff
app.post('/api/auth/change-password', (req, res) => {
  const { identifier, currentPassword, newPassword, userType } = req.body;
  if (!identifier || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password/PIN must be at least 4 characters long.' });
  }

  const db = loadDb();

  if (userType === 'STAFF') {
    const staff = (db.staff || []).find(s => s.username === identifier || s.email === identifier);
    if (!staff || staff.password !== currentPassword) {
      return res.status(401).json({ error: 'Invalid current password.' });
    }
    staff.password = newPassword;
    saveDb(db);
    return res.json({ success: true, message: 'Staff password updated successfully.' });
  } else {
    const student = db.students.find(s => s.regNo === identifier);
    if (!student || student.pin !== currentPassword) {
      return res.status(401).json({ error: 'Invalid current PIN/password.' });
    }
    student.pin = newPassword;
    saveDb(db);
    return res.json({ success: true, message: 'Student PIN updated successfully.' });
  }
});

// Get Staff Directory (public/admin)
app.get('/api/staff', (req, res) => {
  const db = loadDb();
  const sanitizedStaff = (db.staff || []).map(s => ({
    id: s.id,
    name: s.name,
    role: s.role,
    title: s.title,
    department: s.department,
    email: s.email
  }));
  res.json(sanitizedStaff);
});

// 4. Student Fee Status & Ledger Breakdown
app.get('/api/student/:regNo/fees', (req, res) => {
  const { regNo } = req.params;
  const db = loadDb();
  const student = db.students.find(s => s.regNo === regNo);

  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const bills = db.feeBilledItems.filter(b => b.regNo === regNo);
  const receipts = db.receipts.filter(r => r.regNo === regNo);

  const totalBilled = bills.reduce((acc, b) => acc + (b.netPayable || 0), 0);
  const totalPaid = receipts.reduce((acc, r) => acc + (r.amount || 0), 0);
  const outstandingBalance = Math.max(0, totalBilled - totalPaid);

  // Group bills by semester
  const semesterBills = bills.map(b => {
    // Find receipts linked to this bill or calculate payment coverage
    return {
      ...b,
      status: totalPaid >= totalBilled ? 'PAID' : (b.dueDate < new Date().toISOString() ? 'OVERDUE' : 'PENDING')
    };
  });

  res.json({
    student,
    summary: {
      totalBilled,
      totalPaid,
      outstandingBalance,
      receiptCount: receipts.length,
      nextDueDate: bills.length > 0 ? bills[bills.length - 1].dueDate : 'N/A'
    },
    bills: semesterBills,
    receipts
  });
});

// 5. Student Receipt Vault (Current & Migrated Tally Receipts)
app.get('/api/student/:regNo/receipts', (req, res) => {
  const { regNo } = req.params;
  const db = loadDb();
  const receipts = db.receipts.filter(r => r.regNo === regNo);

  // Sort descending by date
  receipts.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json(receipts);
});

// 6. Single Receipt by Receipt Number
app.get('/api/receipts/:receiptNo', (req, res) => {
  const { receiptNo } = req.params;
  const db = loadDb();
  const decodedNo = decodeURIComponent(receiptNo);
  const receipt = db.receipts.find(r => r.receiptNo === decodedNo || r.receiptNo === receiptNo);

  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found' });
  }

  const student = db.students.find(s => s.regNo === receipt.regNo) || { name: 'Unknown', department: 'SPTC' };

  res.json({
    college: db.college,
    student,
    receipt
  });
});

// 7. Process New Payment (Student UPI/Card or Cashier Counter)
app.post('/api/payments/create', (req, res) => {
  const { regNo, amount, paymentMode, transactionRef, remarks, breakdown, billId } = req.body;

  if (!regNo || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Registration number and a valid amount are required.' });
  }

  const db = loadDb();
  const student = db.students.find(s => s.regNo === regNo);

  if (!student) {
    return res.status(404).json({ error: 'Student not found in college database.' });
  }

  const numericAmount = parseFloat(amount);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const yearSeq = `${now.getFullYear()}-${(now.getFullYear() + 1).toString().slice(-2)}`;
  const countThisYear = db.receipts.filter(r => r.date && r.date.startsWith(now.getFullYear().toString())).length + 1;
  const receiptNo = `SPTC/REC/${yearSeq}/${countThisYear.toString().padStart(4, '0')}`;
  const verificationHash = generateReceiptHash(receiptNo, regNo, numericAmount, dateStr);

  const newReceipt = {
    receiptNo,
    regNo,
    billId: billId || `BILL-${regNo}-SEM${student.currentSemester}`,
    date: dateStr,
    amount: numericAmount,
    paymentMode: paymentMode || 'UPI / Student Portal',
    transactionRef: transactionRef || `TXN-${Date.now().toString().slice(-8)}`,
    academicYear: `${now.getFullYear()}-${now.getFullYear() + 1}`,
    semester: `Semester ${student.currentSemester}`,
    source: paymentMode.includes('Cashier') ? 'SPTC Cashier Counter #1' : 'SPTC Student Online Portal',
    breakdown: breakdown || {
      'Tuition Fee Payment': numericAmount
    },
    verificationHash,
    remarks: remarks || 'Payment processed and verified'
  };

  db.receipts.push(newReceipt);
  saveDb(db);

  res.json({
    success: true,
    message: 'Payment recorded successfully and digital receipt generated.',
    receipt: newReceipt
  });
});

// 8. Import from Legacy Tally (XML / File Simulation)
app.post('/api/tally/import-xml', (req, res) => {
  const { xmlContent } = req.body;
  const db = loadDb();

  // Read provided XML or fallback to sample Tally export
  let content = xmlContent;
  if (!content) {
    const samplePath = path.join(__dirname, 'data', 'sample_tally_export.xml');
    if (fs.existsSync(samplePath)) {
      content = fs.readFileSync(samplePath, 'utf-8');
    } else {
      return res.status(400).json({ error: 'No Tally XML content provided or found.' });
    }
  }

  // Parse Tally Vouchers
  const voucherMatches = content.match(/<VOUCHER[\s\S]*?<\/VOUCHER>/gi) || [];
  const importedReceipts = [];

  for (const vch of voucherMatches) {
    const vchNoMatch = vch.match(/<VOUCHERNUMBER>(.*?)<\/VOUCHERNUMBER>/i);
    const dateMatch = vch.match(/<DATE>(.*?)<\/DATE>/i);
    const partyMatch = vch.match(/<PARTYLEDGERNAME>(.*?)<\/PARTYLEDGERNAME>/i);
    const amountMatch = vch.match(/<AMOUNT>([\d\.\-]+)<\/AMOUNT>/i);
    const narrationMatch = vch.match(/<NARRATION>(.*?)<\/NARRATION>/i);

    if (vchNoMatch && partyMatch && amountMatch) {
      const vchNo = vchNoMatch[1].trim();
      const party = partyMatch[1].trim();
      const rawAmount = Math.abs(parseFloat(amountMatch[1]));
      let rawDate = dateMatch ? dateMatch[1].trim() : '20240901';
      // format YYYY-MM-DD
      const formattedDate = rawDate.length === 8 
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : '2024-09-01';

      // Extract RegNo from party name (e.g. "23204014 - R. ANITHA (EEE)")
      const regMatch = party.match(/\b\d{8}\b/);
      const regNo = regMatch ? regMatch[0] : '22201045';

      // Check if already imported
      const exists = db.receipts.some(r => r.receiptNo === vchNo);
      if (!exists) {
        const receiptObj = {
          receiptNo: vchNo,
          regNo: regNo,
          billId: `BILL-${regNo}-TALLY`,
          date: formattedDate,
          amount: rawAmount,
          paymentMode: 'Migrated Tally Counter Ledger',
          transactionRef: `TALLY-IMP-${vchNo.replace(/[^a-zA-Z0-9]/g, '')}`,
          academicYear: '2024-2025',
          semester: 'Migrated Record',
          source: 'Migrated from Outdated Tally PC (XML Sync)',
          breakdown: {
            'Tally Ledger Balance Credit': rawAmount
          },
          verificationHash: generateReceiptHash(vchNo, regNo, rawAmount, formattedDate),
          remarks: narrationMatch ? narrationMatch[1] : 'Migrated from Tally XML'
        };
        db.receipts.push(receiptObj);
        importedReceipts.push(receiptObj);
      }
    }
  }

  saveDb(db);

  res.json({
    success: true,
    importedCount: importedReceipts.length,
    totalVouchersFound: voucherMatches.length,
    importedReceipts,
    message: `Successfully migrated ${importedReceipts.length} legacy vouchers into active college receipts archive.`
  });
});

// 9. Daily Cash-Book & Cashier Audit Summary
app.get('/api/reports/cash-book', (req, res) => {
  const db = loadDb();
  const receipts = db.receipts;

  const modeTotals = {};
  let totalCollections = 0;

  receipts.forEach(r => {
    const mode = r.paymentMode || 'Other';
    modeTotals[mode] = (modeTotals[mode] || 0) + r.amount;
    totalCollections += r.amount;
  });

  // Calculate Defaulters list
  const defaulters = [];
  db.students.forEach(s => {
    const studentBills = db.feeBilledItems.filter(b => b.regNo === s.regNo);
    const studentReceipts = db.receipts.filter(r => r.regNo === s.regNo);
    const billed = studentBills.reduce((acc, b) => acc + (b.netPayable || 0), 0);
    const paid = studentReceipts.reduce((acc, r) => acc + (r.amount || 0), 0);
    const balance = billed - paid;

    if (balance > 0) {
      defaulters.push({
        regNo: s.regNo,
        name: s.name,
        department: s.department,
        currentYear: s.currentYear,
        parentPhone: s.parentPhone,
        totalBilled: billed,
        totalPaid: paid,
        balanceDue: balance
      });
    }
  });

  res.json({
    totalCollections,
    totalReceiptsIssued: receipts.length,
    modeBreakdown: modeTotals,
    defaultersCount: defaulters.length,
    defaultersList: defaulters,
    recentTransactions: receipts.slice(-10).reverse()
  });
});

// 10. Public Verification Endpoint for QR Code
app.get('/api/verify/:hash', (req, res) => {
  const { hash } = req.params;
  const db = loadDb();
  const receipt = db.receipts.find(r => r.verificationHash === hash);

  if (!receipt) {
    return res.status(404).json({
      valid: false,
      message: 'Receipt verification failed. No matching official record found at Subramanian Polytechnic College.'
    });
  }

  const student = db.students.find(s => s.regNo === receipt.regNo) || { name: 'Verified Student' };

  res.json({
    valid: true,
    message: 'Official Tamper-Proof Fee Receipt Verified by SPTC Accounts & DOTE Cell',
    details: {
      institution: db.college.name,
      doteCode: db.college.code,
      location: db.college.location,
      receiptNo: receipt.receiptNo,
      date: receipt.date,
      studentName: student.name,
      regNo: receipt.regNo,
      department: student.department,
      amount: receipt.amount,
      paymentMode: receipt.paymentMode,
      transactionRef: receipt.transactionRef
    }
  });
});

// Fallback to index.html for single-page app navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🏛️  Subramanian Polytechnic College (SPTC) Web Portal`);
  console.log(`💳  Students Fees Management System running at:`);
  console.log(`👉  http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
