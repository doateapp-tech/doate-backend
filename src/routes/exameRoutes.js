const express = require("express");
const router = express.Router();

const exameController = require("../controllers/exameController");
const { authMiddleware, authorize, onlyHospitalStaff } = require("../middlewares/authMiddleware");

router.get(
    "/",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN", "SECRETARIO"),
    exameController.listarSolicitacoes
);

router.post(
    "/solicitar",
    authMiddleware,
    exameController.solicitarExame
);

router.post(
    "/validar-qr",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN", "SECRETARIO"),
    exameController.validarQR
);

router.post(
    "/confirmar",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN", "SECRETARIO"),
    exameController.confirmarExame
);

module.exports = router;