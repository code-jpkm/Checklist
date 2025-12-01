import axios from 'axios';
import { config } from '../config/env.js';

export const sendWhatsAppMessage = async (occurrence, user) => {
  if (!user.whatsappNumber) return;
  const { productId, phoneId, apiKey } = config.maytapi;
  const url = `https://api.maytapi.com/api/${productId}/${phoneId}/sendMessage`;

  const message = `Task: ${occurrence.template.title}
Date: ${occurrence.date}
Deadline: ${occurrence.plannedTime}

Reply like:
1 ${occurrence.submissionToken}  -> DONE
2 ${occurrence.submissionToken}  -> NOT APPLICABLE`;

  await axios.post(
    url,
    {
      to_number: user.whatsappNumber,
      type: 'text',
      message
    },
    { headers: { 'x-maytapi-key': apiKey } }
  );
};
