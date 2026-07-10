const jwt = require("jsonwebtoken");

exports.authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Token não fornecido ou mal formatado"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Token inválido ou expirado"
        });
    }
};
exports.authorize = (...rolesPermitidos) => {
    return (req, res, next) => {

        if (!req.user) {
            return res.status(401).json({
                message: "Usuário não autenticado"
            });
        }
        if (!req.user.tipo_usuario) {
            return res.status(403).json({
                message: "Perfil de usuário inválido"
            });
        }

        if (!rolesPermitidos.includes(req.user.tipo_usuario)) {
            return res.status(403).json({
                message: "Acesso negado: permissão insuficiente"
            });
        }

        next();
    };
};

exports.onlyHospitalStaff = (req, res, next) => {

    if (!req.user) {
        return res.status(401).json({
            message: "Usuário não autenticado"
        });
    }

    const { tipo_usuario, hospital_id } = req.user;

    if (tipo_usuario === "DOADOR") {
        return res.status(403).json({
            message: "Acesso restrito ao painel hospitalar"
        });
    }

    if (
        ["SECRETARIO", "ESTOQUE"].includes(tipo_usuario) &&
        !hospital_id
    ) {
        return res.status(403).json({
            message: "Usuário não vinculado a um hospital"
        });
    }

    next();
};
exports.onlySystemAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            message: "Usuário não autenticado"
        });
    }

    if (req.user.hospital_id) {
        return res.status(403).json({
            message: "Acesso permitido apenas para administradores do sistema"
        });
    }

    if (req.user.tipo_usuario !== "ADMIN") {
        return res.status(403).json({
            message: "Acesso restrito ao administrador do sistema"
        });
    }

    next();
};