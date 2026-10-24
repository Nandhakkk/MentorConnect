const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const txs = await prisma.payment.findMany({
    include: {
      student: { include: { user: { select: { name: true, email: true } } } },
      session: {
        include: { mentorship: { include: { mentor: { include: { user: { select: { name: true, email: true } } } } } } }
      },
      payout: true
    },
    take: 1
  });
  console.log(JSON.stringify(txs, null, 2));
}
main().finally(() => prisma.$disconnect());
