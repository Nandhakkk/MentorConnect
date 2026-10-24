const prisma = require('./src/config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key', { expiresIn: '7d' });
};

const generateEmail = (prefix) => `${prefix}_${crypto.randomBytes(4).toString('hex')}@test.com`;

const BASE_URL = 'http://localhost:5000/api';

async function runVerificationTests() {
  console.log('================================================================');
  console.log('STARTING PROFESSIONAL MENTOR VERIFICATION + AI PORTFOLIO TESTS');
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
    // 0. Setup Users: Admin, Mentor, Student
    console.log('--- Setting up test accounts ---');
    const adminUser = await prisma.user.create({
      data: { name: 'Admin Verification', email: generateEmail('admin'), password: 'hashedpassword', role: 'ADMIN' }
    });
    const adminToken = generateToken({ id: adminUser.id, role: 'ADMIN' });

    const mentorUser = await prisma.user.create({
      data: {
        name: 'Dr. Jane Smith',
        email: generateEmail('prof_mentor'),
        password: 'hashedpassword',
        role: 'MENTOR',
        mentorProfile: {
          create: {
            status: 'PENDING',
            mentorType: 'PROFESSIONAL',
            bio: 'Senior software engineering mentor',
            sessionFee: 1500
          }
        }
      },
      include: { mentorProfile: true }
    });
    const mentorToken = generateToken({ id: mentorUser.id, role: 'MENTOR' });
    const mentorProfile = mentorUser.mentorProfile;

    const studentUser = await prisma.user.create({
      data: {
        name: 'Alex Student',
        email: generateEmail('student'),
        password: 'hashedpassword',
        role: 'STUDENT',
        studentProfile: {
          create: {
            onboardingCompleted: true
          }
        }
      },
      include: { studentProfile: true }
    });
    const studentToken = generateToken({ id: studentUser.id, role: 'STUDENT' });

    console.log(`Created Admin (${adminUser.email}), Mentor (${mentorUser.email}), Student (${studentUser.email})`);

    // TEST 1: Submit Professional Mentor Application with 2 years teaching experience + detailed claims
    console.log('\n--- TEST 1: Professional Mentor Application with detailed claims ---');
    const appPayload = {
      yearsExperience: 4,
      experience: 4,
      teachingExperience: 2,
      teachingExperienceDetails: 'Taught Undergraduate Computer Science courses for 2 years at Tech University',
      employmentHistory: 'Senior Software Engineer at ABC Tech (2020-2022), Teaching Fellow at Tech University (2022-2024)',
      education: 'Master of Science in Computer Science from Tech University (2022)',
      skills: 'JavaScript, Node.js, Python, System Design',
      certifications: 'Python Certified Professional, AWS Solutions Architect',
      achievements: 'Best Teaching Assistant Award 2023',
      expertise: ['Web Development', 'Computer Science'],
      topics: ['Node.js Backend', 'Data Structures in Python'],
      proposedSessionFee: 1500,
      professionalSummary: 'Experienced software engineer and computer science educator passionate about mentoring students in full-stack engineering.',
      linkedinUrl: 'https://linkedin.com/in/janesmith-prof',
      languages: 'English, Spanish'
    };

    const applyRes = await fetch(`${BASE_URL}/mentor-applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mentorToken}`
      },
      body: JSON.stringify(appPayload)
    });
    const applyData = await applyRes.json();
    assert(applyRes.status === 201 && applyData.status === 'success', 'Mentor submitted detailed application successfully');
    const application = applyData.application;
    assert(application.teachingExperience === 2, 'Teaching experience recorded as 2 years');
    assert(application.status === 'PENDING', 'Initial application status is PENDING');

    // TEST 2: Upload Multiple Supporting Documents with Claim Linkage
    console.log('\n--- TEST 2: Multiple Document Uploads with Claim Linkage ---');

    // Helper to upload a credential via multipart form
    async function uploadDoc(filename, title, type, claimType, claimDescription, textContent) {
      const boundary = '----WebKitFormBoundary' + crypto.randomBytes(8).toString('hex');
      const fileBuffer = Buffer.from(textContent);

      const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\n${title}`,
        `--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\n${type}`,
        `--${boundary}\r\nContent-Disposition: form-data; name="claimType"\r\n\r\n${claimType}`,
        `--${boundary}\r\nContent-Disposition: form-data; name="claimDescription"\r\n\r\n${claimDescription}`,
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`
      ];

      const bodyBuffer = Buffer.concat([
        Buffer.from(parts.join('\r\n')),
        fileBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const res = await fetch(`${BASE_URL}/mentor-applications/me/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          Authorization: `Bearer ${mentorToken}`
        },
        body: bodyBuffer
      });
      return await res.json();
    }

    // Document 1: Experience certificate linked to 2 years teaching experience claim
    const cred1Data = await uploadDoc(
      'Tech_University_Teaching_Certificate.pdf',
      'Tech University Teaching Certificate',
      'EXPERIENCE',
      'TEACHING_EXPERIENCE',
      'Supports claim of 2 years teaching experience at Tech University (2022-2024)',
      'Certificate of Teaching: Dr. Jane Smith served as Teaching Fellow from June 2022 to June 2024.'
    );
    assert(cred1Data.status === 'success' && cred1Data.credential.claimType === 'TEACHING_EXPERIENCE', 'Teaching Experience document uploaded with claim linkage');

    // Document 2: Education degree linked to Master of Science
    const cred2Data = await uploadDoc(
      'MSc_Computer_Science_Degree.pdf',
      'MSc Degree Certificate',
      'DEGREE',
      'EDUCATION',
      'Supports claim of Master of Science in Computer Science from Tech University',
      'Diploma: Tech University confers Master of Science in Computer Science to Jane Smith in 2022.'
    );
    assert(cred2Data.status === 'success' && cred2Data.credential.claimType === 'EDUCATION', 'Education document uploaded with claim linkage');

    // Document 3: Python Certification
    const cred3Data = await uploadDoc(
      'Python_Certified_Associate.pdf',
      'Python Certified Associate',
      'CERTIFICATE',
      'CERTIFICATION',
      'Supports claim of Python Certified Professional',
      'Python Institute: Certified Associate in Python Programming awarded to Jane Smith.'
    );
    assert(cred3Data.status === 'success' && cred3Data.credential.claimType === 'CERTIFICATION', 'Certification document uploaded with claim linkage');

    // Verify application now has 3 credentials
    const myAppRes = await fetch(`${BASE_URL}/mentor-applications/me`, {
      headers: { Authorization: `Bearer ${mentorToken}` }
    });
    const myAppData = await myAppRes.json();
    assert(myAppData.application.credentials.length === 3, `Application contains 3 credentials (found: ${myAppData.application.credentials.length})`);

    // TEST 3 & 4: Run AI Screening and verify claim evaluation and unsupported detection
    console.log('\n--- TEST 3 & 4: AI Screening & Claim Evaluation ---');
    console.log('Invoking AI document screening via Gemini...');
    const screenRes = await fetch(`${BASE_URL}/mentor-applications/me/screen`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mentorToken}` }
    });
    const screenData = await screenRes.json();
    assert(screenRes.status === 200 && screenData.status === 'success', 'AI screening completed successfully');

    const screening = screenData.screeningResult;
    const claimsAnalysis = screening?.structuredFindings?.claimsAnalysis || [];
    assert(screening && claimsAnalysis.length > 0, 'AI produced claimsAnalysis matrix');
    console.log(`Claims analyzed count: ${claimsAnalysis.length}`);
    console.log(`AI Recommendation: ${screening?.recommendation}`);

    // Verify claims matrix contains evaluation
    const teachingClaim = claimsAnalysis.find(c => (c.claim || '').toLowerCase().includes('teaching'));
    assert(teachingClaim !== undefined, 'AI evaluated Teaching Experience claim');
    if (teachingClaim) {
      console.log(`Teaching claim status: ${teachingClaim.result || teachingClaim.status}, evidence: ${teachingClaim.evidenceFound}`);
    }

    // Check unsupported detection (e.g. AWS Solutions Architect or unbacked claim)
    const hasUnsupportedOrNeedsReview = claimsAnalysis.some(c => {
      const res = (c.result || c.status || '').toUpperCase();
      return res === 'UNSUPPORTED' || res === 'PARTIALLY_SUPPORTED' || res === 'UNABLE_TO_VERIFY';
    });
    assert(hasUnsupportedOrNeedsReview, 'AI identified unsupported/unverified or partially supported claims (e.g. AWS certification without doc)');

    // Verify document-level AI verification was updated on credentials
    const updatedCreds = await prisma.credential.findMany({ where: { mentorId: mentorProfile.id } });
    const credWithAi = updatedCreds.find(c => c.aiVerificationResult !== null);
    assert(credWithAi !== undefined, 'Credentials updated with document-level AI verification results');
    if (credWithAi) {
      console.log(`Sample credential AI result: ${credWithAi.aiVerificationResult}, reasoning: ${credWithAi.aiReasoning}`);
    }

    // TEST 5: Verify AI does NOT automatically approve the mentor
    console.log('\n--- TEST 5: Verify AI Does NOT Auto-Approve ---');
    const appAfterScreen = await prisma.mentorApplication.findUnique({ where: { id: application.id } });
    const profileAfterScreen = await prisma.mentorProfile.findUnique({ where: { id: mentorProfile.id } });
    assert(appAfterScreen.status === 'AI_SCREENED', `Application status is AI_SCREENED (actual: ${appAfterScreen.status}), NOT APPROVED`);
    assert(profileAfterScreen.status === 'PENDING', `Profile status remains PENDING (actual: ${profileAfterScreen.status}), NOT APPROVED`);

    // TEST 6: Admin opens dedicated Mentor Review Workspace
    console.log('\n--- TEST 6: Admin Mentor Review Workspace ---');
    const adminReviewRes = await fetch(`${BASE_URL}/admin/mentor-applications/${application.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminReviewData = await adminReviewRes.json();
    assert(adminReviewRes.status === 200 && adminReviewData.status === 'success', 'Admin accessed mentor review workspace');
    const reviewWorkspace = adminReviewData.application;
    assert(reviewWorkspace.mentor && reviewWorkspace.mentor.user.name === 'Dr. Jane Smith', 'Admin sees mentor profile and identity');
    assert(reviewWorkspace.teachingExperience === 2, 'Admin sees claimed teaching experience');
    assert(reviewWorkspace.credentials.length === 3, 'Admin sees all 3 uploaded documents with claims');
    assert(reviewWorkspace.credentials[0].claimType !== null, 'Admin sees document-claim association');
    assert(reviewWorkspace.credentials[0].aiVerificationResult !== null, 'Admin sees document AI verification results');
    assert(reviewWorkspace.aiScreening !== null, 'Admin sees AI screening summary and breakdown');

    // TEST 7: Admin manually approves the mentor
    console.log('\n--- TEST 7: Admin Manual Approval ---');
    const approveRes = await fetch(`${BASE_URL}/admin/mentor-applications/${application.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'APPROVED',
        reviewNotes: 'Verified all credentials, teaching evidence, and academic degree. Approved for professional mentorship.'
      })
    });
    const approveData = await approveRes.json();
    assert(approveRes.status === 200 && approveData.status === 'success', 'Admin approved mentor successfully');

    const appAfterApproval = await prisma.mentorApplication.findUnique({ where: { id: application.id } });
    const profileAfterApproval = await prisma.mentorProfile.findUnique({ where: { id: mentorProfile.id } });
    assert(appAfterApproval.status === 'APPROVED', 'Application status changed to APPROVED');
    assert(profileAfterApproval.status === 'APPROVED', 'MentorProfile status changed to APPROVED');

    // TEST 8: Verify AI Professional Portfolio was generated and stored
    console.log('\n--- TEST 8: AI Professional Portfolio Generation ---');
    const portfolio = await prisma.mentorPortfolio.findUnique({
      where: { mentorId: profileAfterApproval.id }
    });
    assert(portfolio !== null, 'MentorPortfolio record was automatically created upon Admin approval');
    assert(portfolio && portfolio.isGenerated === true, 'Portfolio is marked as isGenerated: true');
    assert(portfolio && portfolio.headline && portfolio.headline.length > 5, `Generated headline: "${portfolio?.headline}"`);
    assert(portfolio && portfolio.teachingApproach && portfolio.teachingApproach.length > 10, 'Generated teaching approach exists');
    console.log(`Portfolio headline: "${portfolio?.headline}"`);
    console.log(`Portfolio introduction: "${portfolio?.introduction?.slice(0, 100)}..."`);

    // TEST 9: Student views mentor profile in Find Mentor
    console.log('\n--- TEST 9: Student Views Mentor Portfolio in Find Mentor ---');
    const studentViewRes = await fetch(`${BASE_URL}/mentors/${profileAfterApproval.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const studentViewData = await studentViewRes.json();
    assert(studentViewRes.status === 200 && studentViewData.status === 'success', 'Student retrieved mentor public profile');
    const publicMentor = studentViewData.profile;
    assert(publicMentor.portfolio !== null, 'Student receives rich professional portfolio');
    assert(publicMentor.portfolio.headline === portfolio.headline, 'Student sees the AI-crafted professional headline');
    assert(publicMentor.status === 'APPROVED', 'Mentor has APPROVED status (verified mentor)');
    assert(publicMentor.teachingExperience === 2, 'Student sees verified 2 years teaching experience');

    // TEST 10: Security check - Verify private documents & internal AI/Admin data are NOT exposed to students
    console.log('\n--- TEST 10: Security Check - Student Data Privacy ---');
    assert(publicMentor.aiScreening === undefined, 'Internal AI screening data NOT exposed to student');
    assert(publicMentor.adminNotes === undefined, 'Admin review notes NOT exposed to student');
    assert(publicMentor.teachingEvidence === undefined, 'Private teaching evidence text NOT exposed to student');
    if (publicMentor.credentials) {
      const hasPrivateFileRef = publicMentor.credentials.some(c => c.fileReference || c.fileUrl || c.fileAsset);
      assert(!hasPrivateFileRef, 'Private Cloudinary file URLs/assets NOT exposed to student');
      const hasInternalAiReasoning = publicMentor.credentials.some(c => c.aiReasoning);
      assert(!hasInternalAiReasoning, 'Internal AI document reasoning NOT exposed to student');
    } else {
      assert(true, 'No raw credentials array exposed to student');
    }

    // TEST 11: Mentor editing verified experience triggers re-verification
    console.log('\n--- TEST 11: Mentor Editing Verified Experience Triggers Re-verification ---');
    const updateRes = await fetch(`${BASE_URL}/mentors/me/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mentorToken}` },
      body: JSON.stringify({
        teachingExperience: 5 // Changed from verified 2 to 5 years
      })
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200 && updateData.status === 'success', 'Profile update request processed');
    assert(updateData.profile.status === 'PENDING', `Profile status flipped to PENDING for re-verification (actual: ${updateData.profile?.status})`);
    assert(updateData.reverificationRequired === true, 'Response explicitly flags reverificationRequired');

    // TEST 12: Verify Peer Mentor and Mentor Discovery still work
    console.log('\n--- TEST 12: Peer Mentor & Mentor Discovery intact ---');
    const discoveryRes = await fetch(`${BASE_URL}/mentors?limit=10`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const discoveryData = await discoveryRes.json();
    assert(discoveryRes.status === 200 && discoveryData.status === 'success', 'Mentor discovery API works normally');
    const foundMentors = discoveryData.mentors || discoveryData.data;
    assert(Array.isArray(foundMentors), 'Discovery returned mentor list');
    console.log(`Discovered ${foundMentors?.length || 0} mentors`);

  } catch (err) {
    console.error('Unhandled error during tests:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerificationTests();
