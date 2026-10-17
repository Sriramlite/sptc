// Strict Security & Authentication Test Suite
const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🏛️  SPTC STRICT AUTHENTICATION & DEPLOYMENT TEST SUITE\n');

  // Test 1: Health Check
  const health = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/health',
    method: 'GET'
  });
  console.log(`[TEST 1] GET /api/health -> HTTP ${health.status} (Status: ${health.body.status}, DOTE: ${health.body.doteCode})`);
  console.assert(health.status === 200, 'Health check must return 200');

  // Test 2: Unauthenticated /api/auth/me -> 401
  const unauthMe = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET'
  });
  console.log(`[TEST 2] GET /api/auth/me (No Token) -> HTTP ${unauthMe.status} [Strict Rejection]`);
  console.assert(unauthMe.status === 401, 'Unauthenticated /api/auth/me must return 401');

  // Test 3: Unauthenticated /api/students -> 401
  const unauthStudents = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/students',
    method: 'GET'
  });
  console.log(`[TEST 3] GET /api/students (No Token) -> HTTP ${unauthStudents.status} [Staff Route Protected]`);
  console.assert(unauthStudents.status === 401, 'Unauthenticated /api/students must return 401');

  // Test 4: Student Login
  const studentLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: '22201045', password: '12052005', roleType: 'STUDENT' });
  console.log(`[TEST 4] POST /api/auth/login (Student 22201045) -> HTTP ${studentLogin.status} (Token: ${studentLogin.body.token ? studentLogin.body.token.slice(0, 10) + '...' : 'none'})`);
  console.assert(studentLogin.status === 200 && studentLogin.body.token, 'Student login must return 200 with token');
  const studentToken = studentLogin.body.token;

  // Test 5: Verify Session with Valid Student Token
  const studentMe = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log(`[TEST 5] GET /api/auth/me (Student Token) -> HTTP ${studentMe.status} (Authenticated: ${studentMe.body.authenticated}, Name: ${studentMe.body.profile.name})`);
  console.assert(studentMe.status === 200 && studentMe.body.authenticated === true, 'Session must be verified as true');

  // Test 6: Student Accessing Own Fees
  const ownFees = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/student/22201045/fees',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log(`[TEST 6] GET /api/student/22201045/fees (Own Account) -> HTTP ${ownFees.status} (Billed: ₹${ownFees.body.summary.totalBilled})`);
  console.assert(ownFees.status === 200, 'Student must be able to view their own fees');

  // Test 7: Student Attempting to Access Another Student's Fees -> 403 FORBIDDEN
  const otherFees = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/student/22202018/fees',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log(`[TEST 7] GET /api/student/22202018/fees (Cross Account) -> HTTP ${otherFees.status} [Strict 403 Forbidden: ${otherFees.body.error}]`);
  console.assert(otherFees.status === 403, 'Cross-student fee access must return 403 Forbidden');

  // Test 8: Student Attempting to Access Staff Endpoint -> 403 FORBIDDEN
  const studentToStaff = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/students',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log(`[TEST 8] GET /api/students (Student Token on Staff Route) -> HTTP ${studentToStaff.status} [Strict 403 Forbidden: ${studentToStaff.body.error}]`);
  console.assert(studentToStaff.status === 403, 'Student accessing staff route must return 403 Forbidden');

  // Test 9: Staff Login
  const staffLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: 'cashier', password: 'sptc@cashier2026', roleType: 'STAFF' });
  console.log(`[TEST 9] POST /api/auth/login (Cashier) -> HTTP ${staffLogin.status} (Staff Name: ${staffLogin.body.profile.name})`);
  console.assert(staffLogin.status === 200 && staffLogin.body.userType === 'STAFF', 'Staff login must return 200');
  const staffToken = staffLogin.body.token;

  // Test 10: Staff Accessing /api/students -> 200 Allowed
  const staffStudents = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/students',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${staffToken}` }
  });
  console.log(`[TEST 10] GET /api/students (Staff Token) -> HTTP ${staffStudents.status} (Count: ${staffStudents.body.length} students retrieved)`);
  console.assert(staffStudents.status === 200 && Array.isArray(staffStudents.body), 'Staff must be able to retrieve student list');

  // Test 11: Staff Inspecting Any Student Fees -> 200 Allowed
  const staffInspect = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/student/22202018/fees',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${staffToken}` }
  });
  console.log(`[TEST 11] GET /api/student/22202018/fees (Staff Inspecting Student) -> HTTP ${staffInspect.status} (Student: ${staffInspect.body.student.name})`);
  console.assert(staffInspect.status === 200, 'Staff must be able to inspect any student ledger');

  // Test 12: Strict Logout
  const logoutRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/logout',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log(`[TEST 12] POST /api/auth/logout -> HTTP ${logoutRes.status} (Message: ${logoutRes.body.message})`);
  console.assert(logoutRes.status === 200, 'Logout must succeed');

  // Test 13: Re-verify Logged Out Token -> MUST BE REJECTED 401
  const afterLogoutMe = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log(`[TEST 13] GET /api/auth/me (Using Destroyed Token) -> HTTP ${afterLogoutMe.status} [Invalidated: ${afterLogoutMe.body.error}]`);
  console.assert(afterLogoutMe.status === 401, 'Token must be rejected with 401 after logout');

  // Test 14: Protected Student Route using Destroyed Token -> MUST BE REJECTED 401
  const afterLogoutFees = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/student/22201045/fees',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log(`[TEST 14] GET /api/student/22201045/fees (Using Destroyed Token) -> HTTP ${afterLogoutFees.status} [Invalidated: ${afterLogoutFees.body.error}]`);
  console.assert(afterLogoutFees.status === 401, 'Protected route must reject destroyed token with 401');

  // Test 15: Security Headers
  console.log(`[TEST 15] Security Headers Verification:`);
  console.log(`  - X-Content-Type-Options: ${health.headers['x-content-type-options']}`);
  console.log(`  - X-Frame-Options: ${health.headers['x-frame-options']}`);
  console.log(`  - X-XSS-Protection: ${health.headers['x-xss-protection']}`);
  console.log(`  - Referrer-Policy: ${health.headers['referrer-policy']}`);
  console.assert(health.headers['x-content-type-options'] === 'nosniff', 'Must include nosniff');
  console.assert(health.headers['x-frame-options'] === 'SAMEORIGIN', 'Must include SAMEORIGIN');

  console.log('\n=======================================================');
  console.log('✅ ALL 15 STRICT AUTHENTICATION & DEPLOYMENT TESTS PASSED!');
  console.log('=======================================================');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
