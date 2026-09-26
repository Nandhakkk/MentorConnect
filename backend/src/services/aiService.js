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
   * Build the AI prompt for screening a professional mentor application.
   * @param {object} application - The application object with mentor profile and credentials.
   * @returns {string} - Assembled prompt
   */
  buildScreeningPrompt(application) {
    const dataString = JSON.stringify({
      professionalSummary: application.professionalSummary,
      expertise: application.expertise,
      experienceYears: application.experience,
      teachingExperienceYears: application.teachingExperience,
      linkedinUrl: application.linkedinUrl,
      languages: application.languages,
      credentials: application.credentials?.map(c => ({ title: c.title, type: c.type })) || []
    }, null, 2);

    return `You are an AI Preliminary Screener for a professional mentor application platform.
Your job is to objectively analyze the provided application data and produce a structured JSON report for the human administrator.
You are NOT the final decision maker. Do not approve, reject, or suspend anyone.
Do not infer facts not present. Flag missing info as concerns for human review.

Evaluate:
A. Profile completeness (COMPLETE, PARTIAL, INCOMPLETE)
B. Expertise relevance (STRONG, MODERATE, WEAK)
C. Experience Assessment (STRONG, MODERATE, LIMITED)
D. Teaching Assessment (STRONG, MODERATE, LIMITED)
E. Credential Assessment (SUFFICIENT, NEEDS_REVIEW, MISSING)

You must output valid JSON matching this exact structure:
{
  "overallAssessment": "A concise summary of the applicant.",
  "profileCompleteness": "COMPLETE",
  "expertiseRelevance": "STRONG",
  "experienceAssessment": "STRONG",
  "teachingAssessment": "STRONG",
  "credentialAssessment": "NEEDS_REVIEW",
  "strengths": ["string"],
  "concerns": ["string"],
  "verificationItems": ["string"],
  "recommendation": "SHORTLIST_FOR_REVIEW | NEEDS_MORE_INFORMATION | HIGHER_REVIEW_ATTENTION"
}

Application Data:
${dataString}`;
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
}

module.exports = new AIService();
