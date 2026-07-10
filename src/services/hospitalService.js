const db = require("../config/db");

exports.listarHospitais = async() => {
    const [rows] = await db.execute(`
        SELECT 
            h.id,
            h.nome,
            h.nif,
            h.provincia,
            h.municipio,
            h.latitude,
            h.longitude,
            h.ativo,
            h.criado_em,
            u.email
        FROM hospitais h
        LEFT JOIN usuarios u ON u.id = h.id_usuario
        ORDER BY h.criado_em DESC
    `);

    return rows;
};

exports.getHospitalById = async(id) => {
    const [rows] = await db.execute(
        `
        SELECT 
            h.*,
            u.email
        FROM hospitais h
        LEFT JOIN usuarios u ON u.id = h.id_usuario
        WHERE h.id = ?
        `, [id]
    );

    if (rows.length === 0) {
        throw new Error("Hospital não encontrado");
    }

    return rows[0];
};

exports.atualizarHospital = async(id, data) => {
    const {
        nome,
        provincia,
        municipio,
        latitude,
        longitude
    } = data;

    const [rows] = await db.execute(
        "SELECT id FROM hospitais WHERE id = ?", [id]
    );

    if (rows.length === 0) {
        throw new Error("Hospital não encontrado");
    }

    await db.execute(
        `
        UPDATE hospitais
        SET 
            nome = ?,
            provincia = ?,
            municipio = ?,
            latitude = ?,
            longitude = ?
        WHERE id = ?
        `, [
            nome,
            provincia,
            municipio,
            latitude || null,
            longitude || null,
            id
        ]
    );

    return {
        message: "Hospital atualizado com sucesso",
    };
};

exports.desativarHospital = async(id) => {

    const [rows] = await db.execute(
        "SELECT id, id_usuario FROM hospitais WHERE id = ?", [id]
    );

    if (rows.length === 0) {
        throw new Error("Hospital não encontrado");
    }

    const hospital = rows[0];
    await db.execute(
        "UPDATE hospitais SET ativo = 0 WHERE id = ?", [id]
    );

    if (hospital.id_usuario) {
        await db.execute(
            "UPDATE usuarios SET status = 'inativo' WHERE id = ?", [hospital.id_usuario]
        );
    }

    return {
        message: "Hospital desativado com sucesso",
    };
};