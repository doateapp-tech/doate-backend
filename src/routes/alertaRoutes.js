const express = require("express");
const router = express.Router();

const alertaController = require("../controllers/alertaController");
const {
    authMiddleware,
    onlyHospitalStaff,
    authorize,
} = require("../middlewares/authMiddleware");

router.post(
    "/",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ESTOQUE"),
    alertaController.criarAlerta
);

router.get(
    "/doador",
    authMiddleware,
    authorize("DOADOR"),
    alertaController.listarAlertasDoador
);

module.exports = router;