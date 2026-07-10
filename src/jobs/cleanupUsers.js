const db = require("../config/db");

exports.cleanupIncompleteUsers = async() => {
    try {
        const [result] = await db.execute(`
            DELETE FROM usuarios
            WHERE onboarding_completo = false
            AND criado_em < NOW() - INTERVAL 1 DAY
        `);

        if (result.affectedRows > 0) {
            console.log(`🧹 ${result.affectedRows} usuários incompletos removidos.`);
        }
    } catch (error) {
        console.error("Erro ao limpar usuários incompletos:", error);
    }
};