const express = require("express");
const router = express.Router();

const controller = require("../controllers/hospitalStaffController");
const { authMiddleware, authorize, onlyHospitalStaff } = require("../middlewares/authMiddleware");

router.post(
    "/usuarios",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN"),
    controller.criarUsuario
);

router.get(
    "/exames",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN", "SECRETARIO"),
    controller.listarExames
);

router.get(
    "/estoque",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN", "ESTOQUE"),
    controller.verEstoque
);
router.get(
    "/usuarios",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN"),
    controller.listarUsuarios
);
router.delete(
    "/usuarios/:id",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN"),
    controller.removerUsuario
);
module.exports = router;