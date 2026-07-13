const db = require("../config/db");
const conviteService = require("./conviteService");
const emailService = require("./emailService");


const getDomain = (email) => {
    if (!email || !email.includes("@")) return null;
    return email.split("@")[1].toLowerCase();
};


exports.criarSolicitacao = async(data) => {
    const {
        nome,
        nif,
        email,
        email_admin,
        provincia,
        municipio,
        telefone,
        mensagem,
    } = data;

    if (!nome || !nome.trim() ||
        !nif || !nif.trim() ||
        !email || !email.trim() ||
        !email_admin || !email_admin.trim() ||
        !provincia || !provincia.trim() ||
        !municipio || !municipio.trim()
    ) {
        throw new Error("Campos obrigatórios não preenchidos");
    }

    const emailHospital = email.trim().toLowerCase();
    const emailAdmin = email_admin.trim().toLowerCase();

    if (!/^\d{9}$/.test(nif)) {
        throw new Error("NIF inválido");
    }

    const emailRegex = /^[a-z][a-z0-9._%+-]*@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(emailHospital)) {
        throw new Error("Email do hospital inválido");
    }

    if (!emailRegex.test(emailAdmin)) {
        throw new Error("Email do administrador inválido");
    }

    if (emailHospital === emailAdmin) {
        throw new Error("Email do hospital e do administrador não podem ser iguais");
    }

    const allowedDomains = ["hospital.com", "clinica.ao"];

    const hospitalDomain = getDomain(emailHospital);
    const adminDomain = getDomain(emailAdmin);

    if (!allowedDomains.includes(hospitalDomain)) {
        throw new Error("Email do hospital deve ser institucional (ex: @hospital.com)");
    }

    if (!allowedDomains.includes(adminDomain)) {
        throw new Error("Email do administrador deve ser institucional (ex: @clinica.ao)");
    }

    if (hospitalDomain !== adminDomain) {
        throw new Error("O email do administrador deve pertencer ao mesmo domínio institucional do hospital");
    }

    const localPart = emailAdmin.split("@")[0];

    if (localPart.length < 6) {
        throw new Error("O email do administrador deve ter pelo menos 6 caracteres antes do @");
    }

    if (/^[0-9]/.test(localPart)) {
        throw new Error("O email do administrador não pode começar com número");
    }

    if (/^[A-Z]/.test(localPart)) {
        throw new Error("O email do administrador não pode começar com letra maiúscula");
    }

    const [existingEmail] = await db.execute(
        `SELECT id FROM solicitacoes_hospital WHERE email = ? AND status = 'pendente'`, [emailHospital]
    );

    if (existingEmail.length > 0) {
        throw new Error("Já existe uma solicitação pendente para este email");
    }

    const [existingNif] = await db.execute(
        `SELECT id FROM solicitacoes_hospital WHERE nif = ? AND status = 'pendente'`, [nif]
    );

    if (existingNif.length > 0) {
        throw new Error("Já existe uma solicitação pendente para este NIF");
    }

    // 🔹 INSERT
    const [result] = await db.execute(
        `
        INSERT INTO solicitacoes_hospital
        (nome, nif, email, email_admin, provincia, municipio, telefone, mensagem, status, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', NOW())
        `, [
            nome.trim(),
            nif,
            emailHospital,
            emailAdmin,
            provincia.trim(),
            municipio.trim(),
            telefone || null,
            mensagem || null,
        ]
    );

    await emailService.enviarSolicitacaoHospital({
        nome,
        email: emailHospital,
        email_admin: emailAdmin,
        nif,
        provincia,
        municipio,
        telefone,
        mensagem,
    });

    return {
        message: "Solicitação enviada com sucesso",
        id: result.insertId,
    };
};


exports.listarSolicitacoes = async() => {
    const [rows] = await db.execute(
        `SELECT * FROM solicitacoes_hospital ORDER BY criado_em DESC`
    );

    return rows;
};


exports.getSolicitacaoById = async(id) => {
    const [rows] = await db.execute(
        `SELECT * FROM solicitacoes_hospital WHERE id = ?`, [id]
    );

    if (rows.length === 0) {
        throw new Error("Solicitação não encontrada");
    }

    return rows[0];
};
exports.atualizarStatus = async(id, status) => {
    const connection = await db.getConnection();

    try {
        const validStatus = ["pendente", "aprovado", "rejeitado"];

        if (!validStatus.includes(status)) {
            throw new Error("Status inválido");
        }

        const [rows] = await connection.execute(
            `SELECT * FROM solicitacoes_hospital WHERE id = ?`, [id]
        );

        if (rows.length === 0) {
            throw new Error("Solicitação não encontrada");
        }

        const solicitacao = rows[0];

        if (solicitacao.status !== "pendente") {
            throw new Error("Esta solicitação já foi processada");
        }

        const adminEmail = solicitacao.email_admin || solicitacao.email;

        if (!adminEmail) {
            throw new Error("Email do administrador não encontrado");
        }

        await connection.beginTransaction();

        await connection.execute(
            `UPDATE solicitacoes_hospital SET status = ? WHERE id = ?`, [status, id]
        );

        let hospitalId = null;

        if (status === "aprovado") {
            const [existingHospital] = await connection.execute(
                `SELECT id FROM hospitais WHERE nif = ?`, [solicitacao.nif]
            );

            if (existingHospital.length > 0) {
                throw new Error("Já existe um hospital com este NIF");
            }

            const [hospitalResult] = await connection.execute(
                `INSERT INTO hospitais
                 (nome, nif, provincia, municipio, criado_em, ativo)
                 VALUES (?, ?, ?, ?, NOW(), 1)`, [solicitacao.nome, solicitacao.nif, solicitacao.provincia, solicitacao.municipio]
            );

            hospitalId = hospitalResult.insertId;

            await conviteService.criarConvite({
                hospital_id: hospitalId,
                email: adminEmail,
                tipo: "ADMIN"
            }, connection);
        }

        await connection.commit();

        return { message: `Solicitação ${status} com sucesso`, hospital_id: hospitalId };

    } catch (error) {
        await connection.rollback();
        console.error("ERRO AO ATUALIZAR STATUS:", error);
        throw error;

    } finally {
        connection.release();
    }
};