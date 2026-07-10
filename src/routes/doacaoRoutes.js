const express = require("express");
const router = express.Router();

const doacaoController = require("../controllers/doacaoController");
const {
    authMiddleware,
    authorize,
    onlyHospitalStaff,
} = require("../middlewares/authMiddleware");

router.post(
    "/solicitar",
    authMiddleware,
    authorize("DOADOR"),
    doacaoController.solicitarDoacao
);

router.post(
    "/validar-qr",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN", "SECRETARIO"),
    doacaoController.validarQR
);

router.post(
    "/confirmar",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN", "SECRETARIO"),
    doacaoController.confirmarDoacao
);
router.get(
    "/",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN", "SECRETARIO"),
    doacaoController.listarSolicitacoes
);
router.get(
    "/estatisticas",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN", "SECRETARIO", "ESTOQUE"),
    doacaoController.estatisticasDoacoes
);
router.get(
    "/relatorio",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN"),
    doacaoController.relatorioCompleto
);
module.exports = router;