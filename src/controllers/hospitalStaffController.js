const hospitalStaffService = require("../services/hospitalStaffService");

exports.criarUsuario = async(req, res) => {
    try {
        const { nome, email, tipo_usuario } = req.body;
        const hospital_id = req.user.hospital_id;

        if (!email || !tipo_usuario) {
            return res.status(400).json({ message: "Email e tipo de usuário são obrigatórios" });
        }

        const result = await hospitalStaffService.criarUsuario({
            nome,
            email,
            tipo_usuario,
            hospital_id
        });

        return res.status(201).json(result);

    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        return res.status(400).json({ message: error.message || "Erro ao criar usuário" });
    }
};

exports.listarUsuarios = async(req, res) => {
    try {
        const hospital_id = req.user.hospital_id;
        const { tipo } = req.query;

        const usuarios = await hospitalStaffService.listarUsuarios(hospital_id, tipo);

        return res.status(200).json(usuarios);

    } catch (error) {
        console.error("Erro ao listar usuários:", error);
        return res.status(500).json({ message: "Erro ao listar usuários" });
    }
};

exports.listarExames = async(req, res) => {
    try {
        const hospital_id = req.user.hospital_id;
        const exames = await hospitalStaffService.listarExames(hospital_id);
        return res.status(200).json(exames);
    } catch (error) {
        console.error("Erro ao listar exames:", error);
        return res.status(500).json({ message: "Erro ao listar exames" });
    }
};

exports.verEstoque = async(req, res) => {
    try {
        const hospital_id = req.user.hospital_id;
        const estoque = await hospitalStaffService.verEstoque(hospital_id);
        return res.status(200).json(estoque);
    } catch (error) {
        console.error("Erro ao buscar estoque:", error);
        return res.status(500).json({ message: "Erro ao buscar estoque" });
    }
};