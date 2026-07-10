const db = require("../config/db");
const bcrypt = require("bcryptjs");

async function buscarUsuarioPorEmail(email) {
    const [rows] = await db.execute(
        "SELECT * FROM usuarios WHERE email = ?", [email]
    );
    return rows[0];
}

async function criarUsuario({ nome, email, telefone, senha, codigo, expira }) {
    const senhaHash = await bcrypt.hash(senha, 10);

    const sql = `
    INSERT INTO usuarios 
    (nome, email, telefone, senha, tipo_usuario, email_verificado, codigo_verificacao, codigo_expira)
    VALUES (?, ?, ?, ?, 'DOADOR', false, ?, ?)
  `;

    await db.execute(sql, [
        nome,
        email,
        telefone,
        senhaHash,
        codigo,
        expira,
    ]);
}

async function verificarCodigo(email, codigo) {
    const [rows] = await db.execute(
        `SELECT * FROM usuarios 
     WHERE email = ? 
       AND codigo_verificacao = ?
       AND codigo_expira > NOW()`, [email, codigo]
    );

    if (!rows.length) return false;

    await db.execute(
        `UPDATE usuarios 
     SET email_verificado = true,
         codigo_verificacao = NULL,
         codigo_expira = NULL
     WHERE email = ?`, [email]
    );

    return true;
}

module.exports = {
    buscarUsuarioPorEmail,
    criarUsuario,
    verificarCodigo,
};