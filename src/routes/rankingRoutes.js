const express = require("express");
const router = express.Router();
const rankingController = require("../controllers/rankingController");
const { authMiddleware } = require("../middlewares/authMiddleware");

router.get(
    "/semanal",
    authMiddleware,
    rankingController.rankingSemanal
);

module.exports = router;