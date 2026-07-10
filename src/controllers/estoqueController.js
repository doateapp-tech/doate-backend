const db = require("../config/db");

const TIPOS_SANGUINEOS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

exports.getEstoque = async(req, res) => {
    try {
        const hospital_id = req.user.hospital_id;

        if (!hospital_id) {
            return res.status(403).json({ message: "Hospital não identificado" });
        }

        const [rows] = await db.execute(
            `SELECT tipo_sanguineo, quantidade, atualizado_em
             FROM estoque_sangue
             WHERE hospital_id = ?`, [hospital_id]
        );

        const estoqueMap = new Map(rows.map(r => [r.tipo_sanguineo, r]));

        const data = TIPOS_SANGUINEOS.map(tipo => {
            const item = estoqueMap.get(tipo);
            return {
                tipo,
                quantidade: item ? item.quantidade : 0,
                atualizado_em: item ? item.atualizado_em : null,
            };
        });

        return res.status(200).json({ data });

    } catch (error) {
        console.error("Erro ao buscar estoque:", error);
        return res.status(500).json({ message: "Erro interno ao buscar estoque" });
    }
};

exports.atualizarEstoque = async(req, res) => {
    try {
        const hospital_id = req.user.hospital_id;
        const { tipo_sanguineo, quantidade } = req.body;

        if (!tipo_sanguineo || quantidade === undefined) {
            return res.status(400).json({ message: "tipo_sanguineo e quantidade são obrigatórios" });
        }

        if (!TIPOS_SANGUINEOS.includes(tipo_sanguineo)) {
            return res.status(400).json({ message: "Tipo sanguíneo inválido" });
        }

        if (quantidade < 0) {
            return res.status(400).json({ message: "Quantidade não pode ser negativa" });
        }

        await db.execute(
            `INSERT INTO estoque_sangue (hospital_id, tipo_sanguineo, quantidade, atualizado_em)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE quantidade = ?, atualizado_em = NOW()`, [hospital_id, tipo_sanguineo, quantidade, quantidade]
        );

        return res.status(200).json({ message: "Estoque actualizado com sucesso" });

    } catch (error) {
        console.error("Erro ao actualizar estoque:", error);
        return res.status(500).json({ message: "Erro interno ao actualizar estoque" });
    }
};
exports.relatorioEstoque = async(req, res) => {
    try {
        if (!req.user || !req.user.id) return res.status(401).json({ message: "Não autenticado." });

        let hospital_id = req.user.hospital_id;
        if (!hospital_id) {
            const [h] = await db.execute(
                `SELECT id FROM hospitais WHERE id_usuario = ?`, [req.user.id]
            );
            if (h.length === 0) return res.status(403).json({ message: "Hospital não encontrado." });
            hospital_id = h[0].id;
        }

        const [estoque] = await db.execute(
            `SELECT tipo_sanguineo, quantidade, atualizado_em
             FROM estoque_sangue
             WHERE hospital_id = ?
             ORDER BY FIELD(tipo_sanguineo,'O-','O+','A-','A+','B-','B+','AB-','AB+')`, [hospital_id]
        );

        const totalBolsas = estoque.reduce((acc, e) => acc + Number(e.quantidade), 0);

        const tiposCriticos = estoque.filter(e => Number(e.quantidade) <= 9).length;
        const tiposBaixos = estoque.filter(e => Number(e.quantidade) >= 10 && Number(e.quantidade) <= 19).length;

        const [historico] = await db.execute(
            `SELECT
                DATE_FORMAT(data_doacao, '%Y-%m') AS mes,
                DATE_FORMAT(data_doacao, '%b')    AS mes_label,
                COUNT(*) AS total
             FROM doacoes
             WHERE id_hospital = ?
             AND data_doacao >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
             GROUP BY mes, mes_label
             ORDER BY mes ASC`, [hospital_id]
        );

        return res.status(200).json({
            total_bolsas: totalBolsas,
            tipos_criticos: tiposCriticos,
            tipos_baixos: tiposBaixos,
            estoque,
            historico_6meses: historico,
        });

    } catch (error) {
        console.error("Erro ao gerar relatório de estoque:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};