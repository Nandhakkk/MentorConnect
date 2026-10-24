/**
 * AI Service — Google Gemini integration for MentorConnect.
 * API key is read from environment variable and never exposed to the frontend.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    this.apiKey = process.env.AI_SERVICE_API_KEY || null;
    // Gemini 3.6 Flash is supported by the configured v1beta generateContent API.
    this.modelName = process.env.AI_SERVICE_MODEL || 'gemini-3.6-flash';
    this.fallbackModelName = process.env.AI_SERVICE_FALLBACK_MODEL || 'gemini-flash-lite-latest';
    this.client = null;
  }

  /**
   * Lazily initialize the Gemini client.
   */
  _getClient() {
    if (!this.apiKey) {
      throw new Error('AI_SERVICE_API_KEY is not configured.');
    }
    if (!this.client) {
      this.client = new GoogleGenerativeAI(this.apiKey);
    }
    return this.client;
  }

  /**
   * Send a prompt to Gemini and return the generated text.
   * @param {string} prompt - Full prompt string
   * @returns {Promise<string>} - Generated text response
   */
  _isTemporaryCapacityError(error) {
    const message = String(error?.message || error);
    return /\b503\b/.test(message);
  }

  _wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async _generateWithModel(genAI, modelName, prompt) {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  async generateText(prompt) {
    const genAI = this._getClient();

    try {
      return await this._generateWithModel(genAI, this.modelName, prompt);
    } catch (primaryError) {
      if (!this._isTemporaryCapacityError(primaryError)) {
        throw primaryError;
      }
    }

    await this._wait(250);

    try {
      return await this._generateWithModel(genAI, this.modelName, prompt);
    } catch (retryError) {
      if (!this._isTemporaryCapacityError(retryError)) {
        throw retryError;
      }
    }

    return this._generateWithModel(genAI, this.fallbackModelName, prompt);
  }

  /**
   * Build the AI prompt from student context and their question.
   * @param {object} context - { goals: [...] }
   * @param {string} question - The student's question
   * @returns {string} - Assembled prompt
   */
  buildPrompt(context, question) {
    let contextBlock = '';

    if (context.goals && context.goals.length > 0) {
      context.goals.forEach((goal, i) => {
        contextBlock += `\nGoal ${i + 1}: ${goal.title}`;
        if (goal.description) contextBlock += `\n  Description: ${goal.description}`;
        contextBlock += `\n  Status: ${goal.status}`;
        if (goal.targetDate) {
          contextBlock += `\n  Target Date: ${new Date(goal.targetDate).toLocaleDateString()}`;
        }
        if (goal.milestones && goal.milestones.length > 0) {
          contextBlock += '\n  Milestones:';
          goal.milestones.forEach((m) => {
            contextBlock += `\n    - [${m.status}] ${m.title}`;
            if (m.dueDate) contextBlock += ` (due ${new Date(m.dueDate).toLocaleDateString()})`;
          });
        } else {
          contextBlock += '\n  Milestones: None defined yet.';
        }
        contextBlock += '\n';
      });
    } else {
      contextBlock = '\nThe student has no active goals or milestones yet. This is context, not a prerequisite for helping them.\n';
    }

    return `You are MentorConnect's AI Learning Assistant.

You are an empathetic, beginner-friendly career and learning mentor. Understand the student's underlying intent even when their English is short, informal, misspelled, or incomplete. Never criticize their grammar.

Use the provided goals and milestones as factual personalization when they exist, but do not treat them as a requirement for giving useful advice. Do not invent information about the student's progress, skills, mentor, sessions, or circumstances. If a detail is unknown, state any reasonable interpretation gently and ask a small number of useful follow-up questions.

For broad beginner questions or when there are no active goals:
- Reassure the student that starting from zero is normal; do not tell them to create a goal before helping.
- Infer the likely intent and briefly say what you understood.
- Give an immediate, practical starting step while asking at most two simple questions about interests, background, or available study time.
- Explain only a few relevant paths in simple language (for example web, mobile, data/AI, or cloud) when the student has not chosen a direction.
- Start with common foundations: computer and programming basics, variables, conditions, loops, functions, basic data structures, Git/GitHub, and problem solving. Introduce specialization, projects, portfolio, interviews, and job readiness progressively rather than listing an entire curriculum at once.
- Avoid overwhelming the student with too many technologies. Include why the next step matters, a small practice activity, and when to move forward.

For students who mention partial experience, such as knowing a little Python, build from that stage rather than restarting them at zero. For requests about what to do today, use goal and milestone context when available and give a concrete task with an approximate study time.

When appropriate:
- Identify what they should focus on next.
- Break large goals into manageable steps.
- Suggest realistic learning activities.
- Explain how their milestones relate to their overall goal.
- Point out incomplete milestones that need attention.
- Encourage the student to discuss important choices with their human mentor.

Keep your response clear, supportive, and actionable. Adapt the structure to the question. For beginner career questions, useful sections can include: what you understood, where to start, a few possible paths, a simple roadmap, and what you need from the student next. Use bullet points or numbered steps where helpful.

--- Student's Goals and Milestones ---
${contextBlock}
--------------------------------------

Student's Question:
${question}

Your Answer:`;
  }

  /**
   * Build the AI prompt for screening and document verification of a professional mentor application.
   * @param {object} application - The application object with credentials and profile details.
   * @param {object} user - The user account data (name, email, dob, etc.)
   * @returns {string} - Assembled verification prompt
   */
  buildScreeningPrompt(application, user = {}) {
    const claims = [];

    if (application.teachingExperience) {
      claims.push({
        type: 'TEACHING_EXPERIENCE',
        label: 'Teaching Experience',
        value: `${application.teachingExperience} years`,
        details: application.teachingExperienceDetails || null
      });
    }

    if (application.experience) {
      claims.push({
        type: 'EXPERIENCE',
        label: 'Industry Experience',
        value: `${application.experience} years`,
        details: application.employmentHistory || null
      });
    }

    if (application.education) {
      claims.push({
        type: 'EDUCATION',
        label: 'Education & Qualifications',
        value: application.education
      });
    }

    if (application.certifications) {
      claims.push({
        type: 'CERTIFICATION',
        label: 'Certifications',
        value: application.certifications
      });
    }

    if (application.skills) {
      claims.push({
        type: 'SKILLS',
        label: 'Professional Skills',
        value: application.skills
      });
    }

    if (application.achievements) {
      claims.push({
        type: 'ACHIEVEMENT',
        label: 'Achievements & Awards',
        value: application.achievements
      });
    }

    if (application.expertise) {
      claims.push({
        type: 'EXPERTISE',
        label: 'Primary Expertise',
        value: application.expertise
      });
    }

    const credentialsData = (application.credentials || []).map(c => ({
      id: c.id,
      title: c.title,
      type: c.type,
      claimType: c.claimType || null,
      claimDescription: c.claimDescription || null,
      issuingOrganization: c.issuingOrganization || null,
      issueDate: c.issueDate ? new Date(c.issueDate).toISOString().split('T')[0] : null,
      description: c.description || null,
      fileReference: c.fileReference ? 'Uploaded Document Available' : 'No File Attached'
    }));

    const payload = {
      applicant: {
        name: user.name || 'Applicant',
        dateOfBirth: user.dateOfBirth || null,
        language: application.languages || null,
        linkedinUrl: application.linkedinUrl || null,
        professionalSummary: application.professionalSummary || null,
        proposedSessionFee: application.proposedSessionFee || null
      },
      claims,
      submittedEvidence: credentialsData
    };

    return `You are the AI Document Verification and Preliminary Screening Analyst for MentorConnect.
Your job is to objectively analyze the applicant's claims against their submitted supporting documents and produce a structured JSON verification report for the human administrator.

CRITICAL VERIFICATION RULES:
1. Compare each claimed credential/experience against the submitted evidence metadata and descriptions.
2. Determine the verification status for each claim:
   - "SUPPORTED": A relevant document specifically addressing this claim was uploaded.
   - "PARTIALLY_SUPPORTED": Some relevant evidence was provided, but does not fully verify the stated claim (e.g., certificate provided but date/duration does not fully match claimed years).
   - "UNSUPPORTED": No supporting document was uploaded for this claim, or the uploaded document is unrelated to the claim.
   - "UNABLE_TO_VERIFY": Document title or info is ambiguous and cannot be verified from the metadata.
3. IMPORTANT - AUTHENTICITY NOTICE:
   - You must NOT claim that any document is authentic merely because its title or description looks legitimate.
   - You can only assess whether the document description/metadata appears to support the claim.
   - Clearly distinguish between "Claim supported by submitted evidence" and "Document authenticity independently verified".
   - State clearly that document authenticity must be independently checked by the administrator.
4. Highlight any missing evidence, inconsistencies in dates/numbers, or vague claims.
5. You are NOT the final decision maker. Do not approve or reject anyone.

You MUST output ONLY valid JSON matching this exact structure:
{
  "overallAssessment": "A concise summary of the applicant's background and evidence.",
  "authenticityNotice": "Preliminary AI assessment of submitted evidence against stated claims. Document authenticity has NOT been independently verified and must be verified by the administrator.",
  "profileCompleteness": "COMPLETE | PARTIAL | INCOMPLETE",
  "expertiseRelevance": "STRONG | MODERATE | WEAK",
  "experienceAssessment": "STRONG | MODERATE | LIMITED",
  "teachingAssessment": "STRONG | MODERATE | LIMITED",
  "credentialAssessment": "SUFFICIENT | NEEDS_REVIEW | MISSING",
  "claimsAnalysis": [
    {
      "claim": "Claim description being checked (e.g. 2 years teaching experience)",
      "claimType": "TEACHING_EXPERIENCE | EXPERIENCE | EMPLOYMENT_HISTORY | EDUCATION | CERTIFICATION | ACHIEVEMENT | SKILLS | EXPERTISE | OTHER",
      "credentialId": "id of matching document or null if unsupported",
      "documentTitle": "title of matching document or null",
      "result": "SUPPORTED | PARTIALLY_SUPPORTED | UNSUPPORTED | UNABLE_TO_VERIFY",
      "evidenceFound": "Specific evidence noted in the submission or 'None provided'",
      "reasoning": "Clear explanation of how evidence does or does not support the claim",
      "confidence": "HIGH | MEDIUM | LOW",
      "inconsistencies": "Any date, number, or title discrepancies, or null",
      "missingEvidence": "Details of any required document that is missing, or null"
    }
  ],
  "claimSummary": {
    "totalClaims": 0,
    "supported": 0,
    "partiallySupported": 0,
    "unsupported": 0,
    "unableToVerify": 0,
    "needsManualReview": 0
  },
  "strengths": ["string"],
  "concerns": ["string"],
  "verificationItems": ["string"],
  "recommendation": "READY_FOR_ADMIN_REVIEW | NEEDS_MORE_EVIDENCE | REQUIRES_ATTENTION"
}

Application Data:
${JSON.stringify(payload, null, 2)}`;
  }

  /**
   * Build the AI prompt to generate a professional mentor portfolio after admin approval.
   * @param {object} application - Approved mentor application
   * @param {object} mentorProfile - Mentor profile data
   * @param {object} user - User data
   * @param {Array} verifiedCredentials - Verified credentials
   * @returns {string} - Assembled portfolio generation prompt
   */
  buildPortfolioPrompt(application, mentorProfile, user, verifiedCredentials = []) {
    const context = {
      mentorName: user.name,
      languages: application.languages || mentorProfile.language || 'English',
      experienceYears: application.experience || mentorProfile.experience || 0,
      teachingExperienceYears: application.teachingExperience || mentorProfile.teachingExperience || 0,
      expertise: application.expertise || mentorProfile.expertise || '',
      topics: application.topics || (mentorProfile.topics ? mentorProfile.topics.map(t => t.topic?.name).join(', ') : ''),
      professionalSummary: application.professionalSummary || mentorProfile.bio || '',
      teachingExperienceDetails: application.teachingExperienceDetails || '',
      employmentHistory: application.employmentHistory || mentorProfile.employmentHistory || '',
      education: application.education || '',
      skills: application.skills || '',
      certifications: application.certifications || '',
      achievements: application.achievements || '',
      otherInfo: application.otherInfo || '',
      verifiedCredentials: verifiedCredentials.map(c => ({
        title: c.title,
        type: c.type,
        issuingOrganization: c.issuingOrganization || '',
        issueDate: c.issueDate ? new Date(c.issueDate).getFullYear().toString() : ''
      }))
    };

    return `You are a Professional Portfolio Creator for MentorConnect.
Your task is to take the verified, approved mentor profile data below and transform it into a polished, inspiring, student-facing professional portfolio.

CRITICAL GROUNDING RULES:
1. DO NOT INVENT or hallucinate facts:
   - Do NOT invent companies, jobs, degrees, certificates, awards, universities, or years of experience.
   - Only synthesize, rephrase, and structure the verified information provided.
   - If an optional section (such as achievements or education) is not present in the data, leave the array empty or omit the section.
2. Tone: Highly professional, inspiring, warm, and clear for learners.
3. Emphasize learning outcomes, hands-on guidance, and student success.

You MUST output ONLY valid JSON matching this exact structure:
{
  "headline": "A captivating professional headline (e.g. 'Senior Software Architect & Full-Stack Mentor')",
  "introduction": "An engaging 2-3 sentence personal introduction highlighting passion for mentoring.",
  "about": "A detailed 2-3 paragraph professional story about their journey, background, and why they mentor.",
  "teachingApproach": "A paragraph explaining their hands-on teaching methodology, feedback process, and practical guidance.",
  "mentoringApproach": "A paragraph explaining how they support learners at different stages and help them achieve goals.",
  "experienceSummary": "A concise, well-structured summary of their industry and professional experience.",
  "teachingSummary": "A concise, well-structured summary of their teaching, tutoring, or mentoring experience.",
  "skills": ["string (skills extracted strictly from submitted data)"],
  "topics": ["string (topics they teach)"],
  "highlights": ["string (key career or mentoring highlights)"],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "details": "string"
    }
  ],
  "certifications": [
    {
      "title": "string",
      "issuer": "string",
      "year": "string"
    }
  ],
  "achievements": ["string (awards or achievements from submitted data)"],
  "languages": ["string"]
}

Mentor Verified Data:
${JSON.stringify(context, null, 2)}`;
  }

  /**
   * Generates a grounded professional portfolio using Gemini with deterministic fallback.
   */
  async generatePortfolio(application, mentorProfile, user, verifiedCredentials = []) {
    const prompt = this.buildPortfolioPrompt(application, mentorProfile, user, verifiedCredentials);

    try {
      const rawText = await this.generateText(prompt);
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          headline: parsed.headline || `${application.expertise || 'Experienced'} Professional Mentor`,
          introduction: parsed.introduction || application.professionalSummary || 'Dedicated professional mentor committed to student growth.',
          about: parsed.about || application.professionalSummary || mentorProfile.bio || 'Passionate professional sharing industry insights.',
          teachingApproach: parsed.teachingApproach || application.teachingExperienceDetails || 'Practical, project-based mentorship tailored to learner goals.',
          mentoringApproach: parsed.mentoringApproach || 'Structured milestones, regular feedback, and supportive guidance.',
          experienceSummary: parsed.experienceSummary || application.employmentHistory || `${application.experience || 0} years of industry experience.`,
          teachingSummary: parsed.teachingSummary || application.teachingExperienceDetails || `${application.teachingExperience || 0} years of teaching and mentoring experience.`,
          skills: parsed.skills || (application.skills ? application.skills.split(',').map(s => s.trim()).filter(Boolean) : []),
          topics: parsed.topics || (application.topics ? application.topics.split(',').map(t => t.trim()).filter(Boolean) : []),
          highlights: parsed.highlights || [],
          education: parsed.education || (application.education ? [{ degree: application.education, institution: '', details: '' }] : []),
          certifications: parsed.certifications || verifiedCredentials.map(c => ({ title: c.title, issuer: c.issuingOrganization || '', year: '' })),
          achievements: parsed.achievements || (application.achievements ? application.achievements.split('\n').filter(Boolean) : []),
          languages: parsed.languages || (application.languages ? application.languages.split(',').map(l => l.trim()) : ['English']),
          isGenerated: true,
          generatedAt: new Date()
        };
      }
    } catch (err) {
      console.warn('AI portfolio generation encountered an issue, generating deterministic grounded portfolio:', err.message);
    }

    // Grounded fallback generation when AI is unavailable or parsing fails
    const skillsList = application.skills ? application.skills.split(',').map(s => s.trim()).filter(Boolean) : (application.expertise ? application.expertise.split(',').map(s => s.trim()) : []);
    const topicsList = application.topics ? application.topics.split(',').map(t => t.trim()).filter(Boolean) : [];

    return {
      headline: `${application.expertise || 'Professional'} Mentor & Industry Expert`,
      introduction: application.professionalSummary ? application.professionalSummary.slice(0, 200) + '...' : `Verified mentor with ${application.experience || 0} years of experience.`,
      about: application.professionalSummary || mentorProfile.bio || 'Professional mentor helping students achieve their learning goals.',
      teachingApproach: application.teachingExperienceDetails || 'Goal-oriented, practical guidance with hands-on practice and real-world feedback.',
      mentoringApproach: 'Patient, milestone-driven mentoring tailored to individual learner paces.',
      experienceSummary: application.employmentHistory || `${application.experience || 0} years in industry.`,
      teachingSummary: application.teachingExperienceDetails || `${application.teachingExperience || 0} years in teaching and mentoring.`,
      skills: skillsList,
      topics: topicsList,
      highlights: [`${application.experience || 0}+ years professional experience`, `${application.teachingExperience || 0}+ years mentoring students`],
      education: application.education ? [{ degree: application.education, institution: '', details: '' }] : [],
      certifications: verifiedCredentials.map(c => ({ title: c.title, issuer: c.issuingOrganization || '', year: '' })),
      achievements: application.achievements ? application.achievements.split('\n').map(a => a.trim()).filter(Boolean) : [],
      languages: application.languages ? application.languages.split(',').map(l => l.trim()) : ['English'],
      isGenerated: true,
      generatedAt: new Date()
    };
  }

  /**
   * Build the AI prompt for mentor recommendations.
   * @param {object} studentData - The student's goals, skills, preferences, etc.
   * @param {Array} candidateMentors - Array of eligible mentor objects.
   * @returns {string} - Assembled prompt
   */
  buildMentorRecommendationPrompt(studentData, candidateMentors) {
    const studentInfo = JSON.stringify(studentData, null, 2);
    const mentorsInfo = JSON.stringify(candidateMentors.map(m => ({
      id: m.id,
      name: m.user.name,
      mentorType: m.mentorType,
      expertise: m.expertise,
      experienceYears: m.experience,
      teachingExperienceYears: m.teachingExperience,
      sessionFee: m.sessionFee,
      language: m.language,
      topics: m.topics.map(t => t.topic.name)
    })), null, 2);

    return `You are a mentor recommendation assistant for MentorConnect.
Your task is to analyze the learner's profile and goals, compare them against a provided list of candidate mentors, and recommend the most suitable mentors.

Rules:
- Recommend only from the supplied candidate mentors list.
- Never invent a mentor, their qualifications, availability, or change fees.
- Do not make approval decisions, safety/legal judgments, or discriminate.
- Explain recommendations concisely using only the supplied information.
- The learner makes the final choice.
- Output valid JSON containing a "recommendations" array. Limit to the top 3 best matching mentors.
- Use this JSON structure exactly:
{
  "recommendations": [
    {
      "mentorId": "exact string ID from candidate list",
      "compatibility": "HIGH | MEDIUM | LOW",
      "reasons": ["short reason 1", "short reason 2"],
      "considerations": ["short consideration 1"]
    }
  ]
}
If no mentors are suitable at all, return an empty array for recommendations.

Learner Profile & Context:
${studentInfo}

Candidate Mentors:
${mentorsInfo}`;
  }

  /**
   * Build the AI prompt for screening a peer mentor application.
   * @param {object} studentData - Data from the user's student profile and the application.
   * @returns {string} - Assembled prompt
   */
  buildPeerScreeningPrompt(studentData) {
    const dataString = JSON.stringify(studentData, null, 2);

    return `You are an AI Preliminary Screener for a peer mentor application.
Your job is to objectively analyze the provided student and application data and produce a structured JSON report for the human administrator.
You are NOT the final decision maker. Do not approve, reject, or suspend anyone. Use wording such as "Preliminary assessment for administrator review."
Evaluate the student's readiness to mentor others based ONLY on the provided data.

Assess:
1. Relevant knowledge/skills
2. Experience level
3. Ability to explain or support another learner
4. Motivation to become a peer mentor
5. Communication-related evidence
6. Potential concerns/risk flags
7. Areas that may need improvement before mentoring

You must output valid JSON matching this exact structure:
{
  "recommendation": "A concise summary/recommendation for the administrator.",
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1", "concern 2"],
  "riskFlags": ["flag 1"],
  "developmentAreas": ["area 1", "area 2"]
}

Application Data:
${dataString}`;
  }

  /**
   * Build the AI prompt for Mentor Assistant.
   */
  buildMentorAssistPrompt(context, question) {
    const todayStr = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' });
    const contextBlock = JSON.stringify(context, null, 2);

    return `You are MentorConnect's Mentor AI Assistant.
You support mentors by answering questions about their schedule, availability, students, and platform settings.

CRITICAL RULES:
1. ONLY use the provided JSON context data. Do not invent sessions, availability, or any other information.
2. If the user asks for something not found in the context (like an unknown date or student), simply say you don't have that information.
3. Keep answers concise and practical. Use bullet points when listing items.
4. Use INR (₹) when mentioning money.
5. Today's date (Asia/Kolkata) is: ${todayStr}. Use this to understand "today", "tomorrow", "next week", etc.
6. "Next session" means the closest upcoming ACTIVE session.
7. Do not include excessive detail about students unless explicitly requested.

Mentor's Current Context Data:
${contextBlock}

Mentor's Question:
${question}

Your Answer:`;
  }
}

module.exports = new AIService();
