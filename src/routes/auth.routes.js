const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authMiddleware } = require("../middlewares/authMiddleware");

router.post("/register", authController.register);

router.post("/verify-email", authController.verifyEmail);

router.post("/resend-code", authController.resendCode);

router.post("/login", authController.login);

router.post(
    "/complete-onboarding",
    authMiddleware,
    authController.completeOnboarding
);



router.put(
    "/push-token",
    authMiddleware,
    authController.savePushToken
);


router.get(
    "/perfil",
    authMiddleware,
    authController.obterPerfil
);

router.put(
    "/perfil",
    authMiddleware,
    authController.actualizarPerfil
);

router.put(
    "/perfil/senha",
    authMiddleware,
    authController.alterarSenha
);
router.post("/recuperar-senha", authController.solicitarRecuperacaoSenha);
router.post("/redefinir-senha", authController.redefinirSenha);
module.exports = router;