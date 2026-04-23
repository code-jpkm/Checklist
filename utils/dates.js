// server/utils/dates.js
import crypto from 'crypto';
import { config } from '../config/env.js';
import { Holiday } from '../models/Holiday.js';

function getTzParts(date = new Date(), timeZone = config.timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekdayShort: map.weekday, // Sun, Mon, Tue...
  };
}

export const toDateString = (date = new Date(), timeZone = config.timezone) => {
  const { year, month, day } = getTzParts(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const getTodayDateString = () => toDateString(new Date(), config.timezone);

export const isSunday = (date, timeZone = config.timezone) => {
  return getTzParts(date, timeZone).weekdayShort === 'Sun';
};

export const getHolidaySet = async () => {
  const holidays = await Holiday.find({});
  return new Set(holidays.map((h) => h.date));
};

export const isWorkingDay = (date, holidaySet, timeZone = config.timezone) => {
  const dateStr = toDateString(date, timeZone);
  if (isSunday(date, timeZone)) return false;
  if (holidaySet && holidaySet.has(dateStr)) return false;
  return true;
};

export const makeSubmissionToken = () => crypto.randomBytes(16).toString('hex');

export const getCutoffDateTime = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = (config.cutoffTime || '18:30').split(':').map(Number);

  // creates server-local date object for same wall-clock timestamp
  return new Date(year, month - 1, day, hour, minute, 0, 0);
};

function startDateToDateString(startDate) {
  return toDateString(new Date(startDate), config.timezone);
}

function dayOfWeekIndexInAppTimezone(date) {
  const short = getTzParts(date, config.timezone).weekdayShort;
  const map = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[short];
}

function getDayOfMonthInAppTimezone(date) {
  return getTzParts(date, config.timezone).day;
}

function getMonthInAppTimezone(date) {
  return getTzParts(date, config.timezone).month - 1;
}

function getYearInAppTimezone(date) {
  return getTzParts(date, config.timezone).year;
}

export const shouldGenerateOnDate = (template, date, holidaySet) => {
  if (!template.active) return false;

  const d = new Date(date);
  const todayStr = toDateString(d, config.timezone);
  const templateStartStr = startDateToDateString(template.startDate);

  if (todayStr < templateStartStr) return false;
  if (!isWorkingDay(d, holidaySet, config.timezone)) return false;

  const freq = template.frequency;

  if (freq === 'D') {
    return true;
  }

  if (freq === 'W') {
    return template.dayOfWeek === dayOfWeekIndexInAppTimezone(d);
  }

  if (freq === 'F') {
    const start = new Date(template.startDate);
    const msDiff = new Date(todayStr).getTime() - new Date(templateStartStr).getTime();
    const diffDays = Math.floor(msDiff / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % 14 === 0;
  }

  if (freq === 'M') {
    const start = new Date(template.startDate);
    const targetDay = template.dayOfMonth || getDayOfMonthInAppTimezone(start);
    return getDayOfMonthInAppTimezone(d) === targetDay;
  }

  if (freq === 'Q') {
    const start = new Date(template.startDate);
    const startYear = getYearInAppTimezone(start);
    const startMonth = getMonthInAppTimezone(start);
    const startDay = getDayOfMonthInAppTimezone(start);

    const year = getYearInAppTimezone(d);
    const month = getMonthInAppTimezone(d);
    const day = getDayOfMonthInAppTimezone(d);

    const months = (year - startYear) * 12 + (month - startMonth);
    return months >= 0 && months % 3 === 0 && day === startDay;
  }

  if (freq === 'Y') {
    const start = new Date(template.startDate);
    return (
      getMonthInAppTimezone(d) === getMonthInAppTimezone(start) &&
      getDayOfMonthInAppTimezone(d) === getDayOfMonthInAppTimezone(start)
    );
  }

  if (freq.startsWith('E')) {
    const year = getYearInAppTimezone(d);
    const month = getMonthInAppTimezone(d);
    const workdays = [];

    let cursor = new Date(year, month, 1);

    while (cursor.getMonth() === month) {
      if (isWorkingDay(cursor, holidaySet, config.timezone)) {
        workdays.push(toDateString(cursor, config.timezone));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (!workdays.length) return false;

    let targetDateStr = null;
    if (freq === 'E1st') targetDateStr = workdays[0];
    if (freq === 'E2nd') targetDateStr = workdays[1];
    if (freq === 'E3rd') targetDateStr = workdays[2];
    if (freq === 'E4th') targetDateStr = workdays[3];
    if (freq === 'ELast') targetDateStr = workdays[workdays.length - 1];

    return todayStr === targetDateStr;
  }

  return false;
};