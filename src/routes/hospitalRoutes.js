const express = require("express");
const router = express.Router();

const hospitalController = require("../controllers/hospitalController");
const { authMiddleware, onlyHospitalStaff } = require("../middlewares/authMiddleware");

router.get(
    "/nearest",
    authMiddleware,
    hospitalController.getNearestHospital
);

router.get(
    "/meu",
    authMiddleware,
    onlyHospitalStaff,
    hospitalController.getMeuHospital
);

module.exports = router;