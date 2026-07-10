const jwt = require("jsonwebtoken");

exports.generateToken = (user) => {
    return jwt.sign({
            id: user.id,
            tipo_usuario: user.tipo_usuario,
            email: user.email,
            hospital_id: user.hospital_id || null
        },
        process.env.JWT_SECRET, {
            expiresIn: "7d"
        }
    );
};

exports.verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};