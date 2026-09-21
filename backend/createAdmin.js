const prisma = require('./src/config/db');
const bcrypt = require('bcryptjs');

async function ensureAdmin() {
  let admin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
  if (!admin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    admin = await prisma.user.create({
      data: {
        name: 'System Admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'ADMIN'
      }
    });
    console.log('Created admin user: admin@example.com / admin123');
  } else {
    console.log('Admin user already exists.');
  }
}

ensureAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
