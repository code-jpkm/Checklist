import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: false,
  auth: { user: config.email.user, pass: config.email.pass }
});

export const sendTaskEmail = async (occurrence, user) => {
  const token = occurrence.submissionToken;
  const base = config.backendPublicUrl;

  const doneUrl = `${base}/public/email-submit?t=${token}&s=done`;
  const naUrl = `${base}/public/email-submit?t=${token}&s=na`;

  const html = `
    <p>Task: <b>${occurrence.template.title}</b></p>
    <p>Date: ${occurrence.date}, Deadline: ${occurrence.plannedTime}</p>
    <p>
      <a href="${doneUrl}">Mark DONE</a> |
      <a href="${naUrl}">Mark NOT APPLICABLE</a>
    </p>
  `;

  await transporter.sendMail({
    from: config.email.from,
    to: user.email,
    subject: `Today's task: ${occurrence.template.title}`,
    html
  });
};
