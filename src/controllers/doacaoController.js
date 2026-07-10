const db = require("../config/db");
const crypto = require("crypto");
const notificationService = require("../services/notificationService");

function gerarTokenQR() {
    return crypto.randomBytes(32).toString("hex");
}

function gerarCodigoSolicitacao(id) {
    const ano = new Date().getFullYear();
    const numero = String(id).padStart(5, "0");
    return `DOA-${ano}-${numero}`;
}

function calcularNivel(totalDoacoes) {
    if (totalDoacoes >= 4) return "Ouro";
    if (totalDoacoes >= 2) return "Prata";
    if (totalDoacoes >= 1) return "Bronze";
    return "Iniciante";
}

exports.solicitarDoacao = async(req, res) => {
    const connection = await db.getConnection();

    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Usuário não autenticado." });
        }

        const usuario_id = req.user.id;
        const { hospital_id, alerta_id, tipo = "VOLUNTARIA" } = req.body;

        if (!hospital_id) {
            return res.status(400).json({ message: "Hospital é obrigatório." });
        }

        await connection.beginTransaction();

        // 1. Verifica hospital
        const [hospital] = await connection.execute(
            `SELECT id FROM hospitais WHERE id = ? AND ativo = 1`, [hospital_id]
        );

        if (hospital.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Hospital inválido ou inativo." });
        }

        // 2. Se é resposta a alerta, verifica se o hospital corresponde
        if (alerta_id) {
            const [alerta] = await connection.execute(
                `SELECT hospital_id FROM alertas WHERE id = ? AND status = 'ativo'`, [alerta_id]
            );
            if (alerta.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: "Alerta não encontrado ou inativo." });
            }
            if (alerta[0].hospital_id !== Number(hospital_id)) {
                await connection.rollback();
                return res.status(400).json({ message: "Este alerta não pertence ao hospital seleccionado." });
            }
        }

        // 3. Verifica elegibilidade
        const [ultimaDoacao] = await connection.execute(
            `SELECT data_doacao FROM doacoes
             WHERE id_doador = ?
             ORDER BY data_doacao DESC LIMIT 1`, [usuario_id]
        );

        if (ultimaDoacao.length > 0) {
            const diffDias = Math.floor(
                (Date.now() - new Date(ultimaDoacao[0].data_doacao).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            if (diffDias < 90) {
                await connection.rollback();
                return res.status(400).json({
                    message: `Ainda não pode doar. Faltam ${90 - diffDias} dias.`,
                });
            }
        }

        // 4. Verifica solicitação pendente existente
        const [existente] = await connection.execute(
            `SELECT id, expira_em FROM solicitacoes_doacao
             WHERE usuario_id = ? AND hospital_id = ? AND status = 'pendente'
             LIMIT 1 FOR UPDATE`, [usuario_id, hospital_id]
        );

        if (existente.length > 0) {
            const sol = existente[0];
            if (new Date(sol.expira_em) > new Date()) {
                const [nova] = await connection.execute(
                    `SELECT * FROM solicitacoes_doacao WHERE id = ?`, [sol.id]
                );
                await connection.commit();
                return res.status(200).json({
                    message: "Já existe uma solicitação activa.",
                    solicitacao: nova[0],
                });
            }
            await connection.execute(
                `UPDATE solicitacoes_doacao SET status = 'cancelada' WHERE id = ?`, [sol.id]
            );
        }

        // 5. Cria nova solicitação
        const token_qr = gerarTokenQR();
        const expira_em = new Date(Date.now() + 30 * 60 * 1000);

        const [insertResult] = await connection.execute(
            `INSERT INTO solicitacoes_doacao
             (usuario_id, hospital_id, alerta_id, tipo, token_qr, expira_em, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pendente')`, [usuario_id, hospital_id, alerta_id || null, tipo, token_qr, expira_em]
        );

        const id = insertResult.insertId;
        const codigo_solicitacao = gerarCodigoSolicitacao(id);

        await connection.execute(
            `UPDATE solicitacoes_doacao SET codigo_solicitacao = ? WHERE id = ?`, [codigo_solicitacao, id]
        );

        const [nova] = await connection.execute(
            `SELECT * FROM solicitacoes_doacao WHERE id = ?`, [id]
        );

        await connection.commit();

        return res.status(201).json({
            message: "Solicitação de doação criada com sucesso.",
            solicitacao: nova[0],
        });

    } catch (error) {
        await connection.rollback();
        console.error("ERRO AO CRIAR SOLICITAÇÃO DE DOAÇÃO:", error);
        return res.status(500).json({ message: "Erro interno ao criar solicitação." });
    } finally {
        connection.release();
    }
};

exports.validarQR = async(req, res) => {
    try {
        const { token_qr } = req.body;

        if (!token_qr) {
            return res.status(400).json({ message: "Token QR é obrigatório." });
        }

        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Usuário não autenticado." });
        }

        // Resolve hospital_id
        let hospital_id = req.user.hospital_id;
        if (!hospital_id) {
            const [h] = await db.execute(
                `SELECT id FROM hospitais WHERE id_usuario = ?`, [req.user.id]
            );
            if (h.length === 0) {
                return res.status(403).json({ message: "Utilizador não associado a um hospital." });
            }
            hospital_id = h[0].id;
        }

        const [rows] = await db.execute(
            `SELECT sd.*, u.nome, u.email, d.tipo_sanguineo
             FROM solicitacoes_doacao sd
             JOIN usuarios u ON u.id = sd.usuario_id
             JOIN doadores d ON d.id_usuario = sd.usuario_id
             WHERE sd.token_qr = ?
             AND sd.hospital_id = ?`, [token_qr, hospital_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Solicitação não encontrada para este hospital." });
        }

        const solicitacao = rows[0];

        if (new Date(solicitacao.expira_em) < new Date()) {
            return res.status(400).json({ message: "QR Code expirado." });
        }

        if (solicitacao.status !== "pendente") {
            return res.status(400).json({ message: "Solicitação já processada." });
        }

        return res.status(200).json({
            message: "Solicitação válida.",
            solicitacao,
        });

    } catch (error) {
        console.error("Erro ao validar QR de doação:", error);
        return res.status(500).json({ message: "Erro interno ao validar QR." });
    }
};
exports.confirmarDoacao = async(req, res) => {
    const connection = await db.getConnection();

    try {
        const { token_qr } = req.body;

        if (!token_qr) {
            return res.status(400).json({ message: "Token QR é obrigatório." });
        }

        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Usuário não autenticado." });
        }

        await connection.beginTransaction();

        // Resolve hospital_id
        let hospital_id = req.user.hospital_id;
        if (!hospital_id) {
            const [h] = await connection.execute(
                `SELECT id FROM hospitais WHERE id_usuario = ?`, [req.user.id]
            );
            if (h.length === 0) throw new Error("Hospital não encontrado.");
            hospital_id = h[0].id;
        }

        // Busca solicitação
        const [rows] = await connection.execute(
            `SELECT sd.*, d.tipo_sanguineo, u.push_token
             FROM solicitacoes_doacao sd
             JOIN doadores d ON d.id_usuario = sd.usuario_id
             JOIN usuarios u ON u.id = sd.usuario_id
             WHERE sd.token_qr = ? AND sd.hospital_id = ?
             FOR UPDATE`, [token_qr, hospital_id]
        );

        if (rows.length === 0) throw new Error("Solicitação não encontrada.");

        const solicitacao = rows[0];

        if (solicitacao.status !== "pendente") throw new Error("Solicitação já processada.");
        if (new Date(solicitacao.expira_em) < new Date()) throw new Error("QR expirado.");

        const tipo_sanguineo = solicitacao.tipo_sanguineo;

        // 1. Busca o id correcto da tabela doadores
        const [doadorRow] = await connection.execute(
            `SELECT id FROM doadores WHERE id_usuario = ?`, [solicitacao.usuario_id]
        );

        if (doadorRow.length === 0) throw new Error("Doador não encontrado.");
        const id_doador = doadorRow[0].id;

        // 2. Regista doação
        await connection.execute(
            `INSERT INTO doacoes (id_doador, id_hospital, data_doacao)
             VALUES (?, ?, NOW())`, [id_doador, hospital_id]
        );

        // 3. Actualiza solicitação
        await connection.execute(
            `UPDATE solicitacoes_doacao SET status = 'confirmada' WHERE id = ?`, [solicitacao.id]
        );

        // 4. Actualiza stock automaticamente
        await connection.execute(
            `INSERT INTO estoque_sangue (hospital_id, tipo_sanguineo, quantidade, atualizado_em)
             VALUES (?, ?, 1, NOW())
             ON DUPLICATE KEY UPDATE
             quantidade = quantidade + 1,
             atualizado_em = NOW()`, [hospital_id, tipo_sanguineo]
        );

        // 5. Calcula novo nível do doador
        const [totalRows] = await connection.execute(
            `SELECT COUNT(*) AS total FROM doacoes WHERE id_doador = ?`, [id_doador]
        );
        const totalDoacoes = Number(totalRows[0].total);
        const novoNivel = calcularNivel(totalDoacoes);

        await connection.commit();

        // 6. Notificação push ao doador
        if (solicitacao.push_token) {
            try {
                await notificationService.enviarPushParaDoadores({
                    doadores: [{ id: solicitacao.usuario_id, push_token: solicitacao.push_token }],
                    tipo_sanguineo,
                    mensagem: `A tua doação foi confirmada! És agora Doador ${novoNivel} 🎉`,
                    titulo: "Doação confirmada",
                });
            } catch (pushErr) {
                console.error("Erro ao enviar push:", pushErr);
            }
        }

        return res.status(200).json({
            message: "Doação confirmada com sucesso.",
            nivel: novoNivel,
            total_doacoes: totalDoacoes,
        });

    } catch (error) {
        await connection.rollback();
        console.error("Erro ao confirmar doação:", error);
        return res.status(400).json({ message: error.message || "Erro ao confirmar doação." });
    } finally {
        connection.release();
    }
};
exports.listarSolicitacoes = async(req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Usuário não autenticado." });
        }

        let hospital_id = req.user.hospital_id;
        if (!hospital_id) {
            const [h] = await db.execute(
                `SELECT id FROM hospitais WHERE id_usuario = ?`, [req.user.id]
            );
            if (h.length === 0) {
                return res.status(403).json({ message: "Hospital não encontrado." });
            }
            hospital_id = h[0].id;
        }

        const [rows] = await db.execute(
            `SELECT sd.id, sd.codigo_solicitacao, sd.status, sd.tipo,
                    sd.expira_em, sd.criado_em,
                    u.nome, u.email
             FROM solicitacoes_doacao sd
             JOIN usuarios u ON u.id = sd.usuario_id
             WHERE sd.hospital_id = ?
             ORDER BY sd.criado_em DESC`, [hospital_id]
        );

        return res.status(200).json({ data: rows });

    } catch (error) {
        console.error("Erro ao listar solicitações de doação:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};
exports.estatisticasDoacoes = async(req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Usuário não autenticado." });
        }

        let hospital_id = req.user.hospital_id;
        if (!hospital_id) {
            const [h] = await db.execute(
                `SELECT id FROM hospitais WHERE id_usuario = ?`, [req.user.id]
            );
            if (h.length === 0) return res.status(403).json({ message: "Hospital não encontrado." });
            hospital_id = h[0].id;
        }

        // Total geral
        const [totalGeral] = await db.execute(
            `SELECT COUNT(*) AS total FROM doacoes WHERE id_hospital = ?`, [hospital_id]
        );

        // Este mês
        const [totalMes] = await db.execute(
            `SELECT COUNT(*) AS total FROM doacoes
             WHERE id_hospital = ?
             AND MONTH(data_doacao) = MONTH(NOW())
             AND YEAR(data_doacao) = YEAR(NOW())`, [hospital_id]
        );

        // Mês passado
        const [totalMesPassado] = await db.execute(
            `SELECT COUNT(*) AS total FROM doacoes
             WHERE id_hospital = ?
             AND MONTH(data_doacao) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
             AND YEAR(data_doacao) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))`, [hospital_id]
        );

        // Doadores únicos
        const [doadoresUnicos] = await db.execute(
            `SELECT COUNT(DISTINCT id_doador) AS total FROM doacoes WHERE id_hospital = ?`, [hospital_id]
        );

        // Por tipo sanguíneo
        const [porTipo] = await db.execute(
            `SELECT d.tipo_sanguineo AS tipo, COUNT(*) AS total
             FROM doacoes dc
             JOIN doadores d ON d.id = dc.id_doador
             WHERE dc.id_hospital = ?
             GROUP BY d.tipo_sanguineo
             ORDER BY total DESC`, [hospital_id]
        );

        // Por mês (últimos 6 meses)
        const [porMes] = await db.execute(
            `SELECT
                DATE_FORMAT(data_doacao, '%Y-%m') AS mes,
                DATE_FORMAT(data_doacao, '%b') AS mes_label,
                COUNT(*) AS total
             FROM doacoes
             WHERE id_hospital = ?
             AND data_doacao >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
             GROUP BY mes, mes_label
             ORDER BY mes ASC`, [hospital_id]
        );

        // Doações recentes com info do doador
        const [recentes] = await db.execute(
            `SELECT
                dc.id,
                dc.data_doacao,
                u.nome,
                u.email,
                d.tipo_sanguineo,
                (SELECT COUNT(*) FROM doacoes WHERE id_doador = dc.id_doador) AS total_doacoes
             FROM doacoes dc
             JOIN doadores d ON d.id = dc.id_doador
             JOIN usuarios u ON u.id = d.id_usuario
             WHERE dc.id_hospital = ?
             ORDER BY dc.data_doacao DESC
             LIMIT 10`, [hospital_id]
        );

        const totalMesNum = Number(totalMes[0].total);
        const totalMesPassadoNum = Number(totalMesPassado[0].total);
        const variacaoMes = totalMesPassadoNum === 0 ?
            100 :
            Math.round(((totalMesNum - totalMesPassadoNum) / totalMesPassadoNum) * 100);

        return res.status(200).json({
            total_geral: Number(totalGeral[0].total),
            total_mes: totalMesNum,
            variacao_mes: variacaoMes,
            doadores_unicos: Number(doadoresUnicos[0].total),
            por_tipo: porTipo,
            por_mes: porMes,
            recentes: recentes.map(r => ({
                ...r,
                nivel: calcularNivel(Number(r.total_doacoes)),
            })),
        });

    } catch (error) {
        console.error("Erro ao buscar estatísticas:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};
exports.relatorioCompleto = async(req, res) => {
    try {
        let hospital_id = req.user.hospital_id;
        if (!hospital_id) {
            const [h] = await db.execute(
                `SELECT id FROM hospitais WHERE id_usuario = ?`, [req.user.id]
            );
            if (h.length === 0) return res.status(403).json({ message: "Hospital não encontrado." });
            hospital_id = h[0].id;
        }

        const [hospitalInfo] = await db.execute(
            `SELECT nome, provincia, municipio FROM hospitais WHERE id = ?`, [hospital_id]
        );

        const [totalGeral] = await db.execute(
            `SELECT COUNT(*) AS total FROM doacoes WHERE id_hospital = ?`, [hospital_id]
        );

        const [totalMes] = await db.execute(
            `SELECT COUNT(*) AS total FROM doacoes
             WHERE id_hospital = ?
             AND MONTH(data_doacao) = MONTH(NOW())
             AND YEAR(data_doacao) = YEAR(NOW())`, [hospital_id]
        );

        const [totalMesPassado] = await db.execute(
            `SELECT COUNT(*) AS total FROM doacoes
             WHERE id_hospital = ?
             AND MONTH(data_doacao) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
             AND YEAR(data_doacao) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))`, [hospital_id]
        );

        const [doadoresUnicos] = await db.execute(
            `SELECT COUNT(DISTINCT id_doador) AS total FROM doacoes WHERE id_hospital = ?`, [hospital_id]
        );

        const [porTipo] = await db.execute(
            `SELECT d.tipo_sanguineo AS tipo, COUNT(*) AS total
             FROM doacoes dc
             JOIN doadores d ON d.id = dc.id_doador
             WHERE dc.id_hospital = ?
             GROUP BY d.tipo_sanguineo
             ORDER BY total DESC`, [hospital_id]
        );

        const [porMes] = await db.execute(
            `SELECT
                DATE_FORMAT(data_doacao, '%Y-%m') AS mes,
                DATE_FORMAT(data_doacao, '%b') AS mes_label,
                COUNT(*) AS total
             FROM doacoes
             WHERE id_hospital = ?
             AND data_doacao >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
             GROUP BY mes, mes_label
             ORDER BY mes ASC`, [hospital_id]
        );

        // ✅ Doador mais activo
        const [maisAtivo] = await db.execute(
            `SELECT
                u.nome,
                u.email,
                d.tipo_sanguineo,
                COUNT(*) AS total_doacoes,
                MAX(dc.data_doacao) AS ultima_doacao
             FROM doacoes dc
             JOIN doadores d ON d.id = dc.id_doador
             JOIN usuarios u ON u.id = d.id_usuario
             WHERE dc.id_hospital = ?
             GROUP BY dc.id_doador, u.nome, u.email, d.tipo_sanguineo
             ORDER BY total_doacoes DESC
             LIMIT 1`, [hospital_id]
        );

        // ✅ Top 5 doadores
        const [topDoadores] = await db.execute(
            `SELECT
                u.nome,
                u.email,
                d.tipo_sanguineo,
                COUNT(*) AS total_doacoes,
                MAX(dc.data_doacao) AS ultima_doacao
             FROM doacoes dc
             JOIN doadores d ON d.id = dc.id_doador
             JOIN usuarios u ON u.id = d.id_usuario
             WHERE dc.id_hospital = ?
             GROUP BY dc.id_doador, u.nome, u.email, d.tipo_sanguineo
             ORDER BY total_doacoes DESC
             LIMIT 5`, [hospital_id]
        );

        const totalMesNum = Number(totalMes[0].total);
        const totalMesPassadoNum = Number(totalMesPassado[0].total);
        const variacaoMes = totalMesPassadoNum === 0 ?
            100 :
            Math.round(((totalMesNum - totalMesPassadoNum) / totalMesPassadoNum) * 100);

        return res.status(200).json({
            hospital: hospitalInfo[0],
            gerado_em: new Date().toISOString(),
            total_geral: Number(totalGeral[0].total),
            total_mes: totalMesNum,
            variacao_mes: variacaoMes,
            doadores_unicos: Number(doadoresUnicos[0].total),
            por_tipo: porTipo,
            por_mes: porMes,
            doador_mais_ativo: maisAtivo[0] || null,
            top_doadores: topDoadores,
        });

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};