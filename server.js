const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const QRCode = require('qrcode');

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'production';
const DB_FILE = path.join(__dirname, 'data', 'database.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

// ======================== SECURITY & MIDDLEWARE ========================
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Deployment Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Disable caching on API endpoints
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Static assets: serve HTML with no-cache so updates apply immediately without browser caching locks
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// ======================== DATABASE HELPERS ========================
function loadDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading database:', err);
    return { college: {}, departments: [], students: [], feeBilledItems: [], receipts: [], staff: [] };
  }
}

// Atomic safe save to prevent JSON corruption on sudden restarts
function saveDb(data) {
  try {
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('Atomic database save failed, attempting direct write:', err);
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error('Fatal database save error:', e);
      return false;
    }
  }
}

function generateReceiptHash(receiptNo, regNo, amount, date) {
  return crypto.createHash('sha256').update(`${receiptNo}-${regNo}-${amount}-${date}-SPTC-RAYAVARAM`).digest('hex').substring(0, 16);
}

// ======================== SERVER-SIDE SESSION STORE ========================
const SessionManager = {
  sessions: new Map(), // token -> sessionObj

  init() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        const data = JSON.parse(raw);
        const now = Date.now();
        for (const [token, session] of Object.entries(data)) {
          if (session.expiresAt && session.expiresAt > now) {
            this.sessions.set(token, session);
          }
        }
        console.log(`[AUTH] Restored ${this.sessions.size} active sessions from storage.`);
      }
    } catch (e) {
      console.warn('[AUTH] Could not restore existing sessions:', e.message);
    }

    // Periodic cleanup of expired sessions every 15 minutes
    setInterval(() => this.cleanup(), 15 * 60 * 1000);
  },

  persist() {
    try {
      const obj = Object.fromEntries(this.sessions);
      const tmpFile = `${SESSIONS_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(obj, null, 2), 'utf-8');
      fs.renameSync(tmpFile, SESSIONS_FILE);
    } catch (e) {
      console.error('[AUTH] Error persisting sessions:', e.message);
    }
  },

  createSession(profile, userType, role, req) {
    // Cryptographically secure 256-bit token
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const session = {
      token,
      userType,
      role,
      id: profile.regNo || profile.id || profile.username,
      profile,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + (24 * 60 * 60 * 1000), // 24-hour validity
      lastActive: new Date(now).toISOString(),
      ip: req?.ip || req?.socket?.remoteAddress || 'unknown',
      userAgent: req?.headers['user-agent'] || 'unknown'
    };

    this.sessions.set(token, session);
    this.persist();
    return session;
  },

  get(token) {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    if (session.expiresAt && session.expiresAt < Date.now()) {
      this.sessions.delete(token);
      this.persist();
      return null;
    }

    session.lastActive = new Date().toISOString();
    return session;
  },

  destroy(token) {
    if (!token) return false;
    const existed = this.sessions.delete(token);
    if (existed) {
      this.persist();
      console.log(`[AUTH] Session ${token.substring(0, 8)}... invalidated.`);
    }
    return existed;
  },

  cleanup() {
    const now = Date.now();
    let changed = false;
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt && session.expiresAt < now) {
        this.sessions.delete(token);
        changed = true;
      }
    }
    if (changed) {
      this.persist();
      console.log(`[AUTH] Expired sessions purged. Active count: ${this.sessions.size}`);
    }
  }
};

SessionManager.init();

// ======================== BRUTE-FORCE RATE LIMITER ========================
const LoginRateLimiter = {
  attempts: new Map(), // key -> { count, firstAttempt, lockedUntil }

  check(key) {
    const record = this.attempts.get(key);
    if (!record) return { allowed: true };
    const now = Date.now();
    if (record.lockedUntil && record.lockedUntil > now) {
      const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, waitSeconds };
    }
    // Reset window after 10 minutes of inactivity
    if (now - record.firstAttempt > 10 * 60 * 1000 && !record.lockedUntil) {
      this.attempts.delete(key);
      return { allowed: true };
    }
    return { allowed: true };
  },

  recordFailure(key) {
    const now = Date.now();
    let record = this.attempts.get(key);
    if (!record || (record.lockedUntil && record.lockedUntil <= now)) {
      record = { count: 0, firstAttempt: now, lockedUntil: 0 };
    }
    record.count++;
    if (record.count >= 5) {
      record.lockedUntil = now + (15 * 60 * 1000); // 15-minute lock
      console.warn(`[SECURITY] Excessive failed logins for ${key}. Locked for 15 minutes.`);
    }
    this.attempts.set(key, record);
    return record;
  },

  recordSuccess(key) {
    this.attempts.delete(key);
  }
};

// ======================== AUTHENTICATION MIDDLEWARE ========================
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return req.headers['x-session-token'] || req.query.token || null;
}

// 1. Strict Authenticate Middleware
function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required. Please sign in.', 
      code: 'UNAUTHORIZED' 
    });
  }

  const session = SessionManager.get(token);
  if (!session) {
    return res.status(401).json({ 
      error: 'Invalid or expired session. Please sign in again.', 
      code: 'SESSION_EXPIRED' 
    });
  }

  req.user = session;
  next();
}

// 2. Strict Staff-Only Middleware
function requireStaff(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.userType !== 'STAFF') {
      return res.status(403).json({ 
        error: 'Access denied. Administrative staff credentials required.', 
        code: 'FORBIDDEN' 
      });
    }
    next();
  });
}

// 3. Strict Student or Staff Middleware
function requireStudentOrStaff(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.userType === 'STAFF') {
      return next(); // Staff can view any student ledger
    }

    if (req.user.userType === 'STUDENT') {
      const requestedRegNo = req.params.regNo || req.body.regNo;
      if (requestedRegNo && req.user.profile.regNo !== requestedRegNo) {
        return res.status(403).json({ 
          error: 'Access forbidden. Students may only view and pay their own student fee records.', 
          code: 'FORBIDDEN' 
        });
      }
      return next();
    }

    return res.status(403).json({ error: 'Access denied.', code: 'FORBIDDEN' });
  });
}

// ======================== API ROUTES ========================

// Health & Deployment Status Endpoint
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'UP',
    college: 'Subramanian Polytechnic College (SPTC)',
    location: 'Rayavaram, Pudukkottai District, Tamil Nadu – 622 506',
    doteCode: '331',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    activeSessions: SessionManager.sessions.size,
    environment: NODE_ENV
  });
});

// 1. College Info & Departments (Public)
app.get('/api/college-info', (req, res) => {
  const db = loadDb();
  res.json({
    college: db.college,
    departments: db.departments
  });
});

// 2. All Students (Protected: Strictly Staff Only)
app.get('/api/students', requireStaff, (req, res) => {
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

// 3. Strict Unified Authentication (Student & Staff/Faculty)
app.post('/api/auth/login', (req, res) => {
  const { identifier, password, roleType } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter both your login identifier and password.' });
  }

  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const rateLimitKey = `${clientIp}_${identifier.trim().toLowerCase()}`;

  // Check rate limit lockout
  const rateCheck = LoginRateLimiter.check(rateLimitKey);
  if (!rateCheck.allowed) {
    return res.status(429).json({ 
      error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${rateCheck.waitSeconds} seconds.`,
      code: 'RATE_LIMITED',
      retryAfter: rateCheck.waitSeconds
    });
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
      LoginRateLimiter.recordFailure(rateLimitKey);
      return res.status(404).json({ error: 'Staff account not found. Please verify your employee username or email.' });
    }

    if (staffMember.password !== password.trim()) {
      LoginRateLimiter.recordFailure(rateLimitKey);
      return res.status(401).json({ error: 'Incorrect staff password. Please try again or contact IT support.' });
    }

    // Success: Reset rate limit counter and generate server-side session
    LoginRateLimiter.recordSuccess(rateLimitKey);

    const safeProfile = {
      id: staffMember.id,
      username: staffMember.username,
      email: staffMember.email,
      name: staffMember.name,
      role: staffMember.role,
      title: staffMember.title,
      department: staffMember.department,
      phone: staffMember.phone
    };

    const session = SessionManager.createSession(safeProfile, 'STAFF', staffMember.role, req);

    return res.json({
      success: true,
      role: staffMember.role,
      userType: 'STAFF',
      token: session.token,
      profile: safeProfile,
      expiresAt: session.expiresAt,
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
    LoginRateLimiter.recordFailure(rateLimitKey);
    return res.status(404).json({ error: 'Student registration number not found in SPTC records.' });
  }

  // Verify PIN / Password
  if (student.pin && student.pin !== password.trim()) {
    LoginRateLimiter.recordFailure(rateLimitKey);
    return res.status(401).json({ error: 'Invalid PIN / Date of Birth. Default format: DDMMYYYY' });
  }

  // Success: Reset rate limit counter and generate server-side session
  LoginRateLimiter.recordSuccess(rateLimitKey);

  const safeProfile = {
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
  };

  const session = SessionManager.createSession(safeProfile, 'STUDENT', 'STUDENT', req);

  return res.json({
    success: true,
    role: 'STUDENT',
    userType: 'STUDENT',
    token: session.token,
    profile: safeProfile,
    expiresAt: session.expiresAt,
    message: `Welcome, ${student.name} (${student.department})`
  });
});

// Student Self-Registration Endpoint
app.post('/api/auth/register-student', (req, res) => {
  const {
    regNo, name, department, currentYear, currentSemester,
    quota, admissionNo, isHosteller, busRoute,
    parentName, parentPhone, email, password
  } = req.body;

  if (!regNo || !name || !department || !password) {
    return res.status(400).json({ error: 'Registration number, name, department, and password/PIN are required.' });
  }

  const db = loadDb();
  const existing = db.students.find(s => s.regNo.trim() === regNo.trim());
  if (existing) {
    return res.status(400).json({ error: `Student with DOTE Reg. No ${regNo} is already registered. Please sign in instead.` });
  }

  const deptCodes = {
    'Computer Engineering': 'CSE',
    'Mechanical Engineering': 'MECH',
    'Electrical and Electronics Engineering': 'EEE',
    'Electronics and Communication Engineering': 'ECE',
    'Civil Engineering': 'CIVIL'
  };
  const deptCode = deptCodes[department] || 'DIPLOMA';

  const newStudent = {
    regNo: regNo.trim(),
    name: name.trim(),
    admissionNo: admissionNo ? admissionNo.trim() : `SPTC/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
    department,
    deptCode,
    currentYear: parseInt(currentYear) || 1,
    currentSemester: parseInt(currentSemester) || 1,
    quota: quota || 'Government',
    isHosteller: !!isHosteller,
    busRoute: busRoute || (isHosteller ? 'None (Hosteller)' : 'Pudukkottai Town (Route 1)'),
    parentName: parentName ? parentName.trim() : 'Parent / Guardian',
    parentPhone: parentPhone ? parentPhone.trim() : '9840000000',
    email: email ? email.trim() : `student_${regNo}@sptc.org.in`,
    pin: password.trim(),
    concessionType: 'None',
    concessionAmount: 0
  };

  db.students.push(newStudent);

  // Initialize standard semester fee bill
  const tuitionFee = (quota === 'Government') ? 14000 : 22000;
  const labFee = 3500;
  const busFee = (!isHosteller && busRoute && !busRoute.includes('None')) ? 6500 : 0;
  const hostelFee = isHosteller ? 18000 : 0;
  const netPayable = tuitionFee + labFee + busFee + hostelFee;

  db.feeBilledItems.push({
    id: `BILL-${newStudent.regNo}-S${newStudent.currentSemester}`,
    regNo: newStudent.regNo,
    semester: `Semester ${newStudent.currentSemester}`,
    academicYear: '2025-2026',
    tuitionFee,
    labFee,
    busFee,
    hostelFee,
    concession: 0,
    netPayable,
    dueDate: '2026-11-30'
  });

  saveDb(db);

  const safeProfile = {
    regNo: newStudent.regNo,
    admissionNo: newStudent.admissionNo,
    name: newStudent.name,
    department: newStudent.department,
    deptCode: newStudent.deptCode,
    currentYear: newStudent.currentYear,
    currentSemester: newStudent.currentSemester,
    quota: newStudent.quota,
    isHosteller: newStudent.isHosteller,
    busRoute: newStudent.busRoute,
    parentName: newStudent.parentName,
    parentPhone: newStudent.parentPhone,
    email: newStudent.email,
    concessionType: newStudent.concessionType,
    concessionAmount: newStudent.concessionAmount
  };

  const session = SessionManager.createSession(safeProfile, 'STUDENT', 'STUDENT', req);

  res.json({
    success: true,
    role: 'STUDENT',
    userType: 'STUDENT',
    token: session.token,
    profile: safeProfile,
    expiresAt: session.expiresAt,
    message: `Account enrolled successfully. Welcome, ${newStudent.name}!`
  });
});

// Strict Session Verification Endpoint (/api/auth/me)
app.get('/api/auth/me', (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ authenticated: false, error: 'No active session token provided.' });
  }

  const session = SessionManager.get(token);
  if (!session) {
    return res.status(401).json({ authenticated: false, error: 'Session expired or invalidated. Please sign in again.' });
  }

  res.json({
    authenticated: true,
    userType: session.userType,
    role: session.role,
    user: session.profile,
    profile: session.profile,
    expiresAt: session.expiresAt
  });
});

// Strict Server-Side Logout Endpoint (/api/auth/logout)
app.post('/api/auth/logout', (req, res) => {
  const token = extractToken(req);
  if (token) {
    SessionManager.destroy(token);
  }
  res.json({
    success: true,
    message: 'You have been securely signed out of the SPTC Institutional Portal.'
  });
});

// Change Password (Strictly Protected)
app.post('/api/auth/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required.' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password/PIN must be at least 4 characters long.' });
  }

  const db = loadDb();
  const session = req.user;

  if (session.userType === 'STAFF') {
    const staff = (db.staff || []).find(s => s.username === session.profile.username || s.id === session.profile.id);
    if (!staff || staff.password !== currentPassword) {
      return res.status(401).json({ error: 'Current staff password is incorrect.' });
    }
    staff.password = newPassword;
    saveDb(db);
    return res.json({ success: true, message: 'Staff administrative password updated successfully.' });
  } else {
    const student = db.students.find(s => s.regNo === session.profile.regNo);
    if (!student || student.pin !== currentPassword) {
      return res.status(401).json({ error: 'Current student PIN is incorrect.' });
    }
    student.pin = newPassword;
    saveDb(db);
    return res.json({ success: true, message: 'Student portal PIN updated successfully.' });
  }
});

// Staff Directory (Public Sanitized)
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

// 4. Student Fee Status & Ledger Breakdown (Protected: Student or Staff)
app.get('/api/student/:regNo/fees', requireStudentOrStaff, (req, res) => {
  const { regNo } = req.params;
  const db = loadDb();
  const student = db.students.find(s => s.regNo === regNo);

  if (!student) {
    return res.status(404).json({ error: 'Student record not found in college ledger.' });
  }

  const bills = db.feeBilledItems.filter(b => b.regNo === regNo);
  const receipts = db.receipts.filter(r => r.regNo === regNo);

  const totalBilled = bills.reduce((acc, b) => acc + (b.netPayable || 0), 0);
  const totalPaid = receipts.reduce((acc, r) => acc + (r.amount || 0), 0);
  const outstandingBalance = Math.max(0, totalBilled - totalPaid);

  const semesterBills = bills.map(b => ({
    ...b,
    status: totalPaid >= totalBilled ? 'PAID' : (b.dueDate < new Date().toISOString() ? 'OVERDUE' : 'PENDING')
  }));

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

// 5. Student Receipt Vault (Protected: Student or Staff)
app.get('/api/student/:regNo/receipts', requireStudentOrStaff, (req, res) => {
  const { regNo } = req.params;
  const db = loadDb();
  const receipts = db.receipts.filter(r => r.regNo === regNo);

  // Sort descending by date
  receipts.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(receipts);
});

// Dynamic ISO-Standard QR Code Generator (High-Contrast SVG)
app.get('/api/qr', async (req, res) => {
  try {
    const text = (req.query.text || '').trim();
    if (!text) {
      return res.status(400).send('Missing "text" query parameter.');
    }
    const svg = await QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#0a2558',
        light: '#ffffff'
      }
    });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.send(svg);
  } catch (err) {
    console.error('QR generation error:', err);
    return res.status(500).send('QR generation failed.');
  }
});

// 6. Single Receipt by Receipt Number or Verification Hash (Public/Printable Verification)
app.get('/api/receipts/:receiptNo', async (req, res) => {
  const { receiptNo } = req.params;
  const db = loadDb();
  const decodedNo = decodeURIComponent(receiptNo);
  const receipt = db.receipts.find(r => 
    r.receiptNo === decodedNo || 
    r.receiptNo === receiptNo || 
    r.verificationHash === receiptNo ||
    (r.verificationHash && r.verificationHash.toLowerCase() === receiptNo.toLowerCase())
  );

  if (!receipt) {
    return res.status(404).json({ error: 'Official receipt voucher not found.' });
  }

  const student = db.students.find(s => s.regNo === receipt.regNo) || { name: 'Student', department: 'SPTC' };

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const verifyUrl = `${protocol}://${host}/verify/${receipt.verificationHash}`;

  res.json({
    college: db.college,
    student,
    receipt,
    verifyUrl
  });
});

// 6b. Official Public Receipt Verification API Endpoint (SHA-256 Hash / Token)
app.get('/api/verify/:hash', async (req, res) => {
  try {
    const hash = (req.params.hash || '').trim();
    if (!hash) {
      return res.status(400).json({ success: false, verified: false, error: 'Verification hash or receipt token is required.' });
    }

    const db = loadDb();
    const cleanHash = hash.toLowerCase();
    const receipt = db.receipts.find(r => 
      (r.verificationHash && r.verificationHash.toLowerCase() === cleanHash) ||
      (r.receiptNo && r.receiptNo.toLowerCase() === cleanHash) ||
      (r.receiptNo && r.receiptNo === decodeURIComponent(hash))
    );

    if (!receipt) {
      return res.status(404).json({
        success: false,
        verified: false,
        error: 'Verification Unsuccessful: No authentic receipt found matching this token in the SPTC Accounts Ledger.'
      });
    }

    const student = db.students.find(s => s.regNo === receipt.regNo) || {
      name: 'SPTC Student',
      regNo: receipt.regNo,
      department: 'Diploma in Engineering'
    };

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const verifyUrl = `${protocol}://${host}/verify/${receipt.verificationHash}`;

    res.json({
      success: true,
      verified: true,
      college: db.college,
      student,
      receipt,
      verifyUrl,
      verifiedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Verification API error:', err);
    res.status(500).json({ success: false, error: 'Internal server error during verification.' });
  }
});

// 7. Process New Payment (Protected: Authenticated Student or Staff)
app.post('/api/payments/create', authenticate, (req, res) => {
  const { regNo, amount, paymentMode, transactionRef, remarks, breakdown, billId } = req.body;

  if (!regNo || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Registration number and a valid amount are required.' });
  }

  // Authorization check: Students can only pay their own fees
  if (req.user.userType === 'STUDENT' && req.user.profile.regNo !== regNo) {
    return res.status(403).json({ error: 'Access forbidden. You cannot submit payments for another student.' });
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

  const isStaffPayment = req.user.userType === 'STAFF';
  const newReceipt = {
    receiptNo,
    regNo,
    billId: billId || `BILL-${regNo}-SEM${student.currentSemester}`,
    date: dateStr,
    amount: numericAmount,
    paymentMode: paymentMode || (isStaffPayment ? 'Cashier Desk Counter Collection' : 'UPI Online Payment'),
    transactionRef: transactionRef || `TXN-${Date.now().toString().slice(-8)}`,
    academicYear: `${now.getFullYear()}-${now.getFullYear() + 1}`,
    semester: `Semester ${student.currentSemester}`,
    source: isStaffPayment 
      ? `SPTC Accounts Office Counter (Officer: ${req.user.profile.name})` 
      : 'SPTC Student Online Payment Gateway',
    breakdown: breakdown || {
      'Fee Collection Credit': numericAmount
    },
    verificationHash,
    remarks: remarks || (isStaffPayment ? 'Counter POS payment collected at Accounts Office' : 'Online student self-service fee payment')
  };

  db.receipts.push(newReceipt);
  saveDb(db);

  res.json({
    success: true,
    message: 'Payment recorded successfully and digital receipt generated.',
    receipt: newReceipt
  });
});

// 8. Import from Legacy Tally (Strictly Protected: Staff Only)
app.post('/api/tally/import-xml', requireStaff, (req, res) => {
  const { xmlContent } = req.body;
  const db = loadDb();

  let content = xmlContent;
  if (!content) {
    const samplePath = path.join(__dirname, 'data', 'sample_tally_export.xml');
    if (fs.existsSync(samplePath)) {
      content = fs.readFileSync(samplePath, 'utf-8');
    } else {
      return res.status(400).json({ error: 'No Tally XML content provided or found.' });
    }
  }

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
      const formattedDate = rawDate.length === 8 
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : '2024-09-01';

      const regMatch = party.match(/\b\d{8}\b/);
      const regNo = regMatch ? regMatch[0] : '22201045';

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

// 9. Daily Cash-Book & Cashier Audit Summary (Strictly Protected: Staff Only)
app.get('/api/reports/cash-book', requireStaff, (req, res) => {
  const db = loadDb();
  const receipts = db.receipts;

  const modeTotals = {};
  let totalCollections = 0;

  receipts.forEach(r => {
    const mode = r.paymentMode || 'Other';
    modeTotals[mode] = (modeTotals[mode] || 0) + r.amount;
    totalCollections += r.amount;
  });

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

  const student = db.students.find(s => s.regNo === receipt.regNo) || { name: 'Student', department: 'SPTC' };

  res.json({
    valid: true,
    message: 'Official Subramanian Polytechnic College fee receipt verified successfully.',
    receipt: {
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

// 11. Student Portal Registration Endpoint
app.post('/api/auth/register-student', (req, res) => {
  const { regNo, name, department, currentYear, quota, isHosteller, busRoute, parentName, parentPhone, email, pin, password } = req.body;
  const pinVal = (pin || password || '').trim();

  if (!regNo || !name || !department || !pinVal) {
    return res.status(400).json({ error: 'Registration Number, Full Name, Department, and PIN/Password are required.' });
  }

  const db = loadDb();
  const trimmedRegNo = regNo.trim();

  // Check if student already exists
  const exists = db.students.find(s => s.regNo === trimmedRegNo);
  if (exists) {
    return res.status(409).json({ error: 'A student with this DOTE Registration Number is already registered.' });
  }

  const deptObj = (db.departments || []).find(d => d.name.toLowerCase().includes(department.toLowerCase()) || d.id === department.toLowerCase()) || { id: 'engg', name: department };
  const yr = parseInt(currentYear) || 1;
  const sem = yr * 2;

  const newStudent = {
    regNo: trimmedRegNo,
    admissionNo: `SPTC/${new Date().getFullYear().toString().slice(-2)}/${Math.floor(100 + Math.random() * 900)}`,
    pin: pinVal,
    name: name.trim(),
    department: deptObj.name,
    deptCode: deptObj.id || 'engg',
    currentYear: yr,
    currentSemester: sem,
    quota: quota || 'Government',
    isHosteller: !!isHosteller,
    busRoute: isHosteller ? 'Hosteller (No Bus)' : (busRoute || 'Day Scholar'),
    parentName: parentName || 'Parent / Guardian',
    parentPhone: parentPhone || '',
    email: email || `${trimmedRegNo}@sptc.org.in`,
    concessionType: 'None',
    concessionAmount: 0,
    status: 'Active'
  };

  db.students.push(newStudent);

  // Automatically generate initial semester bills for this student
  const baseTuition = quota === 'Management' ? 16000 : 12500;
  const busCost = isHosteller ? 0 : 4500;
  const hostelCost = isHosteller ? 13500 : 0;
  const netDue = baseTuition + 2500 + 1200 + busCost + hostelCost;

  const billId = `BILL-${trimmedRegNo}-SEM${sem}`;
  db.feeBilledItems.push({
    id: billId,
    regNo: trimmedRegNo,
    academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    semester: `Semester ${sem}`,
    tuitionFee: baseTuition,
    labFee: 2500,
    examFee: 1200,
    busFee: busCost,
    hostelFee: hostelCost,
    concession: 0,
    netPayable: netDue,
    dueDate: `${new Date().getFullYear()}-12-31`
  });

  saveDb(db);

  // Create active session in session store
  const session = SessionManager.createSession(newStudent, 'STUDENT', 'STUDENT', req);

  res.json({
    success: true,
    message: 'Student portal account registered successfully!',
    role: 'STUDENT',
    userType: 'STUDENT',
    token: session.token,
    profile: newStudent,
    expiresAt: session.expiresAt
  });
});

// Dedicated HTML Page Routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/student-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/cashier', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cashier-dashboard.html'));
});

app.get('/cashier-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cashier-dashboard.html'));
});

// Dedicated Public Receipt Verification Route (Scanned via QR Code on phones or paper)
app.get(['/verify', '/verify/:hash'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

// Fallback to index.html for main site navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper to determine Local LAN IP
function getLanIp() {
  try {
    const interfaces = os.networkInterfaces();
    // Prioritize Wi-Fi
    if (interfaces['Wi-Fi']) {
      const wifi = interfaces['Wi-Fi'].find(i => i.family === 'IPv4' && !i.internal);
      if (wifi) return wifi.address;
    }
    for (const name of Object.keys(interfaces)) {
      if (/vethernet|loopback|virtual|host-only/i.test(name)) continue;
      if (name.includes('Ethernet 3')) continue; // Skip VirtualBox host-only
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (e) {}
  return '192.168.1.7';
}

// Start Server
const server = app.listen(PORT, HOST, () => {
  const lanIp = getLanIp();
  console.log(`=======================================================`);
  console.log(`🏛️  Subramanian Polytechnic College (SPTC) Web Portal`);
  console.log(`💳  Students Fees Management System running at:`);
  console.log(`👉  Local Loopback: http://localhost:${PORT} or http://127.0.0.1:${PORT}`);
  console.log(`👉  Local Wi-Fi IP: http://${lanIp}:${PORT}`);
  console.log(`🔒  Strict Session Management & Rate Limiter: ACTIVE`);
  console.log(`=======================================================`);
});

// Graceful Shutdown Handler
function handleGracefulShutdown(signal) {
  console.log(`\n[SHUTDOWN] Received ${signal}. Gracefully shutting down SPTC server...`);
  SessionManager.persist();
  server.close(() => {
    console.log('[SHUTDOWN] HTTP server closed. State preserved safely.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
