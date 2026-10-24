const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const creds = await prisma.credential.findMany({ include: { application: true } });
  console.log('--- CREDENTIALS ---');
  console.log(JSON.stringify(creds, null, 2));

  const fileAssets = await prisma.fileAsset.findMany();
  console.log('--- FILE ASSETS ---');
  console.log(JSON.stringify(fileAssets, null, 2));
}

main().finally(() => prisma.$disconnect());
