/**
 * Razorpay Refund Gateway Service — MentorConnect
 *
 * Integrates directly with official Razorpay SDK for creating, verifying,
 * and reconciling gateway refunds with strict idempotency and audit logs.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../config/db');
const notificationService = require('./notificationService');
const guardianService = require('./guardianService');
const transactionalEmailService = require('./transactionalEmailService');

const cleanEnvVal = (val) => {
  if (!val) return '';
  let str = val.trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str;
};

const getRazorpayInstance = () => {
  const key_id = cleanEnvVal(process.env.RAZORPAY_KEY_ID);
  const key_secret = cleanEnvVal(process.env.RAZORPAY_KEY_SECRET);

  if (!key_id || !key_secret) {
    const error = new Error('Razorpay credentials are not configured in environment.');
    error.code = 'CONFIG_MISSING';
    throw error;
  }
  return new Razorpay({ key_id, key_secret });
};

/**
 * Executes a refund on Razorpay gateway for an existing refund record.
 * @param {string} refundId - Database UUID of Refund record
 * @returns {Promise<Object>} Updated refund record
 */
async function executeGatewayRefund(refundId) {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: {
      payment: {
        include: {
          session: {
            include: {
              mentorship: {
                include: {
                  student: { include: { user: true } },
                  mentor: { include: { user: true } }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!refund) {
    throw new Error('Refund record not found.');
  }

  if (refund.status === 'PROCESSED') {
    return refund; // Idempotent return
  }

  const payment = refund.payment;
  if (!payment) {
    throw new Error('Payment record associated with refund not found.');
  }

  if (!payment.razorpayPaymentId) {
    throw new Error('Original payment does not have a Razorpay Payment ID. Cannot initiate gateway refund.');
  }

  const amountInPaise = Math.round(refund.amount * 100);
  if (amountInPaise <= 0) {
    throw new Error('Invalid refund amount. Must be greater than 0.');
  }

  let razorpay;
  try {
    razorpay = getRazorpayInstance();
  } catch (cfgErr) {
    // Record gateway configuration failure safely
    const updated = await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: 'FAILED',
        failureReason: cfgErr.message,
        failedAt: new Date()
      }
    });
    throw cfgErr;
  }

  const refundOptions = {
    amount: amountInPaise,
    speed: 'normal',
    notes: {
      refund_reference: refund.refundReference,
      sessionId: refund.sessionId || '',
      reason: refund.reason.substring(0, 100)
    },
    receipt: refund.refundReference
  };

  try {
    // Mark PENDING_GATEWAY prior to external call
    await prisma.refund.update({
      where: { id: refund.id },
      data: { status: 'PENDING_GATEWAY' }
    });

    const gatewayRefund = await razorpay.payments.refund(payment.razorpayPaymentId, refundOptions);

    const isProcessed = gatewayRefund.status === 'processed';
    const isPending = gatewayRefund.status === 'pending';

    const newStatus = isProcessed ? 'PROCESSED' : 'PENDING_GATEWAY';

    // Update refund and parent payment inside transaction
    const [updatedRefund] = await prisma.$transaction(async (tx) => {
      const rf = await tx.refund.update({
        where: { id: refund.id },
        data: {
          razorpayRefundId: gatewayRefund.id,
          razorpayPaymentId: payment.razorpayPaymentId,
          status: newStatus,
          processedAt: isProcessed ? new Date() : null,
          gatewayResponse: gatewayRefund,
          failureReason: null
        }
      });

      if (isProcessed) {
        // Calculate new payment status
        const allProcessed = await tx.refund.findMany({
          where: { paymentId: payment.id, status: 'PROCESSED' }
        });
        const totalRefundedPaise = allProcessed.reduce((acc, cur) => acc + Math.round(cur.amount * 100), 0);
        const origPaise = Math.round(payment.amount * 100);

        const newPaymentStatus = totalRefundedPaise >= origPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: newPaymentStatus }
        });

        // Safe payout adjustment:
        // If an ELIGIBLE or PROCESSING payout exists for this session's payment, cancel it or adjust it
        const payout = await tx.payoutRecord.findUnique({ where: { paymentId: payment.id } });
        if (payout) {
          if (payout.status === 'ELIGIBLE' || payout.status === 'PROCESSING') {
            if (newPaymentStatus === 'REFUNDED') {
              await tx.payoutRecord.update({
                where: { id: payout.id },
                data: { status: 'CANCELLED' }
              });
            } else {
              // Partial refund: adjust net amount (retained * 90%)
              const retainedPaise = Math.max(0, origPaise - totalRefundedPaise);
              const newNet = Math.round(retainedPaise * 0.9) / 100;
              const newFee = Math.round(retainedPaise * 0.1) / 100;
              await tx.payoutRecord.update({
                where: { id: payout.id },
                data: {
                  grossAmount: retainedPaise / 100,
                  platformFee: newFee,
                  netAmount: newNet
                }
              });
            }
          }
          // If payout is already PAID, we do NOT alter or delete it; the financial ledger records the refund
        }
      }

      return [rf];
    });

    // Dispatch notifications to student and guardian
    const studentUser = payment.session?.mentorship?.student?.user;
    if (studentUser) {
      if (isProcessed) {
        await notificationService.createNotification(
          studentUser.id,
          'REFUND',
          'Refund Processed',
          `Your refund of ₹${refund.amount} has been processed by the payment gateway (Ref: ${refund.refundReference}).`,
          refund.id,
          'REFUND'
        ).catch(err => console.error('Refund notification error:', err.message));

        await guardianService.notifyGuardianEvent(
          studentUser.id,
          'PAYMENT',
          {
            title: 'Refund Processed',
            message: `A refund of ₹${refund.amount} for session "${payment.session?.topic || 'Mentoring Session'}" was processed to the original payment method. Reference: ${refund.refundReference}.`,
            referenceId: refund.id,
            referenceType: 'REFUND',
            metadata: { refundId: refund.id, amount: refund.amount, refundReference: refund.refundReference }
          }
        ).catch(err => console.error('Guardian refund notification error:', err.message));

        // Real Transactional Email (Event 8: Refund Successfully Processed)
        await transactionalEmailService.notifyRefundProcessed({
          refund: updatedRefund,
          session: payment.session,
          studentUser,
          gatewayRefund
        }).catch(err => console.error('[RazorpayRefundService] Processed email error:', err.message));
      } else {
        await notificationService.createNotification(
          studentUser.id,
          'REFUND',
          'Refund Initiated',
          `Your refund of ₹${refund.amount} has been initiated and is pending processing with the bank (Ref: ${refund.refundReference}).`,
          refund.id,
          'REFUND'
        ).catch(err => console.error('Refund notification error:', err.message));

        // Real Transactional Email (Event 7: Refund Approved / Initiated)
        await transactionalEmailService.notifyRefundInitiated({
          refund: updatedRefund,
          session: payment.session,
          studentUser,
          gatewayRefund
        }).catch(err => console.error('[RazorpayRefundService] Initiated email error:', err.message));
      }
    }

    return updatedRefund;
  } catch (gwErr) {
    const errorDescription = gwErr?.error?.description || gwErr.message || 'Razorpay refund API error';
    console.error('[RazorpayRefundService] Gateway refund execution failed:', {
      refundId: refund.id,
      amountInPaise,
      description: errorDescription,
      code: gwErr?.error?.code || gwErr.code
    });

    const failedRefund = await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: 'FAILED',
        failureReason: errorDescription,
        failedAt: new Date()
      }
    });

    // Notify student about failure
    const studentUser = payment.session?.mentorship?.student?.user;
    if (studentUser) {
      await notificationService.createNotification(
        studentUser.id,
        'REFUND',
        'Refund Processing Issue',
        `There was an issue processing your refund of ₹${refund.amount}. Our finance team has been notified.`,
        refund.id,
        'REFUND'
      ).catch(err => console.error('Refund failure notification error:', err.message));

      // Real Transactional Email (Event 9: Refund Failed)
      await transactionalEmailService.notifyRefundFailed({
        refund: failedRefund,
        session: payment.session,
        studentUser,
        failureReason: errorDescription
      }).catch(err => console.error('[RazorpayRefundService] Failed email error:', err.message));
    }

    return failedRefund;
  }
}

/**
 * Reconciles gateway status of a refund before retrying.
 * Checks if the refund was already created/processed on Razorpay.
 * @param {string} refundId
 * @returns {Promise<Object>} Reconciled refund
 */
async function reconcileAndRetryRefund(refundId) {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: { payment: true }
  });

  if (!refund) throw new Error('Refund not found.');
  if (refund.status === 'PROCESSED') return refund;

  let razorpay;
  try {
    razorpay = getRazorpayInstance();
  } catch (err) {
    throw err;
  }

  // 1. If we have a razorpayRefundId, check its current state directly
  if (refund.razorpayRefundId) {
    try {
      const gwRefund = await razorpay.refunds.fetch(refund.razorpayRefundId);
      if (gwRefund.status === 'processed') {
        const [updated] = await prisma.$transaction([
          prisma.refund.update({
            where: { id: refund.id },
            data: {
              status: 'PROCESSED',
              processedAt: new Date(),
              failureReason: null,
              gatewayResponse: gwRefund
            }
          }),
          prisma.payment.update({
            where: { id: refund.paymentId },
            data: { status: 'REFUNDED' }
          })
        ]);
        return updated;
      }
    } catch (fetchErr) {
      console.warn('[RazorpayRefundService] Could not fetch refund by ID:', fetchErr.message);
    }
  }

  // 2. Fetch all refunds on original payment to see if one matches our receipt
  if (refund.payment?.razorpayPaymentId) {
    try {
      const list = await razorpay.payments.fetchRefunds(refund.payment.razorpayPaymentId);
      const matched = list.items?.find(r =>
        r.receipt === refund.refundReference ||
        r.notes?.refund_reference === refund.refundReference
      );

      if (matched && matched.status === 'processed') {
        const [updated] = await prisma.$transaction([
          prisma.refund.update({
            where: { id: refund.id },
            data: {
              razorpayRefundId: matched.id,
              status: 'PROCESSED',
              processedAt: new Date(),
              failureReason: null,
              gatewayResponse: matched
            }
          }),
          prisma.payment.update({
            where: { id: refund.paymentId },
            data: { status: 'REFUNDED' }
          })
        ]);
        return updated;
      }
    } catch (listErr) {
      console.warn('[RazorpayRefundService] Could not list payment refunds:', listErr.message);
    }
  }

  // 3. If truly not processed, execute cleanly
  return await executeGatewayRefund(refundId);
}

/**
 * Verifies Razorpay webhook signature and processes refund webhooks.
 * @param {string} rawBody - Raw body string
 * @param {string} signature - x-razorpay-signature header
 * @param {Object} eventPayload - Parsed JSON body
 * @returns {Promise<Object>} Webhook processing result
 */
async function handleRazorpayWebhook(rawBody, signature, eventPayload) {
  const webhookSecret = cleanEnvVal(process.env.RAZORPAY_WEBHOOK_SECRET) || cleanEnvVal(process.env.RAZORPAY_KEY_SECRET);
  if (!webhookSecret) {
    throw new Error('Webhook secret is not configured.');
  }

  if (!signature) {
    const err = new Error('Missing webhook signature.');
    err.statusCode = 400;
    throw err;
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody || '')
    .digest('hex');

  if (expectedSignature !== signature) {
    const err = new Error('Invalid webhook signature.');
    err.statusCode = 400;
    throw err;
  }

  const eventName = eventPayload.event;

  // Handle payment webhooks (delayed verification or gateway-reported completion/failure)
  if (eventName === 'payment.captured' || eventName === 'order.paid') {
    const paymentEntity = eventPayload?.payload?.payment?.entity || eventPayload?.payload?.order?.entity;
    const rzpOrderId = paymentEntity?.order_id || (eventName === 'order.paid' ? paymentEntity?.id : null);
    const rzpPaymentId = paymentEntity?.id;

    if (!rzpOrderId) {
      return { status: 'ignored', message: 'No order ID in payment event payload' };
    }

    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: rzpOrderId },
      include: {
        session: {
          include: {
            mentorship: {
              include: {
                student: { include: { user: true } },
                mentor: { include: { user: true } }
              }
            }
          }
        }
      }
    });

    if (!payment) {
      return { status: 'ignored', message: 'No matching payment for order ID' };
    }

    if (payment.status === 'PAID') {
      return { status: 'success', message: 'Payment already marked PAID (idempotent)' };
    }

    const session = payment.session;
    if (session && session.status === 'CANCELLED') {
      const mentorId = session.mentorship?.mentorId;
      const conflict = mentorId ? await prisma.session.findFirst({
        where: {
          id: { not: session.id },
          mentorship: { mentorId },
          scheduledAt: session.scheduledAt,
          status: 'SCHEDULED'
        }
      }) : null;

      if (conflict) {
        // Slot is already taken; automatically execute 100% refund
        const refundRecord = await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              razorpayPaymentId: rzpPaymentId || payment.razorpayPaymentId,
              status: 'PAID',
              paidAt: new Date()
            }
          });
          return await tx.refund.create({
            data: {
              refundReference: `ref_${crypto.randomBytes(8).toString('hex')}`,
              paymentId: payment.id,
              sessionId: session.id,
              amount: payment.amount,
              policyTier: 'BOOKING_FAILURE_100',
              initiator: 'SYSTEM',
              reason: 'Automatic 100% refund: session slot rebooked before payment webhook arrived.',
              status: 'REQUESTED'
            }
          });
        });

        await executeGatewayRefund(refundRecord.id).catch(e => console.error('[Webhook] Auto-refund error:', e.message));
        return { status: 'success', message: 'Slot conflicted; 100% refund automatically initiated via webhook' };
      }
    }

    // Reinstate or confirm session as SCHEDULED and PAID
    const meetingLink = session?.meetingLink || `mentorconnect-session-${crypto.randomBytes(8).toString('hex')}`;
    const [updatedPayment, updatedSession] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPaymentId: rzpPaymentId || payment.razorpayPaymentId,
          status: 'PAID',
          paidAt: new Date()
        }
      }),
      prisma.session.update({
        where: { id: session.id },
        data: {
          status: 'SCHEDULED',
          meetingLink
        },
        include: {
          mentorship: {
            include: {
              mentor: { include: { user: true } },
              student: { include: { user: true } }
            }
          }
        }
      })
    ]);

    const studentUser = updatedSession.mentorship?.student?.user;
    const mentorUser = updatedSession.mentorship?.mentor?.user;

    const transactionalEmailService = require('./transactionalEmailService');
    await transactionalEmailService.notifyPaymentSuccess({
      payment: updatedPayment,
      session: updatedSession,
      studentUser,
      mentorUser
    }).catch(e => console.error('[Webhook] Payment success email error:', e.message));

    await transactionalEmailService.notifyMentorBookingConfirmed({
      session: updatedSession,
      studentUser,
      mentorUser,
      payment: updatedPayment
    }).catch(e => console.error('[Webhook] Mentor booking confirmed email error:', e.message));

    return { status: 'success', message: 'Payment confirmed and session scheduled via webhook' };
  }

  if (eventName === 'payment.failed') {
    const paymentEntity = eventPayload?.payload?.payment?.entity;
    const rzpOrderId = paymentEntity?.order_id;
    if (rzpOrderId) {
      const payment = await prisma.payment.findFirst({
        where: { razorpayOrderId: rzpOrderId },
        include: {
          session: {
            include: {
              mentorship: {
                include: {
                  student: { include: { user: true } }
                }
              }
            }
          }
        }
      });
      if (payment && payment.status !== 'PAID') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' }
        });
        const studentUser = payment.session?.mentorship?.student?.user;
        if (studentUser) {
          const transactionalEmailService = require('./transactionalEmailService');
          await transactionalEmailService.notifyPaymentFailed({
            session: payment.session,
            studentUser,
            reason: paymentEntity?.error_description || 'Payment was declined by issuing bank or gateway.',
            attemptedAmount: payment.amount
          }).catch(e => console.error(e));
        }
        return { status: 'success', message: 'Payment marked FAILED via webhook' };
      }
    }
    return { status: 'ignored', message: 'Payment already settled or order not found' };
  }

  const refundEntity = eventPayload?.payload?.refund?.entity;

  if (!refundEntity) {
    return { status: 'ignored', message: 'No refund entity in event payload' };
  }

  const razorpayRefundId = refundEntity.id;
  const receipt = refundEntity.receipt || refundEntity.notes?.refund_reference;

  // Find refund record with session and student details
  let refund = null;
  const includeQuery = {
    payment: {
      include: {
        session: {
          include: {
            mentorship: {
              include: {
                student: { include: { user: true } },
                mentor: { include: { user: true } }
              }
            }
          }
        }
      }
    }
  };

  if (receipt) {
    refund = await prisma.refund.findUnique({ where: { refundReference: receipt }, include: includeQuery });
  }
  if (!refund && razorpayRefundId) {
    refund = await prisma.refund.findUnique({ where: { razorpayRefundId }, include: includeQuery });
  }

  if (!refund) {
    return { status: 'ignored', message: 'No matching refund record in database' };
  }

  // Handle idempotent completion
  if (eventName === 'refund.processed') {
    if (refund.status === 'PROCESSED') {
      return { status: 'success', message: 'Already processed (idempotent)' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: 'PROCESSED',
          razorpayRefundId: razorpayRefundId || refund.razorpayRefundId,
          processedAt: new Date(),
          failureReason: null,
          gatewayResponse: refundEntity
        }
      });

      const allProcessed = await tx.refund.findMany({
        where: { paymentId: refund.paymentId, status: 'PROCESSED' }
      });
      const payment = await tx.payment.findUnique({ where: { id: refund.paymentId } });
      if (payment) {
        const totalPaise = allProcessed.reduce((acc, r) => acc + Math.round(r.amount * 100), 0);
        const origPaise = Math.round(payment.amount * 100);
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: totalPaise >= origPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED' }
        });
      }
    });

    // Real Transactional Email on Webhook Confirmed Processed (Event 8)
    const studentUser = refund.payment?.session?.mentorship?.student?.user;
    if (studentUser) {
      await transactionalEmailService.notifyRefundProcessed({
        refund,
        session: refund.payment?.session,
        studentUser,
        gatewayRefund: refundEntity
      }).catch(err => console.error('[Webhook] Refund processed email error:', err.message));
    }

    return { status: 'success', message: 'Refund marked PROCESSED via webhook' };
  }

  if (eventName === 'refund.failed') {
    if (refund.status === 'FAILED') {
      return { status: 'success', message: 'Already marked failed (idempotent)' };
    }

    await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: 'FAILED',
        failureReason: refundEntity.error_description || 'Gateway refund failure',
        failedAt: new Date(),
        gatewayResponse: refundEntity
      }
    });

    // Real Transactional Email on Webhook Confirmed Failed (Event 9)
    const studentUser = refund.payment?.session?.mentorship?.student?.user;
    if (studentUser) {
      await transactionalEmailService.notifyRefundFailed({
        refund,
        session: refund.payment?.session,
        studentUser,
        failureReason: refundEntity.error_description || 'Gateway refund failure'
      }).catch(err => console.error('[Webhook] Refund failed email error:', err.message));
    }

    return { status: 'success', message: 'Refund marked FAILED via webhook' };
  }

  return { status: 'ignored', message: `Unhandled event: ${eventName}` };
}

module.exports = {
  executeGatewayRefund,
  reconcileAndRetryRefund,
  handleRazorpayWebhook,
  getRazorpayInstance
};
