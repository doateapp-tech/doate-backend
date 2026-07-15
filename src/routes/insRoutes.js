const express = require("express");
const router = express.Router();
const db = require("../config/db");
const insController = require("../controllers/insController");
const { authMiddleware, authorize } = require("../middlewares/authMiddleware");

// GET todos os hospitais
router.get("/hospitais", authMiddleware, authorize("INS_ADMIN"), async(req, res) => {
    const [rows] = await db.execute(`SELECT id, nome, nif, provincia, municipio, ativo FROM hospitais ORDER BY nome`);
    return res.json({ data: rows });
});

// GET estoque de todos os hospitais
router.get("/estoque", authMiddleware, authorize("INS_ADMIN"), async(req, res) => {
    const [rows] = await db.execute(`
    SELECT h.nome AS hospital_nome, es.tipo_sanguineo, es.quantidade
    FROM estoque_sangue es
    JOIN hospitais h ON h.id = es.hospital_id
    ORDER BY h.nome, es.tipo_sanguineo
  `);
    return res.json({ data: rows });
});
router.get(
    "/dashboard",
    authMiddleware,
    authorize("INS_ADMIN"),
    insController.dashboardOverview
);
router.get("/estoque-ins", authMiddleware, authorize("INS_ADMIN"), async(req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT tipo_sanguineo, quantidade
            FROM estoque_sangue
            WHERE hospital_id = 20
            ORDER BY FIELD(tipo_sanguineo, 'A+','A-','B+','B-','AB+','AB-','O+','O-')
        `);
        return res.json({ data: rows });
    } catch (error) {
        console.error("Erro ao buscar estoque INS:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
});

module.exports = router;