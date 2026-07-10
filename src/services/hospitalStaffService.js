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
        tipo_usuario
    });

    return {
        message: "Convite enviado com sucesso"
    };
};