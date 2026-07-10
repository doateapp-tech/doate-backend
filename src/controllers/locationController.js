const db = require("../config/db");

async function saveLocation(req, res) {
    try {
        const userId = req.user.id;
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                message: "Latitude e longitude são obrigatórios",
            });
        }

        const [users] = await db.execute(
            "SELECT email_verificado, onboarding_completo, status FROM usuarios WHERE id = ?", [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const user = users[0];

        if (!user.email_verificado) {
            return res.status(403).json({
                message: "Email não verificado",
            });
        }

        if (user.status !== "ativo") {
            return res.status(403).json({
                message: "Usuário inativo",
            });
        }


        await db.execute(
            `
            INSERT INTO localizacoes_usuario (id_usuario, latitude, longitude)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                latitude = VALUES(latitude),
                longitude = VALUES(longitude),
                atualizado_em = CURRENT_TIMESTAMP
            `, [userId, latitude, longitude]
        );

        return res.json({
            message: "Localização salva com sucesso",
        });

    } catch (error) {
        console.error("SAVE LOCATION ERROR:", error);
        return res.status(500).json({
            message: "Erro ao salvar localização",
        });
    }
}

module.exports = {
    saveLocation,
};