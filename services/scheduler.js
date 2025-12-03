// server/services/scheduler.js
import cron from 'node-cron';
import { TaskTemplate } from '../models/TaskTemplate.js';
import { TaskOccurrence } from '../models/TaskOccurrence.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import {
  getHolidaySet,
  shouldGenerateOnDate,
  toDateString,
  makeSubmissionToken,
  getCutoffDateTime,
} from '../utils/dates.js';
// ❌ removed: import { sendTaskEmail } from './mailer.js';
import { sendWhatsAppMessage } from './whatsapp.js';

// Generate today's task occurrences and send notifications
export const generateOccurrencesForToday = async () => {
  const today = new Date();
  const todayStr = toDateString(today);
  const holidaySet = await getHolidaySet();

  const templates = await TaskTemplate.find({ active: true }).populate('doer');
  for (const template of templates) {
    if (!shouldGenerateOnDate(template, today, holidaySet)) continue;

    const existing = await TaskOccurrence.findOne({
      template: template._id,
      date: todayStr,
    });
    if (existing) continue;

    const occurrence = await TaskOccurrence.create({
      template: template._id,
      doer: template.doer._id,
      date: todayStr,
      plannedTime: template.timeDue || '18:30',
      submissionToken: makeSubmissionToken(),
    });

    await occurrence.populate('template doer');

    // ❌ no email
    // await sendTaskEmail(occurrence, template.doer);

    // ✅ WhatsApp only
    await sendWhatsAppMessage(occurrence, template.doer);
  }
};

// Close tasks which passed cutoff time
export const closeExpiredTasks = async () => {
  const today = new Date();
  const todayStr = toDateString(today);
  const cutoff = getCutoffDateTime(todayStr);
  const now = new Date();

  if (now < cutoff) return;

  await TaskOccurrence.updateMany(
    { date: todayStr, status: 'PENDING' },
    { status: 'MISSED' }
  );
};

// cleanup: mark very old or expired PasswordResetTokens as used and delete extras
export const cleanupResetTokens = async () => {
  const now = new Date();
  // Remove used tokens older than 1 day (TTL index also handles)
  await PasswordResetToken.deleteMany({
    used: true,
    updatedAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
  });

  // Ensure tokens that are expired are marked as used
  await PasswordResetToken.updateMany(
    { used: false, expiresAt: { $lt: now } },
    { used: true }
  );
};

export const initCronJobs = () => {
  // 1:00 AM every day – generate tasks
  cron.schedule('0 1 * * *', async () => {
    console.log('Cron: generate occurrences');
    await generateOccurrencesForToday();
  });

  // 6:30 PM every day – close tasks
  cron.schedule('30 18 * * *', async () => {
    console.log('Cron: close expired tasks');
    await closeExpiredTasks();
  });

  // Every hour – cleanup reset tokens
  cron.schedule('0 * * * *', async () => {
    console.log('Cron: cleanup reset tokens');
    await cleanupResetTokens();
  });
};
