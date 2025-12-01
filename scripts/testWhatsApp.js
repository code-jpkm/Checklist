import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Resolve path to ../.env relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

console.log("Loaded ENV →", {
  product: process.env.MAYTAPI_PRODUCT_ID,
  phone: process.env.MAYTAPI_PHONE_ID,
  key: process.env.MAYTAPI_KEY ? "✔ Exists" : "❌ Missing",
});

async function testWhatsApp() {
  const {
    MAYTAPI_PRODUCT_ID,
    MAYTAPI_PHONE_ID,
    MAYTAPI_KEY
  } = process.env;

  if (!MAYTAPI_PRODUCT_ID || !MAYTAPI_PHONE_ID || !MAYTAPI_KEY) {
    console.error("❌ Missing Maytapi credentials in .env");
    return;
  }

  const phoneNumber = "917047437018"; // <-- put your WhatsApp number here

  const url = `https://api.maytapi.com/api/${MAYTAPI_PRODUCT_ID}/${MAYTAPI_PHONE_ID}/sendMessage`;

  try {
    console.log("📨 Sending WhatsApp message...");

    const response = await axios.post(
      url,
      {
        to_number: phoneNumber,
        type: "text",
        message: "Hello from Checklist WhatsApp Integration Test! 🚀"
      },
      {
        headers: {
          "x-maytapi-key": MAYTAPI_KEY
        }
      }
    );

    console.log("✅ WhatsApp message sent!");
    console.log(response.data);
  } catch (error) {
    console.error("❌ WhatsApp send failed");
    console.error(error.response?.data || error.message);
  }
}

testWhatsApp();
