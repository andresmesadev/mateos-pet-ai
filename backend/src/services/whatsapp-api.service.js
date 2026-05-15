const axios = require("axios");

const GRAPH_API_VERSION = "v25.0";

const sendWhatsAppMessage = async (to, message) => {
  const phoneNumberId = String(
    process.env.WHATSAPP_PHONE_NUMBER_ID || ""
  ).trim();
  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim();

  if (!phoneNumberId || !accessToken) {
    console.error(
      "[WhatsApp API] Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN en .env"
    );
    return null;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: String(to),
    text: {
      body: message,
    },
  };

  console.log("[WhatsApp API] Enviando mensaje:", {
    url,
    to: payload.to,
    phoneNumberId,
    bodyPreview: message?.slice?.(0, 80) ?? message,
  });

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log(
      "[WhatsApp API] Mensaje enviado correctamente:",
      JSON.stringify(response.data, null, 2)
    );
    return response.data;
  } catch (error) {
    if (error.response?.data) {
      console.error(
        "[WhatsApp API] Error de Meta (response.data):",
        JSON.stringify(error.response.data, null, 2)
      );
      console.error(
        "[WhatsApp API] HTTP status:",
        error.response.status,
        error.response.statusText
      );
    } else {
      console.error("[WhatsApp API] Error de red o request:", error.message);
    }

    if (error.config) {
      console.error("[WhatsApp API] Request URL:", error.config.url);
    }

    return null;
  }
};

module.exports = {
  sendWhatsAppMessage,
};
