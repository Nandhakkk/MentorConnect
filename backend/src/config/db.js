const { PrismaClient } = require('@prisma/client');

// Prisma Client instance
// Global instance pattern to prevent exhausting connection pool in development
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

module.exports = prisma;
