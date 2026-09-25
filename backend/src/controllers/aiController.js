const prisma = require('../config/db');
const aiService = require('../services/aiService');

/**
 * POST /api/ai/assist
 * Generate a personalized AI response using the student's goals/milestones.
 */
const assist = async (req, res) => {
  try {
    // --- Validation ---
    const { question, goalId } = req.body;

    if (!question || question.trim() === '') {
      return res.status(400).json({ success: false, error: 'Question is required.' });
    }
    if (question.trim().length > 2000) {
      return res.status(400).json({ success: false, error: 'Question is too long (max 2000 characters).' });
    }

    // --- Get student profile from JWT (never from body) ---
    const studentProfile = req.user.studentProfile;
    if (!studentProfile) {
      return res.status(403).json({ success: false, error: 'Student profile not found.' });
    }

    // --- Fetch goal context (validates goal ownership before hitting AI) ---
    let goals = [];

    if (goalId) {
      // Focused context: one specific goal
      const goal = await prisma.goal.findFirst({
        where: { id: goalId, studentId: studentProfile.id },
        include: { milestones: { orderBy: { createdAt: 'asc' } } }
      });

      if (!goal) {
        return res.status(404).json({ success: false, error: 'Goal not found or access denied.' });
      }
      goals = [goal];
    } else {
      // Broad context: all active goals
      goals = await prisma.goal.findMany({
        where: { studentId: studentProfile.id, status: 'ACTIVE' },
        include: { milestones: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' }
      });
    }

    // --- API key check (after validation, before costly AI call) ---
    if (!process.env.AI_SERVICE_API_KEY || process.env.AI_SERVICE_API_KEY.trim() === '') {
      return res.status(503).json({ success: false, error: 'AI service is not configured. Please contact the administrator.' });
    }

    // --- Build prompt and call Gemini ---
    const prompt = aiService.buildPrompt({ goals }, question.trim());

    let answer;
    try {
      answer = await aiService.generateText(prompt);
    } catch (aiErr) {
      // Log internally but do NOT expose API key or raw error to client
      console.error('[AI] Gemini error:', aiErr.message);
      return res.status(503).json({
        success: false,
        error: 'AI service is temporarily unavailable. Please try again.'
      });
    }

    return res.status(200).json({ success: true, answer });
  } catch (err) {
    console.error('[AI] Unexpected error:', err.message);
    return res.status(500).json({ success: false, error: 'An unexpected error occurred.' });
  }
};

/**
 * POST /api/ai/mentor-recommendations
 * Generates and returns AI mentor recommendations based on the student's profile/goals.
 */
const recommendMentors = async (req, res) => {
  try {
    const studentProfile = req.user.studentProfile;
    if (!studentProfile) {
      return res.status(403).json({ success: false, error: 'Student profile not found.' });
    }

    if (!process.env.AI_SERVICE_API_KEY || process.env.AI_SERVICE_API_KEY.trim() === '') {
      return res.status(503).json({ success: false, error: 'AI service is not configured.' });
    }

    // 1. Gather learner context
    const goals = await prisma.goal.findMany({
      where: { studentId: studentProfile.id, status: 'ACTIVE' },
      select: { title: true, description: true, targetDate: true }
    });

    const learnerContext = {
      careerGoal: studentProfile.careerGoal,
      interests: studentProfile.interests,
      skills: studentProfile.skills,
      experienceLevel: studentProfile.experienceLevel,
      education: studentProfile.education,
      preferredLearningStyle: studentProfile.preferredLearningStyle,
      preferredLanguage: studentProfile.preferredLanguage,
      budget: studentProfile.budget,
      studyAvailability: studentProfile.studyAvailability,
      goals
    };

    // 2. Fetch eligible mentors based on Phase 3D hard constraints
    const whereClause = {
      user: { role: 'MENTOR' },
      mentorType: 'PROFESSIONAL',
      status: 'APPROVED',
      isAvailable: true,
      bio: { not: null },
      expertise: { not: null },
      sessionFee: { not: null },
      topics: { some: {} },
      availabilities: { some: { isActive: true } }
    };

    if (studentProfile.budget) {
      whereClause.sessionFee = { lte: studentProfile.budget };
    }

    const candidateMentors = await prisma.mentorProfile.findMany({
      where: whereClause,
      include: {
        user: { select: { name: true, profileImage: true } },
        topics: { include: { topic: true } },
        availabilities: { where: { isActive: true } }
      },
      take: 20
    });

    if (candidateMentors.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No currently eligible mentors fit your criteria (such as budget constraints). You can update your preferences or browse mentors manually.',
        recommendations: []
      });
    }

    // 3. Ask AI to recommend from the candidate list
    const prompt = aiService.buildMentorRecommendationPrompt(learnerContext, candidateMentors);

    let rawAiResponse;
    try {
      rawAiResponse = await aiService.generateText(prompt);
    } catch (aiErr) {
      console.error('[AI Recommendation] Error:', aiErr.message);
      return res.status(503).json({ success: false, error: 'AI service is temporarily unavailable.' });
    }

    // 4. Parse AI JSON
    let parsedData;
    try {
      // Strip markdown code block formatting if present
      const cleanJson = rawAiResponse.replace(/```json\n?/, '').replace(/```\n?$/, '').trim();
      parsedData = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error('[AI Recommendation] JSON Parse Error:', parseErr.message);
      console.error('Raw Response:', rawAiResponse);
      return res.status(500).json({ success: false, error: 'AI returned an invalid format.' });
    }

    const recommendations = parsedData.recommendations || [];

    // 5. Store / Update AIRecommendation record to prevent duplicates
    // We update the existing one if it's still PENDING, or create a new one.
    let aiRecRecord = await prisma.aIRecommendation.findFirst({
      where: { studentId: studentProfile.id, type: 'MENTOR', status: 'PENDING' }
    });

    if (aiRecRecord) {
      aiRecRecord = await prisma.aIRecommendation.update({
        where: { id: aiRecRecord.id },
        data: { content: recommendations, updatedAt: new Date() }
      });
    } else {
      aiRecRecord = await prisma.aIRecommendation.create({
        data: {
          studentId: studentProfile.id,
          type: 'MENTOR',
          status: 'PENDING',
          content: recommendations
        }
      });
    }

    // 6. Return response
    return res.status(200).json({
      success: true,
      recommendationId: aiRecRecord.id,
      recommendations,
      candidates: candidateMentors // We might want to just send back the enriched recommendations
    });

  } catch (err) {
    console.error('[AI Recommendation] Unexpected error:', err.message);
    return res.status(500).json({ success: false, error: 'An unexpected error occurred.' });
  }
};

module.exports = { assist, recommendMentors };
