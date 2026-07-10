const express = require("express");
const router = express.Router();

const adminHospitalController = require("../controllers/adminHospitalController");
const { authMiddleware, authorize } = require("../middlewares/authMiddleware");

// ADMIN GLOBAL 
router.get(
    "/",
    authMiddleware,
    authorize("ADMIN"),
    adminHospitalController.listarHospitais
);

router.get(
    "/:id",
    authMiddleware,
    authorize("ADMIN"),
    adminHospitalController.getHospitalById
);

router.patch(
    "/:id",
    authMiddleware,
    authorize("ADMIN"),
    adminHospitalController.atualizarHospital
);

router.delete(
    "/:id",
    authMiddleware,
    authorize("ADMIN"),
    adminHospitalController.desativarHospital
);

module.exports = router;