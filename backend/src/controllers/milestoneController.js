const prisma = require('../config/db');

/**
 * Helper: Resolve the StudentProfile for the authenticated user.
 */
const getStudentProfileOrFail = async (res, user) => {
  if (user.role !== 'STUDENT') {
    res.status(403).json({
      status: 'error',
      message: 'Only STUDENT users can manage milestones.'
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
 * Helper: Verify that the goal belongs to the authenticated student.
 */
const verifyGoalOwnership = async (res, goalId, studentId) => {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, studentId: studentId }
  });

  if (!goal) {
    res.status(404).json({
      status: 'error',
      message: 'Goal not found or access denied.'
    });
    return null;
  }
  return goal;
};

/**
 * Helper: Verify that the milestone exists and its goal belongs to the student.
 */
const verifyMilestoneOwnership = async (res, milestoneId, studentId) => {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { goal: true }
  });

  if (!milestone || milestone.goal.studentId !== studentId) {
    res.status(404).json({
      status: 'error',
      message: 'Milestone not found or access denied.'
    });
    return null;
  }
  return milestone;
};

/**
 * POST /api/goals/:goalId/milestones
 * Create a new milestone for a goal.
 */
const createMilestone = async (req, res) => {
  try {
    const profile = await getStudentProfileOrFail(res, req.user);
    if (!profile) return;

    const goalId = req.params.goalId;
    const goal = await verifyGoalOwnership(res, goalId, profile.id);
    if (!goal) return;

    const { title, description, dueDate } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ status: 'error', message: 'Milestone title is required.' });
    }

    let parsedDate = null;
    if (dueDate) {
      parsedDate = new Date(dueDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Invalid dueDate format. Use YYYY-MM-DD.' });
      }
    }

    const milestone = await prisma.milestone.create({
      data: {
        goalId: goalId,
        title: title.trim(),
        description: description?.trim() || null,
        dueDate: parsedDate,
        status: 'PENDING'
      }
    });

    return res.status(201).json({ status: 'success', message: 'Milestone created successfully.', milestone });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to create milestone.', details: err.message });
  }
};

/**
 * PUT /api/milestones/:id
 * Update a milestone.
 */
const updateMilestone = async (req, res) => {
  try {
    const profile = await getStudentProfileOrFail(res, req.user);
    if (!profile) return;

    const existing = await verifyMilestoneOwnership(res, req.params.id, profile.id);
    if (!existing) return;

    const { title, description, dueDate, status } = req.body;

    const validStatuses = ['PENDING', 'COMPLETED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}.`
      });
    }

    let parsedDate = existing.dueDate;
    if (dueDate !== undefined) {
      parsedDate = dueDate ? new Date(dueDate) : null;
      if (dueDate && isNaN(parsedDate?.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Invalid dueDate format. Use YYYY-MM-DD.' });
      }
    }

    const milestone = await prisma.milestone.update({
      where: { id: req.params.id },
      data: {
        title: title ? title.trim() : existing.title,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        dueDate: parsedDate,
        status: status || existing.status
      }
    });

    return res.status(200).json({ status: 'success', message: 'Milestone updated successfully.', milestone });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update milestone.', details: err.message });
  }
};

/**
 * DELETE /api/milestones/:id
 * Delete a milestone.
 */
const deleteMilestone = async (req, res) => {
  try {
    const profile = await getStudentProfileOrFail(res, req.user);
    if (!profile) return;

    const existing = await verifyMilestoneOwnership(res, req.params.id, profile.id);
    if (!existing) return;

    await prisma.milestone.delete({ where: { id: req.params.id } });

    return res.status(200).json({ status: 'success', message: 'Milestone deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to delete milestone.', details: err.message });
  }
};

module.exports = { createMilestone, updateMilestone, deleteMilestone };
