// server/services/mailer.js
// Email sending has been disabled. This stub keeps the same
// function name so imports won't crash if used anywhere.

export const sendTaskEmail = async (occurrence, user) => {
  console.log(
    '[Email disabled] Would send task email for',
    occurrence?.template?.title,
    'to',
    user?.email
  );
  // intentionally do nothing – WhatsApp handles notifications now
};
