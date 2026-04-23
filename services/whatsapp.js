// server/services/whatsapp.js
import { sendWhatsAppText } from './notify.js';

export const sendWhatsAppMessage = async (occurrence, user) => {
  if (!user?.whatsappNumber) {
    throw new Error(`User ${user?.email || user?._id || ''} has no WhatsApp number`);
  }

  const message = `Task: ${occurrence.template.title}
Date: ${occurrence.date}
Deadline: ${occurrence.plannedTime}

Reply like:
1 ${occurrence.submissionToken}  -> DONE
2 ${occurrence.submissionToken}  -> NOT APPLICABLE`;

  return sendWhatsAppText(user.whatsappNumber, message);
};