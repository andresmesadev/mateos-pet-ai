const express = require("express");
const { triggerError } = require("../controllers/error.controller");

const router = express.Router();

router.get("/", triggerError);

module.exports = router;
