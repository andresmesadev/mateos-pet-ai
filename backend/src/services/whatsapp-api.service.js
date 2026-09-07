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

  // Fix post-auditoría de seguridad (2026-09-07, hallazgo F7): antes se
  // logueaba `bodyPreview` (texto del mensaje, incluye códigos de
  // verificación del Portal del Cliente) junto al teléfono destino —
  // cualquiera con acceso de lectura a los logs podía tomar un OTP vigente
  // y el número al que pertenece. Ya no se loguea el contenido del mensaje,
  // solo metadata operativa (longitud, no el texto).
  console.log("[WhatsApp API] Enviando mensaje:", {
    url,
    to: payload.to,
    phoneNumberId,
    bodyLength: typeof message === "string" ? message.length : null,
  });

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("[WhatsApp API] Mensaje enviado correctamente:", {
      messaging_product: response.data?.messaging_product,
      wamid: response.data?.messages?.[0]?.id ?? null,
    });
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
