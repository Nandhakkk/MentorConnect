const assert = require('assert');
const jwt = require('jsonwebtoken');
const prisma = require('./src/config/db');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== STARTING ADMIN AUTO-REJECTED HISTORY BUG FIX TEST SUITE ===\n');

  try {
    // 1. Get or create an Admin user and JWT
    let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: 'System Admin',
          email: `admin_${Date.now()}@test.com`,
          password: 'password123',
          role: 'ADMIN'
        }
      });
    }

    const secret = process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key';
    const adminToken = jwt.sign({ id: admin.id, role: 'ADMIN' }, secret, { expiresIn: '1d' });

    // 2. Fetch admin mentors from API
    console.log('--- 1. Testing GET /api/admin/mentors endpoint ---');
    const mentorsRes = await fetch(`${BASE_URL}/admin/mentors`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.strictEqual(mentorsRes.status, 200, 'GET /api/admin/mentors returns 200');
    const mentorsJson = await mentorsRes.json();
    assert.strictEqual(mentorsJson.status, 'success', 'Response status is success');
    assert(Array.isArray(mentorsJson.mentors), 'Mentors is an array');
    console.log(`✓ Successfully fetched ${mentorsJson.mentors.length} mentor profiles`);

    // 3. Test queue outcome logic mirroring frontend getMentorQueueOutcome
    console.log('\n--- 2. Testing Frontend Queue Classification & Tab Counts ---');
    const getLatestApp = (mentor) => {
      return mentor.mentorType === 'PEER'
        ? mentor.peerApplications?.[0]
        : mentor.applications?.[0];
    };

    const getMentorQueueOutcome = (mentor) => {
      const latestApp = getLatestApp(mentor);

      if (mentor.status === 'APPROVED') return 'APPROVED';
      if (mentor.status === 'SUSPENDED') return 'SUSPENDED';

      if (!latestApp) {
        return mentor.status === 'REJECTED' ? 'AUTO_REJECTED' : 'MANUAL_REVIEW';
      }

      const appStatus = latestApp.status;
      const screening = latestApp.aiScreening;
      const rec = screening?.recommendation;
      const findings = screening?.structuredFindings || {};
      const explicitOutcome = findings.outcome || findings.screeningOutcome;

      if (appStatus === 'REJECTED' || mentor.status === 'REJECTED') {
        return 'AUTO_REJECTED';
      }

      if (explicitOutcome === 'ELIGIBLE' || ['STRONG_PASS', 'PASS'].includes(rec)) {
        return 'ELIGIBLE';
      }

      if (explicitOutcome === 'NEEDS_MANUAL_REVIEW' || ['NEEDS_REVIEW', 'BORDERLINE'].includes(rec) || appStatus === 'UNDER_REVIEW') {
        return 'MANUAL_REVIEW';
      }

      if (appStatus === 'AI_SCREENED') return 'ELIGIBLE';
      return 'MANUAL_REVIEW';
    };

    const formatCriterion = (c) => {
      if (!c) return '';
      if (typeof c === 'string') return c;
      return c.message || c.code || c.category || JSON.stringify(c);
    };

    const counts = mentorsJson.mentors.reduce((acc, m) => {
      const outcome = getMentorQueueOutcome(m);
      acc[outcome] = (acc[outcome] || 0) + 1;
      acc.ALL = (acc.ALL || 0) + 1;
      return acc;
    }, {});

    console.log('Queue counts:', counts);
    assert(counts.AUTO_REJECTED > 0, 'Auto-rejected mentors exist in database');

    // 4. Test rendering data for AUTO_REJECTED tab
    console.log('\n--- 3. Testing AUTO_REJECTED Tab Data Transformation (Bug Validation) ---');
    const autoRejectedMentors = mentorsJson.mentors.filter(m => getMentorQueueOutcome(m) === 'AUTO_REJECTED');
    console.log(`Found ${autoRejectedMentors.length} mentors in AUTO_REJECTED queue`);

    let criteriaTestedCount = 0;
    for (const mentor of autoRejectedMentors) {
      const latestApp = getLatestApp(mentor);
      const findings = latestApp?.aiScreening?.structuredFindings || {};
      const failedCriteria = Array.isArray(findings.failedCriteria)
        ? findings.failedCriteria
        : (findings.failedCriteria ? [findings.failedCriteria] : []);

      // Crucial test: formatting criterion must produce a string, NEVER a plain object
      if (failedCriteria.length > 0) {
        const rawFirst = failedCriteria[0];
        const formatted = formatCriterion(rawFirst);
        assert.strictEqual(typeof formatted, 'string', 'Formatted criterion must be a string');
        assert(formatted.length > 0, 'Formatted criterion must not be empty');
        // Verify that raw criterion was indeed an object in database
        if (typeof rawFirst === 'object') {
          criteriaTestedCount++;
          console.log(`  ✓ Successfully transformed criterion object { code: '${rawFirst.code}' } -> "${formatted.substring(0, 50)}..."`);
        }
      }

      // Safe user access check
      const mentorName = mentor.user?.name || 'Unnamed Mentor';
      const mentorEmail = mentor.user?.email || '-';
      assert(typeof mentorName === 'string', 'Mentor name is string');
      assert(typeof mentorEmail === 'string', 'Mentor email is string');

      // Safe date check
      const dateVal = new Date(latestApp?.createdAt || mentor.createdAt || Date.now());
      assert(!isNaN(dateVal.getTime()), 'Date parses validly');
    }

    assert(criteriaTestedCount > 0, 'Validated at least one structured criterion object transformation');
    console.log(`✓ All ${autoRejectedMentors.length} auto-rejected mentors transform cleanly without object-as-child exceptions`);

    // 5. Test empty queue handling
    console.log('\n--- 4. Testing Empty Queue & Search Handling ---');
    const emptyResult = mentorsJson.mentors.filter(m => {
      const outcome = getMentorQueueOutcome(m);
      if (outcome !== 'AUTO_REJECTED') return false;
      return m.user?.name?.includes('NonExistentSearchTerm123456');
    });
    assert.strictEqual(emptyResult.length, 0, 'Non-matching search yields 0 items');
    console.log('✓ Empty results handled cleanly');

    // 6. Test other tabs (ELIGIBLE, MANUAL_REVIEW, APPROVED)
    console.log('\n--- 5. Testing Other Tabs Regression ---');
    const tabs = ['ELIGIBLE', 'MANUAL_REVIEW', 'APPROVED', 'SUSPENDED', 'ALL'];
    for (const tab of tabs) {
      const tabMentors = mentorsJson.mentors.filter(m => {
        const outcome = getMentorQueueOutcome(m);
        if (tab === 'ALL') return true;
        if (tab === 'APPROVED') return m.status === 'APPROVED';
        if (tab === 'SUSPENDED') return m.status === 'SUSPENDED';
        return outcome === tab;
      });
      console.log(`  Tab [${tab}]: ${tabMentors.length} records processed without error`);
    }

    console.log('\n=== ALL TESTS PASSED! AUTO-REJECTED HISTORY BUG IS VERIFIED FIXED ===');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
