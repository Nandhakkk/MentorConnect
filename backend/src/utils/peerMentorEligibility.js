const { calculateAge, MINOR_AGE_THRESHOLD } = require('./ageHelper');

/**
 * Check if a student is eligible to become a peer mentor based on actual platform activity and track record.
 *
 * Measurable Experience-Based Criteria:
 * 1. Account Maturity: Account registered at least 30 days ago.
 * 2. Mentoring Experience: Completed at least 5 legitimate paid or free sessions as a mentee (excluding cancelled, missed, or refunded).
 * 3. Learning Goals: At least 2 learning goals with at least 1 marked as COMPLETED.
 * 4. Assignments: At least 3 distinct assignments completed and submitted through the platform.
 * 5. Feedback and Conduct: Age 18+, active, unsuspended, and 0 unresolved complaints.
 * 6. Profile Completeness: Completed onboarding, biography (min 20 chars), technical skills, and learning interests.
 *
 * @param {Object} user - The user object including studentProfile (with goals, mentorships, assignments) and complaintsReceived
 * @returns {Object} { eligible, reasons, requirements, criteria, stats, alreadyApproved }
 */
const checkPeerMentorEligibility = (user) => {
  const requirements = [
    'Account maturity: Must be registered on MentorConnect for at least 30 days',
    'Mentoring experience: Must have completed at least 5 mentoring sessions as a learner',
    'Learning goals: Must have at least 2 learning goals with at least 1 completed goal',
    'Assignments completed: Must have completed and submitted at least 3 mentor assignments',
    'Feedback & conduct: Age 18+, active account, good standing, and no unresolved complaints',
    'Profile completeness: Must complete student onboarding, bio, technical skills, and interests'
  ];

  const reasons = [];
  const now = new Date();

  // If user object is null or missing
  if (!user) {
    return {
      eligible: false,
      reasons: ['User account could not be found.'],
      requirements,
      criteria: {},
      stats: {},
      alreadyApproved: false
    };
  }

  // 0. Check if already an approved peer mentor
  const alreadyApproved = Boolean(
    user.mentorProfile &&
    user.mentorProfile.mentorType === 'PEER' &&
    user.mentorProfile.status === 'APPROVED'
  );

  // 1. Account Maturity (at least 30 days)
  const createdAt = user.createdAt ? new Date(user.createdAt) : now;
  const accountAgeMs = now.getTime() - createdAt.getTime();
  const accountAgeDays = Math.max(0, Math.floor(accountAgeMs / (1000 * 60 * 60 * 24)));
  const REQUIRED_ACCOUNT_DAYS = 30;
  const accountMaturityMet = accountAgeDays >= REQUIRED_ACCOUNT_DAYS;

  const accountMaturityCriterion = {
    key: 'accountMaturity',
    title: 'Account Maturity',
    description: `Platform tenure of at least ${REQUIRED_ACCOUNT_DAYS} days`,
    current: accountAgeDays,
    required: REQUIRED_ACCOUNT_DAYS,
    unit: 'days',
    progress: Math.min(100, Math.round((accountAgeDays / REQUIRED_ACCOUNT_DAYS) * 100)),
    met: accountMaturityMet,
    reason: accountMaturityMet
      ? null
      : `Account is ${accountAgeDays} day(s) old. ${REQUIRED_ACCOUNT_DAYS - accountAgeDays} more day(s) required to establish platform track record.`
  };

  if (!accountMaturityMet) {
    reasons.push(accountMaturityCriterion.reason);
  }

  // 2. Completed Mentoring Experience (5+ sessions as mentee)
  // Sessions booked under student's mentorships where status is COMPLETED and not refunded/cancelled/missed
  const studentMentorships = user.studentProfile?.mentorships || [];
  const validCompletedSessions = [];

  for (const m of studentMentorships) {
    if (!m.sessions || !Array.isArray(m.sessions)) continue;
    for (const sess of m.sessions) {
      if (sess.status !== 'COMPLETED') continue;

      // Exclude cancelled or missed
      if (sess.status === 'CANCELLED' || sess.status === 'MISSED') continue;

      // Payment check: if payment exists and has an amount > 0, must be PAID and not refunded
      if (sess.payment) {
        if (sess.payment.amount > 0) {
          if (sess.payment.status !== 'PAID') continue;
          if (sess.payment.status === 'REFUNDED' || sess.payment.status === 'PARTIALLY_REFUNDED') continue;
          if (sess.payment.refunds && sess.payment.refunds.some(r => r.status === 'PROCESSED')) continue;
        }
      }
      validCompletedSessions.push(sess);
    }
  }

  const completedSessionsCount = validCompletedSessions.length;
  const REQUIRED_SESSIONS = 5;
  const mentoringExperienceMet = completedSessionsCount >= REQUIRED_SESSIONS;

  const mentoringExperienceCriterion = {
    key: 'mentoringExperience',
    title: 'Completed Mentee Sessions',
    description: `At least ${REQUIRED_SESSIONS} completed mentoring sessions as a learner`,
    current: completedSessionsCount,
    required: REQUIRED_SESSIONS,
    unit: 'sessions',
    progress: Math.min(100, Math.round((completedSessionsCount / REQUIRED_SESSIONS) * 100)),
    met: mentoringExperienceMet,
    reason: mentoringExperienceMet
      ? null
      : `You have completed ${completedSessionsCount} of ${REQUIRED_SESSIONS} required mentee sessions. (Cancelled, missed, and refunded sessions are excluded.)`
  };

  if (!mentoringExperienceMet) {
    reasons.push(mentoringExperienceCriterion.reason);
  }

  // 3. Learning Goals (at least 2 total non-cancelled, at least 1 completed)
  const studentGoals = user.studentProfile?.goals || [];
  const nonCancelledGoals = studentGoals.filter(g => g.status !== 'CANCELLED');
  const completedGoals = studentGoals.filter(g => g.status === 'COMPLETED');
  const totalGoalsCount = nonCancelledGoals.length;
  const completedGoalsCount = completedGoals.length;

  const REQUIRED_TOTAL_GOALS = 2;
  const REQUIRED_COMPLETED_GOALS = 1;
  const learningGoalsMet = totalGoalsCount >= REQUIRED_TOTAL_GOALS && completedGoalsCount >= REQUIRED_COMPLETED_GOALS;

  let goalShortfallReason = null;
  if (!learningGoalsMet) {
    if (totalGoalsCount < REQUIRED_TOTAL_GOALS && completedGoalsCount < REQUIRED_COMPLETED_GOALS) {
      goalShortfallReason = `You have ${totalGoalsCount} goal(s) (${completedGoalsCount} completed). You need at least 2 learning goals with at least 1 completed.`;
    } else if (totalGoalsCount < REQUIRED_TOTAL_GOALS) {
      goalShortfallReason = `You need at least 2 active learning goals (currently ${totalGoalsCount}).`;
    } else {
      goalShortfallReason = `You need at least 1 completed learning goal (currently ${completedGoalsCount} completed). Mark a goal as completed once you achieve your milestones.`;
    }
    reasons.push(goalShortfallReason);
  }

  const learningGoalsCriterion = {
    key: 'learningGoals',
    title: 'Learning Goals Track Record',
    description: `At least ${REQUIRED_TOTAL_GOALS} goals with at least ${REQUIRED_COMPLETED_GOALS} completed`,
    current: {
      total: totalGoalsCount,
      completed: completedGoalsCount
    },
    required: {
      total: REQUIRED_TOTAL_GOALS,
      completed: REQUIRED_COMPLETED_GOALS
    },
    unit: 'goals',
    progress: Math.min(100, Math.round(((Math.min(totalGoalsCount, REQUIRED_TOTAL_GOALS) + Math.min(completedGoalsCount, REQUIRED_COMPLETED_GOALS)) / (REQUIRED_TOTAL_GOALS + REQUIRED_COMPLETED_GOALS)) * 100)),
    met: learningGoalsMet,
    reason: goalShortfallReason
  };

  // 4. Assignments (at least 3 completed & submitted)
  // Check distinct assignments assigned to student that have SUBMITTED or REVIEWED status, or have valid submissions
  const studentAssignments = user.studentProfile?.assignments || [];
  const validSubmittedAssignments = studentAssignments.filter(a => {
    if (a.status === 'SUBMITTED' || a.status === 'REVIEWED') return true;
    if (a.submissions && Array.isArray(a.submissions)) {
      return a.submissions.some(s => ['SUBMITTED', 'REVIEWED', 'LATE'].includes(s.status));
    }
    return false;
  });

  const submittedAssignmentsCount = validSubmittedAssignments.length;
  const REQUIRED_ASSIGNMENTS = 3;
  const assignmentsMet = submittedAssignmentsCount >= REQUIRED_ASSIGNMENTS;

  const assignmentsCriterion = {
    key: 'assignmentsCompleted',
    title: 'Assignments Completed & Submitted',
    description: `At least ${REQUIRED_ASSIGNMENTS} mentor assignments completed and submitted`,
    current: submittedAssignmentsCount,
    required: REQUIRED_ASSIGNMENTS,
    unit: 'assignments',
    progress: Math.min(100, Math.round((submittedAssignmentsCount / REQUIRED_ASSIGNMENTS) * 100)),
    met: assignmentsMet,
    reason: assignmentsMet
      ? null
      : `You have completed and submitted ${submittedAssignmentsCount} of ${REQUIRED_ASSIGNMENTS} required assignments.`
  };

  if (!assignmentsMet) {
    reasons.push(assignmentsCriterion.reason);
  }

  // 5. Feedback and Conduct
  // Must be adult (18+), active, unsuspended, and 0 unresolved complaints
  let age = 0;
  let isAdult = false;
  if (user.dateOfBirth) {
    age = calculateAge(user.dateOfBirth);
    isAdult = age >= MINOR_AGE_THRESHOLD;
  }

  const complaintsReceived = user.complaintsReceived || [];
  const openComplaints = complaintsReceived.filter(c => ['OPEN', 'UNDER_REVIEW'].includes(c.status));
  const hasNoOpenComplaints = openComplaints.length === 0;
  const isAccountActive = Boolean(user.isActive);
  const isNotSuspended = !user.isSuspended;

  const conductMet = isAdult && hasNoOpenComplaints && isAccountActive && isNotSuspended;

  let conductReason = null;
  if (!conductMet) {
    const conductIssues = [];
    if (!user.dateOfBirth) conductIssues.push('Date of birth not provided');
    else if (!isAdult) conductIssues.push(`Must be at least 18 years old (current age: ${age})`);
    if (!isAccountActive) conductIssues.push('Account is deactivated');
    if (!isNotSuspended) conductIssues.push('Account is currently suspended');
    if (!hasNoOpenComplaints) conductIssues.push(`${openComplaints.length} unresolved complaint(s) under investigation`);

    conductReason = `Conduct & Account Status requirement unmet: ${conductIssues.join(', ')}.`;
    reasons.push(conductReason);
  }

  const conductCriterion = {
    key: 'feedbackAndConduct',
    title: 'Good Standing & Conduct',
    description: 'Age 18+, active account, unsuspended, and no unresolved complaints',
    current: {
      age,
      isAdult,
      isActive: isAccountActive,
      isSuspended: user.isSuspended,
      openComplaintsCount: openComplaints.length
    },
    required: 'Adult (18+), active, good standing, 0 complaints',
    met: conductMet,
    reason: conductReason
  };

  // 6. Profile Completeness
  const profile = user.studentProfile;
  const hasProfile = Boolean(profile);
  const hasBio = Boolean(profile?.bio && profile.bio.trim().length >= 20);
  const hasSkills = Boolean(profile?.skills && profile.skills.trim().length > 0);
  const hasInterests = Boolean(profile?.interests && profile.interests.trim().length > 0);
  const onboardingCompleted = Boolean(profile?.onboardingCompleted);

  const profileCompletenessMet = hasProfile && hasBio && hasSkills && hasInterests && onboardingCompleted;

  let profileReason = null;
  if (!profileCompletenessMet) {
    const missingFields = [];
    if (!hasProfile) missingFields.push('Student Profile');
    else {
      if (!onboardingCompleted) missingFields.push('Complete learner onboarding');
      if (!hasBio) missingFields.push('Biography (min 20 characters)');
      if (!hasSkills) missingFields.push('Technical skills');
      if (!hasInterests) missingFields.push('Learning interests');
    }
    profileReason = `Incomplete student profile. Please complete: ${missingFields.join(', ')} on your profile page.`;
    reasons.push(profileReason);
  }

  const profileCriterion = {
    key: 'profileCompleteness',
    title: 'Student Profile Completeness',
    description: 'Completed onboarding, biography (20+ chars), skills, and interests',
    current: {
      hasBio,
      hasSkills,
      hasInterests,
      onboardingCompleted
    },
    required: 'Complete bio, skills, interests, and onboarding',
    met: profileCompletenessMet,
    reason: profileReason
  };

  // Overall check
  if (alreadyApproved) {
    reasons.push('You are already an approved peer mentor.');
  }

  const allCriteria = {
    accountMaturity: accountMaturityCriterion,
    mentoringExperience: mentoringExperienceCriterion,
    learningGoals: learningGoalsCriterion,
    assignmentsCompleted: assignmentsCriterion,
    feedbackAndConduct: conductCriterion,
    profileCompleteness: profileCriterion
  };

  const metCount = Object.values(allCriteria).filter(c => c.met).length;
  const totalCriteriaCount = Object.keys(allCriteria).length;
  const overallProgress = Math.round((metCount / totalCriteriaCount) * 100);

  const eligible = metCount === totalCriteriaCount && !alreadyApproved;

  return {
    eligible,
    metCount,
    totalCriteriaCount,
    overallProgress,
    reasons,
    requirements,
    criteria: allCriteria,
    stats: {
      accountAgeDays,
      completedSessionsCount,
      totalGoalsCount,
      completedGoalsCount,
      submittedAssignmentsCount,
      openComplaintsCount: openComplaints.length,
      age
    },
    alreadyApproved
  };
};

module.exports = {
  checkPeerMentorEligibility
};
