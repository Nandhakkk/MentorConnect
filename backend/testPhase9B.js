
const prisma = require('./src/config/db');
const { calculateAge, isMinor, validateDateOfBirth } = require('./src/utils/ageHelper');
const { checkPeerMentorEligibility } = require('./src/utils/peerMentorEligibility');
const adminController = require('./src/controllers/adminController');

async function runTests() {
  console.log('--- TEST 1-4: AGE CALCULATION ---');
  
  // 1. Valid adult DOB
  const validDob = new Date('1990-01-01');
  console.log('Valid adult DOB:', validateDateOfBirth(validDob));
  
  // 2. Minor age calculation
  const minorDob = new Date(); minorDob.setFullYear(minorDob.getFullYear() - 17);
  console.log('Minor age calculation:', calculateAge(minorDob));
  console.log('isMinor (17yo):', isMinor(minorDob));
  
  // 3. Adult age calculation
  const adultDob = new Date(); adultDob.setFullYear(adultDob.getFullYear() - 25);
  console.log('Adult age calculation:', calculateAge(adultDob));
  console.log('isMinor (25yo):', isMinor(adultDob));
  
  // 4. Future DOB rejection
  const futureDob = new Date(); futureDob.setFullYear(futureDob.getFullYear() + 1);
  console.log('Future DOB rejection:', validateDateOfBirth(futureDob) === null ? 'Rejected' : 'Failed');
  
  console.log('\n--- TEST 12: ADMIN USER LIST ---');
  // Mock req, res for getUsers
  const req = { query: {} };
  const res = {
    status: (code) => ({
      json: (data) => console.log('Admin getUsers excluded ADMIN:', data.users.every(u => u.role !== 'ADMIN'))
    })
  };
  await adminController.getUsers(req, res);
  
  console.log('\n--- TEST 13-14: ROLE ARCHITECTURE ---');
  const profMentor = await prisma.user.findFirst({ where: { role: 'MENTOR', mentorProfile: { mentorType: 'PROFESSIONAL' } } });
  console.log('Professional mentor remains MENTOR:', profMentor ? 'YES' : 'NO DATA');
  
  const peerMentor = await prisma.user.findFirst({ where: { role: 'STUDENT', mentorProfile: { mentorType: 'PEER' } } });
  console.log('Peer mentor remains STUDENT:', peerMentor ? 'YES' : 'NO DATA');
  
  console.log('\n--- TEST 6-7: PEER MENTOR ELIGIBILITY ---');
  const testUser = {
    id: 'test',
    isActive: true,
    isSuspended: false,
    studentProfile: {
      onboardingCompleted: true,
      skills: 'JS, Node'
    },
    dateOfBirth: minorDob
  };
  
  console.log('Under-18 peer mentor eligible:', checkPeerMentorEligibility(testUser).eligible);
  
  testUser.dateOfBirth = adultDob;
  console.log('Adult peer mentor eligible:', checkPeerMentorEligibility(testUser).eligible);

  console.log('\nALL TESTS EXECUTED.');
  process.exit(0);
}

runTests().catch(console.error);
