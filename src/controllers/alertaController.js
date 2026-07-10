const alertaService = require("../services/alertaService");
const db = require("../config/db");

exports.criarAlerta = async(req, res) => {
    try {
        const { tipo_sanguineo, mensagem } = req.body;
        const hospital_id = req.user.hospital_id;

        if (!tipo_sanguineo) {
            return res.status(400).json({
                message: "Tipo sanguíneo é obrigatório",
            });
        }

        const result = await alertaService.criarAlerta({
            hospital_id,
            tipo_sanguineo,
            mensagem,
        });

        return res.status(201).json(result);

    } catch (error) {
        console.error("Erro ao criar alerta:", error);

        return res.status(400).json({
            message: error.message || "Erro ao criar alerta",
        });
    }
};
exports.listarAlertasDoador = async(req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Usuário não autenticado." });
        }

        const usuario_id = req.user.id;

        // Busca tipo sanguíneo do doador
        const [doadorRows] = await db.execute(
            `SELECT tipo_sanguineo, conhece_tipo_sanguineo
             FROM doadores
             WHERE id_usuario = ?`, [usuario_id]
        );

        if (doadorRows.length === 0) {
            return res.status(404).json({ message: "Perfil de doador não encontrado." });
        }

        const doador = doadorRows[0];

        if (!doador.conhece_tipo_sanguineo || !doador.tipo_sanguineo) {
            return res.status(200).json({
                data: [],
                message: "Tipo sanguíneo não confirmado. Faça um exame primeiro."
            });
        }

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

        const tiposCompativeis = compatibilidade[doador.tipo_sanguineo];

        if (!tiposCompativeis) {
            return res.status(400).json({ message: "Tipo sanguíneo inválido." });
        }

        const placeholders = tiposCompativeis.map(() => "?").join(",");

        const [alertas] = await db.execute(
            `SELECT 
        a.id,
        a.hospital_id,
        a.tipo_sanguineo,
        a.mensagem,
        a.criado_em,
        h.nome AS hospital_nome,
        h.municipio AS hospital_municipio,
        h.provincia AS hospital_provincia,
        h.latitude AS hospital_latitude,
        h.longitude AS hospital_longitude
     FROM alertas a
     JOIN hospitais h ON h.id = a.hospital_id
     WHERE a.tipo_sanguineo IN (${placeholders})
     AND a.status = 'ativo'
     ORDER BY a.criado_em DESC
     LIMIT 20`,
            tiposCompativeis
        );

        return res.status(200).json({
            tipo_sanguineo: doador.tipo_sanguineo,
            data: alertas,
        });

    } catch (error) {
        console.error("Erro ao listar alertas do doador:", error);
        return res.status(500).json({ message: "Erro interno ao listar alertas." });
    }
};