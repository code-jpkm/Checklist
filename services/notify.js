// server/services/notify.js
import nodemailer from 'nodemailer';
import axios from 'axios';
import { config } from '../config/env.js';

// ---------- Email transporter ----------

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: false,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

// ---------- SMS helper (generic HTTP gateway) ----------

async function sendSmsIfEnabled(phoneNumber, message) {
  if (!config.sms.enabled || !config.sms.providerUrl || !config.sms.apiKey) return;

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
  if (!phoneNumber || !config.maytapi.productId || !config.maytapi.phoneId || !config.maytapi.apiKey) {
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
    // fallback to SMS if enabled
    await sendSmsIfEnabled(phoneNumber, message);
  }
}

// ---------- Branded templates ----------

export async function sendWelcomeMessage({ email, name, password, whatsapp, role }) {
  const loginUrl = config.webBaseUrl;

  const subject = 'Welcome to Task Checklist System';
  const text = `
Hi ${name},

Your account has been created in the Task Checklist System.

Login URL: ${loginUrl}
Email: ${email}
Temporary Password: ${password}
Role: ${role}

For security:
- Please login as soon as possible.
- Go to "Profile -> Change Password" and set a new strong password.

Regards,
Task Checklist Bot
  `.trim();

  const html = `
  <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; color:#0f172a;">
    <h2 style="color:#2563eb;">Welcome to Task Checklist System</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your account has been created.</p>
    <table style="border-collapse:collapse; margin-top:8px;">
      <tr><td style="padding:4px 8px;">Login URL:</td><td style="padding:4px 8px;"><a href="${loginUrl}">${loginUrl}</a></td></tr>
      <tr><td style="padding:4px 8px;">Email:</td><td style="padding:4px 8px;">${email}</td></tr>
      <tr><td style="padding:4px 8px;">Temporary Password:</td><td style="padding:4px 8px;"><strong>${password}</strong></td></tr>
      <tr><td style="padding:4px 8px;">Role:</td><td style="padding:4px 8px;">${role}</td></tr>
    </table>
    <p style="margin-top:12px;">
      For security, please login and change your password from the <strong>Profile → Change Password</strong> section.
    </p>
    <p style="margin-top:16px;">Regards,<br/>Task Checklist Bot</p>
  </div>
  `;

  await transporter.sendMail({
    from: config.email.from,
    to: email,
    subject,
    text,
    html,
  });

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
  }
}

export async function sendResetOtp({ email, name, otp, whatsapp }) {
  const subject = 'Your Task Checklist Password Reset OTP';
  const text = `
Hi ${name},

You requested to reset your Task Checklist password.

Your OTP is: ${otp}
This code is valid for 10 minutes.

If you did not request this, you can ignore this message.

Regards,
Task Checklist Bot
  `.trim();

  const html = `
  <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; color:#0f172a;">
    <h2 style="color:#2563eb;">Password Reset OTP</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your one-time password (OTP) to reset your Task Checklist password is:</p>
    <p style="font-size:20px; font-weight:700; letter-spacing:4px; margin:12px 0;">${otp}</p>
    <p>This code is valid for <strong>10 minutes</strong>.</p>
    <p>If you did not request a password reset, you can safely ignore this email.</p>
    <p style="margin-top:16px;">Regards,<br/>Task Checklist Bot</p>
  </div>
  `;

  await transporter.sendMail({
    from: config.email.from,
    to: email,
    subject,
    text,
    html,
  });

  const waMessage = `
Task Checklist Password Reset

OTP: ${otp}
Valid for 10 minutes.

If this wasn't you, ignore this message.
`.trim();

  if (whatsapp) {
    await sendWhatsAppIfPossible(whatsapp, waMessage);
  }
}
