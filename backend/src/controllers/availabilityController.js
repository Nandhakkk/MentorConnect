const prisma = require('../config/db');
const { isApprovedMentor } = require('../utils/mentorCapability');

/**
 * GET /api/availability
 * Get all availability slots for the authenticated mentor.
 * Works for both PROFESSIONAL and PEER approved mentors.
 */
const getAvailability = async (req, res) => {
  try {
    // requireApprovedMentor middleware already validates capability
    const mentorProfile = req.user.mentorProfile;
    if (!mentorProfile) {
      return res.status(403).json({ status: 'error', message: 'Mentor profile not found.' });
    }

    const availabilities = await prisma.mentorAvailability.findMany({
      where: { mentorId: mentorProfile.id },
      orderBy: { dayOfWeek: 'asc' }
    });

    return res.status(200).json({ status: 'success', availabilities });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch availability.', details: err.message });
  }
};

/**
 * POST /api/availability
 * Create a new availability slot.
 */
const createAvailability = async (req, res) => {
  try {
    const mentorProfile = req.user.mentorProfile;
    if (!mentorProfile) {
      return res.status(403).json({ status: 'error', message: 'Mentor profile not found.' });
    }

    const { dayOfWeek, startTime, endTime } = req.body;

    if (!dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields.' });
    }

    const availability = await prisma.mentorAvailability.create({
      data: {
        mentorId: mentorProfile.id,
        dayOfWeek,
        startTime,
        endTime
      }
    });

    return res.status(201).json({ status: 'success', message: 'Availability created.', availability });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to create availability.', details: err.message });
  }
};

/**
 * PUT /api/availability/:id
 * Update an existing availability slot.
 */
const updateAvailability = async (req, res) => {
  try {
    const mentorProfile = req.user.mentorProfile;
    if (!mentorProfile) {
      return res.status(403).json({ status: 'error', message: 'Mentor profile not found.' });
    }

    const { id } = req.params;
    const { dayOfWeek, startTime, endTime, isActive } = req.body;

    const existing = await prisma.mentorAvailability.findFirst({
      where: { id, mentorId: mentorProfile.id }
    });

    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Availability slot not found or unauthorized.' });
    }

    const availability = await prisma.mentorAvailability.update({
      where: { id },
      data: {
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : undefined,
        startTime: startTime !== undefined ? startTime : undefined,
        endTime: endTime !== undefined ? endTime : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      }
    });

    return res.status(200).json({ status: 'success', message: 'Availability updated.', availability });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update availability.', details: err.message });
  }
};

/**
 * DELETE /api/availability/:id
 * Delete an availability slot.
 */
const deleteAvailability = async (req, res) => {
  try {
    const mentorProfile = req.user.mentorProfile;
    if (!mentorProfile) {
      return res.status(403).json({ status: 'error', message: 'Mentor profile not found.' });
    }

    const { id } = req.params;

    const existing = await prisma.mentorAvailability.findFirst({
      where: { id, mentorId: mentorProfile.id }
    });

    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Availability slot not found or unauthorized.' });
    }

    await prisma.mentorAvailability.delete({ where: { id } });

    return res.status(200).json({ status: 'success', message: 'Availability deleted.' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to delete availability.', details: err.message });
  }
};

module.exports = {
  getAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability
};
