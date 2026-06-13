const express = require("express");
const {
  verifyWebhook,
  receiveWebhook,
} = require("../controllers/webhook.controller");
const validateWebhookSignature = require("../middleware/validateWebhookSignature");

const router = express.Router();

router.get("/", verifyWebhook);
router.post("/", validateWebhookSignature, receiveWebhook);

module.exports = router;
