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

module.exports = { assist };
