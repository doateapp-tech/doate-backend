const doadorService = require("../services/doadorService");
const progressoService = require("../services/progressoService");
const db = require("../config/db");

function calcularNivel(totalDoacoes) {
    if (totalDoacoes >= 4) return "OURO";
    if (totalDoacoes >= 2) return "PRATA";
    if (totalDoacoes >= 1) return "BRONZE";
    return null;
}

function calcularStatus(ultimaDoacao) {
    if (!ultimaDoacao) return "inativo";
    const diasDesdeUltima = Math.floor(
        (Date.now() - new Date(ultimaDoacao).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diasDesdeUltima <= 90) return "recente";
    if (diasDesdeUltima <= 180) return "elegivel";
    return "inativo";
}

exports.listarDoadores = async(req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Usuário não autenticado." });
        }

        let hospital_id = req.user.hospital_id;

        if (!hospital_id) {
            const [hospital] = await db.execute(
                `SELECT id FROM hospitais WHERE id_usuario = ?`, [req.user.id]
            );
            if (hospital.length === 0) {
                return res.status(403).json({ message: "Utilizador não associado a um hospital." });
            }
            hospital_id = hospital[0].id;
        }

        const [rows] = await db.execute( // Substitui COUNT(dc.id) por esta subquery
            `SELECT 
    u.id,
    u.nome,
    u.email,
    u.telefone,
    d.tipo_sanguineo,
    COUNT(dc.id) AS total_doacoes,
    MAX(dc.data_doacao) AS ultima_doacao
 FROM doacoes dc
 JOIN doadores d ON d.id = dc.id_doador
 JOIN usuarios u ON u.id = d.id_usuario
 WHERE dc.id_hospital = ?
 GROUP BY u.id, u.nome, u.email, u.telefone, d.tipo_sanguineo
 ORDER BY total_doacoes DESC, ultima_doacao DESC`, [hospital_id]);

        const doadores = rows.map(row => ({
            id: row.id,
            nome: row.nome,
            email: row.email,
            telefone: row.telefone,
            tipo_sanguineo: row.tipo_sanguineo,
            total_doacoes: Number(row.total_doacoes),
            ultima_doacao: row.ultima_doacao,
            nivel: calcularNivel(Number(row.total_doacoes)),
            status: calcularStatus(row.ultima_doacao),
        }));

        return res.status(200).json({ data: doadores });

    } catch (error) {
        console.error("Erro ao listar doadores:", error);
        return res.status(500).json({ message: "Erro interno ao listar doadores." });
    }
};

exports.getProgresso = async(req, res) => {
    try {

        if (!req.user || !req.user.id) {
            return res.status(401).json({
                message: "Usuário não autenticado"
            });
        }

        const idDoador = req.user.id;

        const { totalDoacoes, ultimaDoacao } =
        await doadorService.obterDadosDoacoesConfirmadas(idDoador);

        const progresso =
            progressoService.calcularProgresso(totalDoacoes, ultimaDoacao);

        return res.status(200).json({
            sucesso: true,
            dados: progresso
        });

    } catch (error) {
        console.error("ERRO AO OBTER PROGRESSO DO DOADOR:", error);

        return res.status(500).json({
            sucesso: false,
            message: "Erro interno ao buscar progresso"
        });
    }
};
exports.obterCarteira = async(req, res) => {
    try {
        if (!req.user.id) return res.status(401).json({ message: "Não autenticado." });

        const usuario_id = req.user.id;

        // Dados do doador
        const [doadorRows] = await db.execute(
            `SELECT d.id, d.tipo_sanguineo, d.conhece_tipo_sanguineo,
                    u.nome, u.email, u.telefone, u.criado_em AS membro_desde
             FROM doadores d
             JOIN usuarios u ON u.id = d.id_usuario
             WHERE d.id_usuario = ?`, [usuario_id]
        );

        if (doadorRows.length === 0) {
            return res.status(404).json({ message: "Perfil de doador não encontrado." });
        }

        const doador = doadorRows[0];

        // Total de doações + última doação
        const [statsRows] = await db.execute(
            `SELECT COUNT(*) AS total, MAX(data_doacao) AS ultima_doacao
             FROM doacoes WHERE id_doador = ?`, [doador.id]
        );

        const totalDoacoes = Number(statsRows[0].total);
        const ultimaDoacao = statsRows[0].ultima_doacao;

        // Histórico — últimas 5 doações com hospital
        const [historico] = await db.execute(
            `SELECT dc.data_doacao, h.nome AS hospital_nome,
                    h.municipio, h.provincia
             FROM doacoes dc
             JOIN hospitais h ON h.id = dc.id_hospital
             WHERE dc.id_doador = ?
             ORDER BY dc.data_doacao DESC
             LIMIT 5`, [doador.id]
        );

        // Nível actual + progresso
        function calcularNivel(total) {
            if (total >= 4) return "Ouro";
            if (total >= 2) return "Prata";
            if (total >= 1) return "Bronze";
            return "Iniciante";
        }

        const NIVEL_LIMIARES = { Iniciante: 1, Bronze: 2, Prata: 4, Ouro: null };
        const nivel = calcularNivel(totalDoacoes);

        let proximoNivel = null;
        let faltamParaProximo = 0;

        if (nivel === "Iniciante") {
            proximoNivel = "Bronze";
            faltamParaProximo = 1 - totalDoacoes;
        } else if (nivel === "Bronze") {
            proximoNivel = "Prata";
            faltamParaProximo = 2 - totalDoacoes;
        } else if (nivel === "Prata") {
            proximoNivel = "Ouro";
            faltamParaProximo = 4 - totalDoacoes;
        }

        // Elegibilidade — 90 dias
        let diasRestantes = 0;
        let elegivel = true;

        if (ultimaDoacao) {
            const hoje = new Date();
            const ultima = new Date(ultimaDoacao);
            const diffDias = Math.floor((hoje.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
            diasRestantes = Math.max(90 - diffDias, 0);
            elegivel = diasRestantes === 0;
        }

        return res.status(200).json({
            id_doador: doador.id,
            nome: doador.nome,
            email: doador.email,
            telefone: doador.telefone,
            tipo_sanguineo: doador.conhece_tipo_sanguineo ? doador.tipo_sanguineo : null,
            membro_desde: doador.membro_desde,
            total_doacoes: totalDoacoes,
            nivel,
            proximo_nivel: proximoNivel,
            faltam_para_proximo: Math.max(faltamParaProximo, 0),
            ultima_doacao: ultimaDoacao,
            elegivel,
            dias_restantes: diasRestantes,
            historico,
        });

    } catch (error) {
        console.error("Erro ao buscar carteira do doador:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};
exports.obterPerfil = async(req, res) => {
    try {
        if (!req.user.id) return res.status(401).json({ message: "Não autenticado." });

        const usuario_id = req.user.id;

        const [rows] = await db.execute(
            `SELECT u.id, u.nome, u.email, u.telefone, u.foto_base64,
                    d.tipo_sanguineo, d.conhece_tipo_sanguineo
             FROM usuarios u
             JOIN doadores d ON d.id_usuario = u.id
             WHERE u.id = ?`, [usuario_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Perfil não encontrado." });
        }

        const perfil = rows[0];

        return res.status(200).json({
            id: perfil.id,
            nome: perfil.nome,
            email: perfil.email,
            telefone: perfil.telefone,
            foto_base64: perfil.foto_base64 || null,
            tipo_sanguineo: perfil.conhece_tipo_sanguineo ? perfil.tipo_sanguineo : null,
            localizacao: null,
        });

    } catch (error) {
        console.error("Erro ao buscar perfil:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};

exports.atualizarPerfil = async(req, res) => {
    try {
        if (!req.user.id) return res.status(401).json({ message: "Não autenticado." });

        const usuario_id = req.user.id;
        const { nome, telefone, foto_base64 } = req.body;

        const campos = [];
        const valores = [];

        if (nome) {
            campos.push("nome = ?");
            valores.push(nome);
        }
        if (telefone) {
            campos.push("telefone = ?");
            valores.push(telefone);
        }
        if (foto_base64 !== undefined) {
            campos.push("foto_base64 = ?");
            valores.push(foto_base64);
        }

        if (campos.length === 0) {
            return res.status(400).json({ message: "Nenhum dado para actualizar." });
        }

        valores.push(usuario_id);

        await db.execute(
            `UPDATE usuarios SET ${campos.join(", ")} WHERE id = ?`,
            valores
        );

        return res.status(200).json({ message: "Perfil actualizado com sucesso." });

    } catch (error) {
        console.error("Erro ao actualizar perfil:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};
exports.listarExamesDoador = async(req, res) => {
    try {
        if (!req.user.id) return res.status(401).json({ message: "Não autenticado." });

        const usuario_id = req.user.id;

        const [exames] = await db.execute(
            `SELECT se.id, se.codigo_solicitacao, se.token_qr, se.status, 
                    se.criado_em, se.expira_em,
                    h.nome AS hospital_nome, h.municipio, h.provincia
             FROM solicitacao_exame se
             JOIN hospitais h ON h.id = se.hospital_id
             WHERE se.usuario_id = ?
             AND (se.status = 'CONCLUIDO' OR se.expira_em > NOW())
             ORDER BY se.criado_em DESC`, [usuario_id]
        );

        return res.status(200).json({ data: exames });

    } catch (error) {
        console.error("Erro ao listar exames do doador:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};
exports.historicoCompleto = async(req, res) => {
    try {
        if (!req.user.id) return res.status(401).json({ message: "Não autenticado." });

        const usuario_id = req.user.id;

        const [doadorRows] = await db.execute(
            `SELECT id FROM doadores WHERE id_usuario = ?`, [usuario_id]
        );

        if (doadorRows.length === 0) {
            return res.status(404).json({ message: "Perfil de doador não encontrado." });
        }

        const doador_id = doadorRows[0].id;

        const [doacoes] = await db.execute(
            `SELECT 'doacao' AS tipo, dc.data_doacao AS data, h.nome AS hospital_nome,
                    NULL AS status, NULL AS token_qr, NULL AS expira_em
             FROM doacoes dc
             JOIN hospitais h ON h.id = dc.id_hospital
             WHERE dc.id_doador = ?
             AND dc.data_doacao >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`, [doador_id]
        );

        const [exames] = await db.execute(
            `SELECT 'exame' AS tipo, se.criado_em AS data, h.nome AS hospital_nome,
                    se.status AS status, NULL AS token_qr, NULL AS expira_em
             FROM solicitacao_exame se
             JOIN hospitais h ON h.id = se.hospital_id
             WHERE se.usuario_id = ?
             AND se.criado_em >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`, [usuario_id]
        );

        const [solicitacoes] = await db.execute(
            `SELECT 'solicitacao_doacao' AS tipo, sd.criado_em AS data,
                    h.nome AS hospital_nome, sd.status AS status,
                    sd.token_qr AS token_qr, sd.expira_em AS expira_em
             FROM solicitacoes_doacao sd
             JOIN hospitais h ON h.id = sd.hospital_id
             WHERE sd.usuario_id = ?
             AND sd.status = 'pendente'
             AND sd.expira_em > NOW()`, [usuario_id]
        );

        const historico = [...doacoes, ...exames, ...solicitacoes].sort(
            (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
        );

        return res.status(200).json({ data: historico });

    } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};