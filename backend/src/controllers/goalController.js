const prisma = require('../config/db');

/**
 * Helper: Resolve the StudentProfile for the authenticated user.
 * Returns 403 if the user is not a STUDENT or has no profile.
 */
const getStudentProfileOrFail = async (res, user) => {
  if (user.role !== 'STUDENT') {
    res.status(403).json({
      status: 'error',
      message: 'Only STUDENT users can manage goals.'
    });
    return null;
  }

  const profile = user.studentProfile;
  if (!profile) {
    res.status(403).json({
      status: 'error',
      message: 'Student profile not found. Please complete your profile.'
    });
    return null;
  }

  return profile;
};

/**
 * GET /api/goals
 * Return all goals (with milestones) belonging to the authenticated student.
 */
const getGoals = async (req, res) => {
  try {
    const profile = await getStudentProfileOrFail(res, req.user);
    if (!profile) return;

    const goals = await prisma.goal.findMany({
      where: { studentId: profile.id },
      include: { milestones: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', goals });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch goals.', details: err.message });
  }
};

/**
 * GET /api/goals/:id
 * Return one goal (with milestones) — must belong to the authenticated student.
 */
const getGoalById = async (req, res) => {
  try {
    const profile = await getStudentProfileOrFail(res, req.user);
    if (!profile) return;

    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, studentId: profile.id },
      include: { milestones: { orderBy: { createdAt: 'asc' } } }
    });

    if (!goal) {
      return res.status(404).json({ status: 'error', message: 'Goal not found or access denied.' });
    }

    return res.status(200).json({ status: 'success', goal });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch goal.', details: err.message });
  }
};

/**
 * POST /api/goals
 * Create a new goal for the authenticated student.
 */
const createGoal = async (req, res) => {
  try {
    const profile = await getStudentProfileOrFail(res, req.user);
    if (!profile) return;

    const { title, description, targetDate } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ status: 'error', message: 'Goal title is required.' });
    }

    // Validate and parse targetDate if provided
    let parsedDate = null;
    if (targetDate) {
      parsedDate = new Date(targetDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Invalid targetDate format. Use YYYY-MM-DD.' });
      }
    }

    const goal = await prisma.goal.create({
      data: {
        studentId: profile.id,          // always from JWT, never from request body
        title: title.trim(),
        description: description?.trim() || null,
        targetDate: parsedDate,
        status: 'ACTIVE'
      },
      include: { milestones: true }
    });

    return res.status(201).json({ status: 'success', message: 'Goal created successfully.', goal });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to create goal.', details: err.message });
  }
};

/**
 * PUT /api/goals/:id
 * Update a goal — must belong to the authenticated student.
 */
const updateGoal = async (req, res) => {
  try {
    const profile = await getStudentProfileOrFail(res, req.user);
    if (!profile) return;

    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, studentId: profile.id }
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Goal not found or access denied.' });
    }

    const { title, description, targetDate, status } = req.body;

    const validStatuses = ['ACTIVE', 'COMPLETED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}.`
      });
    }

    let parsedDate = existing.targetDate;
    if (targetDate !== undefined) {
      parsedDate = targetDate ? new Date(targetDate) : null;
      if (targetDate && isNaN(parsedDate?.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Invalid targetDate format. Use YYYY-MM-DD.' });
      }
    }

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        title: title ? title.trim() : existing.title,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        targetDate: parsedDate,
        status: status || existing.status
      },
      include: { milestones: { orderBy: { createdAt: 'asc' } } }
    });

    return res.status(200).json({ status: 'success', message: 'Goal updated successfully.', goal });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update goal.', details: err.message });
  }
};

/**
 * DELETE /api/goals/:id
 * Delete a goal — must belong to the authenticated student.
 */
const deleteGoal = async (req, res) => {
  try {
    const profile = await getStudentProfileOrFail(res, req.user);
    if (!profile) return;

    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, studentId: profile.id }
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Goal not found or access denied.' });
    }

    await prisma.goal.delete({ where: { id: req.params.id } });

    return res.status(200).json({ status: 'success', message: 'Goal deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to delete goal.', details: err.message });
  }
};

module.exports = { getGoals, getGoalById, createGoal, updateGoal, deleteGoal };
