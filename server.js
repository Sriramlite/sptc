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

// In-memory db cache for serverless environments (e.g. Vercel)
let inMemoryDb = null;

// ======================== DATABASE HELPERS ========================
function loadDb() {
  if (inMemoryDb) return inMemoryDb;
  try {
    const tmpPath = path.join(os.tmpdir(), 'sptc_database.json');
    if (fs.existsSync(tmpPath)) {
      const raw = fs.readFileSync(tmpPath, 'utf-8');
      inMemoryDb = JSON.parse(raw);
      return inMemoryDb;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    inMemoryDb = JSON.parse(raw);
    return inMemoryDb;
  } catch (err) {
    console.error('Error loading database:', err);
    return { college: {}, departments: [], students: [], feeBilledItems: [], receipts: [], staff: [] };
  }
}

// Atomic safe save to prevent JSON corruption on sudden restarts
function saveDb(data) {
  inMemoryDb = data;
  try {
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
    return true;
  } catch (err) {
    // If running in a read-only serverless environment (e.g. Vercel), fallback to OS temp dir
    try {
      const tmpPath = path.join(os.tmpdir(), 'sptc_database.json');
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.warn('Serverless environment: database updated in-memory.');
      return true;
    }
  }
}

function generateReceiptHash(receiptNo, regNo, amount, date) {
  return crypto.createHash('sha256').update(`${receiptNo}-${regNo}-${amount}-${date}-SPTC-RAYAVARAM`).digest('hex').substring(0, 16);
}

// ======================== SERVER-SIDE SESSION STORE (VERCEL COMPATIBLE) ========================
const AUTH_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'SPTC_RAYAVARAM_SECURE_AUTH_2026_DOTE_331_SECRET_KEY';

const SessionManager = {
  sessions: new Map(), // token -> sessionObj (in-memory fast cache)
  revokedTokens: new Set(),

  init() {
    try {
      const fileToRead = fs.existsSync(path.join(os.tmpdir(), 'sptc_sessions.json')) 
        ? path.join(os.tmpdir(), 'sptc_sessions.json') 
        : (fs.existsSync(SESSIONS_FILE) ? SESSIONS_FILE : null);
      if (fileToRead) {
        const raw = fs.readFileSync(fileToRead, 'utf-8');
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
      // In serverless (Vercel) read-only filesystem, fallback gracefully to OS temp dir
      try {
        const tmpPath = path.join(os.tmpdir(), 'sptc_sessions.json');
        const obj = Object.fromEntries(this.sessions);
        fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf-8');
      } catch (err) {}
    }
  },

  signPayload(payload) {
    const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', AUTH_SECRET).update(raw).digest('base64url');
    return `sptc_${raw}.${sig}`;
  },

  verifySignedToken(token) {
    if (!token || typeof token !== 'string' || !token.startsWith('sptc_')) return null;
    const body = token.substring(5);
    const dotIdx = body.lastIndexOf('.');
    if (dotIdx === -1) return null;
    const raw = body.substring(0, dotIdx);
    const sig = body.substring(dotIdx + 1);
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(raw).digest('base64url');
    if (sig.length !== expectedSig.length) return null;
    try {
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
        return null;
      }
      const session = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'));
      if (session.expiresAt && session.expiresAt < Date.now()) {
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  },

  createSession(profile, userType, role, req) {
    const now = Date.now();
    const id = profile.regNo || profile.id || profile.username;
    const sessionData = {
      userType,
      role,
      id,
      department: profile.department || '',
      profile,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + (7 * 24 * 60 * 60 * 1000), // 7-day validity
      lastActive: new Date(now).toISOString(),
      ip: req?.ip || req?.socket?.remoteAddress || 'unknown',
      userAgent: req?.headers['user-agent'] || 'unknown'
    };

    // Cryptographic self-contained signed token for Vercel Serverless
    const token = this.signPayload(sessionData);
    sessionData.token = token;

    this.sessions.set(token, sessionData);
    this.persist();
    return sessionData;
  },

  get(token) {
    if (!token) return null;
    if (this.revokedTokens.has(token)) return null;

    // 1. Check in-memory session map
    let session = this.sessions.get(token);
    if (session) {
      if (session.expiresAt && session.expiresAt < Date.now()) {
        this.sessions.delete(token);
        this.persist();
        return null;
      }
      session.lastActive = new Date().toISOString();
      return session;
    }

    // 2. Stateless cryptographic verification (solves Vercel serverless multi-instance auth)
    const verified = this.verifySignedToken(token);
    if (verified) {
      verified.lastActive = new Date().toISOString();
      this.sessions.set(token, verified);
      return verified;
    }

    return null;
  },

  destroy(token) {
    if (!token) return false;
    this.revokedTokens.add(token);
    const existed = this.sessions.delete(token);
    this.persist();
    console.log(`[AUTH] Session ${token.substring(0, 12)}... invalidated.`);
    return true;
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

// 4. Strict Principal-Only Middleware
function requirePrincipal(req, res, next) {
  requireStaff(req, res, () => {
    const role = (req.user.role || req.user.profile?.role || '').toUpperCase();
    if (role !== 'PRINCIPAL') {
      return res.status(403).json({ 
        error: 'Access denied. Principal executive authorization required.', 
        code: 'FORBIDDEN' 
      });
    }
    next();
  });
}

// 5. Principal or Department HOD Authorization Middleware
function requirePrincipalOrHOD(req, res, next) {
  requireStaff(req, res, () => {
    const role = (req.user.role || req.user.profile?.role || '').toUpperCase();
    if (role !== 'PRINCIPAL' && role !== 'HOD') {
      return res.status(403).json({ 
        error: 'Access denied. Principal or Head of Department (HOD) authorization required.', 
        code: 'FORBIDDEN' 
      });
    }
    next();
  });
}

// 6. Strict Cashier Desk & Accounts Office Middleware (HODs strictly forbidden)
function requireCashierOrPrincipal(req, res, next) {
  requireStaff(req, res, () => {
    const role = (req.user.role || req.user.profile?.role || '').toUpperCase();
    const dept = (req.user.department || req.user.profile?.department || '').toLowerCase();
    
    // Explicitly deny HOD role from cashier desk / financial operations
    if (role === 'HOD') {
      return res.status(403).json({ 
        error: 'Access denied. Head of Departments (HOD) do not have privileges to view the Cashier Dashboard or process counter fee transactions. Please use the HOD Department Portal.', 
        code: 'FORBIDDEN_HOD' 
      });
    }

    if (role !== 'CASHIER' && role !== 'PRINCIPAL' && !dept.includes('accounts')) {
      return res.status(403).json({ 
        error: 'Access denied. Accounts Officer or Cashier authorization required.', 
        code: 'FORBIDDEN' 
      });
    }
    next();
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

// 8. Import from Legacy Tally (Strictly Protected: Cashier & Principal Only)
app.post('/api/tally/import-xml', requireCashierOrPrincipal, (req, res) => {
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

// 9. Daily Cash-Book & Cashier Audit Summary (Strictly Protected: Cashier & Principal Only)
app.get('/api/reports/cash-book', requireCashierOrPrincipal, (req, res) => {
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

// ============================================================================
// CASHIER REDESIGN APIS: PAGINATED TRANSACTIONS, SET FEES & STUDENT LEDGER
// ============================================================================

// A. Paginated Past Transactions (Staff Only - Default 20 rows per page)
app.get('/api/transactions', requireStaff, (req, res) => {
  const db = loadDb();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 20);
  const search = (req.query.search || '').trim().toLowerCase();
  const paymentMode = (req.query.paymentMode || '').trim();
  const regNoFilter = (req.query.regNo || '').trim();

  // Map receipts with student details
  let list = db.receipts.map(r => {
    const student = db.students.find(s => s.regNo === r.regNo);
    return {
      ...r,
      studentName: student ? student.name : 'Unknown Student',
      department: student ? student.department : 'SPTC Diploma',
      currentYear: student ? student.currentYear : 1
    };
  });

  // Sort newest first
  list.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Filter by student regNo if requested
  if (regNoFilter) {
    list = list.filter(r => r.regNo === regNoFilter);
  }

  // Filter by payment mode if requested
  if (paymentMode && paymentMode !== 'ALL') {
    list = list.filter(r => r.paymentMode && r.paymentMode.toLowerCase().includes(paymentMode.toLowerCase()));
  }

  // Filter by search query (Name, RegNo, ReceiptNo, TxnRef, Department)
  if (search) {
    list = list.filter(r => 
      (r.studentName && r.studentName.toLowerCase().includes(search)) ||
      (r.regNo && r.regNo.toLowerCase().includes(search)) ||
      (r.receiptNo && r.receiptNo.toLowerCase().includes(search)) ||
      (r.transactionRef && r.transactionRef.toLowerCase().includes(search)) ||
      (r.department && r.department.toLowerCase().includes(search)) ||
      (r.paymentMode && r.paymentMode.toLowerCase().includes(search))
    );
  }

  const total = list.length;
  const totalAmount = list.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedTransactions = list.slice(startIndex, startIndex + limit);

  res.json({
    success: true,
    transactions: paginatedTransactions,
    total,
    page,
    limit,
    totalPages,
    totalAmount
  });
});

// B. Set / Adjust Total Fees per Year / Semester (Cashier & Principal Only)
app.post('/api/students/:regNo/set-fees', requireCashierOrPrincipal, (req, res) => {
  const { regNo } = req.params;
  const {
    annualFee,
    tuitionFee,
    labFee,
    busFee,
    hostelFee,
    concession,
    academicYear,
    semester,
    dueDate
  } = req.body;

  const db = loadDb();
  const student = db.students.find(s => s.regNo === regNo);
  if (!student) {
    return res.status(404).json({ success: false, error: `Student with Reg No ${regNo} not found.` });
  }

  const yr = academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  const sem = semester || `Year ${student.currentYear} Annual Fee`;

  // Calculate parsed components
  const parsedTuition = tuitionFee !== undefined ? parseFloat(tuitionFee) : (annualFee !== undefined ? parseFloat(annualFee) : 15000);
  const parsedLab = labFee !== undefined ? parseFloat(labFee) : 3500;
  const parsedBus = busFee !== undefined ? parseFloat(busFee) : (student.isHosteller ? 0 : 5000);
  const parsedHostel = hostelFee !== undefined ? parseFloat(hostelFee) : (student.isHosteller ? 16000 : 0);
  const parsedConcession = concession !== undefined ? parseFloat(concession) : (student.concessionAmount || 0);

  const netPayable = Math.max(0, parsedTuition + parsedLab + parsedBus + parsedHostel - parsedConcession);

  // Check if an existing bill exists for this student & semester, or create new
  let bill = db.feeBilledItems.find(b => b.regNo === regNo && (b.semester === sem || b.id === `BILL-${regNo}-ANNUAL`));
  if (bill) {
    bill.academicYear = yr;
    bill.semester = sem;
    bill.tuitionFee = parsedTuition;
    bill.labFee = parsedLab;
    bill.busFee = parsedBus;
    bill.hostelFee = parsedHostel;
    bill.concession = parsedConcession;
    bill.netPayable = netPayable;
    if (dueDate) bill.dueDate = dueDate;
  } else {
    bill = {
      id: `BILL-${regNo}-Y${student.currentYear}-${Date.now().toString().slice(-4)}`,
      regNo: regNo,
      academicYear: yr,
      semester: sem,
      tuitionFee: parsedTuition,
      labFee: parsedLab,
      busFee: parsedBus,
      hostelFee: parsedHostel,
      concession: parsedConcession,
      netPayable: netPayable,
      dueDate: dueDate || `${new Date().getFullYear()}-12-31`
    };
    db.feeBilledItems.push(bill);
  }

  // Update student concession record if passed
  if (concession !== undefined) {
    student.concessionAmount = parsedConcession;
  }

  saveDb(db);

  // Recalculate full totals
  const studentBills = db.feeBilledItems.filter(b => b.regNo === regNo);
  const studentReceipts = db.receipts.filter(r => r.regNo === regNo);
  const totalBilled = studentBills.reduce((acc, b) => acc + (b.netPayable || 0), 0);
  const totalPaid = studentReceipts.reduce((acc, r) => acc + (r.amount || 0), 0);
  const balanceDue = Math.max(0, totalBilled - totalPaid);

  res.json({
    success: true,
    message: `Total fees updated successfully for ${student.name}.`,
    bill,
    summary: {
      totalBilled,
      totalPaid,
      balanceDue,
      concessionAmount: parsedConcession
    }
  });
});

// C. Detailed Student Ledger & Complete Payment History (Staff Only)
app.get('/api/students/:regNo/ledger', requireStaff, (req, res) => {
  const { regNo } = req.params;
  const db = loadDb();
  const student = db.students.find(s => s.regNo === regNo);
  if (!student) {
    return res.status(404).json({ success: false, error: 'Student not found.' });
  }

  const bills = db.feeBilledItems.filter(b => b.regNo === regNo);
  const receipts = db.receipts.filter(r => r.regNo === regNo);
  receipts.sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalBilled = bills.reduce((acc, b) => acc + (b.netPayable || 0), 0);
  const totalPaid = receipts.reduce((acc, r) => acc + (r.amount || 0), 0);
  const balanceDue = Math.max(0, totalBilled - totalPaid);

  res.json({
    success: true,
    student,
    bills,
    billedItems: bills,
    receipts,
    totalBilled,
    totalPaid,
    balanceDue,
    summary: {
      totalBilled,
      totalPaid,
      balanceDue,
      receiptCount: receipts.length
    }
  });
});

// ============================================================================
// PRINCIPAL GOVERNANCE DESK APIS: FACULTY, STUDENTS & INSTITUTIONAL OVERSIGHT
// ============================================================================

// A. Executive Overview & Institutional Analytics (Principal Only)
app.get('/api/principal/overview', requirePrincipal, (req, res) => {
  const db = loadDb();
  const students = db.students || [];
  const staff = db.staff || [];
  const bills = db.feeBilledItems || [];
  const receipts = db.receipts || [];
  const departments = db.departments || [];

  const totalBilled = bills.reduce((sum, b) => sum + (b.netPayable || 0), 0);
  const totalCollections = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalDues = Math.max(0, totalBilled - totalCollections);

  let studentsWithDues = 0;
  let studentsSettled = 0;

  // Department statistics
  const deptSummary = departments.map(d => {
    const deptStudents = students.filter(s => 
      s.deptCode?.toLowerCase() === d.id?.toLowerCase() || 
      s.department?.toLowerCase() === d.name?.toLowerCase() ||
      s.department?.toLowerCase().includes(d.name?.toLowerCase())
    );
    const deptStaff = staff.filter(st => 
      st.department?.toLowerCase().includes(d.name?.toLowerCase()) ||
      st.department?.toLowerCase().includes(d.id?.toLowerCase())
    );

    const studentRegNos = new Set(deptStudents.map(s => s.regNo));
    const deptBills = bills.filter(b => studentRegNos.has(b.regNo));
    const deptReceipts = receipts.filter(r => studentRegNos.has(r.regNo));

    const billed = deptBills.reduce((acc, b) => acc + (b.netPayable || 0), 0);
    const collected = deptReceipts.reduce((acc, r) => acc + (r.amount || 0), 0);
    const dues = Math.max(0, billed - collected);

    return {
      id: d.id,
      name: d.name,
      code: d.code,
      department: d.name,
      deptCode: d.code || d.id || 'ENGG',
      intake: d.intake,
      head: d.head,
      studentCount: deptStudents.length,
      staffCount: deptStaff.length,
      enrolledStudents: deptStudents.length,
      facultyCount: deptStaff.length,
      hostellers: deptStudents.filter(s => s.isHosteller).length,
      busUsers: deptStudents.filter(s => !s.isHosteller).length,
      billedAmount: billed,
      collectedAmount: collected,
      balanceDue: dues
    };
  });

  // Calculate dues count across all students
  students.forEach(s => {
    const sBills = bills.filter(b => b.regNo === s.regNo);
    const sReceipts = receipts.filter(r => r.regNo === s.regNo);
    const bTotal = sBills.reduce((acc, b) => acc + (b.netPayable || 0), 0);
    const pTotal = sReceipts.reduce((acc, r) => acc + (r.amount || 0), 0);
    if (bTotal - pTotal > 0) {
      studentsWithDues++;
    } else {
      studentsSettled++;
    }
  });

  // Recent 5 enrolled students
  const recentStudents = [...students].slice(-5).reverse();
  // Recent 5 receipts
  const recentReceipts = [...receipts].slice(-5).reverse().map(r => {
    const st = students.find(s => s.regNo === r.regNo);
    return {
      ...r,
      studentName: st ? st.name : 'Unknown Student',
      department: st ? st.department : 'Diploma',
      amountPaid: r.amount || 0,
      paymentMode: r.paymentMode || 'Counter Cash'
    };
  });

  res.json({
    success: true,
    kpis: {
      totalEnrolledStudents: students.length,
      totalStaffMembers: staff.length,
      totalFeesCollected: totalCollections,
      totalOutstandingDues: totalDues,
      totalBilled
    },
    studentsBreakdown: {
      govtQuota: students.filter(s => s.quota === 'Government').length,
      mgtQuota: students.filter(s => s.quota === 'Management').length,
      hostellers: students.filter(s => s.isHosteller).length,
      dayScholars: students.filter(s => !s.isHosteller).length
    },
    staffBreakdown: {
      hodCount: staff.filter(s => s.role === 'HOD').length,
      facultyCount: staff.filter(s => s.role === 'FACULTY').length,
      adminAccountsCount: staff.filter(s => s.role === 'CASHIER' || s.role === 'PRINCIPAL').length
    },
    departmentSummary: deptSummary,
    recentEnrollments: recentStudents,
    recentCollections: recentReceipts,
    totalStudents: students.length,
    totalStaff: staff.length,
    totalBilled,
    totalCollections,
    totalDues,
    studentsWithDues,
    studentsSettled,
    departments: deptSummary,
    recentStudents,
    recentReceipts
  });
});

// B. Staff Management: Get All Staff (Principal Only)
app.get('/api/principal/staff', requirePrincipal, (req, res) => {
  const db = loadDb();
  const staffList = (db.staff || []).map(s => ({
    id: s.id,
    username: s.username,
    email: s.email,
    name: s.name,
    role: s.role,
    title: s.title,
    department: s.department,
    phone: s.phone || 'N/A',
    status: s.status || 'Active'
  }));
  res.json(staffList);
});

// C. Staff Management: Add New Staff (Principal Only)
app.post('/api/principal/staff', requirePrincipal, (req, res) => {
  const { name, role, department, title, phone, email, username, password, status } = req.body;
  if (!name || !role || !department || !username || !password) {
    return res.status(400).json({ success: false, error: 'Full Name, Role, Department, Username, and Password are required.' });
  }

  const db = loadDb();
  const trimmedUser = username.trim().toLowerCase();
  const trimmedEmail = (email || '').trim().toLowerCase();

  const userExists = (db.staff || []).some(s => s.username.toLowerCase() === trimmedUser);
  if (userExists) {
    return res.status(409).json({ success: false, error: `A staff member with username "${username}" already exists.` });
  }

  if (trimmedEmail) {
    const emailExists = (db.staff || []).some(s => s.email && s.email.toLowerCase() === trimmedEmail);
    if (emailExists) {
      return res.status(409).json({ success: false, error: `Email address "${email}" is already registered to another staff member.` });
    }
  }

  // Generate unique employee ID
  const existingIds = (db.staff || []).map(s => parseInt((s.id || '').replace(/\D/g, '')) || 0);
  const nextIdNum = Math.max(0, ...existingIds) + 1;
  const newId = `STAFF${nextIdNum.toString().padStart(3, '0')}`;

  const newStaff = {
    id: newId,
    username: trimmedUser,
    email: trimmedEmail || `${trimmedUser}@sptc.org.in`,
    password: password.trim(),
    name: name.trim(),
    role: role.trim().toUpperCase(),
    title: title ? title.trim() : (role === 'HOD' ? `Head of Department (${department})` : `${role} - ${department}`),
    department: department.trim(),
    phone: phone ? phone.trim() : '',
    status: status || 'Active'
  };

  db.staff = db.staff || [];
  db.staff.push(newStaff);
  saveDb(db);

  res.json({
    success: true,
    message: `Faculty member ${newStaff.name} registered successfully with ID ${newStaff.id}.`,
    staff: {
      id: newStaff.id,
      username: newStaff.username,
      email: newStaff.email,
      name: newStaff.name,
      role: newStaff.role,
      title: newStaff.title,
      department: newStaff.department,
      phone: newStaff.phone,
      status: newStaff.status
    }
  });
});

// D. Staff Management: Update Staff Member (Principal Only)
app.put('/api/principal/staff/:id', requirePrincipal, (req, res) => {
  const { id } = req.params;
  const { name, role, department, title, phone, email, status } = req.body;

  const db = loadDb();
  const staff = (db.staff || []).find(s => s.id === id);
  if (!staff) {
    return res.status(404).json({ success: false, error: `Staff record with ID "${id}" not found.` });
  }

  if (name) staff.name = name.trim();
  if (role) staff.role = role.trim().toUpperCase();
  if (department) staff.department = department.trim();
  if (title) staff.title = title.trim();
  if (phone !== undefined) staff.phone = phone.trim();
  if (email) staff.email = email.trim();
  if (status) staff.status = status.trim();

  saveDb(db);
  res.json({
    success: true,
    message: `Staff record for ${staff.name} updated successfully.`,
    staff: {
      id: staff.id,
      username: staff.username,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      title: staff.title,
      department: staff.department,
      phone: staff.phone,
      status: staff.status
    }
  });
});

// E. Staff Management: Reset Staff Password (Principal Only)
app.post('/api/principal/staff/:id/reset-password', requirePrincipal, (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ success: false, error: 'New password must be at least 4 characters long.' });
  }

  const db = loadDb();
  const staff = (db.staff || []).find(s => s.id === id);
  if (!staff) {
    return res.status(404).json({ success: false, error: `Staff record with ID "${id}" not found.` });
  }

  staff.password = newPassword.trim();
  saveDb(db);

  res.json({
    success: true,
    message: `Password for ${staff.name} (${staff.username}) has been updated successfully.`
  });
});

// F. Staff Management: Delete Staff Member (Principal Only)
app.delete('/api/principal/staff/:id', requirePrincipal, (req, res) => {
  const { id } = req.params;
  const db = loadDb();
  const staff = (db.staff || []).find(s => s.id === id);

  if (!staff) {
    return res.status(404).json({ success: false, error: 'Staff member not found.' });
  }

  if (staff.role === 'PRINCIPAL' || staff.username === 'principal') {
    return res.status(403).json({ success: false, error: 'The Master Principal administrative account cannot be deleted.' });
  }

  db.staff = db.staff.filter(s => s.id !== id);
  saveDb(db);

  res.json({
    success: true,
    message: `Staff member ${staff.name} has been removed from the institutional directory.`
  });
});

// Helper to calculate standard 3-year diploma batch label & post final year batches
function computeBatchLabel(year, batch) {
  if (batch && batch.trim()) return batch.trim();
  const yr = parseInt(year) || 1;
  if (yr >= 4) return 'Batch 2022–2025 (Post Final Year)';
  if (yr === 3) return 'Batch 2023–2026 (3rd Year Final)';
  if (yr === 2) return 'Batch 2024–2027 (2nd Year Intermediate)';
  return 'Batch 2025–2028 (1st Year Freshers)';
}

// G. Student Management: Enroll New Student (Principal or HOD)
app.post(['/api/principal/students', '/api/hod/students'], requirePrincipalOrHOD, (req, res) => {
  const userRole = (req.user.role || req.user.profile?.role || '').toUpperCase();
  const userDept = req.user.department || req.user.profile?.department || '';

  let {
    regNo, name, department, currentYear, currentSemester,
    quota, admissionNo, isHosteller, busRoute,
    parentName, parentPhone, email, pin,
    concessionType, concessionAmount, annualTuitionFee, batch, status
  } = req.body;

  // If HOD, default department to HOD's department
  if (userRole === 'HOD' && userDept) {
    department = userDept;
  }

  if (!regNo || !name || !department) {
    return res.status(400).json({ success: false, error: 'Registration Number, Full Name, and Department are required.' });
  }

  const db = loadDb();
  const trimmedReg = regNo.trim();
  const exists = (db.students || []).find(s => s.regNo === trimmedReg);
  if (exists) {
    return res.status(409).json({ success: false, error: `Student with DOTE Reg. No ${trimmedReg} already exists.` });
  }

  const deptCodes = {
    'Computer Engineering': 'CSE',
    'Mechanical Engineering': 'MECH',
    'Electrical & Electronics Engineering': 'EEE',
    'Electronics & Communication Engineering': 'ECE',
    'Civil Engineering': 'CIVIL',
    'Artificial Intelligence & Machine Learning': 'AIML',
    'Biomedical Engineering': 'BME',
    'Medical Laboratory Technology': 'MLT'
  };
  const deptCode = deptCodes[department] || 'DIPLOMA';
  const yr = parseInt(currentYear) || 1;
  const sem = parseInt(currentSemester) || (yr >= 4 ? 6 : yr * 2 - 1);
  const concAmt = parseFloat(concessionAmount) || 0;
  const studentBatch = batch && batch.trim() ? batch.trim() : computeBatchLabel(yr);
  const studentStatus = status ? status.trim() : (yr >= 4 ? 'Post Final Year' : 'Active');

  const newStudent = {
    regNo: trimmedReg,
    admissionNo: admissionNo ? admissionNo.trim() : `SPTC/${new Date().getFullYear().toString().slice(-2)}/${Math.floor(100 + Math.random() * 900)}`,
    name: name.trim(),
    pin: pin ? pin.trim() : '12052005',
    department: department.trim(),
    deptCode: deptCode.toLowerCase(),
    currentYear: yr,
    currentSemester: sem,
    batch: studentBatch,
    quota: quota || 'Government',
    isHosteller: !!isHosteller,
    busRoute: isHosteller ? 'Hosteller (No Bus)' : (busRoute || 'Pudukkottai Town (Route #1)'),
    parentName: parentName ? parentName.trim() : 'Parent / Guardian',
    parentPhone: parentPhone ? parentPhone.trim() : '',
    email: email ? email.trim() : `${trimmedReg}@sptc.org.in`,
    concessionType: concessionType || 'None',
    concessionAmount: concAmt,
    status: studentStatus,
    enrolledBy: userRole === 'HOD' ? `HOD (${userDept})` : 'Principal'
  };

  db.students = db.students || [];
  db.students.push(newStudent);

  // Initialize fee bill
  const tuition = annualTuitionFee !== undefined ? parseFloat(annualTuitionFee) : (quota === 'Management' ? 22000 : 14000);
  const lab = 3500;
  const bus = isHosteller ? 0 : 5000;
  const hostel = isHosteller ? 16000 : 0;
  const netDue = Math.max(0, tuition + lab + bus + hostel - concAmt);

  db.feeBilledItems = db.feeBilledItems || [];
  db.feeBilledItems.push({
    id: `BILL-${trimmedReg}-SEM${sem}`,
    regNo: trimmedReg,
    academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    semester: `Semester ${sem}`,
    tuitionFee: tuition,
    labFee: lab,
    busFee: bus,
    hostelFee: hostel,
    concession: concAmt,
    netPayable: netDue,
    dueDate: `${new Date().getFullYear()}-12-31`
  });

  saveDb(db);

  res.json({
    success: true,
    message: `Student ${newStudent.name} (${newStudent.regNo}) enrolled successfully in ${newStudent.batch}.`,
    student: newStudent
  });
});

// H. Student Management: Update Student Profile (Principal or HOD)
app.put(['/api/principal/students/:regNo', '/api/hod/students/:regNo'], requirePrincipalOrHOD, (req, res) => {
  const { regNo } = req.params;
  const userRole = (req.user.role || req.user.profile?.role || '').toUpperCase();
  const userDept = (req.user.department || req.user.profile?.department || '').toLowerCase();

  const {
    name, department, currentYear, currentSemester,
    quota, admissionNo, isHosteller, busRoute,
    parentName, parentPhone, email,
    concessionType, concessionAmount, status, batch
  } = req.body;

  const db = loadDb();
  const student = (db.students || []).find(s => s.regNo === regNo);
  if (!student) {
    return res.status(404).json({ success: false, error: `Student with Reg. No ${regNo} not found.` });
  }

  // If HOD, verify department authorization
  if (userRole === 'HOD' && userDept) {
    const studentDeptLower = (student.department || '').toLowerCase();
    if (!studentDeptLower.includes(userDept) && !userDept.includes(studentDeptLower)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. As HOD of ${req.user.department}, you may only edit students in your department.`
      });
    }
  }

  if (name) student.name = name.trim();
  if (department && userRole === 'PRINCIPAL') student.department = department.trim();
  if (currentYear) {
    student.currentYear = parseInt(currentYear);
    if (!batch && !student.batch) student.batch = computeBatchLabel(student.currentYear);
  }
  if (currentSemester) student.currentSemester = parseInt(currentSemester);
  if (batch) student.batch = batch.trim();
  if (quota) student.quota = quota.trim();
  if (admissionNo) student.admissionNo = admissionNo.trim();
  if (isHosteller !== undefined) student.isHosteller = !!isHosteller;
  if (busRoute !== undefined) student.busRoute = busRoute.trim();
  if (parentName) student.parentName = parentName.trim();
  if (parentPhone !== undefined) student.parentPhone = parentPhone.trim();
  if (email) student.email = email.trim();
  if (concessionType) student.concessionType = concessionType.trim();
  if (concessionAmount !== undefined) student.concessionAmount = parseFloat(concessionAmount) || 0;
  if (status) student.status = status.trim();

  saveDb(db);

  res.json({
    success: true,
    message: `Student record for ${student.name} (${student.regNo}) updated successfully.`,
    student
  });
});

// H2. HOD Department Overview & Batch Grouping API (3-Year Batches + Post Final Year Batches)
app.get('/api/hod/overview', requireStaff, (req, res) => {
  const userRole = (req.user.role || req.user.profile?.role || '').toUpperCase();
  if (userRole !== 'HOD' && userRole !== 'PRINCIPAL') {
    return res.status(403).json({ success: false, error: 'HOD or Principal authorization required.' });
  }

  const db = loadDb();
  const userDept = req.user.department || req.user.profile?.department || req.query.department || 'Computer Engineering';
  const allStudents = db.students || [];
  const bills = db.feeBilledItems || [];
  const receipts = db.receipts || [];

  // Filter students for HOD's department
  const deptStudents = allStudents.filter(s => {
    return s.department?.toLowerCase() === userDept.toLowerCase() ||
           s.department?.toLowerCase().includes(userDept.toLowerCase()) ||
           userDept.toLowerCase().includes(s.department?.toLowerCase());
  }).map(s => {
    const sBills = bills.filter(b => b.regNo === s.regNo);
    const sReceipts = receipts.filter(r => r.regNo === s.regNo);
    const bTotal = sBills.reduce((acc, b) => acc + (b.netPayable || 0), 0);
    const pTotal = sReceipts.reduce((acc, r) => acc + (r.amount || 0), 0);
    const balanceDue = Math.max(0, bTotal - pTotal);
    return {
      ...s,
      batch: s.batch || computeBatchLabel(s.currentYear),
      totalBilled: bTotal,
      totalPaid: pTotal,
      balanceDue
    };
  });

  // Calculate financial metrics for department students
  const studentRegNos = new Set(deptStudents.map(s => s.regNo));
  const deptBills = bills.filter(b => studentRegNos.has(b.regNo));
  const deptReceipts = receipts.filter(r => studentRegNos.has(r.regNo));
  const totalBilled = deptBills.reduce((acc, b) => acc + (b.netPayable || 0), 0);
  const totalCollections = deptReceipts.reduce((acc, r) => acc + (r.amount || 0), 0);
  const totalDues = Math.max(0, totalBilled - totalCollections);

  // Helper to identify Post Final Year students
  const isPostFinal = (s) => {
    const yr = parseInt(s.currentYear);
    const b = (s.batch || '').toLowerCase();
    const st = (s.status || '').toLowerCase();
    return yr >= 4 || b.includes('post final') || st.includes('post final');
  };

  // Group active 3 years and Post Final Year students
  const postFinalStudents = deptStudents.filter(isPostFinal);
  const batch3 = deptStudents.filter(s => !isPostFinal(s) && parseInt(s.currentYear) === 3);
  const batch2 = deptStudents.filter(s => !isPostFinal(s) && parseInt(s.currentYear) === 2);
  const batch1 = deptStudents.filter(s => !isPostFinal(s) && (parseInt(s.currentYear) === 1 || !s.currentYear));

  // Dynamically group Post Final Year students by batch
  const postFinalMap = {};
  postFinalStudents.forEach(st => {
    const bLabel = st.batch || 'Batch 2022–2025 (Post Final Year)';
    if (!postFinalMap[bLabel]) {
      postFinalMap[bLabel] = [];
    }
    postFinalMap[bLabel].push(st);
  });

  const postFinalBatches = Object.keys(postFinalMap).map(bLabel => {
    const list = postFinalMap[bLabel];
    return {
      batchLabel: bLabel,
      year: 4,
      isPostFinal: true,
      count: list.length,
      govtQuota: list.filter(s => s.quota === 'Government').length,
      mgtQuota: list.filter(s => s.quota === 'Management').length,
      students: list
    };
  });

  res.json({
    success: true,
    department: userDept,
    hodName: req.user.name || req.user.profile?.name,
    totalStudents: deptStudents.length,
    totalPostFinalStudents: postFinalStudents.length,
    totalBilled,
    totalCollections,
    totalDues,
    batches: {
      year3: {
        batchLabel: 'Batch 2023–2026 (3rd Year Final)',
        year: 3,
        count: batch3.length,
        govtQuota: batch3.filter(s => s.quota === 'Government').length,
        mgtQuota: batch3.filter(s => s.quota === 'Management').length,
        students: batch3
      },
      year2: {
        batchLabel: 'Batch 2024–2027 (2nd Year Intermediate)',
        year: 2,
        count: batch2.length,
        govtQuota: batch2.filter(s => s.quota === 'Government').length,
        mgtQuota: batch2.filter(s => s.quota === 'Management').length,
        students: batch2
      },
      year1: {
        batchLabel: 'Batch 2025–2028 (1st Year Freshers)',
        year: 1,
        count: batch1.length,
        govtQuota: batch1.filter(s => s.quota === 'Government').length,
        mgtQuota: batch1.filter(s => s.quota === 'Management').length,
        students: batch1
      },
      postFinal: {
        batchLabel: 'Post Final Year Batches',
        year: 4,
        count: postFinalStudents.length,
        govtQuota: postFinalStudents.filter(s => s.quota === 'Government').length,
        mgtQuota: postFinalStudents.filter(s => s.quota === 'Management').length,
        batches: postFinalBatches,
        students: postFinalStudents
      }
    },
    postFinalBatches: postFinalBatches,
    students: deptStudents
  });
});

// I. Student Management: Delete Student (Principal Only)
app.delete('/api/principal/students/:regNo', requirePrincipal, (req, res) => {
  const { regNo } = req.params;
  const db = loadDb();
  const student = (db.students || []).find(s => s.regNo === regNo);
  if (!student) {
    return res.status(404).json({ success: false, error: 'Student record not found.' });
  }

  db.students = (db.students || []).filter(s => s.regNo !== regNo);
  db.feeBilledItems = (db.feeBilledItems || []).filter(b => b.regNo !== regNo);
  saveDb(db);

  res.json({
    success: true,
    message: `Student record for ${student.name} (${regNo}) deleted from institutional records.`
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

// Helper for department code normalization
function getDeptCode(deptName = '') {
  const d = deptName.toLowerCase();
  if (d.includes('computer') || d.includes('cse')) return 'CSE';
  if (d.includes('artificial') || d.includes('ai')) return 'AI&ML';
  if (d.includes('mechanical') || d.includes('mech')) return 'MECH';
  if (d.includes('electrical') || d.includes('eee')) return 'EEE';
  if (d.includes('electronics & communication') || d.includes('ece')) return 'ECE';
  if (d.includes('civil')) return 'CIVIL';
  if (d.includes('biomedical') || d.includes('bme')) return 'BME';
  if (d.includes('medical') || d.includes('mlt') || d.includes('dmlt')) return 'MLT';
  return 'GEN';
}

// ======================== ADMISSION ENQUIRY & MANAGEMENT APIS ========================

// 1. Submit New Admission Enquiry (Public: from Website Modal or Walk-In)
app.post('/api/admissions', (req, res) => {
  const { studentName, phone, email, department, quota, residenceType, notes, enquirySource } = req.body;

  if (!studentName || !studentName.trim()) {
    return res.status(400).json({ error: 'Student candidate full name is required.' });
  }

  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    return res.status(400).json({ error: 'A valid 10-digit mobile contact number is required.' });
  }

  if (!department || !department.trim()) {
    return res.status(400).json({ error: 'Preferred diploma discipline is required.' });
  }

  const db = loadDb();
  if (!Array.isArray(db.admissions)) {
    db.admissions = [];
  }

  const nextSeq = db.admissions.length + 1;
  const enquiryId = `ADM-2026-${String(nextSeq).padStart(4, '0')}`;

  const newEnquiry = {
    id: enquiryId,
    studentName: studentName.trim(),
    phone: cleanPhone,
    email: (email || '').trim(),
    department: department.trim(),
    deptCode: getDeptCode(department),
    quota: quota || 'Government',
    residenceType: residenceType || 'Day Scholar (College Bus Needed)',
    academicYear: '2026-2027',
    status: 'Pending',
    submittedAt: new Date().toISOString(),
    assignedStaff: 'Unassigned',
    notes: (notes || '').trim(),
    followUpDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    enquirySource: enquirySource || 'Website Modal'
  };

  db.admissions.unshift(newEnquiry);
  saveDb(db);

  console.log(`[ADMISSION] New enquiry recorded: ${enquiryId} for ${newEnquiry.studentName} (${newEnquiry.department})`);

  res.status(201).json({
    success: true,
    message: 'Admission enquiry recorded successfully! Our admission office will contact you shortly.',
    id: enquiryId,
    enquiry: newEnquiry
  });
});

// 2. Get All Admission Enquiries (Protected: Accessible by ALL Staff Roles)
app.get('/api/admissions', requireStaff, (req, res) => {
  const db = loadDb();
  const admissions = db.admissions || [];

  const stats = {
    total: admissions.length,
    pending: admissions.filter(a => a.status === 'Pending').length,
    contacted: admissions.filter(a => a.status === 'Contacted').length,
    admitted: admissions.filter(a => a.status === 'Admitted').length,
    cancelled: admissions.filter(a => a.status === 'Cancelled' || a.status === 'Rejected').length,
    byDept: {}
  };

  admissions.forEach(a => {
    const dept = a.department || 'Other';
    stats.byDept[dept] = (stats.byDept[dept] || 0) + 1;
  });

  res.json({
    success: true,
    total: admissions.length,
    stats,
    admissions
  });
});

// 3. Update Admission Enquiry Status / Notes (Protected: Staff Only)
app.put('/api/admissions/:id', requireStaff, (req, res) => {
  const { id } = req.params;
  const { status, notes, assignedStaff, followUpDate, quota, residenceType } = req.body;

  const db = loadDb();
  const enquiry = (db.admissions || []).find(a => a.id === id);

  if (!enquiry) {
    return res.status(404).json({ error: 'Admission enquiry not found.' });
  }

  if (status) enquiry.status = status;
  if (notes !== undefined) enquiry.notes = notes;
  if (assignedStaff !== undefined) enquiry.assignedStaff = assignedStaff;
  if (followUpDate !== undefined) enquiry.followUpDate = followUpDate;
  if (quota) enquiry.quota = quota;
  if (residenceType) enquiry.residenceType = residenceType;

  enquiry.updatedAt = new Date().toISOString();
  enquiry.updatedBy = `${req.user.profile?.name || req.user.id} (${req.user.role || 'STAFF'})`;

  saveDb(db);

  res.json({
    success: true,
    message: 'Admission enquiry updated successfully.',
    enquiry
  });
});

// 4. One-Click Enroll Admitted Candidate into DOTE Student Ledger (Protected: Staff Only)
app.post('/api/admissions/:id/enroll', requireStaff, (req, res) => {
  const { id } = req.params;
  const db = loadDb();
  const enquiry = (db.admissions || []).find(a => a.id === id);

  if (!enquiry) {
    return res.status(404).json({ error: 'Admission enquiry not found.' });
  }

  if (enquiry.enrolledRegNo) {
    return res.status(400).json({ error: `Candidate is already enrolled with Reg No ${enquiry.enrolledRegNo}.` });
  }

  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const newRegNo = `2420${randSuffix}`;
  const isHosteller = (enquiry.residenceType || '').toLowerCase().includes('hostel');

  const newStudent = {
    regNo: newRegNo,
    name: enquiry.studentName,
    admissionNo: `SPTC/2026/${Math.floor(100 + Math.random() * 900)}`,
    department: enquiry.department,
    deptCode: enquiry.deptCode || getDeptCode(enquiry.department),
    currentYear: 1,
    currentSemester: 1,
    quota: enquiry.quota || 'Government',
    isHosteller: isHosteller,
    busRoute: isHosteller ? 'None (Hosteller)' : 'Route 1 (Pudukkottai - Rayavaram)',
    parentName: 'Parent / Guardian',
    parentPhone: enquiry.phone,
    email: enquiry.email || `${newRegNo}@sptc.org.in`,
    pin: 'sptc2026',
    concessionType: 'None',
    concessionAmount: 0,
    status: 'Active',
    enrolledBy: `${req.user.profile?.name || req.user.id} (Admission Office)`
  };

  db.students.push(newStudent);

  // Generate initial Semester 1 fee assessment
  const baseTuition = newStudent.quota === 'Management' ? 16000 : 12500;
  const busCost = isHosteller ? 0 : 4500;
  const hostelCost = isHosteller ? 13500 : 0;
  const netDue = baseTuition + 2500 + 1200 + busCost + hostelCost;

  db.feeBilledItems.push({
    id: `BILL-${newRegNo}-SEM1`,
    regNo: newRegNo,
    academicYear: '2026-2027',
    semester: 'Semester 1',
    tuitionFee: baseTuition,
    labFee: 2500,
    examFee: 1200,
    busFee: busCost,
    hostelFee: hostelCost,
    concession: 0,
    netPayable: netDue,
    dueDate: '2026-12-31'
  });

  enquiry.status = 'Admitted';
  enquiry.enrolledRegNo = newRegNo;
  enquiry.enrolledAt = new Date().toISOString();
  enquiry.enrolledBy = `${req.user.profile?.name || req.user.id}`;

  saveDb(db);

  res.json({
    success: true,
    message: `Candidate enrolled successfully as Student Reg No ${newRegNo} in DOTE Ledger!`,
    student: newStudent,
    enquiry
  });
});

// 5. Delete Admission Enquiry (Protected: Staff Only)
app.delete('/api/admissions/:id', requireStaff, (req, res) => {
  const { id } = req.params;
  const db = loadDb();
  const idx = (db.admissions || []).findIndex(a => a.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Admission enquiry not found.' });
  }

  db.admissions.splice(idx, 1);
  saveDb(db);

  res.json({ success: true, message: 'Enquiry deleted successfully.' });
});

// Dedicated HTML Page Routes
app.get(['/admissions', '/admissions-dashboard', '/admissions-dashboard.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admissions-dashboard.html'));
});

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

app.get(['/cashier', '/cashier-dashboard', '/cashier-dashboard.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cashier-dashboard.html'));
});

// Dedicated Principal Executive Dashboard Route
app.get(['/principal', '/principal-dashboard', '/principal-dashboard.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'principal-dashboard.html'));
});

// Dedicated HOD Department Dashboard Route
app.get(['/hod', '/hod-dashboard', '/hod-dashboard.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hod-dashboard.html'));
});

// Dedicated Transactions Journal Page (Paginated 20 rows per page)
app.get(['/transactions', '/transactions.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'transactions.html'));
});

// Dedicated Public Receipt Verification Route (Scanned via QR Code on phones or paper)
app.get(['/verify', '/verify/:hash'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

// Dedicated Facilities & Placements Page
app.get(['/facilities', '/facilities.html', '/placements', '/placements.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'facilities.html'));
});

// Dedicated Departments & Gallery Pages
app.get(['/departments', '/departments.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'departments.html'));
});

app.get(['/gallery', '/gallery.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
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

// Export app for serverless platforms (e.g. Vercel)
module.exports = app;
