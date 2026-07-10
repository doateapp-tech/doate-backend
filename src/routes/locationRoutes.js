const express = require("express");
const router = express.Router();
const locationController = require("../controllers/locationController");
const { authMiddleware } = require("../middlewares/authMiddleware");

router.post("/save", authMiddleware, locationController.saveLocation);


module.exports = router;