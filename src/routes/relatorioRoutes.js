const express = require("express");
const router = express.Router();
const relatorioController = require("../controllers/relatorioController");
const {
    authMiddleware,
    onlyHospitalStaff,
    authorize,
} = require("../middlewares/authMiddleware");

// Hospital — enviar snapshot ao INS
router.post(
    "/enviar",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN"),
    relatorioController.enviarAoINS
);

// Hospital — listar histórico de envios
router.get(
    "/hospital",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN"),
    relatorioController.listarRelatoriosHospital
);

// INS — ver todos os relatórios enviados por todos os hospitais
router.get(
    "/ins",
    authMiddleware,
    relatorioController.listarRelatoriosINS
);

// Detalhe de um relatório específico
router.get(
    "/:id",
    authMiddleware,
    relatorioController.detalheRelatorio
);

module.exports = router;