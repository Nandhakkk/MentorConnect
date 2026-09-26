const prisma = require('../config/db');
const { isApprovedMentor } = require('../utils/mentorCapability');
const notificationService = require('../services/notificationService');

/**
 * MENTOR ENDPOINTS
 */

/**
 * GET /api/finance/mentor/earnings
 * Return earnings summary and payout history for the logged-in mentor.
 */
const getMentorEarnings = async (req, res) => {
  try {
    if (!isApprovedMentor(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Access denied. Mentor capability required.' });
    }

    const mentorId = req.user.mentorProfile.id;

    const payouts = await prisma.payoutRecord.findMany({
      where: { mentorId },
      include: {
        payment: {
          select: {
            session: {
              select: {
                id: true,
                scheduledAt: true,
                duration: true,
                topic: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate summaries
    const summary = payouts.reduce((acc, p) => {
      acc.totalGross += p.grossAmount;
      acc.totalPlatformFee += p.platformFee;
      acc.totalNet += p.netAmount;

      if (p.status === 'ELIGIBLE') acc.eligible += p.netAmount;
      if (p.status === 'PROCESSING') acc.processing += p.netAmount;
      if (p.status === 'PAID') acc.paid += p.netAmount;
      if (p.status === 'FAILED') acc.failed += p.netAmount;
      return acc;
    }, {
      totalGross: 0,
      totalPlatformFee: 0,
      totalNet: 0,
      eligible: 0,
      processing: 0,
      paid: 0,
      failed: 0
    });

    return res.status(200).json({ status: 'success', summary, payouts });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentor earnings.', details: err.message });
  }
};


/**
 * ADMIN ENDPOINTS
 */

/**
 * GET /api/finance/admin/summary
 * Return overall platform finance stats.
 */
const getAdminFinanceSummary = async (req, res) => {
  try {
    const payouts = await prisma.payoutRecord.findMany();

    const summary = payouts.reduce((acc, p) => {
      acc.totalStudentPayments += p.grossAmount;
      acc.totalPlatformIncome += p.platformFee;
      acc.totalMentorAmount += p.netAmount;

      if (p.status === 'ELIGIBLE') {
        acc.eligibleCount++;
        acc.eligibleAmount += p.netAmount;
      }
      if (p.status === 'PROCESSING') {
        acc.processingCount++;
        acc.processingAmount += p.netAmount;
      }
      if (p.status === 'PAID') {
        acc.paidCount++;
        acc.paidAmount += p.netAmount;
      }
      if (p.status === 'FAILED') {
        acc.failedCount++;
        acc.failedAmount += p.netAmount;
      }
      return acc;
    }, {
      totalStudentPayments: 0,
      totalPlatformIncome: 0,
      totalMentorAmount: 0,
      eligibleCount: 0,
      eligibleAmount: 0,
      processingCount: 0,
      processingAmount: 0,
      paidCount: 0,
      paidAmount: 0,
      failedCount: 0,
      failedAmount: 0
    });

    return res.status(200).json({ status: 'success', summary });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch admin finance summary.', details: err.message });
  }
};

/**
 * GET /api/finance/admin/payouts
 * Return all payouts with filtering.
 */
const getAdminPayouts = async (req, res) => {
  try {
    const { status } = req.query;
    
    let whereClause = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    const payouts = await prisma.payoutRecord.findMany({
      where: whereClause,
      include: {
        mentor: {
          include: {
            user: { select: { name: true, email: true } }
          }
        },
        payment: {
          select: {
            session: {
              select: {
                id: true,
                scheduledAt: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', payouts });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch payouts.', details: err.message });
  }
};

/**
 * PUT /api/finance/admin/payouts/:id/process
 * Transition payout from ELIGIBLE -> PROCESSING
 */
const processPayout = async (req, res) => {
  try {
    const { id } = req.params;

    const payout = await prisma.payoutRecord.findUnique({ where: { id }, include: { mentor: true } });
    
    if (!payout) return res.status(404).json({ status: 'error', message: 'Payout not found.' });
    if (payout.status !== 'ELIGIBLE' && payout.status !== 'FAILED') {
      return res.status(400).json({ status: 'error', message: 'Only ELIGIBLE or FAILED payouts can be processed.' });
    }

    const updated = await prisma.payoutRecord.update({
      where: { id },
      data: { status: 'PROCESSING' }
    });

    // Notify mentor
    await notificationService.createNotification(
      payout.mentor.userId,
      'PAYMENT',
      'Payout Processing',
      `Your payout of ₹${payout.netAmount} is now processing.`,
      payout.id,
      'PAYOUT'
    );

    return res.status(200).json({ status: 'success', message: 'Payout status updated to PROCESSING.', payout: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to process payout.', details: err.message });
  }
};

/**
 * PUT /api/finance/admin/payouts/:id/complete
 * Transition payout from PROCESSING -> PAID
 */
const completePayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerId, status } = req.body; // status can be PAID or FAILED

    const payout = await prisma.payoutRecord.findUnique({ where: { id }, include: { mentor: true } });
    
    if (!payout) return res.status(404).json({ status: 'error', message: 'Payout not found.' });
    if (payout.status !== 'PROCESSING') {
      return res.status(400).json({ status: 'error', message: 'Only PROCESSING payouts can be marked as completed or failed.' });
    }
    
    if (status !== 'PAID' && status !== 'FAILED') {
      return res.status(400).json({ status: 'error', message: 'Invalid target status. Must be PAID or FAILED.' });
    }

    const dataToUpdate = { status };
    if (providerId) dataToUpdate.providerId = providerId;
    if (status === 'PAID') dataToUpdate.paidAt = new Date();

    const updated = await prisma.payoutRecord.update({
      where: { id },
      data: dataToUpdate
    });

    if (status === 'PAID') {
      await notificationService.createNotification(
        payout.mentor.userId,
        'PAYMENT',
        'Payout Paid',
        `Your payout of ₹${payout.netAmount} has been successfully paid.`,
        payout.id,
        'PAYOUT'
      );
    } else {
      await notificationService.createNotification(
        payout.mentor.userId,
        'PAYMENT',
        'Payout Failed',
        `There was an issue processing your payout of ₹${payout.netAmount}. Admin will investigate.`,
        payout.id,
        'PAYOUT'
      );
    }

    return res.status(200).json({ status: 'success', message: `Payout status updated to ${status}.`, payout: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to complete payout.', details: err.message });
  }
};

module.exports = {
  getMentorEarnings,
  getAdminFinanceSummary,
  getAdminPayouts,
  processPayout,
  completePayout
};
