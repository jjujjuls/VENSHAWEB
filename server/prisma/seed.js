import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedDatabase() {
  const levels = [
    {
      name: 'Classic',
      slug: 'classic',
      description: 'Entry membership tier',
      minConsultations: 0,
      benefits: 'Welcome consultation, member updates',
      colorTheme: '#F5F3F0',
      priority: 1,
      displayOrder: 1,
    },
    {
      name: 'Premium Gold',
      slug: 'premium-gold',
      description: 'Enhanced benefits after 5 consultations',
      minConsultations: 5,
      benefits: 'Priority booking, exclusive promotions',
      colorTheme: '#B89B5E',
      priority: 2,
      displayOrder: 2,
    },
    {
      name: 'Platinum',
      slug: 'platinum',
      description: 'Premium tier after 10 consultations',
      minConsultations: 10,
      benefits: 'Complimentary add-ons, VIP scheduling',
      colorTheme: '#8a8a8a',
      priority: 3,
      displayOrder: 3,
    },
    {
      name: 'Elite Diamond',
      slug: 'elite-diamond',
      description: 'Top tier after 20 consultations',
      minConsultations: 20,
      benefits: 'Exclusive rewards, concierge support',
      colorTheme: '#111111',
      priority: 4,
      displayOrder: 4,
    },
  ];

  for (const level of levels) {
    await prisma.membershipLevel.upsert({
      where: { slug: level.slug },
      update: level,
      create: level,
    });
  }

  const settings = [
    { key: 'contact_phone', value: '09921209631' },
    { key: 'contact_email', value: 'venshaskin@gmail.com' },
    {
      key: 'contact_address',
      value: 'Alabang-Zapote Road, Pamplona Tres, Las Piñas, 1747 Metro Manila',
    },
    { key: 'tagline', value: 'Sculpt. Strengthen. Radiate.' },
    { key: 'business_hours', value: 'Open Mon–Sat' },
    { key: 'site_coming_soon', value: 'false' },
  ];

  for (const setting of settings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const bcrypt = await import('bcryptjs');
    await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'VENSHA',
        lastName: 'Admin',
        role: 'ADMIN',
        emailVerified: true,
        passwordHash: await bcrypt.default.hash(adminPassword, 12),
      },
    });
    console.log(`Admin user created: ${adminEmail} / ${adminPassword}`);
  }

  console.log('Database seeded.');
}

if (process.argv[1]?.includes('seed.js')) {
  seedDatabase().finally(() => prisma.$disconnect());
}
