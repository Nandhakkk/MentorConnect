const { calculateAge, MINOR_AGE_THRESHOLD } = require('./ageHelper');

/**
 * Check if a student is eligible to become a peer mentor.
 * 
 * @param {Object} user - The user object including studentProfile and mentorProfile
 * @returns {Object} { eligible, reasons, requirements }
 */
const checkPeerMentorEligibility = (user) => {
  const requirements = [
    'Must be 18 years or older',
    'Must have an active account that is not suspended',
    'Must have completed learner onboarding',
    'Must provide skills and interests in your student profile'
  ];

  const reasons = [];
  let eligible = true;

  // 1. Age check
  if (!user.dateOfBirth) {
    eligible = false;
    reasons.push('Date of birth is not provided in your profile.');
  } else {
    const age = calculateAge(user.dateOfBirth);
    if (age < MINOR_AGE_THRESHOLD) {
      eligible = false;
      reasons.push(`You must be at least ${MINOR_AGE_THRESHOLD} years old. Your current age is ${age}.`);
    }
  }

  // 2. Account status
  if (!user.isActive) {
    eligible = false;
    reasons.push('Your account must be active.');
  }
  if (user.isSuspended) {
    eligible = false;
    reasons.push('Your account is currently suspended.');
  }

  // 3. Onboarding & Profile Info
  if (!user.studentProfile) {
    eligible = false;
    reasons.push('You must have a student profile.');
  } else {
    if (!user.studentProfile.onboardingCompleted) {
      eligible = false;
      reasons.push('You must complete the student onboarding process.');
    }
    if (!user.studentProfile.skills || user.studentProfile.skills.trim() === '') {
      eligible = false;
      reasons.push('You must list your skills in your student profile.');
    }
  }

  // 4. Already a peer mentor
  if (user.mentorProfile && user.mentorProfile.mentorType === 'PEER' && user.mentorProfile.status === 'APPROVED') {
    eligible = false;
    reasons.push('You are already an approved peer mentor.');
  }

  return { eligible, reasons, requirements };
};

module.exports = {
  checkPeerMentorEligibility
};
