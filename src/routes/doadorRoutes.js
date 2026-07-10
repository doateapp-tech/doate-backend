const express = require("express");
const router = express.Router();

const doadorController = require("../controllers/doadorController");
const { authMiddleware, authorize, onlyHospitalStaff } = require("../middlewares/authMiddleware");

router.get(
    "/progresso",
    authMiddleware,
    authorize("DOADOR"),
    doadorController.getProgresso
);

router.get(
    "/hospital",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN", "SECRETARIO"),
    doadorController.listarDoadores
);
router.get(
    "/carteira",
    authMiddleware,
    authorize("DOADOR"),
    doadorController.obterCarteira
);
router.get("/perfil", authMiddleware, authorize("DOADOR"), doadorController.obterPerfil);
router.put("/perfil", authMiddleware, authorize("DOADOR"), doadorController.atualizarPerfil);
router.get("/exames", authMiddleware, authorize("DOADOR"), doadorController.listarExamesDoador);
router.get("/historico", authMiddleware, authorize("DOADOR"), doadorController.historicoCompleto);
module.exports = router;