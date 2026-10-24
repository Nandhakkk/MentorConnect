const prisma = require('./src/config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key', { expiresIn: '7d' });
};

const generateEmail = (prefix) => `${prefix}_${crypto.randomBytes(4).toString('hex')}@test.com`;
const BASE_URL = 'http://localhost:5000/api';

async function runApplicationCreateTests() {
  console.log('================================================================');
  console.log('TESTING PROFESSIONAL MENTOR APPLICATION CREATE FIX');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // SCENARIO 1: Normal user registers with dateOfBirth string, applies with string dateOfBirth
    console.log('--- SCENARIO 1: Normal Mentor Register & Apply Flow ---');
    const registerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sarah Connor',
        email: generateEmail('mentor_create'),
        password: 'password123',
        role: 'MENTOR',
        dateOfBirth: '1992-07-15'
      })
    });
    const registerData = await registerRes.json();
    assert(registerRes.status === 201 && registerData.token, 'Registered new MENTOR account with dateOfBirth');
    const mentorToken = registerData.token;

    // Test GET /api/mentor-applications/me before application exists -> returns 404
    const initialGetRes = await fetch(`${BASE_URL}/mentor-applications/me`, {
      headers: { Authorization: `Bearer ${mentorToken}` }
    });
    assert(initialGetRes.status === 404, 'Initial GET /me returns 404 (no application yet)');

    // Create Application with string dateOfBirth, claims, and empty optional fields
    const createPayload = {
      name: 'Sarah Connor',
      dateOfBirth: '1992-07-15', // String date as sent by HTML date input
      professionalSummary: 'Experienced Robotics & Autonomous Systems Mentor',
      expertise: 'Robotics, Embedded Systems',
      topics: 'ROS2, C++, Sensor Fusion',
      experience: '6',
      teachingExperience: '3',
      teachingExperienceDetails: '3 years university lecturing in Robotics',
      employmentHistory: 'Robotics Engineer at CyberTech (2018-2021)',
      education: 'B.Tech Robotics, M.S. Mechatronics',
      skills: 'C++, Python, ROS, Microcontrollers',
      certifications: 'Certified Robotics Professional',
      achievements: 'Patent in Autonomous Navigation',
      otherInfo: '',
      linkedinUrl: 'https://linkedin.com/in/sarah-robotics',
      languages: 'English',
      proposedSessionFee: '1200'
    };

    const createRes = await fetch(`${BASE_URL}/mentor-applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mentorToken}`
      },
      body: JSON.stringify(createPayload)
    });
    const createData = await createRes.json();
    assert(createRes.status === 201 && createData.status === 'success', `Application created successfully (status ${createRes.status})`);
    assert(createData.application && createData.application.teachingExperience === 3, 'Application contains teachingExperience = 3');
    assert(createData.application.status === 'PENDING', 'Application status is PENDING');

    // Confirm application appears in GET /api/mentor-applications/me
    const afterGetRes = await fetch(`${BASE_URL}/mentor-applications/me`, {
      headers: { Authorization: `Bearer ${mentorToken}` }
    });
    const afterGetData = await afterGetRes.json();
    assert(afterGetRes.status === 200 && afterGetData.application.id === createData.application.id, 'GET /me retrieves the newly created application');

    // SCENARIO 2: Test missing optional fields & empty skills/topics
    console.log('\n--- SCENARIO 2: Missing Optional Fields & Empty Skills/Topics ---');
    const updatePayload = {
      experience: '6',
      teachingExperience: '3',
      skills: '',
      topics: '',
      certifications: '',
      achievements: '',
      otherInfo: '',
      proposedSessionFee: ''
    };
    const updateRes = await fetch(`${BASE_URL}/mentor-applications/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mentorToken}`
      },
      body: JSON.stringify(updatePayload)
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200 && updateData.status === 'success', 'Updated application with empty optional fields without error');

    // SCENARIO 3: Re-submitting application when status is PENDING safely updates rather than erroring
    console.log('\n--- SCENARIO 3: Re-submitting to POST /mentor-applications while PENDING ---');
    const reCreateRes = await fetch(`${BASE_URL}/mentor-applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mentorToken}`
      },
      body: JSON.stringify({
        ...createPayload,
        skills: 'C++, Python, Linux'
      })
    });
    const reCreateData = await reCreateRes.json();
    assert(reCreateRes.status === 200 && reCreateData.status === 'success', 'Re-submitting while PENDING safely updates existing application');

    // SCENARIO 4: Upload supporting document afterward
    console.log('\n--- SCENARIO 4: Upload Supporting Evidence ---');
    const boundary = '----WebKitFormBoundary' + crypto.randomBytes(8).toString('hex');
    const fileContent = 'Teaching Certificate for Sarah Connor - 3 years Robotics instruction';
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nRobotics Teaching Certificate`,
      `--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\nEXPERIENCE`,
      `--${boundary}\r\nContent-Disposition: form-data; name="claimType"\r\n\r\nTEACHING_EXPERIENCE`,
      `--${boundary}\r\nContent-Disposition: form-data; name="claimDescription"\r\n\r\nSupports 3 years university lecturing in Robotics`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="robotics_teaching_cert.pdf"\r\nContent-Type: application/pdf\r\n\r\n`
    ];
    const bodyBuffer = Buffer.concat([
      Buffer.from(parts.join('\r\n')),
      Buffer.from(fileContent),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    const uploadRes = await fetch(`${BASE_URL}/mentor-applications/me/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${mentorToken}`
      },
      body: bodyBuffer
    });
    const uploadData = await uploadRes.json();
    assert(uploadRes.status === 201 && uploadData.status === 'success', 'Supporting document uploaded successfully');

    // SCENARIO 5: Run AI Screening
    console.log('\n--- SCENARIO 5: AI Screening & Non-Auto-Approval ---');
    const screenRes = await fetch(`${BASE_URL}/mentor-applications/me/screen`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mentorToken}` }
    });
    const screenData = await screenRes.json();
    assert(screenRes.status === 200 && screenData.status === 'success', 'AI screening completed successfully');

    const appAfterScreen = await prisma.mentorApplication.findUnique({
      where: { id: createData.application.id }
    });
    assert(appAfterScreen.status === 'AI_SCREENED', `Application status is AI_SCREENED (actual: ${appAfterScreen.status})`);

    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: registerData.user.id }
    });
    assert(mentorProfile.status === 'PENDING', `MentorProfile status remains PENDING (actual: ${mentorProfile.status}) - ADMIN APPROVAL STILL REQUIRED`);

    // SCENARIO 6: Edge Case - User missing mentorProfile auto-heals
    console.log('\n--- SCENARIO 6: Edge Case - Mentor account missing MentorProfile record ---');
    const orphanUser = await prisma.user.create({
      data: {
        name: 'Orphan Mentor',
        email: generateEmail('orphan'),
        password: 'password123',
        role: 'MENTOR'
      }
    });
    const orphanToken = generateToken({ id: orphanUser.id, role: 'MENTOR' });
    const orphanAppRes = await fetch(`${BASE_URL}/mentor-applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orphanToken}`
      },
      body: JSON.stringify({
        expertise: 'Data Science',
        experience: '4',
        teachingExperience: '1'
      })
    });
    const orphanAppData = await orphanAppRes.json();
    assert(orphanAppRes.status === 201 && orphanAppData.status === 'success', 'Missing mentorProfile automatically healed and application created');

    // SCENARIO 7: Minor validation (< 18 years old) is properly rejected
    console.log('\n--- SCENARIO 7: Minor Validation ---');
    const minorUser = await prisma.user.create({
      data: {
        name: 'Minor Applicant',
        email: generateEmail('minor'),
        password: 'password123',
        role: 'MENTOR',
        dateOfBirth: new Date('2015-01-01')
      }
    });
    const minorToken = generateToken({ id: minorUser.id, role: 'MENTOR' });
    const minorAppRes = await fetch(`${BASE_URL}/mentor-applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({
        dateOfBirth: '2015-01-01',
        expertise: 'Coding',
        experience: '1'
      })
    });
    const minorAppData = await minorAppRes.json();
    assert(minorAppRes.status === 400 && minorAppData.message.includes('18 years old'), 'Minor application rejected with 400 error message');

    // SCENARIO 8: Active application block (e.g. AI_SCREENED)
    console.log('\n--- SCENARIO 8: Active application block ---');
    const duplicateRes = await fetch(`${BASE_URL}/mentor-applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mentorToken}`
      },
      body: JSON.stringify(createPayload)
    });
    const duplicateData = await duplicateRes.json();
    assert(duplicateRes.status === 400 && duplicateData.message.includes('AI_SCREENED'), 'Blocked duplicate creation when already in AI_SCREENED status');

  } catch (err) {
    console.error('Unhandled error during test:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runApplicationCreateTests();
