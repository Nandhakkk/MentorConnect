const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  const users = await prisma.user.findMany();

  const toDelete = [];
  const toRetain = [];

  for (const u of users) {
    // Match dummy emails like: admin_e616111b@test.com, student_73d0e310@test.com
    if (u.email.match(/_(?:[a-f0-9]{8})@test\.com$/)) {
      toDelete.push(u);
    } else {
      toRetain.push(u);
    }
  }

  console.log("=== USERS TO BE RETAINED ===");
  console.table(toRetain.map(u => ({ name: u.name, email: u.email, role: u.role })));

  console.log("\n=== USERS TO BE DELETED ===");
  console.table(toDelete.map(u => ({ name: u.name, email: u.email, role: u.role })));

  console.log("\nDeleting dummy users...");
  for (const u of toDelete) {
    await prisma.user.delete({ where: { id: u.id } });
  }

  console.log("Cleanup complete!");
  await prisma.$disconnect();
}

cleanup().catch(console.error);
