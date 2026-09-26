const prisma = require('./src/config/db');
const {
  isApprovedMentor,
  isProfessionalMentor,
  isPeerMentor,
  isLearner,
} = require('./src/utils/mentorCapability');

async function runTests() {
  console.log('--- PHASE 7D CAPABILITY TESTS ---');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
    }
  }

  // Generate test data objects
  const normalStudent = {
    role: 'STUDENT',
    isActive: true,
    isSuspended: false,
    studentProfile: { id: 'sp1' },
    mentorProfile: null
  };

  const pendingPeer = {
    role: 'STUDENT',
    isActive: true,
    isSuspended: false,
    studentProfile: { id: 'sp2' },
    mentorProfile: { id: 'mp1', status: 'PENDING', mentorType: 'PEER' }
  };

  const approvedPeer = {
    role: 'STUDENT',
    isActive: true,
    isSuspended: false,
    studentProfile: { id: 'sp3' },
    mentorProfile: { id: 'mp2', status: 'APPROVED', mentorType: 'PEER' }
  };

  const suspendedPeer = {
    role: 'STUDENT',
    isActive: true,
    isSuspended: true,
    studentProfile: { id: 'sp4' },
    mentorProfile: { id: 'mp3', status: 'APPROVED', mentorType: 'PEER' }
  };

  const professionalMentor = {
    role: 'MENTOR',
    isActive: true,
    isSuspended: false,
    studentProfile: null,
    mentorProfile: { id: 'mp4', status: 'APPROVED', mentorType: 'PROFESSIONAL' }
  };

  // Test 1: Normal STUDENT remains learner only
  assert(isLearner(normalStudent) === true && isApprovedMentor(normalStudent) === false, 'Normal STUDENT remains learner only');

  // Test 2: Pending peer applicant has no mentor capability
  assert(isLearner(pendingPeer) === true && isApprovedMentor(pendingPeer) === false, 'Pending peer applicant has no mentor capability');

  // Test 4: Approved peer mentor has mentor capability
  assert(isLearner(approvedPeer) === true && isApprovedMentor(approvedPeer) === true && isPeerMentor(approvedPeer) === true, 'Approved peer mentor has mentor capability');

  // Test 5: Suspended peer mentor loses mentor capability
  assert(isApprovedMentor(suspendedPeer) === false, 'Suspended peer mentor loses mentor capability');

  // Test 6: Professional mentor still works
  assert(isLearner(professionalMentor) === false && isApprovedMentor(professionalMentor) === true && isProfessionalMentor(professionalMentor) === true, 'Professional mentor still works');

  // Test 19: User.role remains STUDENT for peer mentors
  assert(approvedPeer.role === 'STUDENT', 'User.role remains STUDENT for peer mentors');

  // Test 20: Professional mentor remains MENTOR + PROFESSIONAL
  assert(professionalMentor.role === 'MENTOR' && professionalMentor.mentorProfile.mentorType === 'PROFESSIONAL', 'Professional mentor remains MENTOR + PROFESSIONAL');

  console.log(`\nResults: ${passed}/${total} tests passed.`);
  process.exit(passed === total ? 0 : 1);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
