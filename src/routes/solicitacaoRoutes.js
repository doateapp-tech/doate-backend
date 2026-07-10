const express = require("express");
const router = express.Router();

const solicitacaoController = require("../controllers/solicitacaoController");
const { authMiddleware, authorize } = require("../middlewares/authMiddleware");

router.post(
    "/",
    solicitacaoController.criarSolicitacao
);

router.get(
    "/",
    authMiddleware,
    authorize("ADMIN"),
    solicitacaoController.listarSolicitacoes
);

router.get(
    "/:id",
    authMiddleware,
    authorize("ADMIN"),
    solicitacaoController.getSolicitacaoById
);

router.patch(
    "/:id/status",
    authMiddleware,
    authorize("ADMIN"),
    solicitacaoController.atualizarStatus
);

module.exports = router;