import { processAppointmentReminders } from '../../server/src/services/reminderService.js';

export default async function handler(req, res) {
  /* Only allow Vercel Cron or requests with the secret */
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const count = await processAppointmentReminders();
    res.status(200).json({ ok: true, remindersProcessed: count });
  } catch (error) {
    console.error('[cron] Reminder error:', error);
    res.status(500).json({ error: 'Reminder processing failed' });
  }
}
