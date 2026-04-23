// server/services/notify.js
import axios from 'axios';
import { config } from '../config/env.js';

function normalizeWhatsAppNumber(input) {
  if (!input) return null;

  let digits = String(input).replace(/[^\d]/g, '');

  // remove leading 00
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // if user saved only 10-digit Indian number, prefix 91
  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  return digits || null;
}

async function sendSmsIfEnabled(phoneNumber, message) {
  if (
    !config.sms ||
    !config.sms.enabled ||
    !config.sms.providerUrl ||
    !config.sms.apiKey
  ) {
    return;
  }

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
}

export async function sendWhatsAppText(rawPhoneNumber, message) {
  const phoneNumber = normalizeWhatsAppNumber(rawPhoneNumber);

  if (!phoneNumber) {
    throw new Error('WhatsApp number missing or invalid');
  }

  if (
    !config.maytapi ||
    !config.maytapi.productId ||
    !config.maytapi.phoneId ||
    !config.maytapi.apiKey
  ) {
    throw new Error('Maytapi configuration missing');
  }

  const url = `https://api.maytapi.com/api/${config.maytapi.productId}/${config.maytapi.phoneId}/sendMessage`;

  try {
    const response = await axios.post(
      url,
      {
        to_number: phoneNumber,
        type: 'text',
        message,
      },
      {
        headers: {
          'x-maytapi-key': config.maytapi.apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('WhatsApp sent to', phoneNumber);
    return response.data;
  } catch (err) {
    const maytapiError =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.response?.data ||
      err.message;

    console.error('WhatsApp send failed:', maytapiError);

    // optional fallback
    try {
      await sendSmsIfEnabled(phoneNumber, message);
    } catch (smsErr) {
      console.error('SMS fallback also failed:', smsErr.message);
    }

    throw new Error(
      typeof maytapiError === 'string'
        ? maytapiError
        : JSON.stringify(maytapiError)
    );
  }
}

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

  if (!whatsapp) {
    console.log('[Welcome] No WhatsApp number, skipping welcome message');
    return;
  }

  await sendWhatsAppText(whatsapp, waMessage);
}

export async function sendResetOtp({ email, name, otp, whatsapp }) {
  const waMessage = `
Task Checklist Password Reset

Hi ${name},

Your OTP to reset your Task Checklist password is: ${otp}
This code is valid for 10 minutes.

If you did not request this, you can ignore this message.
`.trim();

  if (!whatsapp) {
    throw new Error('User does not have a WhatsApp number');
  }

  await sendWhatsAppText(whatsapp, waMessage);
}