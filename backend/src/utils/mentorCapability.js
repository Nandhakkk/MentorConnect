/**
 * Mentor Capability Helpers — Phase 7D
 *
 * These helpers derive mentor/learner capabilities from the user's profile data
 * attached by authenticateToken middleware (req.user).
 *
 * Role Architecture:
 *   Professional: User.role === 'MENTOR', MentorProfile.status === 'APPROVED', mentorType === 'PROFESSIONAL'
 *   Peer:         User.role === 'STUDENT', MentorProfile.status === 'APPROVED', mentorType === 'PEER'
 *   Learner:      StudentProfile exists (regardless of peer mentor status)
 *
 * A peer mentor satisfies BOTH isLearner and isPeerMentor.
 * A professional mentor does NOT automatically become a learner.
 */

/**
 * True when the user has an approved MentorProfile (PROFESSIONAL or PEER),
 * is active, and is not suspended.
 */
function isApprovedMentor(user) {
  if (!user) return false;
  const mp = user.mentorProfile;
  if (!mp || mp.status !== 'APPROVED') return false;
  if (mp.mentorType !== 'PROFESSIONAL' && mp.mentorType !== 'PEER') return false;
  if (user.isActive === false) return false;
  if (user.isSuspended === true) return false;
  return true;
}

/**
 * True when the user is a professional mentor:
 *   User.role === 'MENTOR' AND approved MentorProfile AND mentorType === 'PROFESSIONAL'
 */
function isProfessionalMentor(user) {
  if (!user) return false;
  if (user.role !== 'MENTOR') return false;
  const mp = user.mentorProfile;
  if (!mp || mp.status !== 'APPROVED') return false;
  if (mp.mentorType !== 'PROFESSIONAL') return false;
  return true;
}

/**
 * True when the user is a peer mentor:
 *   User.role === 'STUDENT' AND approved MentorProfile AND mentorType === 'PEER'
 */
function isPeerMentor(user) {
  if (!user) return false;
  if (user.role !== 'STUDENT') return false;
  const mp = user.mentorProfile;
  if (!mp || mp.status !== 'APPROVED') return false;
  if (mp.mentorType !== 'PEER') return false;
  return true;
}

/**
 * True when the user has a StudentProfile (regardless of peer mentor status).
 */
function isLearner(user) {
  if (!user) return false;
  return !!user.studentProfile;
}

/**
 * True when the user is acting as a mentor participant in a given mentorship
 * (their mentorProfile.id matches the mentorship's mentorId).
 */
function isMentorParticipant(user, mentorId) {
  if (!user) return false;
  const mp = user.mentorProfile;
  if (!mp) return false;
  return mp.id === mentorId;
}

/**
 * True when the user is acting as a student participant in a given mentorship
 * (their studentProfile.id matches the mentorship's studentId).
 */
function isStudentParticipant(user, studentId) {
  if (!user) return false;
  const sp = user.studentProfile;
  if (!sp) return false;
  return sp.id === studentId;
}

/**
 * Generic readiness check for any approved MentorProfile.
 * Both professional and peer mentors must satisfy:
 *   - approved status
 *   - bio, expertise, at least one topic, at least one active availability
 *   - sessionFee defined (may be 0 for free peer mentoring)
 */
function checkMentorReadiness(profile) {
  if (!profile || profile.status !== 'APPROVED') return false;
  if (profile.mentorType !== 'PROFESSIONAL' && profile.mentorType !== 'PEER') return false;
  if (!profile.bio || !profile.expertise) return false;
  if (profile.sessionFee == null) return false;
  if (!profile.topics || profile.topics.length === 0) return false;
  if (!profile.availabilities || profile.availabilities.filter(a => a.isActive).length === 0) return false;
  return true;
}

module.exports = {
  isApprovedMentor,
  isProfessionalMentor,
  isPeerMentor,
  isLearner,
  isMentorParticipant,
  isStudentParticipant,
  checkMentorReadiness
};
