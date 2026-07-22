import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedDatabase() {
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

  const emailTemplates = [
    { slug: 'booking', name: 'Booking', subject: 'Your Appointment — VENSHA SKIN', bodyHtml: 'We look forward to welcoming you. Here are your appointment details.' },
    { slug: 'reminder', name: 'Reminder', subject: 'Appointment Reminder — VENSHA SKIN', bodyHtml: 'This is a gentle reminder about your upcoming visit with us.' },
    { slug: 'promotion', name: 'Promotion', subject: 'Exclusive Offer — VENSHA SKIN', bodyHtml: 'As a valued member of the VENSHA family, we have something special to share.' },
    { slug: 'newsletter', name: 'Newsletter', subject: 'VENSHA SKIN Newsletter', bodyHtml: 'The latest news, treatments, and wellness insights from our team.' },
    { slug: 'membership', name: 'Membership', subject: 'Membership Update — VENSHA SKIN', bodyHtml: 'Here is the latest on your VENSHA SKIN membership journey.' },
    { slug: 'rewards', name: 'Rewards', subject: 'Reward Unlocked — VENSHA SKIN', bodyHtml: 'Thank you for your continued trust. A luxury reward awaits you.' },
    { slug: 'general-reply', name: 'General Reply', subject: 'Message from VENSHA SKIN', bodyHtml: 'Thank you for reaching out — your message is important to us.' },
  ];

  for (const tpl of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { slug: tpl.slug },
      update: { name: tpl.name, subject: tpl.subject, bodyHtml: tpl.bodyHtml },
      create: tpl,
    });
  }

  /* ─── Seed FAQs ─── */
  const faqs = [
    { question: 'What is Megashape Pro?', answer: 'A multi-technology body contouring system combining vacuum roller, cavitation, RF, and infrared light for sculpting and skin improvement.', displayOrder: 1 },
    { question: 'Is it suitable for everyone?', answer: 'No. Suitability is determined during consultation based on health history, goals, and treatment expectations.', displayOrder: 2 },
    { question: 'What should I expect from treatment?', answer: 'A guided, professional experience with clear communication, realistic outcomes, and aftercare support. No downtime required.', displayOrder: 3 },
    { question: 'How many sessions are recommended?', answer: 'Typically 6–12 sessions depending on your goals. Your consultant will create a personalized treatment plan.', displayOrder: 4 },
    { question: 'Is there any downtime?', answer: 'No downtime is required. Most clients resume normal activities immediately after treatment.', displayOrder: 5 },
  ];
  for (const faq of faqs) {
    await prisma.faq.upsert({ where: { id: faq.question }, update: faq, create: { id: undefined, ...faq } }).catch(() =>
      prisma.faq.create({ data: faq })
    );
  }

  /* ─── Seed Testimonials ─── */
  const testimonials = [
    { author: 'Maria C.', quote: 'The results exceeded my expectations. After just 4 sessions, I noticed a remarkable difference in my skin texture and contour.', displayOrder: 1, featured: true },
    { author: 'Angela R.', quote: 'Professional, caring, and truly effective. The VENSHA team made me feel comfortable throughout my entire journey.', displayOrder: 2, featured: true },
    { author: 'Liza M.', quote: 'I was hesitant at first, but the consultation was thorough and honest. Now I am a believer — the transformation speaks for itself.', displayOrder: 3, featured: false },
  ];
  for (const t of testimonials) {
    await prisma.testimonial.create({ data: t }).catch(() => {});
  }

  /* ─── Seed Gallery ─── */
  const gallery = [
    { title: 'Clinic Reception', imageUrl: '/assets/images/export/placeholder.jpg', caption: 'Our welcoming reception area', category: 'Clinic', displayOrder: 1 },
    { title: 'Treatment Room', imageUrl: '/assets/images/export/placeholder.jpg', caption: 'State-of-the-art treatment room', category: 'Clinic', displayOrder: 2 },
    { title: 'Megashape Pro Device', imageUrl: '/assets/images/export/placeholder.jpg', caption: 'The Megashape Pro system', category: 'Equipment', displayOrder: 3 },
  ];
  for (const g of gallery) {
    await prisma.galleryItem.create({ data: g }).catch(() => {});
  }

  /* ─── Seed Research ─── */
  const research = [
    { title: 'Efficacy of Multi-Polar RF in Body Contouring', summary: 'Clinical study demonstrating significant circumference reduction using multi-polar radio frequency technology.', content: 'Multi-polar RF technology has shown remarkable results in non-invasive body contouring. Studies indicate an average circumference reduction of 3-5cm after 4-6 treatments. The technology works by heating deep dermal layers to stimulate collagen production while simultaneously promoting fat metabolism.', category: 'Clinical Study', author: 'Dr. Sarah Chen', source: 'Journal of Aesthetic Dermatology', displayOrder: 1 },
    { title: 'Understanding Cellulite Reduction Physics', summary: 'How cavitation and vacuum roller technologies work together to reduce the appearance of cellulite.', content: 'Cellulite reduction requires a multi-faceted approach. Cavitation uses low-frequency ultrasound waves to disrupt fat cell membranes, while vacuum roller technology mobilizes tissues and enhances lymphatic drainage. Combined, these technologies achieve up to 85% reduction in cellulite appearance across a full treatment course.', category: 'Educational', displayOrder: 2 },
    { title: 'Safety Profile of Non-Invasive Body Contouring', summary: 'Comprehensive review of safety data across 500+ treatment sessions.', content: 'Non-invasive body contouring technologies have established an excellent safety profile. In a review of 500+ treatment sessions, adverse events were limited to mild, transient redness or warmth at the treatment site. No serious adverse events were reported. The 43°C temperature alarm system provides an additional safety layer.', category: 'Safety', displayOrder: 3 },
  ];
  for (const r of research) {
    await prisma.research.create({ data: r }).catch(() => {});
  }

  /* ─── Seed Website Content ─── */
  const websiteContent = [
    { key: 'hero_title', section: 'hero', value: 'Beautiful figure.<br />Timeless elegance.', type: 'text' },
    { key: 'hero_subtitle', section: 'hero', value: 'Your curves—eternalized by Megashape Pro. A revolutionary cellulite treatment that is safe, effective, and requires no downtime.', type: 'text' },
    { key: 'hero_tagline', section: 'hero', value: 'Sculpt · Strengthen · Radiate', type: 'text' },
    { key: 'about_title', section: 'about', value: 'A refined approach to medical aesthetics', type: 'text' },
    { key: 'about_description', section: 'about', value: 'Premium care, thoughtful education, and calm professionalism—guiding clients with clarity toward informed treatment decisions.', type: 'text' },
    { key: 'contact_phone', section: 'contact', value: '09921209631', type: 'text' },
    { key: 'contact_email', section: 'contact', value: 'venshaskin@gmail.com', type: 'text' },
    { key: 'contact_address', section: 'contact', value: 'Alabang-Zapote Road, Pamplona Tres, Las Piñas, 1747 Metro Manila', type: 'text' },
    { key: 'contact_hours', section: 'contact', value: 'Open Mon–Sat', type: 'text' },
    { key: 'social_instagram', section: 'social', value: 'venshaskin', type: 'text' },
    { key: 'social_facebook', section: 'social', value: 'VENSHASKIN', type: 'text' },
    { key: 'social_whatsapp', section: 'social', value: '09921209631', type: 'text' },
    { key: 'footer_tagline', section: 'footer', value: 'Sculpt · Strengthen · Radiate', type: 'text' },
  ];
  for (const c of websiteContent) {
    await prisma.websiteContent.upsert({
      where: { key: c.key },
      update: { value: c.value, section: c.section, type: c.type },
      create: c,
    });
  }

  console.log('Database seeded.');
}

if (process.argv[1]?.includes('seed.js')) {
  seedDatabase().finally(() => prisma.$disconnect());
}
