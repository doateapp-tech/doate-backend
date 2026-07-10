const db = require("../config/db");
const crypto = require("crypto");

function gerarTokenQR() {
    return crypto.randomBytes(32).toString("hex");
}

function gerarCodigoSolicitacao(id) {
    const ano = new Date().getFullYear();
    const numero = String(id).padStart(5, "0");
    return `SOL-${ano}-${numero}`;
}

// helper — encontra hospital_id independente do role
async function resolverHospitalId(user, connection) {
    const executor = connection || db;

    // SECRETARIO e ESTOQUE têm hospital_id no token
    if (user.hospital_id) {
        return user.hospital_id;
    }

    // ADMIN — busca pelo id_usuario na tabela hospitais
    const [hospital] = await executor.execute(
        `SELECT id FROM hospitais WHERE id_usuario = ?`, [user.id]
    );

    if (hospital.length === 0) return null;
    return hospital[0].id;
}

exports.solicitarExame = async(req, res) => {
    const connection = await db.getConnection();

    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Usuário não autenticado." });
        }

        const usuario_id = req.user.id;
        const { hospital_id } = req.body;

        if (!hospital_id) {
            return res.status(400).json({ message: "Hospital é obrigatório." });
        }

        await connection.beginTransaction();

        const [hospital] = await connection.execute(
            `SELECT h.id FROM hospitais h WHERE h.id = ? AND h.ativo = 1 FOR UPDATE`, [hospital_id]
        );

        if (hospital.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Hospital inválido ou inativo." });
        }

        const [existente] = await connection.execute(
            `SELECT * FROM solicitacao_exame
             WHERE usuario_id = ? AND hospital_id = ? AND status = 'PENDENTE'
             LIMIT 1 FOR UPDATE`, [usuario_id, hospital_id]
        );

        if (existente.length > 0) {
            const solicitacao = existente[0];
            if (new Date(solicitacao.expira_em) > new Date()) {
                await connection.commit();
                return res.status(200).json({
                    message: "Solicitação já existente.",
                    solicitacao
                });
            }
            await connection.execute(
                `UPDATE solicitacao_exame SET status = 'EXPIRADO' WHERE id = ?`, [solicitacao.id]
            );
        }

        const token_qr = gerarTokenQR();
        const expira_em = new Date(Date.now() + 15 * 60 * 1000);

        const [insertResult] = await connection.execute(
            `INSERT INTO solicitacao_exame (usuario_id, hospital_id, token_qr, expira_em, status)
             VALUES (?, ?, ?, ?, 'PENDENTE')`, [usuario_id, hospital_id, token_qr, expira_em]
        );

        const id = insertResult.insertId;
        const codigo_solicitacao = gerarCodigoSolicitacao(id);

        await connection.execute(
            `UPDATE solicitacao_exame SET codigo_solicitacao = ? WHERE id = ?`, [codigo_solicitacao, id]
        );

        const [nova] = await connection.execute(
            `SELECT * FROM solicitacao_exame WHERE id = ?`, [id]
        );

        await connection.commit();

        return res.status(201).json({
            message: "Solicitação criada com sucesso.",
            solicitacao: nova[0]
        });

    } catch (error) {
        await connection.rollback();
        console.error("ERRO AO CRIAR SOLICITAÇÃO:", error);
        return res.status(500).json({ message: "Erro interno ao criar solicitação." });
    } finally {
        connection.release();
    }
};

exports.validarQR = async(req, res) => {
    try {
        const { token_qr } = req.body;

        if (!token_qr) {
            return res.status(400).json({ message: "Token QR é obrigatório" });
        }

        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Usuário não autenticado" });
        }

        const hospital_id = await resolverHospitalId(req.user);

        if (!hospital_id) {
            return res.status(403).json({ message: "Utilizador não está associado a um hospital" });
        }

        const [rows] = await db.execute(
            `SELECT se.*, u.nome, u.email
             FROM solicitacao_exame se
             JOIN usuarios u ON u.id = se.usuario_id
             WHERE se.token_qr = ?
             AND se.hospital_id = ?`, [token_qr, hospital_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Solicitação não encontrada para este hospital" });
        }

        const solicitacao = rows[0];

        if (new Date(solicitacao.expira_em) < new Date()) {
            return res.status(400).json({ message: "QR Code expirado" });
        }

        if (solicitacao.status !== "PENDENTE") {
            return res.status(400).json({ message: "Solicitação já processada" });
        }

        return res.status(200).json({
            message: "Solicitação válida",
            solicitacao
        });

    } catch (error) {
        console.error("Erro ao validar QR:", error);
        return res.status(500).json({ message: "Erro interno ao validar QR" });
    }
};

exports.confirmarExame = async(req, res) => {
    const connection = await db.getConnection();

    try {
        const { token_qr, tipo_sanguineo } = req.body;

        if (!token_qr || !tipo_sanguineo) {
            return res.status(400).json({ message: "Token QR e tipo sanguíneo são obrigatórios" });
        }

        const tiposValidos = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
        if (!tiposValidos.includes(tipo_sanguineo)) {
            return res.status(400).json({ message: "Tipo sanguíneo inválido" });
        }

        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Usuário não autenticado" });
        }

        await connection.beginTransaction();

        const hospital_id = await resolverHospitalId(req.user, connection);

        if (!hospital_id) {
            throw new Error("Hospital não encontrado");
        }

        const [rows] = await connection.execute(
            `SELECT * FROM solicitacao_exame
             WHERE token_qr = ? AND hospital_id = ? FOR UPDATE`, [token_qr, hospital_id]
        );

        if (rows.length === 0) throw new Error("Solicitação não encontrada");

        const solicitacao = rows[0];

        if (solicitacao.status !== "PENDENTE") throw new Error("Solicitação já processada");
        if (new Date(solicitacao.expira_em) < new Date()) throw new Error("QR expirado");

        const [doador] = await connection.execute(
            `SELECT * FROM doadores WHERE id_usuario = ?`, [solicitacao.usuario_id]
        );

        if (doador.length === 0) throw new Error("Doador não encontrado.");

        await connection.execute(
            `UPDATE doadores SET tipo_sanguineo = ?, conhece_tipo_sanguineo = 1 WHERE id_usuario = ?`, [tipo_sanguineo, solicitacao.usuario_id]
        );

        await connection.execute(
            `INSERT INTO exames (usuario_id, hospital_id, solicitacao_id, tipo_sanguineo)
             VALUES (?, ?, ?, ?)`, [solicitacao.usuario_id, hospital_id, solicitacao.id, tipo_sanguineo]
        );

        await connection.execute(
            `UPDATE solicitacao_exame SET status = 'CONCLUIDO' WHERE id = ?`, [solicitacao.id]
        );

        await connection.commit();

        return res.status(200).json({ message: "Exame confirmado com sucesso" });

    } catch (error) {
        await connection.rollback();
        console.error("Erro ao confirmar exame:", error);
        return res.status(400).json({ message: error.message || "Erro ao confirmar exame" });
    } finally {
        connection.release();
    }
};
exports.listarSolicitacoes = async(req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Usuário não autenticado." });
        }

        const hospital_id = await resolverHospitalId(req.user);

        if (!hospital_id) {
            return res.status(403).json({ message: "Utilizador não está associado a um hospital." });
        }
        await db.execute(
            `UPDATE solicitacao_exame
             SET status = 'EXPIRADO'
             WHERE hospital_id = ?
             AND expira_em < NOW()
             AND (status = 'PENDENTE' OR status = '' OR status IS NULL)`, [hospital_id]
        );

        const [rows] = await db.execute(
            `SELECT se.id, se.codigo_solicitacao, se.status, se.expira_em, se.criado_em,
                    u.nome, u.email
             FROM solicitacao_exame se
             JOIN usuarios u ON u.id = se.usuario_id
             WHERE se.hospital_id = ?
             ORDER BY se.criado_em DESC`, [hospital_id]
        );

        return res.status(200).json({ data: rows });

    } catch (error) {
        console.error("Erro ao listar solicitações:", error);
        return res.status(500).json({ message: "Erro interno ao listar solicitações." });
    }
};