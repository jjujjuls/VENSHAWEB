import { PrismaClient } from '@prisma/client';
import { sendAppointmentReminderEmail } from './emailService.js';

const prisma = new PrismaClient();

const REMINDER_HOURS = Number(process.env.REMINDER_HOURS_BEFORE || 24);

export async function processAppointmentReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_HOURS * 60 * 60 * 1000);

  const upcoming = await prisma.appointment.findMany({
    where: {
      reminderSent: false,
      status: { in: ['CONFIRMED', 'RESCHEDULED', 'PENDING'] },
      scheduledAt: { gt: now, lte: windowEnd },
    },
    include: { user: true },
  });

  for (const appointment of upcoming) {
    try {
      await sendAppointmentReminderEmail(appointment, appointment.user);
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminderSent: true },
      });
      console.log(`[reminder] Sent reminder for appointment ${appointment.id}`);
    } catch (error) {
      console.error(`[reminder] Failed for appointment ${appointment.id}:`, error.message);
    }
  }

  return upcoming.length;
}
