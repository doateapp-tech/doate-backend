const db = require("../config/db");
const crypto = require("crypto");
const emailService = require("./emailService");
const bcrypt = require("bcrypt");

const gerarToken = () => crypto.randomBytes(32).toString("hex");

exports.criarConvite = async({ hospital_id, email, tipo = "ADMIN" }, conn = null) => {
    const executor = conn || db;

    const [hospital] = await executor.execute(
        "SELECT id, nome FROM hospitais WHERE id = ?", [hospital_id]
    );

    if (hospital.length === 0) {
        throw new Error("Hospital não encontrado");
    }

    const [existing] = await executor.execute(
        `SELECT id FROM convites 
     WHERE hospital_id = ? 
     AND tipo = ?
     AND usado = 0 
     AND expira_em > NOW()`, [hospital_id, tipo]
    );

    if (existing.length > 0) {
        throw new Error(`Já existe um convite ativo do tipo ${tipo} para este hospital`);
    }

    const token = gerarToken();
    const expiraEm = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await executor.execute(
        `INSERT INTO convites 
         (hospital_id, token, email, tipo, expira_em, usado, criado_em)
         VALUES (?, ?, ?, ?, ?, 0, NOW())`, [hospital_id, token, email, tipo, expiraEm]
    );

    const link = `${process.env.FRONTEND_URL}/ativar-conta/${token}`;
    await emailService.enviarConviteHospital(email, link);

    return { message: "Convite enviado com sucesso" };
};

exports.validarConvite = async(token) => {
    const [rows] = await db.execute(
        "SELECT * FROM convites WHERE token = ?", [token]
    );

    if (rows.length === 0) {
        throw new Error("Convite inválido");
    }

    const convite = rows[0];

    if (convite.usado) {
        throw new Error("Convite já utilizado");
    }

    if (new Date(convite.expira_em) < new Date()) {
        throw new Error("Convite expirado");
    }

    return {
        hospital_id: convite.hospital_id,
        email: convite.email,
        tipo: convite.tipo || "ADMIN"
    };
};

exports.ativarConta = async({ token, email, password, nome }) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            "SELECT * FROM convites WHERE token = ?", [token]
        );

        if (rows.length === 0) {
            throw new Error("Convite inválido");
        }

        const convite = rows[0];

        if (convite.usado) {
            throw new Error("Convite já utilizado");
        }

        if (new Date(convite.expira_em) < new Date()) {
            throw new Error("Convite expirado");
        }


        if (!email || email.toLowerCase() !== convite.email.toLowerCase()) {
            throw new Error("O email informado não corresponde ao convite");
        }

        if (!password || password.length < 6) {
            throw new Error("A senha deve ter pelo menos 6 caracteres");
        }

        const [existingUser] = await connection.execute(
            "SELECT id FROM usuarios WHERE email = ?", [convite.email]
        );

        if (existingUser.length > 0) {
            throw new Error("Já existe um usuário com este email");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [userResult] = await connection.execute(
            `INSERT INTO usuarios
     (nome, email, senha, tipo_usuario, hospital_id, status, criado_em)
     VALUES (?, ?, ?, ?, ?, 'ativo', NOW())`, [
                nome && nome.trim() !== "" ? nome.trim() : convite.email.split("@")[0],
                convite.email,
                hashedPassword,
                convite.tipo || "ADMIN",
                convite.hospital_id
            ]
        );
        const userId = userResult.insertId;

        await connection.execute(
            `UPDATE hospitais SET id_usuario = ? WHERE id = ?`, [userId, convite.hospital_id]
        );

        await connection.execute(
            `UPDATE convites SET usado = 1 WHERE id = ?`, [convite.id]
        );

        await connection.commit();

        return { message: "Conta ativada com sucesso" };

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};