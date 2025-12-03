// server/services/notify.js
// WhatsApp-only notifications (email completely disabled)

import axios from 'axios';
import { config } from '../config/env.js';

// ---------- SMS helper (optional fallback) ----------

async function sendSmsIfEnabled(phoneNumber, message) {
  if (
    !config.sms ||
    !config.sms.enabled ||
    !config.sms.providerUrl ||
    !config.sms.apiKey
  ) {
    return;
  }

  try {
    await axios.post(
      config.sms.providerUrl,
      {
        to: phoneNumber,
        message,
        senderId: config.sms.senderId || 'TASKBOT',
      },
      {
        headers: {
          Authorization: `Bearer ${config.sms.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('SMS sent to', phoneNumber);
  } catch (err) {
    console.error('SMS send failed:', err.message);
  }
}

// ---------- WhatsApp helper (Maytapi) ----------

async function sendWhatsAppIfPossible(phoneNumber, message) {
  if (
    !phoneNumber ||
    !config.maytapi ||
    !config.maytapi.productId ||
    !config.maytapi.phoneId ||
    !config.maytapi.apiKey
  ) {
    console.log('WhatsApp not configured or phone missing, skipping');
    return;
  }

  const url = `https://api.maytapi.com/api/${config.maytapi.productId}/${config.maytapi.phoneId}/sendMessage`;

  try {
    await axios.post(
      url,
      {
        to_number: phoneNumber,
        type: 'text',
        message,
      },
      {
        headers: {
          'x-maytapi-key': config.maytapi.apiKey,
        },
      }
    );
    console.log('WhatsApp sent to', phoneNumber);
  } catch (err) {
    console.error('WhatsApp send failed:', err.message);
    // optional: fallback to SMS
    await sendSmsIfEnabled(phoneNumber, message);
  }
}

// ---------- Branded templates (WhatsApp ONLY) ----------

// New user / welcome
export async function sendWelcomeMessage({
  email,
  name,
  password,
  whatsapp,
  role,
}) {
  const loginUrl = config.webBaseUrl;

  const waMessage = `
Task Checklist System

Your account has been created.

Login URL: ${loginUrl}
Email: ${email}
Temp Password: ${password}
Role: ${role}

Please login and change your password.
`.trim();

  if (whatsapp) {
    await sendWhatsAppIfPossible(whatsapp, waMessage);
  } else {
    console.log('[Welcome] No WhatsApp number, not sending anything');
  }
}

// Password reset OTP
export async function sendResetOtp({ email, name, otp, whatsapp }) {
  const waMessage = `
Task Checklist Password Reset

Hi ${name},

Your OTP to reset your Task Checklist password is: ${otp}
This code is valid for 10 minutes.

If you did not request this, you can ignore this message.
`.trim();

  if (whatsapp) {
    await sendWhatsAppIfPossible(whatsapp, waMessage);
  } else {
    console.log('[Reset OTP] No WhatsApp number, not sending anything');
  }
}
