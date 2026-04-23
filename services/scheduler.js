// server/services/scheduler.js
import cron from 'node-cron';
import { config } from '../config/env.js';
import { TaskTemplate } from '../models/TaskTemplate.js';
import { TaskOccurrence } from '../models/TaskOccurrence.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import {
  getHolidaySet,
  shouldGenerateOnDate,
  getTodayDateString,
  makeSubmissionToken,
  getCutoffDateTime,
} from '../utils/dates.js';
import { sendWhatsAppMessage } from './whatsapp.js';

export const generateOccurrencesForToday = async () => {
  const today = new Date();
  const todayStr = getTodayDateString();
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

    try {
      await sendWhatsAppMessage(occurrence, template.doer);
    } catch (err) {
      console.error(
        `Failed to send task WhatsApp for template ${template._id}:`,
        err.message
      );
    }
  }
};

export const closeExpiredTasks = async () => {
  const todayStr = getTodayDateString();
  const cutoff = getCutoffDateTime(todayStr);
  const now = new Date();

  if (now < cutoff) return;

  await TaskOccurrence.updateMany(
    { date: todayStr, status: 'PENDING' },
    { status: 'MISSED' }
  );
};

export const cleanupResetTokens = async () => {
  const now = new Date();

  await PasswordResetToken.deleteMany({
    used: true,
    updatedAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
  });

  await PasswordResetToken.updateMany(
    { used: false, expiresAt: { $lt: now } },
    { used: true }
  );
};

export const runStartupJobs = async () => {
  console.log('Startup: generating today occurrences');
  await generateOccurrencesForToday();

  console.log('Startup: closing expired tasks if needed');
  await closeExpiredTasks();

  console.log('Startup: cleaning reset tokens');
  await cleanupResetTokens();
};

export const initCronJobs = () => {
  cron.schedule(
    '0 1 * * *',
    async () => {
      console.log('Cron: generate occurrences');
      await generateOccurrencesForToday();
    },
    { timezone: config.timezone }
  );

  cron.schedule(
    '30 18 * * *',
    async () => {
      console.log('Cron: close expired tasks');
      await closeExpiredTasks();
    },
    { timezone: config.timezone }
  );

  cron.schedule(
    '0 * * * *',
    async () => {
      console.log('Cron: cleanup reset tokens');
      await cleanupResetTokens();
    },
    { timezone: config.timezone }
  );
};