const db = require("../config/db");
const notificationService = require("./notificationService");

const compatibilidade = {
    "O-": ["O-"],
    "O+": ["O-", "O+"],
    "A-": ["O-", "A-"],
    "A+": ["O-", "O+", "A-", "A+"],
    "B-": ["O-", "B-"],
    "B+": ["O-", "O+", "B-", "B+"],
    "AB-": ["O-", "A-", "B-", "AB-"],
    "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
};

exports.criarAlerta = async({ hospital_id, tipo_sanguineo, mensagem }) => {
    const connection = await db.getConnection();

    if (!hospital_id) throw new Error("Hospital não identificado");

    try {
        await connection.beginTransaction();

        const tiposCompativeis = compatibilidade[tipo_sanguineo];
        if (!tiposCompativeis) throw new Error("Tipo sanguíneo inválido");

        // Busca dados do hospital (nome + coordenadas fixas)
        const [hospitalRows] = await connection.execute(
            `SELECT id, nome, provincia, municipio, latitude, longitude
             FROM hospitais WHERE id = ?`, [hospital_id]
        );

        if (hospitalRows.length === 0) throw new Error("Hospital não encontrado");
        const hospital = hospitalRows[0];

        const [result] = await connection.execute(
            `INSERT INTO alertas (hospital_id, tipo_sanguineo, mensagem, status)
             VALUES (?, ?, ?, 'ativo')`, [hospital_id, tipo_sanguineo, mensagem || null]
        );

        const alertaId = result.insertId;

        const placeholders = tiposCompativeis.map(() => "?").join(",");

        // Busca doadores compatíveis + coordenadas actuais (tabela localizacoes_usuario)
        const [doadores] = await connection.execute(
            `SELECT u.id, u.push_token,
                    l.latitude AS doador_lat,
                    l.longitude AS doador_lng
             FROM usuarios u
             JOIN doadores d ON d.id_usuario = u.id
             LEFT JOIN localizacoes_usuario l ON l.id_usuario = u.id
             WHERE u.tipo_usuario = 'DOADOR'
             AND u.status = 'ativo'
             AND d.tipo_sanguineo IN (${placeholders})
             AND d.conhece_tipo_sanguineo = 1
             AND u.push_token IS NOT NULL`,
            tiposCompativeis
        );

        if (doadores.length === 0) {
            await connection.commit();
            return {
                message: "Alerta criado, mas nenhum doador compatível encontrado",
                total_enviados: 0,
            };
        }

        const valoresEnvio = doadores.map((d) => [alertaId, d.id, "pendente"]);

        await connection.query(
            `INSERT INTO alerta_envios (alerta_id, usuario_id, status) VALUES ?`, [valoresEnvio]
        );

        try {
            await notificationService.enviarPushParaDoadores({
                doadores,
                tipo_sanguineo,
                mensagem,
                hospital, // passa dados completos do hospital
            });

            await connection.execute(
                `UPDATE alerta_envios
                 SET status = 'enviado', enviado_em = NOW()
                 WHERE alerta_id = ?`, [alertaId]
            );

        } catch (err) {
            console.error("Erro no envio de push:", err);
        }

        await connection.commit();

        return {
            message: "Alerta criado e enviado com sucesso",
            total_enviados: doadores.length,
        };

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};