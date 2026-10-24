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

    // 2. Fetch eligible mentors — both PROFESSIONAL and PEER
    const whereClause = {
      mentorType: { in: ['PROFESSIONAL', 'PEER'] },
      status: 'APPROVED',
      isAvailable: true,
      bio: { not: null },
      expertise: { not: null },
      sessionFee: { not: null },
      topics: { some: {} },
      availabilities: { some: { isActive: true } },
      user: {
        isActive: true,
        isSuspended: false
      }
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

/**
 * POST /api/ai/mentor-assist
 * Generate a personalized AI response for mentors using their schedule, availability, and assignments.
 */
const mentorAssist = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim() === '') {
      return res.status(400).json({ success: false, error: 'Question is required.' });
    }
    if (question.trim().length > 2000) {
      return res.status(400).json({ success: false, error: 'Question is too long (max 2000 characters).' });
    }

    const mentorProfile = req.user.mentorProfile;
    if (!mentorProfile) {
      return res.status(403).json({ success: false, error: 'Mentor profile not found.' });
    }

    if (!process.env.AI_SERVICE_API_KEY || process.env.AI_SERVICE_API_KEY.trim() === '') {
      return res.status(503).json({ success: false, error: 'AI service is not configured.' });
    }

    // 1. Fetch upcoming confirmed sessions
    const upcomingSessions = await prisma.session.findMany({
      where: {
        mentorship: { mentorId: mentorProfile.id },
        scheduledAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        status: 'SCHEDULED',
        OR: [
          { payment: null },
          { payment: { amount: 0 } },
          { payment: { status: 'PAID' } }
        ]
      },
      include: {
        mentorship: {
          include: { student: { include: { user: { select: { name: true } } } } }
        }
      },
      orderBy: { scheduledAt: 'asc' },
      take: 20
    });

    // 2. Fetch active availabilities
    const availabilities = await prisma.mentorAvailability.findMany({
      where: { mentorId: mentorProfile.id, isActive: true }
    });

    // 3. Fetch mentor topics and basic info
    const fullProfile = await prisma.mentorProfile.findUnique({
      where: { id: mentorProfile.id },
      include: { topics: { include: { topic: true } } }
    });

    // 4. Fetch active mentorships (student list)
    const activeMentorships = await prisma.mentorship.findMany({
      where: { mentorId: mentorProfile.id, status: 'ACTIVE' },
      include: { student: { include: { user: { select: { name: true } } } } }
    });

    // 5. Fetch pending assignments (submitted but not reviewed)
    const pendingAssignments = await prisma.assignmentSubmission.findMany({
      where: {
        assignment: { mentorId: mentorProfile.id },
        status: 'SUBMITTED'
      },
      include: {
        assignment: { select: { title: true, dueDate: true } },
        student: { include: { user: { select: { name: true } } } }
      }
    });

    // Build context
    const context = {
      mentorInfo: {
        name: req.user.name,
        sessionFee: fullProfile.sessionFee,
        topics: fullProfile.topics.map(t => t.topic.name)
      },
      upcomingSessions: upcomingSessions.map(s => ({
        studentName: s.mentorship.student.user.name,
        topic: s.topic || 'General Mentoring',
        scheduledAt: s.scheduledAt,
        durationMinutes: s.duration
      })),
      availability: availabilities.map(a => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime
      })),
      activeStudents: activeMentorships.map(m => m.student.user.name),
      pendingAssignments: pendingAssignments.map(sub => ({
        studentName: sub.student.user.name,
        assignmentTitle: sub.assignment.title,
        submittedAt: sub.submittedAt
      }))
    };

    // Build prompt and call Gemini
    const prompt = aiService.buildMentorAssistPrompt(context, question.trim());

    let answer;
    try {
      answer = await aiService.generateText(prompt);
    } catch (aiErr) {
      console.error('[Mentor AI] Error:', aiErr.message);
      return res.status(503).json({ success: false, error: 'AI service is temporarily unavailable.' });
    }

    return res.status(200).json({ success: true, answer });
  } catch (err) {
    console.error('[Mentor AI] Unexpected error:', err.message);
    return res.status(500).json({ success: false, error: 'An unexpected error occurred.' });
  }
};

module.exports = { assist, recommendMentors, mentorAssist };
