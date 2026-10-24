const assert = require('assert');
const prisma = require('./src/config/db');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== STARTING REGISTRATION GOALS BUG FIX TEST SUITE ===\n');
  const timestamp = Date.now();

  try {
    // ----------------------------------------------------
    // Test 1: Register new student with goal in registration payload
    // ----------------------------------------------------
    console.log('--- Test 1: Register student with goal in registration payload ---');
    const student1Email = `student_reg_goal_${timestamp}@test.com`;
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Reg Goal Student',
        email: student1Email,
        password: 'password123',
        role: 'STUDENT',
        dateOfBirth: '2000-05-15',
        goal: 'Become an AWS Cloud Architect'
      })
    });
    const regJson = await regRes.json();
    assert.strictEqual(regRes.status, 201, 'Student registers successfully (201)');
    assert(regJson.token, 'Token returned on registration');
    const student1Token = regJson.token;
    const student1UserId = regJson.user.id;
    const student1ProfileId = regJson.user.studentProfile.id;

    // Verify stored in DB directly
    const student1Profile = await prisma.studentProfile.findUnique({
      where: { id: student1ProfileId },
      include: { goals: true }
    });
    assert.strictEqual(student1Profile.careerGoal, 'Become an AWS Cloud Architect', 'careerGoal saved in studentProfile');
    assert.strictEqual(student1Profile.goals.length, 1, 'Exactly 1 Goal record created in DB');
    assert.strictEqual(student1Profile.goals[0].studentId, student1ProfileId, 'Goal.studentId points to StudentProfile.id, NOT User.id');
    assert.notStrictEqual(student1Profile.goals[0].studentId, student1UserId, 'Goal.studentId is NOT User.id');
    assert.strictEqual(student1Profile.goals[0].title, 'Become an AWS Cloud Architect', 'Goal title matches registration goal');
    assert.strictEqual(student1Profile.goals[0].status, 'ACTIVE', 'Goal status is ACTIVE');
    console.log('✓ Registration goal properly stored in DB and linked to StudentProfile.id');

    // ----------------------------------------------------
    // Test 2: Goals API returns the registration goal
    // ----------------------------------------------------
    console.log('\n--- Test 2: Goals page API (GET /api/goals) returns registration goal ---');
    const goalsRes1 = await fetch(`${BASE_URL}/goals`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    const goalsJson1 = await goalsRes1.json();
    assert.strictEqual(goalsRes1.status, 200, 'GET /api/goals returns 200');
    assert.strictEqual(goalsJson1.goals.length, 1, 'Goals page shows exactly 1 goal');
    assert.strictEqual(goalsJson1.goals[0].title, 'Become an AWS Cloud Architect', 'Goals page displays registration goal title');
    assert.strictEqual(goalsJson1.goals[0].status, 'ACTIVE', 'Goals page displays active status');
    console.log('✓ GET /api/goals returned registration goal');

    // ----------------------------------------------------
    // Test 3: Multiple GET /api/goals requests do NOT create duplicate goals
    // ----------------------------------------------------
    console.log('\n--- Test 3: Multiple GET /api/goals calls do NOT create duplicate goals ---');
    for (let i = 0; i < 3; i++) {
      const reloadRes = await fetch(`${BASE_URL}/goals`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${student1Token}` }
      });
      const reloadJson = await reloadRes.json();
      assert.strictEqual(reloadJson.goals.length, 1, `Reload ${i + 1}: still exactly 1 goal`);
    }
    const dbGoalsAfterReload = await prisma.goal.findMany({
      where: { studentId: student1ProfileId }
    });
    assert.strictEqual(dbGoalsAfterReload.length, 1, 'DB still has exactly 1 goal (no duplicates on page load)');
    console.log('✓ Loading Goals page does not create duplicate goals');

    // ----------------------------------------------------
    // Test 4: Complete onboarding does NOT duplicate registration goal
    // ----------------------------------------------------
    console.log('\n--- Test 4: Complete onboarding does NOT duplicate existing registration goal ---');
    const onboardingRes = await fetch(`${BASE_URL}/students/onboarding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`
      },
      body: JSON.stringify({
        education: 'B.Tech IT',
        skills: 'Python, Docker',
        interests: 'Cloud, DevOps',
        experienceLevel: 'BEGINNER',
        careerGoal: 'Become an AWS Cloud Architect', // Same goal as registration
        preferredLearningStyle: 'HANDS_ON',
        preferredLanguage: 'English',
        budget: 0,
        studyAvailability: '10 hours/week'
      })
    });
    const onboardingJson = await onboardingRes.json();
    assert.strictEqual(onboardingRes.status, 200, 'Onboarding completed');

    const dbGoalsAfterOnboarding = await prisma.goal.findMany({
      where: { studentId: student1ProfileId }
    });
    assert.strictEqual(dbGoalsAfterOnboarding.length, 1, 'No duplicate created when onboarding submits same goal');
    console.log('✓ Onboarding did not duplicate registration goal');

    // ----------------------------------------------------
    // Test 5: Register student without goal, then set goal in onboarding
    // ----------------------------------------------------
    console.log('\n--- Test 5: Register student without initial goal, then set goal in onboarding ---');
    const student2Email = `student_onboarding_goal_${timestamp}@test.com`;
    const regRes2 = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Onboarding Goal Student',
        email: student2Email,
        password: 'password123',
        role: 'STUDENT',
        dateOfBirth: '2001-09-20'
      })
    });
    const regJson2 = await regRes2.json();
    const student2Token = regJson2.token;
    const student2ProfileId = regJson2.user.studentProfile.id;

    // Initially 0 goals
    const initialGoalsRes2 = await fetch(`${BASE_URL}/goals`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${student2Token}` }
    });
    const initialGoalsJson2 = await initialGoalsRes2.json();
    assert.strictEqual(initialGoalsJson2.goals.length, 0, 'New student without goal has 0 goals');

    // Submit onboarding with careerGoal
    const onboardingRes2 = await fetch(`${BASE_URL}/students/onboarding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student2Token}`
      },
      body: JSON.stringify({
        education: 'B.Sc Physics',
        skills: 'Math, Logic',
        interests: 'Data Science',
        experienceLevel: 'BEGINNER',
        careerGoal: 'Become a Machine Learning Engineer',
        preferredLearningStyle: 'VISUAL',
        preferredLanguage: 'English',
        budget: 20,
        studyAvailability: '8 hours/week'
      })
    });
    assert.strictEqual(onboardingRes2.status, 200, 'Onboarding completed');

    // Check goals page
    const goalsRes2 = await fetch(`${BASE_URL}/goals`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${student2Token}` }
    });
    const goalsJson2 = await goalsRes2.json();
    assert.strictEqual(goalsJson2.goals.length, 1, 'Goals page now has 1 goal from onboarding');
    assert.strictEqual(goalsJson2.goals[0].title, 'Become a Machine Learning Engineer', 'Goal title matches onboarding goal');
    console.log('✓ Goal created during onboarding appears on Goals page');

    // ----------------------------------------------------
    // Test 6: Create Goal feature adds additional goal alongside registration goal
    // ----------------------------------------------------
    console.log('\n--- Test 6: "Create Goal" feature adds additional goal alongside registration goal ---');
    const createGoalRes = await fetch(`${BASE_URL}/goals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`
      },
      body: JSON.stringify({
        title: 'Master Kubernetes and Terraform',
        description: 'Deploy real-world microservices infrastructure',
        targetDate: '2026-12-31'
      })
    });
    const createGoalJson = await createGoalRes.json();
    assert.strictEqual(createGoalRes.status, 201, 'Create Goal returns 201');
    assert.strictEqual(createGoalJson.goal.title, 'Master Kubernetes and Terraform');

    // Both goals must appear on Goals page
    const bothGoalsRes = await fetch(`${BASE_URL}/goals`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    const bothGoalsJson = await bothGoalsRes.json();
    assert.strictEqual(bothGoalsJson.goals.length, 2, 'Goals page displays both goals');
    const titles = bothGoalsJson.goals.map(g => g.title);
    assert(titles.includes('Become an AWS Cloud Architect'), 'Registration goal present');
    assert(titles.includes('Master Kubernetes and Terraform'), 'Created goal present');
    console.log('✓ Goals created via "Create Goal" appear alongside registration-created goal');

    // ----------------------------------------------------
    // Test 7: Goal updating and milestone tracking preserved
    // ----------------------------------------------------
    console.log('\n--- Test 7: Goal updating and milestone tracking preserved ---');
    const goalId = createGoalJson.goal.id;
    const updateGoalRes = await fetch(`${BASE_URL}/goals/${goalId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`
      },
      body: JSON.stringify({
        title: 'Master Kubernetes, Helm and Terraform',
        status: 'ACTIVE'
      })
    });
    const updateGoalJson = await updateGoalRes.json();
    assert.strictEqual(updateGoalRes.status, 200, 'Goal updated');
    assert.strictEqual(updateGoalJson.goal.title, 'Master Kubernetes, Helm and Terraform');

    // Add milestone
    const milestoneRes = await fetch(`${BASE_URL}/goals/${goalId}/milestones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`
      },
      body: JSON.stringify({
        title: 'Pass CKA Certification Exam'
      })
    });
    assert.strictEqual(milestoneRes.status, 201, 'Milestone created');

    // Verify Goal Details endpoint
    const goalDetailRes = await fetch(`${BASE_URL}/goals/${goalId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    const goalDetailJson = await goalDetailRes.json();
    assert.strictEqual(goalDetailJson.goal.milestones.length, 1, 'Milestone retrieved with goal');
    console.log('✓ Goal updating and milestone tracking verified');

    // ----------------------------------------------------
    // Test 8: Goal deletion preserved without recreating on page load
    // ----------------------------------------------------
    console.log('\n--- Test 8: Goal deletion works without unwanted recreation on reload ---');
    const deleteRes = await fetch(`${BASE_URL}/goals/${goalId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert.strictEqual(deleteRes.status, 200, 'Goal deleted successfully');

    const goalsAfterDelete = await fetch(`${BASE_URL}/goals`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${student1Token}` }
    });
    const goalsAfterDeleteJson = await goalsAfterDelete.json();
    assert.strictEqual(goalsAfterDeleteJson.goals.length, 1, 'Only 1 goal remaining');
    assert.strictEqual(goalsAfterDeleteJson.goals[0].title, 'Become an AWS Cloud Architect');
    console.log('✓ Goal deletion works and deleted goal is not recreated');

    // ----------------------------------------------------
    // Test 9: Existing students with previously missing registration goals
    // ----------------------------------------------------
    console.log('\n--- Test 9: Verify existing students have their registration goals backfilled ---');
    // Check Shine (existing student from earlier)
    const shineProfile = await prisma.studentProfile.findFirst({
      where: { user: { email: 'shine@example.com' } },
      include: { goals: true }
    });
    if (shineProfile) {
      const shineTitles = shineProfile.goals.map(g => g.title.toLowerCase());
      assert(shineTitles.includes('developer'), 'Shine registration goal is present in goals');
      assert(shineTitles.includes('software developer'), 'Shine created goal is also present');
      console.log('✓ Existing student (Shine) has both registration goal and manually created goal');
    }

    // Check Arun (existing student from earlier)
    const arunProfile = await prisma.studentProfile.findFirst({
      where: { user: { email: 'arun@gmail.com' } },
      include: { goals: true }
    });
    if (arunProfile) {
      const arunTitles = arunProfile.goals.map(g => g.title.toLowerCase());
      assert(arunTitles.includes('need to learn web development within 3 months'), 'Arun registration goal is present');
      assert(arunTitles.includes('html master'), 'Arun created goal is also present');
      console.log('✓ Existing student (Arun) has both registration goal and manually created goal');
    }

    console.log('\n=== ALL REGISTRATION GOAL TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
