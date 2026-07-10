const db = require("../config/db");

async function resolverHospitalId(user, executor) {
    if (user.hospital_id) return user.hospital_id;
    const [h] = await executor.execute(
        `SELECT id FROM hospitais WHERE id_usuario = ?`, [user.id]
    );
    if (h.length === 0) return null;
    return h[0].id;
}

exports.enviarAoINS = async(req, res) => {
    const connection = await db.getConnection();
    try {
        if (!req.user || !req.user.id) return res.status(401).json({ message: "Não autenticado." });
        const hospital_id = await resolverHospitalId(req.user, connection);
        if (!hospital_id) return res.status(403).json({ message: "Hospital não encontrado." });

        await connection.beginTransaction();

        // Total doações geral
        const [totalDoacoes] = await connection.execute(
            `SELECT COUNT(*) AS total FROM doacoes WHERE id_hospital = ?`, [hospital_id]
        );

        // Total doações este mês
        const [totalMes] = await connection.execute(
            `SELECT COUNT(*) AS total FROM doacoes
             WHERE id_hospital = ?
             AND MONTH(data_doacao) = MONTH(NOW())
             AND YEAR(data_doacao) = YEAR(NOW())`, [hospital_id]
        );

        // Total exames concluídos
        const [totalExames] = await connection.execute(
            `SELECT COUNT(*) AS total FROM solicitacao_exame
             WHERE hospital_id = ? AND status = 'CONCLUIDO'`, [hospital_id]
        );

        // Doadores únicos
        const [doadoresUnicos] = await connection.execute(
            `SELECT COUNT(DISTINCT id_doador) AS total FROM doacoes
             WHERE id_hospital = ?`, [hospital_id]
        );

        // Doador mais activo
        const [doadorActivo] = await connection.execute(
            `SELECT u.nome, u.email, d.tipo_sanguineo,
                    COUNT(*) AS total_doacoes,
                    MAX(dc.data_doacao) AS ultima_doacao
             FROM doacoes dc
             JOIN doadores d ON d.id = dc.id_doador
             JOIN usuarios u ON u.id = d.id_usuario
             WHERE dc.id_hospital = ?
             GROUP BY dc.id_doador, u.nome, u.email, d.tipo_sanguineo
             ORDER BY total_doacoes DESC LIMIT 1`, [hospital_id]
        );

        // Top 5 doadores
        const [topDoadores] = await connection.execute(
            `SELECT u.nome, u.email, d.tipo_sanguineo,
                    COUNT(*) AS total_doacoes,
                    MAX(dc.data_doacao) AS ultima_doacao
             FROM doacoes dc
             JOIN doadores d ON d.id = dc.id_doador
             JOIN usuarios u ON u.id = d.id_usuario
             WHERE dc.id_hospital = ?
             GROUP BY dc.id_doador, u.nome, u.email, d.tipo_sanguineo
             ORDER BY total_doacoes DESC LIMIT 5`, [hospital_id]
        );

        // Distribuição por tipo sanguíneo
        const [distribuicao] = await connection.execute(
            `SELECT d.tipo_sanguineo AS tipo, COUNT(*) AS total
             FROM doacoes dc
             JOIN doadores d ON d.id = dc.id_doador
             WHERE dc.id_hospital = ?
             GROUP BY d.tipo_sanguineo ORDER BY total DESC`, [hospital_id]
        );

        // Estoque actual
        const [estoque] = await connection.execute(
            `SELECT tipo_sanguineo, quantidade, atualizado_em
             FROM estoque_sangue WHERE hospital_id = ?
             ORDER BY tipo_sanguineo`, [hospital_id]
        );

        const doadorMaisAtivo = doadorActivo[0] || null;
        const snapshot = {
            top_doadores: topDoadores,
            estoque,
        };

        const [insert] = await connection.execute(
            `INSERT INTO relatorios_ins
             (id_hospital, periodo_inicio, periodo_fim,
              total_doacoes, total_exames, total_doadores_unicos, total_bolsas,
              doador_mais_ativo_id, doador_mais_ativo_nome, doador_mais_ativo_doacoes,
              distribuicao_tipos, observacoes, status, criado_por, enviado_em)
             VALUES (?, DATE_FORMAT(NOW(), '%Y-%m-01'), NOW(),
                     ?, ?, ?, ?, NULL, ?, ?, ?, NULL, 'enviado', ?, NOW())`, [
                hospital_id,
                Number(totalDoacoes[0].total),
                Number(totalExames[0].total),
                Number(doadoresUnicos[0].total),
                Number(totalDoacoes[0].total),
                doadorMaisAtivo ? doadorMaisAtivo.nome : null,
                doadorMaisAtivo ? doadorMaisAtivo.total_doacoes : 0,
                JSON.stringify({ distribuicao, ...snapshot }),
                req.user.id,
            ]
        );

        const [novo] = await connection.execute(
            `SELECT r.*, h.nome AS hospital_nome
             FROM relatorios_ins r
             JOIN hospitais h ON h.id = r.id_hospital
             WHERE r.id = ?`, [insert.insertId]
        );

        await connection.commit();

        return res.status(201).json({
            message: "Relatório enviado ao INS com sucesso.",
            relatorio: novo[0],
        });

    } catch (error) {
        await connection.rollback();
        console.error("Erro ao enviar ao INS:", error);
        return res.status(500).json({ message: "Erro interno." });
    } finally {
        connection.release();
    }
};

exports.listarRelatoriosHospital = async(req, res) => {
    try {
        if (!req.user || !req.user.id) return res.status(401).json({ message: "Não autenticado." });

        const hospital_id = await resolverHospitalId(req.user, db);
        if (!hospital_id) return res.status(403).json({ message: "Hospital não encontrado." });

        const [rows] = await db.execute(
            `SELECT r.id, r.periodo_inicio, r.periodo_fim,
                    r.total_doacoes, r.total_exames, r.total_doadores_unicos,
                    r.total_bolsas, r.doador_mais_ativo_nome, r.doador_mais_ativo_doacoes,
                    r.status, r.enviado_em, r.criado_em,
                    u.nome AS criado_por_nome
             FROM relatorios_ins r
             JOIN usuarios u ON u.id = r.criado_por
             WHERE r.id_hospital = ?
             ORDER BY r.enviado_em DESC`, [hospital_id]
        );

        return res.status(200).json({ data: rows });

    } catch (error) {
        console.error("Erro ao listar relatórios:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};

exports.listarRelatoriosINS = async(req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT r.id, r.periodo_inicio, r.periodo_fim,
                    r.total_doacoes, r.total_exames, r.total_doadores_unicos,
                    r.total_bolsas, r.doador_mais_ativo_nome, r.doador_mais_ativo_doacoes,
                    r.enviado_em, r.criado_em,
                    h.nome AS hospital_nome, h.provincia, h.municipio,
                    u.nome AS criado_por_nome
             FROM relatorios_ins r
             JOIN hospitais h ON h.id = r.id_hospital
             JOIN usuarios u ON u.id = r.criado_por
             WHERE r.status = 'enviado'
             ORDER BY r.enviado_em DESC`
        );

        return res.status(200).json({ data: rows });

    } catch (error) {
        console.error("Erro ao listar relatórios INS:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};

exports.detalheRelatorio = async(req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.execute(
            `SELECT r.*, h.nome AS hospital_nome, h.provincia, h.municipio,
                    u.nome AS criado_por_nome
             FROM relatorios_ins r
             JOIN hospitais h ON h.id = r.id_hospital
             JOIN usuarios u ON u.id = r.criado_por
             WHERE r.id = ?`, [id]
        );

        if (rows.length === 0) return res.status(404).json({ message: "Relatório não encontrado." });

        const relatorio = rows[0];
        if (relatorio.distribuicao_tipos && typeof relatorio.distribuicao_tipos === "string") {
            relatorio.distribuicao_tipos = JSON.parse(relatorio.distribuicao_tipos);
        }
        ç
        return res.status(200).json({ relatorio });

    } catch (error) {
        console.error("Erro ao buscar relatório:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};