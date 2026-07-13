const conviteService = require("../services/conviteService");

exports.criarConvite = async(req, res) => {
    try {
        const { hospital_id, email, tipo } = req.body;

        if (!hospital_id || !email) {
            return res.status(400).json({
                message: "hospital_id e email são obrigatórios",
            });
        }


        const result = await conviteService.criarConvite({
            hospital_id,
            email,
            tipo,
        });

        return res.status(201).json(result);

    } catch (error) {
        console.error("Erro ao criar convite:", error);

        return res.status(400).json({
            message: error.message || "Erro ao criar convite",
        });
    }
};
exports.validarConvite = async(req, res) => {
    try {
        const { token } = req.params;

        const result = await conviteService.validarConvite(token);

        return res.status(200).json(result);

    } catch (error) {
        console.error("Erro ao validar convite:", error);

        return res.status(400).json({
            message: error.message || "Erro ao validar convite",
        });
    }
};
exports.ativarConta = async(req, res) => {
    try {
        const { token, email, password, nome } = req.body;
        if (!token || !email || !password) {
            return res.status(400).json({
                message: "Token, email e password são obrigatórios",
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "A senha deve ter pelo menos 6 caracteres",
            });
        }

        const result = await conviteService.ativarConta({
            token,
            email,
            password,
            nome,
        });

        return res.status(200).json(result);

    } catch (error) {
        console.error("Erro ao ativar conta:", error);

        return res.status(400).json({
            message: error.message || "Erro ao ativar conta",
        });
    }
};
exports.getLinkConvite = async(req, res) => {
    try {
        const { hospital_id } = req.params;

        const [rows] = await db.execute(
            `SELECT link_ativacao, email, tipo, criado_em, expira_em 
             FROM convites 
             WHERE hospital_id = ? 
             AND usado = 0 
             AND expira_em > NOW()
             ORDER BY criado_em DESC 
             LIMIT 1`, [hospital_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Nenhum convite activo encontrado." });
        }

        return res.status(200).json(rows[0]);

    } catch (error) {
        console.error("Erro ao buscar link convite:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};