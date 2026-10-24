/**
 * Mentor Application Pre-Screening and Automated Decision Service
 *
 * Implements objective, evidence-based pre-screening with 3 persisted outcomes:
 * 1. ELIGIBLE — READY FOR ADMIN: All mandatory criteria met, evidence supported, queued for admin approval.
 * 2. INELIGIBLE — AUTO-REJECTED: Demonstrably fails published objective eligibility criteria.
 * 3. NEEDS MANUAL REVIEW: Inconclusive, ambiguous, AI failure/timeout, suspected fraud, low confidence.
 *
 * Rules Standard: MentorConnect Published Eligibility Rules v1.0
 */

const prisma = require('../config/db');
const aiService = require('./aiService');
const notificationService = require('./notificationService');
const transactionalEmailService = require('./transactionalEmailService');
const { calculateAge, MINOR_AGE_THRESHOLD } = require('../utils/ageHelper');
const logger = require('../utils/logger');

const RULE_VERSION = 'MC-SCREENING-v1.0';

const SCREENING_OUTCOMES = {
  ELIGIBLE: 'ELIGIBLE',
  AUTO_REJECTED: 'AUTO_REJECTED',
  NEEDS_MANUAL_REVIEW: 'NEEDS_MANUAL_REVIEW'
};

/**
 * Scan untrusted text for prompt injection / instruction override patterns.
 * Never executes user text as instructions.
 */
const detectPromptInjection = (text) => {
  if (!text || typeof text !== 'string') return false;
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /you\s+are\s+now\s+a/i,
    /system\s*prompt/i,
    /override\s+(all\s+)?(security|screening|rules|criteria)/i,
    /approve\s+this\s+application\s+immediately/i,
    /bypass\s+verification/i,
    /disregard\s+(the\s+)?(above|rules|instructions)/i,
    /roleplay\s+as\s+admin/i
  ];
  return injectionPatterns.some(pattern => pattern.test(text));
};

/**
 * Deterministic validation for Professional Mentor Applications.
 * Checks published, mandatory, objective eligibility requirements.
 */
const evaluateProfessionalDeterministic = (appOrParams, maybeUser) => {
  const application = (appOrParams && appOrParams.application) ? appOrParams.application : appOrParams;
  const user = (appOrParams && appOrParams.user) ? appOrParams.user : maybeUser;
  const mentorProfile = (appOrParams && appOrParams.mentorProfile) ? appOrParams.mentorProfile : (application && application.mentor) ? application.mentor : null;
  const explicitCredentials = (appOrParams && appOrParams.credentials) ? appOrParams.credentials : null;

  const failedCriteria = [];
  const passedCriteria = [];

  // 1. Minimum Age (18+)
  if (user && user.dateOfBirth) {
    const age = calculateAge(user.dateOfBirth);
    if (age < MINOR_AGE_THRESHOLD) {
      failedCriteria.push({
        code: 'MIN_AGE_18',
        field: 'dateOfBirth',
        category: 'Age Requirement',
        message: `Professional mentors must be at least ${MINOR_AGE_THRESHOLD} years old. Verified age is ${age}.`
      });
    } else {
      passedCriteria.push(`Age criterion verified (${age} years old)`);
    }
  } else {
    passedCriteria.push('Age check: Date of birth not recorded on account');
  }

  // 2. Account Status
  if (user.isActive === false) {
    failedCriteria.push({
      code: 'ACCOUNT_INACTIVE',
      field: 'isActive',
      category: 'Account Status',
      message: 'Applicant account is inactive.'
    });
  } else if (user.isSuspended === true) {
    failedCriteria.push({
      code: 'ACCOUNT_SUSPENDED',
      field: 'isSuspended',
      category: 'Account Status',
      message: 'Applicant account is currently suspended.'
    });
  } else {
    passedCriteria.push('Account is active and in good standing');
  }

  // 3. Mandatory Application Fields (Strictly published requirements)
  const missingFields = [];
  if (!user.name || user.name.trim().length < 2) missingFields.push('Full Name');
  const summaryText = application.professionalSummary || mentorProfile?.bio;
  if (!summaryText || summaryText.trim().length < 15) {
    missingFields.push('Professional Summary / Bio (minimum 15 characters)');
  }
  const expertiseText = application.expertise || mentorProfile?.expertise;
  if (!expertiseText || !expertiseText.trim()) missingFields.push('Primary Expertise');

  if (missingFields.length > 0) {
    failedCriteria.push({
      code: 'MANDATORY_FIELDS_MISSING',
      field: 'mandatoryFields',
      category: 'Mandatory Form Fields',
      message: `Required mandatory application fields are incomplete: ${missingFields.join(', ')}.`
    });
  } else {
    passedCriteria.push('All published mandatory profile fields provided');
  }

  // 4. Objective Plausibility & Sanity Checks
  if (application.proposedSessionFee != null && Number(application.proposedSessionFee) < 0) {
    failedCriteria.push({
      code: 'INVALID_SESSION_FEE',
      field: 'proposedSessionFee',
      category: 'Commercial Consistency',
      message: 'Session fee cannot be negative.'
    });
  }

  const ageVal = user.dateOfBirth ? calculateAge(user.dateOfBirth) : null;
  if (ageVal != null) {
    const maxPlausibleExperience = Math.max(0, ageVal - 14);
    if (Number(application.teachingExperience) > maxPlausibleExperience) {
      failedCriteria.push({
        code: 'EXPERIENCE_EXCEEDS_PLAUSIBILITY',
        field: 'teachingExperience',
        category: 'Logical Consistency',
        message: `Claimed teaching experience (${application.teachingExperience} years) exceeds plausible duration for applicant's age (${ageVal} years old).`
      });
    }
  }

  // 5. Mandatory Supporting Evidence Documents
  const credentials = explicitCredentials || application.credentials || [];
  const hasEducationDoc = credentials.some(c =>
    (c.claimType === 'EDUCATION' || c.type === 'DEGREE' || c.type === 'EDUCATION') && (c.fileReference || c.documentUrl)
  );
  const claimedTeachingYears = Number(application.teachingExperience || 0);
  const hasTeachingDoc = credentials.some(c =>
    (c.claimType === 'TEACHING_EXPERIENCE' || c.type === 'TEACHING_CERTIFICATE' || c.type === 'TEACHING_EXPERIENCE' || c.type === 'TEACHING') && (c.fileReference || c.documentUrl)
  );

  const missingEvidence = [];
  if (!hasEducationDoc) missingEvidence.push('Education Degree or Diploma');
  if (claimedTeachingYears > 0 && !hasTeachingDoc) missingEvidence.push('Proof of Teaching / Tutoring Experience');

  if (missingEvidence.length > 0) {
    failedCriteria.push({
      code: 'MANDATORY_EVIDENCE_MISSING',
      field: 'credentials',
      category: 'Required Evidence',
      message: `Missing required supporting document(s): ${missingEvidence.join(', ')}. Objective proof of qualification is required.`
    });
  } else {
    passedCriteria.push('Mandatory supporting evidence documents uploaded with file attachments');
  }

  return {
    passed: failedCriteria.length === 0,
    failedCriteria,
    passedCriteria
  };
};

/**
 * Deterministic validation for Peer Mentor Applications.
 * Validates only published peer mentor requirements (Learner role, onboarding, skills).
 */
const evaluatePeerDeterministic = (appOrParams, maybeUser) => {
  const application = (appOrParams && appOrParams.application) ? appOrParams.application : appOrParams;
  const user = (appOrParams && appOrParams.user) ? appOrParams.user : maybeUser;

  const failedCriteria = [];
  const passedCriteria = [];

  // 1. Role: Must be STUDENT
  if (!user || user.role !== 'STUDENT') {
    failedCriteria.push({
      code: 'ROLE_NOT_STUDENT',
      field: 'role',
      category: 'Eligibility Category',
      message: 'Peer mentors must have the STUDENT role on MentorConnect.'
    });
  } else {
    passedCriteria.push('Student role verified');
  }

  // 2. Minimum Age (18+)
  if (user && user.dateOfBirth) {
    const age = calculateAge(user.dateOfBirth);
    if (age < MINOR_AGE_THRESHOLD) {
      failedCriteria.push({
        code: 'MIN_AGE_18',
        field: 'dateOfBirth',
        category: 'Age Requirement',
        message: `Peer mentors must be at least ${MINOR_AGE_THRESHOLD} years old. Verified age is ${age}.`
      });
    } else {
      passedCriteria.push(`Age criterion verified (${age} years old)`);
    }
  } else {
    passedCriteria.push('Age check: Date of birth not recorded on student account');
  }

  // 3. Account Status
  if (user.isActive === false) {
    failedCriteria.push({
      code: 'ACCOUNT_INACTIVE',
      field: 'isActive',
      category: 'Account Status',
      message: 'Applicant account is inactive.'
    });
  } else if (user.isSuspended === true) {
    failedCriteria.push({
      code: 'ACCOUNT_SUSPENDED',
      field: 'isSuspended',
      category: 'Account Status',
      message: 'Applicant account is currently suspended.'
    });
  } else {
    passedCriteria.push('Account is active and in good standing');
  }

  // 4. Student Profile & Onboarding
  const studentProfile = user.studentProfile;
  if (!studentProfile) {
    failedCriteria.push({
      code: 'STUDENT_PROFILE_MISSING',
      field: 'studentProfile',
      category: 'Profile Completeness',
      message: 'A completed student profile is required before applying as a peer mentor.'
    });
  } else {
    if (!studentProfile.onboardingCompleted) {
      failedCriteria.push({
        code: 'ONBOARDING_INCOMPLETE',
        field: 'onboardingCompleted',
        category: 'Profile Completeness',
        message: 'Student onboarding must be fully completed before applying as a peer mentor.'
      });
    } else {
      passedCriteria.push('Student onboarding completed');
    }

    if (!studentProfile.skills || !studentProfile.skills.trim()) {
      failedCriteria.push({
        code: 'SKILLS_MISSING',
        field: 'skills',
        category: 'Skill Evidence',
        message: 'You must list your academic/technical skills in your student profile.'
      });
    } else {
      passedCriteria.push('Student skills declared');
    }
  }

  // 5. Application Details
  if (!application.eligibilityInfo || application.eligibilityInfo.trim().length < 15) {
    failedCriteria.push({
      code: 'APPLICATION_DETAILS_INSUFFICIENT',
      field: 'eligibilityInfo',
      category: 'Application Content',
      message: 'Application motivation and subject details are mandatory (minimum 15 characters).'
    });
  } else {
    passedCriteria.push('Application statement and motivation provided');
  }

  // 6. Existing Active Status
  if (user.mentorProfile && user.mentorProfile.mentorType === 'PEER' && user.mentorProfile.status === 'APPROVED') {
    failedCriteria.push({
      code: 'ALREADY_APPROVED',
      field: 'status',
      category: 'Account Status',
      message: 'You are already an approved peer mentor.'
    });
  }

  return {
    passed: failedCriteria.length === 0,
    failedCriteria,
    passedCriteria
  };
};

/**
 * Execute AI pre-screening with strict schema, timeout protection, and failsafe to manual review.
 */
const runAiScreeningWithFailsafe = async (prompt, timeoutMs = 35000) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('AI screening request timed out.')), timeoutMs);
  });

  try {
    const rawResponse = await Promise.race([
      aiService.generateText(prompt),
      timeoutPromise
    ]);

    // Clean markdown codeblocks
    const cleaned = String(rawResponse || '')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('No valid JSON block found in AI response.');
    }

    const parsed = JSON.parse(match[0]);
    return { success: true, data: parsed, rawResponse };
  } catch (err) {
    logger.warn(`[MentorScreeningService] AI evaluation fallback triggered: ${err.message}`);
    return { success: false, error: err.message };
  }
};

/**
 * Pre-screen a Professional Mentor Application
 */
const screenProfessionalMentorApplication = async (applicationId) => {
  const application = await prisma.mentorApplication.findUnique({
    where: { id: applicationId },
    include: {
      credentials: true,
      aiScreening: true,
      mentor: {
        include: {
          user: true
        }
      }
    }
  });

  if (!application) {
    throw new Error('Mentor application not found.');
  }

  const user = application.mentor?.user;
  if (!user) {
    throw new Error('Applicant user record not found.');
  }

  const evaluatedAt = new Date();

  // -------------------------------------------------------------------------
  // STEP 1: Deterministic Evaluation of Mandatory Objective Requirements
  // -------------------------------------------------------------------------
  const detResult = await evaluateProfessionalDeterministic(application, user);

  if (!detResult.passed) {
    // Definitive Objective Ineligibility -> AUTO-REJECTED
    const rejectionReason = `Auto-rejected on published objective criteria: ${detResult.failedCriteria.map(c => c.message).join(' ')}`;

    const [updatedApp, screening] = await prisma.$transaction(async (tx) => {
      const app = await tx.mentorApplication.update({
        where: { id: application.id },
        data: {
          status: 'REJECTED',
          rejectionReason,
          reviewerId: 'SYSTEM_AUTO_SCREEN',
          reviewedAt: evaluatedAt
        }
      });

      await tx.mentorProfile.update({
        where: { id: application.mentorId },
        data: { status: 'REJECTED' }
      });

      const srData = {
        screeningStatus: 'AUTO_REJECTED',
        recommendation: SCREENING_OUTCOMES.AUTO_REJECTED,
        structuredFindings: {
          outcome: SCREENING_OUTCOMES.AUTO_REJECTED,
          ruleVersion: RULE_VERSION,
          evaluatedAt,
          failedCriteria: detResult.failedCriteria,
          passedCriteria: detResult.passedCriteria,
          reapplyAllowed: true,
          appealPath: 'Applicants may update incomplete profile fields or upload missing required credentials to reapply.'
        },
        riskFlags: {
          concerns: detResult.failedCriteria.map(c => c.message),
          uncertaintyReasons: []
        },
        modelInfo: 'Deterministic Rule Engine v1.0'
      };

      const sr = await tx.aIScreeningResult.upsert({
        where: { applicationId: application.id },
        update: srData,
        create: { ...srData, applicationId: application.id }
      });

      return [app, sr];
    });

    // Notify applicant professionally with specific unmet requirements and reapply/appeal guidance
    await notificationService.createNotification(
      user.id,
      'GENERAL',
      'Mentor Application Eligibility Update',
      `Your application could not be approved due to unmet objective criteria: ${detResult.failedCriteria.map(c => c.message).join(' ')}. You may update your application and reapply.`,
      application.id,
      'MENTOR_APPLICATION'
    ).catch(e => logger.warn(`In-app notification error: ${e.message}`));

    await transactionalEmailService.notifyMentorApplicationAutoRejected({
      user,
      application: updatedApp,
      isPeer: false,
      failedCriteria: detResult.failedCriteria,
      appealPath: 'Update application fields and re-submit for automated review.'
    }).catch(e => logger.warn(`Auto-rejection email error: ${e.message}`));

    return {
      outcome: SCREENING_OUTCOMES.AUTO_REJECTED,
      status: 'REJECTED',
      application: updatedApp,
      screeningResult: screening,
      failedCriteria: detResult.failedCriteria
    };
  }

  // -------------------------------------------------------------------------
  // STEP 2: Untrusted Text & Prompt Injection Defense
  // -------------------------------------------------------------------------
  const combinedUserText = [
    application.professionalSummary || '',
    application.employmentHistory || '',
    application.teachingExperienceDetails || '',
    application.skills || '',
    application.certifications || '',
    application.achievements || '',
    application.otherInfo || '',
    ...(application.credentials || []).map(c => `${c.title} ${c.description || ''} ${c.claimDescription || ''}`)
  ].join(' ');

  const hasSuspiciousInjection = detectPromptInjection(combinedUserText);

  if (hasSuspiciousInjection) {
    logger.warn(`[MentorScreeningService] Prompt injection pattern detected in application ${application.id}. Routing to manual review.`);

    // Route to NEEDS_MANUAL_REVIEW — NEVER execute injected commands and never blindly approve
    const [updatedApp, screening] = await prisma.$transaction(async (tx) => {
      const app = await tx.mentorApplication.update({
        where: { id: application.id },
        data: {
          status: 'UNDER_REVIEW',
          reviewNotes: '[Automated Security Notice] Application text contains instruction-override or prompt-injection patterns. Routed to manual administrative investigation.'
        }
      });

      const srData = {
        screeningStatus: 'NEEDS_MANUAL_REVIEW',
        recommendation: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
        structuredFindings: {
          outcome: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
          ruleVersion: RULE_VERSION,
          evaluatedAt,
          passedCriteria: detResult.passedCriteria,
          failedCriteria: []
        },
        riskFlags: {
          concerns: ['Prompt injection attempt or instruction-override pattern detected in user submission.'],
          uncertaintyReasons: ['Automated screening suspended due to potential adversarial input; human administrator review required.'],
          verificationItems: ['Carefully inspect professional summary and credential descriptions for adversarial text.']
        },
        modelInfo: 'Security Failsafe + Deterministic Rules v1.0'
      };

      const sr = await tx.aIScreeningResult.upsert({
        where: { applicationId: application.id },
        update: srData,
        create: { ...srData, applicationId: application.id }
      });

      return [app, sr];
    });

    return {
      outcome: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
      status: 'UNDER_REVIEW',
      application: updatedApp,
      screeningResult: screening,
      reason: 'Adversarial instruction pattern flagged; routed to manual review.'
    };
  }

  // -------------------------------------------------------------------------
  // STEP 3: AI Document Verification & Semantic Evidence Analysis
  // -------------------------------------------------------------------------
  const prompt = aiService.buildScreeningPrompt(application, user);
  const aiResult = await runAiScreeningWithFailsafe(prompt, 35000);

  if (!aiResult.success) {
    // AI Provider failure, timeout, or malformed response -> FAILSAFE TO MANUAL REVIEW
    logger.warn(`[MentorScreeningService] AI screening unavailable for ${application.id}. Routing safely to manual review.`);

    const [updatedApp, screening] = await prisma.$transaction(async (tx) => {
      const app = await tx.mentorApplication.update({
        where: { id: application.id },
        data: { status: 'UNDER_REVIEW' }
      });

      const srData = {
        screeningStatus: 'NEEDS_MANUAL_REVIEW',
        recommendation: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
        structuredFindings: {
          outcome: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
          ruleVersion: RULE_VERSION,
          evaluatedAt,
          passedCriteria: detResult.passedCriteria,
          failedCriteria: [],
          claimsAnalysis: [],
          claimSummary: {},
          strengths: [],
          aiFallbackNotice: 'AI verification service was temporarily unavailable or timed out during evaluation. No applicant is rejected on AI failure.'
        },
        riskFlags: {
          uncertaintyReasons: ['AI automated evaluation service was temporarily unavailable or timed out.'],
          concerns: ['Automated document verification inconclusive. Application queued for manual administrator review.']
        },
        modelInfo: 'Fail-Safe Provider Fallback'
      };

      const sr = await tx.aIScreeningResult.upsert({
        where: { applicationId: application.id },
        update: srData,
        create: { ...srData, applicationId: application.id }
      });

      return [app, sr];
    });

    return {
      outcome: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
      status: 'UNDER_REVIEW',
      application: updatedApp,
      screeningResult: screening,
      reason: 'AI service unavailable or timed out; routed safely to manual review.'
    };
  }

  const jsonResult = aiResult.data;

  // Update individual credentials with structured AI findings
  const claimsAnalysis = Array.isArray(jsonResult.claimsAnalysis) ? jsonResult.claimsAnalysis : [];
  for (const cred of application.credentials) {
    const matchedClaim = claimsAnalysis.find(ca =>
      ca.credentialId === cred.id ||
      (ca.documentTitle && cred.title && ca.documentTitle.toLowerCase() === cred.title.toLowerCase())
    );
    if (matchedClaim) {
      await prisma.credential.update({
        where: { id: cred.id },
        data: {
          aiVerificationResult: matchedClaim.result || 'UNABLE_TO_VERIFY',
          aiConfidence: matchedClaim.confidence || 'MEDIUM',
          aiReasoning: matchedClaim.reasoning || null,
          aiEvidenceFound: matchedClaim.evidenceFound || null
        }
      }).catch(e => logger.warn(`Credential update warning: ${e.message}`));
    }
  }

  // -------------------------------------------------------------------------
  // STEP 4: Determine Final Screening Outcome (ELIGIBLE vs NEEDS_MANUAL_REVIEW)
  // -------------------------------------------------------------------------
  // Check required claims: Education and Teaching Experience
  const educationClaim = claimsAnalysis.find(c => c.claimType === 'EDUCATION');
  const teachingClaim = claimsAnalysis.find(c => c.claimType === 'TEACHING_EXPERIENCE');

  const uncertaintyReasons = [];
  const concerns = Array.isArray(jsonResult.concerns) ? [...jsonResult.concerns] : [];

  if (educationClaim && (educationClaim.result === 'UNABLE_TO_VERIFY' || educationClaim.result === 'PARTIALLY_SUPPORTED' || educationClaim.confidence === 'LOW')) {
    uncertaintyReasons.push(`Education credential evidence is inconclusive (${educationClaim.result || 'UNABLE_TO_VERIFY'}, confidence: ${educationClaim.confidence || 'LOW'}).`);
  }

  if (teachingClaim && (teachingClaim.result === 'UNABLE_TO_VERIFY' || teachingClaim.result === 'PARTIALLY_SUPPORTED' || teachingClaim.confidence === 'LOW')) {
    uncertaintyReasons.push(`Teaching experience credential evidence is inconclusive (${teachingClaim.result || 'UNABLE_TO_VERIFY'}, confidence: ${teachingClaim.confidence || 'LOW'}).`);
  }

  const hasInconclusiveEvidence = uncertaintyReasons.length > 0;
  const hasSevereInconsistencies = claimsAnalysis.some(c =>
    c.inconsistencies && (
      c.inconsistencies.toLowerCase().includes('fraud') ||
      c.inconsistencies.toLowerCase().includes('tamper') ||
      c.inconsistencies.toLowerCase().includes('fake') ||
      c.inconsistencies.toLowerCase().includes('forge')
    )
  );

  let finalOutcome;
  let finalStatus;

  if (hasInconclusiveEvidence || hasSevereInconsistencies || jsonResult.credentialAssessment === 'MISSING') {
    finalOutcome = SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW;
    finalStatus = 'UNDER_REVIEW';
  } else {
    finalOutcome = SCREENING_OUTCOMES.ELIGIBLE;
    finalStatus = 'AI_SCREENED';
  }

  const [updatedApp, screening] = await prisma.$transaction(async (tx) => {
    const app = await tx.mentorApplication.update({
      where: { id: application.id },
      data: { status: finalStatus }
    });

    const srData = {
      screeningStatus: finalOutcome === SCREENING_OUTCOMES.ELIGIBLE ? 'COMPLETED' : 'NEEDS_MANUAL_REVIEW',
      recommendation: finalOutcome,
      structuredFindings: {
        outcome: finalOutcome,
        ruleVersion: RULE_VERSION,
        evaluatedAt,
        passedCriteria: detResult.passedCriteria,
        failedCriteria: [],
        overallAssessment: jsonResult.overallAssessment,
        authenticityNotice: jsonResult.authenticityNotice,
        profileCompleteness: jsonResult.profileCompleteness,
        expertiseRelevance: jsonResult.expertiseRelevance,
        experienceAssessment: jsonResult.experienceAssessment,
        teachingAssessment: jsonResult.teachingAssessment,
        credentialAssessment: jsonResult.credentialAssessment,
        claimsAnalysis,
        claimSummary: jsonResult.claimSummary || {},
        strengths: jsonResult.strengths || []
      },
      riskFlags: {
        concerns,
        uncertaintyReasons,
        verificationItems: jsonResult.verificationItems || []
      },
      modelInfo: aiService.modelName
    };

    const sr = await tx.aIScreeningResult.upsert({
      where: { applicationId: application.id },
      update: srData,
      create: { ...srData, applicationId: application.id }
    });

    return [app, sr];
  });

  // If eligible, notify applicant that pre-screening passed and application is in the admin approval queue
  if (finalOutcome === SCREENING_OUTCOMES.ELIGIBLE) {
    await notificationService.createNotification(
      user.id,
      'GENERAL',
      'Mentor Application Pre-Screening Passed',
      'Your mentor application has successfully passed preliminary eligibility screening and is awaiting final administrative approval.',
      application.id,
      'MENTOR_APPLICATION'
    ).catch(e => logger.warn(`In-app notification error: ${e.message}`));

    await transactionalEmailService.notifyMentorApplicationEligible({
      user,
      application: updatedApp,
      isPeer: false
    }).catch(e => logger.warn(`Eligible email error: ${e.message}`));
  }

  return {
    outcome: finalOutcome,
    status: finalStatus,
    application: updatedApp,
    screeningResult: screening,
    uncertaintyReasons: uncertaintyReasons.length > 0 ? uncertaintyReasons : null
  };
};

/**
 * Pre-screen a Peer Mentor Application
 */
const screenPeerMentorApplication = async (peerApplicationId) => {
  const application = await prisma.peerMentorApplication.findUnique({
    where: { id: peerApplicationId },
    include: {
      aiScreening: true,
      mentor: {
        include: {
          user: {
            include: { studentProfile: true }
          }
        }
      }
    }
  });

  if (!application) {
    throw new Error('Peer mentor application not found.');
  }

  const user = application.mentor?.user;
  if (!user) {
    throw new Error('Applicant user record not found.');
  }

  const evaluatedAt = new Date();

  // -------------------------------------------------------------------------
  // STEP 1: Deterministic Evaluation of Peer Mentor Requirements
  // -------------------------------------------------------------------------
  const detResult = evaluatePeerDeterministic(application, user);

  if (!detResult.passed) {
    const rejectionReason = `Auto-rejected on published peer mentor criteria: ${detResult.failedCriteria.map(c => c.message).join(' ')}`;

    const [updatedApp, screening] = await prisma.$transaction(async (tx) => {
      const app = await tx.peerMentorApplication.update({
        where: { id: application.id },
        data: {
          status: 'REJECTED',
          rejectionReason,
          reviewerId: 'SYSTEM_AUTO_SCREEN',
          reviewedAt: evaluatedAt
        }
      });

      await tx.mentorProfile.update({
        where: { id: application.mentorId },
        data: { status: 'REJECTED' }
      });

      const srData = {
        screeningStatus: 'AUTO_REJECTED',
        recommendation: SCREENING_OUTCOMES.AUTO_REJECTED,
        structuredFindings: {
          outcome: SCREENING_OUTCOMES.AUTO_REJECTED,
          ruleVersion: RULE_VERSION,
          evaluatedAt,
          failedCriteria: detResult.failedCriteria,
          passedCriteria: detResult.passedCriteria,
          reapplyAllowed: true
        },
        riskFlags: {
          concerns: detResult.failedCriteria.map(c => c.message),
          uncertaintyReasons: []
        },
        modelInfo: 'Peer Rule Engine v1.0'
      };

      const sr = await tx.aIScreeningResult.upsert({
        where: { peerApplicationId: application.id },
        update: srData,
        create: { ...srData, peerApplicationId: application.id }
      });

      return [app, sr];
    });

    await notificationService.createNotification(
      user.id,
      'GENERAL',
      'Peer Mentor Application Eligibility Update',
      `Your peer mentor application could not be approved due to unmet criteria: ${detResult.failedCriteria.map(c => c.message).join(' ')}. You may update your profile and reapply.`,
      application.id,
      'PEER_MENTOR_APPLICATION'
    ).catch(e => logger.warn(`In-app notification error: ${e.message}`));

    await transactionalEmailService.notifyMentorApplicationAutoRejected({
      user,
      application: updatedApp,
      isPeer: true,
      failedCriteria: detResult.failedCriteria,
      appealPath: 'Complete onboarding and update profile skills to reapply.'
    }).catch(e => logger.warn(`Auto-rejection email error: ${e.message}`));

    return {
      outcome: SCREENING_OUTCOMES.AUTO_REJECTED,
      status: 'REJECTED',
      application: updatedApp,
      screeningResult: screening,
      failedCriteria: detResult.failedCriteria
    };
  }

  // -------------------------------------------------------------------------
  // STEP 2: Untrusted Text & Prompt Injection Defense
  // -------------------------------------------------------------------------
  const combinedUserText = `${application.eligibilityInfo || ''} ${user.studentProfile?.skills || ''} ${user.studentProfile?.careerGoal || ''}`;
  const hasSuspiciousInjection = detectPromptInjection(combinedUserText);

  if (hasSuspiciousInjection) {
    logger.warn(`[MentorScreeningService] Prompt injection pattern detected in peer application ${application.id}. Routing to manual review.`);

    const [updatedApp, screening] = await prisma.$transaction(async (tx) => {
      const app = await tx.peerMentorApplication.update({
        where: { id: application.id },
        data: {
          status: 'UNDER_REVIEW',
          reviewNotes: '[Automated Security Notice] Adversarial instruction pattern detected in student statement. Routed to manual review.'
        }
      });

      const srData = {
        screeningStatus: 'NEEDS_MANUAL_REVIEW',
        recommendation: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
        structuredFindings: {
          outcome: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
          ruleVersion: RULE_VERSION,
          evaluatedAt,
          passedCriteria: detResult.passedCriteria,
          failedCriteria: []
        },
        riskFlags: {
          concerns: ['Instruction override pattern detected in application text.'],
          uncertaintyReasons: ['Automated screening suspended due to adversarial input.']
        },
        modelInfo: 'Security Failsafe v1.0'
      };

      const sr = await tx.aIScreeningResult.upsert({
        where: { peerApplicationId: application.id },
        update: srData,
        create: { ...srData, peerApplicationId: application.id }
      });

      return [app, sr];
    });

    return {
      outcome: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
      status: 'UNDER_REVIEW',
      application: updatedApp,
      screeningResult: screening
    };
  }

  // -------------------------------------------------------------------------
  // STEP 3: AI Peer Mentor Semantic Screening & Assessment
  // -------------------------------------------------------------------------
  const studentData = {
    age: user.dateOfBirth ? calculateAge(user.dateOfBirth) : null,
    education: user.studentProfile?.education,
    experienceLevel: user.studentProfile?.experienceLevel,
    skills: user.studentProfile?.skills,
    interests: user.studentProfile?.interests,
    careerGoal: user.studentProfile?.careerGoal,
    learningStyle: user.studentProfile?.preferredLearningStyle,
    language: user.studentProfile?.preferredLanguage,
    studyAvailability: user.studentProfile?.studyAvailability,
    applicationInfo: application.eligibilityInfo
  };

  const peerPrompt = aiService.buildPeerScreeningPrompt(studentData);
  const aiResult = await runAiScreeningWithFailsafe(peerPrompt, 35000);

  if (!aiResult.success) {
    // Fail-safe to manual review
    const [updatedApp, screening] = await prisma.$transaction(async (tx) => {
      const app = await tx.peerMentorApplication.update({
        where: { id: application.id },
        data: { status: 'UNDER_REVIEW' }
      });

      const srData = {
        screeningStatus: 'NEEDS_MANUAL_REVIEW',
        recommendation: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
        structuredFindings: {
          outcome: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
          ruleVersion: RULE_VERSION,
          evaluatedAt,
          passedCriteria: detResult.passedCriteria,
          failedCriteria: []
        },
        riskFlags: {
          uncertaintyReasons: ['AI automated evaluation service unavailable or timed out.'],
          concerns: ['Peer screening routed to manual review queue.']
        },
        modelInfo: 'Fail-Safe Provider Fallback'
      };

      const sr = await tx.aIScreeningResult.upsert({
        where: { peerApplicationId: application.id },
        update: srData,
        create: { ...srData, peerApplicationId: application.id }
      });

      return [app, sr];
    });

    return {
      outcome: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
      status: 'UNDER_REVIEW',
      application: updatedApp,
      screeningResult: screening
    };
  }

  const parsed = aiResult.data;
  const concerns = Array.isArray(parsed.concerns) ? parsed.concerns : [];
  const riskFlags = Array.isArray(parsed.riskFlags) ? parsed.riskFlags : [];

  let finalOutcome;
  let finalStatus;

  if (concerns.length > 1 || riskFlags.length > 0) {
    finalOutcome = SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW;
    finalStatus = 'UNDER_REVIEW';
  } else {
    finalOutcome = SCREENING_OUTCOMES.ELIGIBLE;
    finalStatus = 'AI_SCREENED';
  }

  const [updatedApp, screening] = await prisma.$transaction(async (tx) => {
    const app = await tx.peerMentorApplication.update({
      where: { id: application.id },
      data: { status: finalStatus }
    });

    const srData = {
      screeningStatus: finalOutcome === SCREENING_OUTCOMES.ELIGIBLE ? 'COMPLETED' : 'NEEDS_MANUAL_REVIEW',
      recommendation: finalOutcome,
      structuredFindings: {
        outcome: finalOutcome,
        ruleVersion: RULE_VERSION,
        evaluatedAt,
        passedCriteria: detResult.passedCriteria,
        failedCriteria: [],
        strengths: parsed.strengths || [],
        concerns,
        developmentAreas: parsed.developmentAreas || []
      },
      riskFlags: {
        concerns,
        riskFlags
      },
      modelInfo: aiService.modelName
    };

    const sr = await tx.aIScreeningResult.upsert({
      where: { peerApplicationId: application.id },
      update: srData,
      create: { ...srData, peerApplicationId: application.id }
    });

    return [app, sr];
  });

  if (finalOutcome === SCREENING_OUTCOMES.ELIGIBLE) {
    await notificationService.createNotification(
      user.id,
      'GENERAL',
      'Peer Mentor Application Pre-Screening Passed',
      'Your peer mentor application has passed automated pre-screening and is awaiting final administrative approval.',
      application.id,
      'PEER_MENTOR_APPLICATION'
    ).catch(e => logger.warn(`In-app notification error: ${e.message}`));

    await transactionalEmailService.notifyMentorApplicationEligible({
      user,
      application: updatedApp,
      isPeer: true
    }).catch(e => logger.warn(`Eligible email error: ${e.message}`));
  }

  return {
    outcome: finalOutcome,
    status: finalStatus,
    application: updatedApp,
    screeningResult: screening
  };
};

/**
 * Admin Reconsideration / Override Action.
 * Reopens an auto-rejected or flagged application for manual review.
 */
const reconsiderApplication = async ({ applicationId, isPeer = false, adminUser, reason = '' }) => {
  if (!applicationId || !adminUser) {
    throw new Error('Application ID and authorized admin user are required.');
  }

  const timestamp = new Date();
  const auditNote = `[${timestamp.toISOString()}] RECONSIDERED by Admin ${adminUser.name || adminUser.id}: ${reason || 'Application reopened for detailed administrative review.'}`;

  if (isPeer) {
    const application = await prisma.peerMentorApplication.findUnique({
      where: { id: applicationId },
      include: {
        mentor: { include: { user: true } },
        aiScreening: true
      }
    });

    if (!application) throw new Error('Peer mentor application not found.');

    const [updatedApp, screening] = await prisma.$transaction(async (tx) => {
      const app = await tx.peerMentorApplication.update({
        where: { id: applicationId },
        data: {
          status: 'UNDER_REVIEW',
          rejectionReason: null,
          reviewNotes: application.reviewNotes ? `${application.reviewNotes}\n${auditNote}` : auditNote,
          reviewerId: adminUser.id,
          reviewedAt: timestamp
        }
      });

      await tx.mentorProfile.update({
        where: { id: application.mentorId },
        data: { status: 'PENDING' }
      });

      const existingFindings = application.aiScreening?.structuredFindings || {};
      const updatedFindings = {
        ...existingFindings,
        outcome: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
        reconsideration: {
          isReconsidered: true,
          adminId: adminUser.id,
          adminName: adminUser.name,
          reconsideredAt: timestamp,
          notes: reason
        }
      };

      const sr = await tx.aIScreeningResult.upsert({
        where: { peerApplicationId: applicationId },
        update: {
          screeningStatus: 'NEEDS_MANUAL_REVIEW',
          recommendation: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
          structuredFindings: updatedFindings
        },
        create: {
          peerApplicationId: applicationId,
          screeningStatus: 'NEEDS_MANUAL_REVIEW',
          recommendation: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
          structuredFindings: updatedFindings
        }
      });

      return [app, sr];
    });

    const user = application.mentor?.user;
    if (user) {
      await notificationService.createNotification(
        user.id,
        'GENERAL',
        'Peer Mentor Application Reopened',
        'An administrator has reopened your peer mentor application for manual review.',
        application.id,
        'PEER_MENTOR_APPLICATION'
      ).catch(e => logger.warn(`In-app notification error: ${e.message}`));

      await transactionalEmailService.notifyMentorApplicationReconsidered({
        user,
        application: updatedApp,
        isPeer: true,
        adminNotes: reason
      }).catch(e => logger.warn(`Reconsidered email error: ${e.message}`));
    }

    return { status: 'success', application: updatedApp, screeningResult: screening };
  } else {
    const application = await prisma.mentorApplication.findUnique({
      where: { id: applicationId },
      include: {
        mentor: { include: { user: true } },
        aiScreening: true
      }
    });

    if (!application) throw new Error('Professional mentor application not found.');

    const [updatedApp, screening] = await prisma.$transaction(async (tx) => {
      const app = await tx.mentorApplication.update({
        where: { id: applicationId },
        data: {
          status: 'UNDER_REVIEW',
          rejectionReason: null,
          reviewNotes: application.reviewNotes ? `${application.reviewNotes}\n${auditNote}` : auditNote,
          reviewerId: adminUser.id,
          reviewedAt: timestamp
        }
      });

      await tx.mentorProfile.update({
        where: { id: application.mentorId },
        data: { status: 'PENDING' }
      });

      const existingFindings = application.aiScreening?.structuredFindings || {};
      const updatedFindings = {
        ...existingFindings,
        outcome: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
        reconsideration: {
          isReconsidered: true,
          adminId: adminUser.id,
          adminName: adminUser.name,
          reconsideredAt: timestamp,
          notes: reason
        }
      };

      const sr = await tx.aIScreeningResult.upsert({
        where: { applicationId: applicationId },
        update: {
          screeningStatus: 'NEEDS_MANUAL_REVIEW',
          recommendation: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
          structuredFindings: updatedFindings
        },
        create: {
          applicationId,
          screeningStatus: 'NEEDS_MANUAL_REVIEW',
          recommendation: SCREENING_OUTCOMES.NEEDS_MANUAL_REVIEW,
          structuredFindings: updatedFindings
        }
      });

      return [app, sr];
    });

    const user = application.mentor?.user;
    if (user) {
      await notificationService.createNotification(
        user.id,
        'GENERAL',
        'Mentor Application Reopened',
        'An administrator has reopened your mentor application for manual review.',
        application.id,
        'MENTOR_APPLICATION'
      ).catch(e => logger.warn(`In-app notification error: ${e.message}`));

      await transactionalEmailService.notifyMentorApplicationReconsidered({
        user,
        application: updatedApp,
        isPeer: false,
        adminNotes: reason
      }).catch(e => logger.warn(`Reconsidered email error: ${e.message}`));
    }

    return { status: 'success', application: updatedApp, screeningResult: screening };
  }
};

module.exports = {
  RULE_VERSION,
  SCREENING_OUTCOMES,
  detectPromptInjection,
  evaluateProfessionalDeterministic,
  evaluatePeerDeterministic,
  screenProfessionalMentorApplication,
  screenPeerMentorApplication,
  reconsiderApplication
};
