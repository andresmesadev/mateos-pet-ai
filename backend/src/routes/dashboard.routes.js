const express = require("express");
const router = express.Router();

router.use(require("./dashboard/tenant.routes"));
router.use(require("./dashboard/appointments.routes"));
router.use(require("./dashboard/pets.routes"));
router.use(require("./dashboard/clients.routes"));
router.use(require("./dashboard/services.routes"));
router.use(require("./dashboard/staff.routes"));
router.use(require("./dashboard/metrics.routes"));
router.use(require("./dashboard/transactions.routes"));
router.use(require("./dashboard/conversations.routes"));

module.exports = router;
