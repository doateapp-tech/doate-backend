const db = require("../config/db");
const conviteService = require("./conviteService");

exports.criarUsuario = async({ email, tipo_usuario, hospital_id }) => {
    const tiposValidos = ["SECRETARIO", "ESTOQUE"];

    if (!tiposValidos.includes(tipo_usuario)) {
        throw new Error("Tipo de usuário inválido");
    }

    const [existing] = await db.execute(
        "SELECT id FROM usuarios WHERE email = ?", [email]
    );

    if (existing.length > 0) {
        throw new Error("Já existe um usuário com este email");
    }

    await conviteService.criarConvite({
        hospital_id,
        email,
        tipo: tipo_usuario
    });

    // Busca o link gerado
    const [rows] = await db.execute(
        `SELECT link_ativacao FROM convites 
         WHERE email = ? AND hospital_id = ? AND usado = 0 
         ORDER BY criado_em DESC LIMIT 1`, [email, hospital_id]
    );

    const link = rows.length > 0 ? rows[0].link_ativacao : null;

    return { message: "Convite enviado com sucesso", link };
};

exports.listarUsuarios = async(hospital_id, tipo) => {
    let query = `SELECT id, nome, email, tipo_usuario, status, criado_em 
                 FROM usuarios 
                 WHERE hospital_id = ?`;
    const params = [hospital_id];

    if (tipo) {
        query += ` AND tipo_usuario = ?`;
        params.push(tipo);
    }

    const [rows] = await db.execute(query, params);
    return rows;
};

exports.listarExames = async(hospital_id) => {
    const [rows] = await db.execute(
        `SELECT * FROM exames WHERE hospital_id = ? ORDER BY criado_em DESC`, [hospital_id]
    );
    return rows;
};

exports.verEstoque = async(hospital_id) => {
    const [rows] = await db.execute(
        `SELECT * FROM estoque_sangue WHERE hospital_id = ? ORDER BY tipo_sanguineo`, [hospital_id]
    );
    return rows;
};