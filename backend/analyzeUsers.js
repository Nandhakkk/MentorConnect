const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyze() {
  const users = await prisma.user.findMany({
    include: {
      studentProfile: {
        include: {
          mentorships: true,
          goals: true,
        }
      },
      mentorProfile: {
        include: {
          mentorships: true,
          applications: true,
          peerApplications: true,
          payouts: true,
        }
      },
      sentMessages: { take: 1 },
      guardians: true,
      minors: true,
      complaintsSubmitted: true,
      complaintsReceived: true
    }
  });

  const analysis = users.map(u => {
    let hasData = false;
    let dataSummary = [];

    if (u.studentProfile) {
      if (u.studentProfile.mentorships.length > 0) dataSummary.push(`${u.studentProfile.mentorships.length} student mentorships`);
      if (u.studentProfile.goals.length > 0) dataSummary.push(`${u.studentProfile.goals.length} goals`);
    }

    if (u.mentorProfile) {
      if (u.mentorProfile.mentorships.length > 0) dataSummary.push(`${u.mentorProfile.mentorships.length} mentor mentorships`);
      if (u.mentorProfile.applications.length > 0) dataSummary.push(`${u.mentorProfile.applications.length} apps`);
      if (u.mentorProfile.peerApplications.length > 0) dataSummary.push(`${u.mentorProfile.peerApplications.length} peer apps`);
      if (u.mentorProfile.payouts.length > 0) dataSummary.push(`${u.mentorProfile.payouts.length} payouts`);
    }

    if (u.sentMessages.length > 0) dataSummary.push('has messages');
    if (u.guardians.length > 0) dataSummary.push(`${u.guardians.length} guardianships (as learner)`);
    if (u.minors.length > 0) dataSummary.push(`${u.minors.length} guardianships (as guardian)`);
    if (u.complaintsSubmitted.length > 0) dataSummary.push('submitted complaints');
    if (u.complaintsReceived.length > 0) dataSummary.push('received complaints');

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      data: dataSummary.join(', ') || 'No data',
      createdAt: u.createdAt
    };
  });

  console.table(analysis);
  await prisma.$disconnect();
}

analyze().catch(console.error);
