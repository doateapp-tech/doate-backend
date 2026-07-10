const express = require("express");
const router = express.Router();

const conviteController = require("../controllers/conviteController");
const { authMiddleware, authorize, onlyHospitalStaff } = require("../middlewares/authMiddleware");

router.post(
    "/",
    authMiddleware,
    onlyHospitalStaff,
    authorize("ADMIN"),
    conviteController.criarConvite
);

router.get("/:token", conviteController.validarConvite);

router.post("/ativar", conviteController.ativarConta);

module.exports = router;