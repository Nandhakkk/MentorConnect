const prisma = require('../config/db');
const { isApprovedMentor } = require('../utils/mentorCapability');

const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const isValidTime = (time) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);

const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const checkOverlap = (existingSlots, newStart, newEnd, excludeId = null) => {
  const newStartMin = timeToMinutes(newStart);
  const newEndMin = timeToMinutes(newEnd);
  
  for (const slot of existingSlots) {
    if (excludeId && slot.id === excludeId) continue;
    
    const slotStartMin = timeToMinutes(slot.startTime);
    const slotEndMin = timeToMinutes(slot.endTime);
    
    // Check overlap: (StartA < EndB) and (EndA > StartB)
    if (newStartMin < slotEndMin && newEndMin > slotStartMin) {
      return true;
    }
  }
  return false;
};

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

    const dayOfWeek = req.body.dayOfWeek?.toUpperCase();
    const { startTime, endTime } = req.body;

    if (!dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields.' });
    }

    if (!DAYS_OF_WEEK.includes(dayOfWeek)) {
      return res.status(400).json({ status: 'error', message: 'Invalid day of week.' });
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ status: 'error', message: 'Invalid time format. Use HH:mm (24-hour).' });
    }

    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      return res.status(400).json({ status: 'error', message: 'Start time must be earlier than end time.' });
    }

    // Check overlaps
    const existingSlots = await prisma.mentorAvailability.findMany({
      where: { mentorId: mentorProfile.id, dayOfWeek }
    });

    if (checkOverlap(existingSlots, startTime, endTime)) {
      return res.status(400).json({ status: 'error', message: 'Slot overlaps with existing availability on this day.' });
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

    const newDay = dayOfWeek !== undefined ? dayOfWeek.toUpperCase() : existing.dayOfWeek;
    const newStart = startTime !== undefined ? startTime : existing.startTime;
    const newEnd = endTime !== undefined ? endTime : existing.endTime;

    if (!DAYS_OF_WEEK.includes(newDay)) {
      return res.status(400).json({ status: 'error', message: 'Invalid day of week.' });
    }

    if (!isValidTime(newStart) || !isValidTime(newEnd)) {
      return res.status(400).json({ status: 'error', message: 'Invalid time format. Use HH:mm (24-hour).' });
    }

    if (timeToMinutes(newStart) >= timeToMinutes(newEnd)) {
      return res.status(400).json({ status: 'error', message: 'Start time must be earlier than end time.' });
    }

    // Check overlaps
    const existingSlots = await prisma.mentorAvailability.findMany({
      where: { mentorId: mentorProfile.id, dayOfWeek: newDay }
    });

    if (checkOverlap(existingSlots, newStart, newEnd, id)) {
      return res.status(400).json({ status: 'error', message: 'Slot overlaps with existing availability on this day.' });
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
