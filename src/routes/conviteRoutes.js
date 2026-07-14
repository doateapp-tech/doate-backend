const express = require("express");
const router = express.Router();

const conviteController = require("../controllers/conviteController");
const { authMiddleware, authorize, onlyHospitalStaff, onlySystemAdmin } = require("../middlewares/authMiddleware");

router.post(
    "/",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN", "INS_ADMIN"),
    conviteController.criarConvite
);

router.get("/:token", conviteController.validarConvite);

router.post("/ativar", conviteController.ativarConta);
router.get("/link/:hospital_id", authMiddleware, onlySystemAdmin, conviteController.getLinkConvite);

module.exports = router;