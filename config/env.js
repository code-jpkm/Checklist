// server/config/env.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve .env relative to this file (works no matter where node is started)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, '..', '.env'),
});

export const config = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  cutoffTime: process.env.CUTOFF_TIME || '18:30',
  webBaseUrl: process.env.WEB_BASE_URL || 'http://localhost:5173',
  backendPublicUrl: process.env.BACKEND_PUBLIC_URL || 'http://localhost:4000',

  maytapi: {
    productId: process.env.MAYTAPI_PRODUCT_ID,
    phoneId: process.env.MAYTAPI_PHONE_ID,
    apiKey: process.env.MAYTAPI_KEY,
  },

  email: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
  },

  sms: {
    enabled: process.env.SMS_ENABLED === 'true',
    providerUrl: process.env.SMS_PROVIDER_URL, // generic HTTP API
    apiKey: process.env.SMS_API_KEY,
    senderId: process.env.SMS_SENDER_ID,
  },
};

// tiny sanity log – comment out in production if you like
console.log('ENV loaded. WEB_BASE_URL =', config.webBaseUrl);
