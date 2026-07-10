const express = require("express");
const router = express.Router();

const estoqueController = require("../controllers/estoqueController");
const {
    authMiddleware,
    onlyHospitalStaff,
    authorize,
} = require("../middlewares/authMiddleware");

router.get(
    "/",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN", "SECRETARIO", "ESTOQUE"),
    estoqueController.getEstoque
);

router.put(
    "/",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ESTOQUE"),
    estoqueController.atualizarEstoque
);
router.get(
    "/relatorio",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ESTOQUE", "ADMIN"),
    estoqueController.relatorioEstoque
);
module.exports = router;