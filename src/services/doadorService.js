const db = require("../config/db");

/**
 * 
 * @param {number} idDoador
 * @returns {Object}
 */
async function obterDadosDoacoesConfirmadas(idDoador) {
    try {
        const [rows] = await db.execute(
            `SELECT 
                COUNT(*) AS totalDoacoes,
                MAX(data_doacao) AS ultimaDoacao
             FROM doacoes
             WHERE id_doador = (
                 SELECT id FROM doadores WHERE id_usuario = ?
             )`, [idDoador]
        );

        const resultado = rows[0];

        return {
            totalDoacoes: Number(resultado.totalDoacoes) || 0,
            ultimaDoacao: resultado.ultimaDoacao || null,
        };

    } catch (error) {
        console.error("ERRO AO BUSCAR DOAÇÕES DO DOADOR:", error);
        throw new Error("Erro ao buscar dados do doador");
    }
}

module.exports = {
    obterDadosDoacoesConfirmadas,
};