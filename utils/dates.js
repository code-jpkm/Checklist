import { config } from '../config/env.js';
import { Holiday } from '../models/Holiday.js';
import crypto from 'crypto';

export const toDateString = (d) => d.toISOString().slice(0, 10);

export const isSunday = (d) => d.getDay() === 0;

// returns Set of 'YYYY-MM-DD'
export const getHolidaySet = async () => {
  const holidays = await Holiday.find({});
  return new Set(holidays.map((h) => h.date));
};

export const isWorkingDay = (d, holidaySet) => {
  const day = d.getDay();
  if (day === 0) return false;
  if (holidaySet && holidaySet.has(toDateString(d))) return false;
  return true;
};

// parse 'HH:mm' relative to date string (YYYY-MM-DD) in local TZ
export const getCutoffDateTime = (dateStr) => {
  // simple: treat as local time of server; for more advanced, use timezone libs
  const [h, m] = (config.cutoffTime || '18:30').split(':').map(Number);
  const d = new Date(`${dateStr}T${h.toString().padStart(2, '0')}:${m
    .toString()
    .padStart(2, '0')}:00`);
  return d;
};

export const makeSubmissionToken = () => crypto.randomBytes(16).toString('hex');

// recurrence check: should template occur on given date?
export const shouldGenerateOnDate = (template, date, holidaySet) => {
  if (!template.active) return false;
  const d = new Date(date);
  const todayStr = toDateString(d);
  if (todayStr < toDateString(template.startDate)) return false;
  if (!isWorkingDay(d, holidaySet)) return false;

  const freq = template.frequency;

  if (freq === 'D') {
    return true;
  }

  if (freq === 'W') {
    const dow = d.getDay(); // 0-6
    return template.dayOfWeek === dow;
  }

  if (freq === 'F') {
    // every 14 days from startDate, but only working days; approximate:
    const diffDays = Math.floor((d - template.startDate) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % 14 === 0;
  }

  if (freq === 'M') {
    // specified day of month or same as startDate
    const day = template.dayOfMonth || template.startDate.getDate();
    return d.getDate() === day;
  }

  if (freq === 'Q') {
    // every 3 months on same day as startDate
    const start = template.startDate;
    const months =
      (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
    const sameDay = d.getDate() === start.getDate();
    return months >= 0 && months % 3 === 0 && sameDay;
  }

  if (freq === 'Y') {
    const sameMonth = d.getMonth() === template.startDate.getMonth();
    const sameDay = d.getDate() === template.startDate.getDate();
    return sameMonth && sameDay;
  }

  // E1st..ELast
  if (freq.startsWith('E')) {
    const year = d.getFullYear();
    const month = d.getMonth();
    const workdays = [];
    let cursor = new Date(year, month, 1);
    while (cursor.getMonth() === month) {
      if (isWorkingDay(cursor, holidaySet)) {
        workdays.push(toDateString(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (!workdays.length) return false;

    let targetDateStr;
    if (freq === 'E1st') targetDateStr = workdays[0];
    if (freq === 'E2nd') targetDateStr = workdays[1];
    if (freq === 'E3rd') targetDateStr = workdays[2];
    if (freq === 'E4th') targetDateStr = workdays[3];
    if (freq === 'ELast') targetDateStr = workdays[workdays.length - 1];

    return todayStr === targetDateStr;
  }

  return false;
};
