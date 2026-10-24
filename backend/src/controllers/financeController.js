const prisma = require('../config/db');
const { isApprovedMentor } = require('../utils/mentorCapability');
const notificationService = require('../services/notificationService');
const transactionalEmailService = require('../services/transactionalEmailService');

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
    // 1. Total Revenue and Platform Income from PAID and PARTIALLY_REFUNDED Payments
    const paidPayments = await prisma.payment.aggregate({
      where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
      _sum: {
        amount: true,
        platformFee: true
      }
    });

    // 2. Refunds aggregation
    const processedRefunds = await prisma.refund.aggregate({
      where: { status: 'PROCESSED' },
      _sum: { amount: true },
      _count: { id: true }
    });

    const pendingRefunds = await prisma.refund.aggregate({
      where: { status: { in: ['REQUESTED', 'PENDING_GATEWAY'] } },
      _sum: { amount: true },
      _count: { id: true }
    });

    const totalRefundsAmount = processedRefunds._sum.amount || 0;
    const totalRefundsCount = processedRefunds._count.id || 0;
    const pendingRefundsAmount = pendingRefunds._sum.amount || 0;
    const pendingRefundsCount = pendingRefunds._count.id || 0;

    // Platform income: refunded amounts do not count as retained platform income
    const refundedPlatformFee = Math.round(totalRefundsAmount * 0.1 * 100) / 100;
    const grossPlatformFee = paidPayments._sum.platformFee || 0;
    const netPlatformIncome = Math.max(0, grossPlatformFee - refundedPlatformFee);
    const grossRevenue = paidPayments._sum.amount || 0;
    const netRevenue = Math.max(0, grossRevenue - totalRefundsAmount);

    // 3. Mentor Payouts and Pending from PayoutRecords
    const payouts = await prisma.payoutRecord.groupBy({
      by: ['status'],
      _sum: { netAmount: true },
      _count: { id: true }
    });

    let paidPayouts = 0;
    let eligibleAmount = 0;
    let processingAmount = 0;
    let eligibleCount = 0;
    let processingCount = 0;
    let failedAmount = 0;
    let failedCount = 0;
    let paidCount = 0;

    payouts.forEach(p => {
      if (p.status === 'PAID') {
        paidPayouts += p._sum.netAmount || 0;
        paidCount += p._count.id;
      }
      if (p.status === 'ELIGIBLE') {
        eligibleAmount += p._sum.netAmount || 0;
        eligibleCount += p._count.id;
      }
      if (p.status === 'PROCESSING') {
        processingAmount += p._sum.netAmount || 0;
        processingCount += p._count.id;
      }
      if (p.status === 'FAILED') {
        failedAmount += p._sum.netAmount || 0;
        failedCount += p._count.id;
      }
    });

    const summary = {
      totalRevenue: netRevenue,
      grossRevenue,
      totalPlatformIncome: netPlatformIncome,
      grossPlatformIncome: grossPlatformFee,
      totalRefunds: totalRefundsAmount,
      refundsCount: totalRefundsCount,
      pendingRefundsAmount,
      pendingRefundsCount,
      totalMentorPayouts: paidPayouts,
      eligibleAmount,
      eligibleCount,
      processingAmount,
      processingCount,
      paidCount,
      failedAmount,
      failedCount
    };

    return res.status(200).json({ status: 'success', summary });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch admin finance summary.', details: err.message });
  }
};

/**
 * GET /api/finance/admin/trend
 * Returns revenue and income aggregated by day for charts.
 */
const getAdminFinanceTrend = async (req, res) => {
  try {
    // We fetch PAID and PARTIALLY_REFUNDED payments with refunds
    const payments = await prisma.payment.findMany({
      where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] }, paidAt: { not: null } },
      select: {
        paidAt: true,
        amount: true,
        platformFee: true,
        refunds: {
          where: { status: 'PROCESSED' },
          select: { amount: true }
        }
      },
      orderBy: { paidAt: 'asc' }
    });

    // Group by Date string YYYY-MM-DD
    const trendMap = {};
    payments.forEach(p => {
      const dateKey = p.paidAt.toISOString().split('T')[0];
      if (!trendMap[dateKey]) {
        trendMap[dateKey] = { date: dateKey, revenue: 0, income: 0, refunds: 0 };
      }
      const refunded = (p.refunds || []).reduce((sum, r) => sum + r.amount, 0);
      const refundedFee = Math.round(refunded * 0.1 * 100) / 100;
      trendMap[dateKey].revenue += Math.max(0, p.amount - refunded);
      trendMap[dateKey].income += Math.max(0, p.platformFee - refundedFee);
      trendMap[dateKey].refunds += refunded;
    });

    const trend = Object.values(trendMap);

    return res.status(200).json({ status: 'success', trend });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch finance trend.', details: err.message });
  }
};

/**
 * GET /api/finance/admin/transactions
 * Returns actual payment records for the table.
 */
const getAdminTransactions = async (req, res) => {
  try {
    const transactions = await prisma.payment.findMany({
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        session: {
          include: {
            mentorship: {
              include: {
                mentor: { include: { user: { select: { name: true, email: true } } } }
              }
            }
          }
        },
        payout: true,
        refunds: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const formattedTransactions = transactions.map(tx => ({
      ...tx,
      session: tx.session ? {
        ...tx.session,
        mentor: tx.session.mentorship?.mentor
      } : null
    }));

    return res.status(200).json({ status: 'success', transactions: formattedTransactions });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch transactions.', details: err.message });
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

    const payout = await prisma.payoutRecord.findUnique({
      where: { id },
      include: {
        mentor: {
          include: {
            user: true
          }
        }
      }
    });

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

    // Real Transactional Email (Event 12: Mentor Payout Processed)
    if (payout.mentor?.user) {
      await transactionalEmailService.notifyMentorPayoutProcessed({
        payout: updated,
        mentorUser: payout.mentor.user,
        status
      }).catch(err => console.error('[FinanceController] Mentor payout email error:', err.message));
    }

    return res.status(200).json({ status: 'success', message: `Payout status updated to ${status}.`, payout: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to complete payout.', details: err.message });
  }
};

module.exports = {
  getMentorEarnings,
  getAdminFinanceSummary,
  getAdminFinanceTrend,
  getAdminTransactions,
  getAdminPayouts,
  processPayout,
  completePayout
};
