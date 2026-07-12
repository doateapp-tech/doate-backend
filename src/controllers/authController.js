const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { enviarCodigo, enviarRecuperacaoSenha } = require("../services/emailService");
const { generateToken } = require("../config/jwt");
const jwt = require("jsonwebtoken");

function gerarCodigo() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
exports.register = async(req, res) => {
    try {
        const { nome, email, telefone, senha } = req.body;

        if (!nome || !email || !telefone || !senha) {
            return res.status(400).json({ message: "Todos os campos são obrigatórios" });
        }
        const [existing] = await db.execute(
            "SELECT id FROM usuarios WHERE email = ? OR telefone = ?", [email, telefone]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: "Email ou telefone já cadastrado" });
        }

        const senhaHash = await bcrypt.hash(senha, 10);
        const codigo = gerarCodigo();
        const expiraEm = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

        await db.execute(
            `
            INSERT INTO usuarios 
            (nome, email, telefone, senha, tipo_usuario, email_verificado, 
             codigo_verificacao, codigo_expira_em, onboarding_completo, status)
            VALUES (?, ?, ?, ?, 'DOADOR', false, ?, ?, false, 'ativo')
            `, [nome, email, telefone, senhaHash, codigo, expiraEm]
        );

        await enviarCodigo(email, codigo);

        return res.status(201).json({
            message: "Usuário criado. Verifique seu email.",
        });

    } catch (error) {
        console.error("REGISTER ERROR:", error);
        return res.status(500).json({ message: "Erro ao registrar usuário" });
    }
};
const jwt = require("jsonwebtoken");

exports.verifyEmail = async(req, res) => {
    try {
        const { email, codigo } = req.body;

        const [rows] = await db.execute(
            "SELECT * FROM usuarios WHERE email = ?", [email]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: "Usuário não encontrado" });
        }

        const user = rows[0];

        if (!user.email_verificado) {

            if (user.codigo_verificacao !== codigo) {
                return res.status(400).json({ message: "Código inválido" });
            }

            if (new Date() > new Date(user.codigo_expira_em)) {
                return res.status(400).json({ message: "Código expirado" });
            }

            await db.execute(
                `
                UPDATE usuarios 
                SET email_verificado = true,
                    codigo_verificacao = NULL,
                    codigo_expira_em = NULL
                WHERE id = ?
                `, [user.id]
            );
        }
        const token = jwt.sign({
                id: user.id,
                email: user.email,
                tipo_usuario: user.tipo_usuario
            },
            process.env.JWT_SECRET, { expiresIn: "7d" }
        );

        return res.json({
            message: "Email verificado com sucesso",
            token,
            onboarding: false
        });

    } catch (error) {
        console.error("VERIFY EMAIL ERROR:", error);
        return res.status(500).json({ message: "Erro ao verificar email" });
    }
};

exports.resendCode = async(req, res) => {
    try {
        const { email } = req.body;

        const codigo = gerarCodigo();
        const expiraEm = new Date(Date.now() + 5 * 60 * 1000);

        await db.execute(
            `
            UPDATE usuarios
            SET codigo_verificacao = ?, codigo_expira_em = ?
            WHERE email = ?
            `, [codigo, expiraEm, email]
        );
        await enviarCodigo(email, codigo);


        return res.json({ message: "Novo código enviado" });

    } catch (error) {
        console.error("RESEND CODE ERROR:", error);
        return res.status(500).json({ message: "Erro ao reenviar código" });
    }
};
const { generateToken } = require("../config/jwt");

exports.login = async(req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                message: "Email e senha são obrigatórios"
            });
        }

        const [rows] = await db.execute(
            "SELECT * FROM usuarios WHERE email = ?", [email]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                message: "Credenciais inválidas"
            });
        }

        const user = rows[0];

        const senhaValida = await bcrypt.compare(senha, user.senha);

        if (!senhaValida) {
            return res.status(400).json({
                message: "Credenciais inválidas"
            });
        }

        if (user.status !== "ativo") {
            return res.status(403).json({
                message: "Conta inativa ou bloqueada"
            });
        }

        if (user.tipo_usuario === "DOADOR") {

            if (!user.email_verificado) {
                return res.status(403).json({
                    message: "Email não verificado"
                });
            }

            if (!user.onboarding_completo) {
                return res.status(403).json({
                    message: "Finalize o cadastro antes de entrar"
                });
            }
        }

        if (["SECRETARIO", "ESTOQUE"].includes(user.tipo_usuario)) {
            if (!user.hospital_id) {
                return res.status(403).json({
                    message: "Usuário não vinculado a um hospital"
                });
            }
        }

        if (user.tipo_usuario === "ADMIN") {

        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            tipo_usuario: user.tipo_usuario,
            hospital_id: user.hospital_id || null
        });

        return res.status(200).json({
            message: "Login realizado com sucesso",
            token,
            usuario: {
                id: user.id,
                nome: user.nome,
                email: user.email,
                tipo_usuario: user.tipo_usuario,
                hospital_id: user.hospital_id || null,
                onboarding_completo: user.onboarding_completo
            }
        });

    } catch (error) {
        console.error("LOGIN ERROR:", error);
        return res.status(500).json({
            message: "Erro interno no servidor"
        });
    }
};
exports.completeOnboarding = async(req, res) => {
    const connection = await db.getConnection();

    try {
        const userId = req.user.id;
        let { tipo_sanguineo, conhece_tipo_sanguineo } = req.body;

        if (conhece_tipo_sanguineo === undefined) {
            return res.status(400).json({
                message: "O campo 'conhece_tipo_sanguineo' é obrigatório"
            });
        }

        conhece_tipo_sanguineo = Number(conhece_tipo_sanguineo) === 1;
        console.log("REQ.USER:", req.user);
        if (conhece_tipo_sanguineo) {
            if (!tipo_sanguineo) {
                return res.status(400).json({
                    message: "Tipo sanguíneo é obrigatório quando o usuário informa que conhece"
                });
            }
        } else {
            tipo_sanguineo = null;
        }

        await connection.beginTransaction();

        const [users] = await connection.execute(
            "SELECT id, nome, onboarding_completo FROM usuarios WHERE id = ?", [userId]
        );

        if (users.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const user = users[0];

        if (user.onboarding_completo) {
            await connection.rollback();
            return res.status(400).json({
                message: "Onboarding já foi concluído"
            });
        }
        console.log("TIPO:", tipo_sanguineo);
        console.log("CONHECE:", conhece_tipo_sanguineo);

        const [existingDonor] = await connection.execute(
            "SELECT id FROM doadores WHERE id_usuario = ?", [userId]
        );

        if (existingDonor.length === 0) {
            await connection.execute(
                `
           INSERT INTO doadores
         (id_usuario, tipo_sanguineo, conhece_tipo_sanguineo,
          data_ultima_doacao,apto_para_doacao, criado_em)
             VALUES (?, ?, ?, NULL, 0, NOW())
                 `, [
                    userId,
                    tipo_sanguineo,
                    conhece_tipo_sanguineo ? 1 : 0
                ]
            );
        }

        await connection.execute(
            "UPDATE usuarios SET onboarding_completo = true WHERE id = ?", [userId]
        );

        await connection.commit();

        return res.json({
            message: "Onboarding concluído com sucesso"
        });

    } catch (error) {
        await connection.rollback();
        console.error("COMPLETE ONBOARDING ERROR:", error);
        return res.status(500).json({
            message: "Erro ao finalizar onboarding"
        });
    } finally {
        connection.release();
    }
};
exports.salvarPushToken = async(req, res) => {
    try {
        const userId = req.user.id;
        const { push_token } = req.body;

        if (!push_token) {
            return res.status(400).json({
                message: "Push token é obrigatório",
            });
        }

        // ✅ Remove este token de qualquer OUTRO utilizador (dispositivo partilhado)
        await db.execute(
            `UPDATE usuarios SET push_token = NULL WHERE push_token = ? AND id != ?`, [push_token, userId]
        );

        await db.execute(
            `
            UPDATE usuarios
            SET push_token = ?
            WHERE id = ?
            `, [push_token, userId]
        );

        return res.status(200).json({
            message: "Push token salvo com sucesso",
        });

    } catch (error) {
        console.error("Erro ao salvar push token:", error);
        return res.status(500).json({
            message: "Erro interno",
        });
    }
};
exports.savePushToken = async(req, res) => {
    try {
        const userId = req.user.id;
        const { push_token } = req.body;

        if (!push_token) {
            return res.status(400).json({ message: "push_token é obrigatório" });
        }

        await db.execute(
            `UPDATE usuarios SET push_token = NULL WHERE push_token = ? AND id != ?`, [push_token, userId]
        );

        await db.execute(
            `UPDATE usuarios SET push_token = ? WHERE id = ?`, [push_token, userId]
        );

        return res.status(200).json({ message: "Push token actualizado" });

    } catch (error) {
        console.error("Erro ao guardar push token:", error);
        return res.status(500).json({ message: "Erro interno" });
    }
};

exports.obterPerfil = async(req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Não autenticado." });
        }

        const [rows] = await db.execute(
            `SELECT id, nome, email, telefone, tipo_usuario, criado_em
             FROM usuarios WHERE id = ?`, [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Utilizador não encontrado." });
        }

        return res.status(200).json({ perfil: rows[0] });

    } catch (error) {
        console.error("Erro ao obter perfil:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};

exports.actualizarPerfil = async(req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Não autenticado." });
        }

        const { nome, telefone } = req.body;

        if (!nome || nome.trim() === "") {
            return res.status(400).json({ message: "O nome é obrigatório." });
        }

        await db.execute(
            `UPDATE usuarios SET nome = ?, telefone = ? WHERE id = ?`, [nome.trim(), telefone ? telefone.trim() : null, req.user.id]
        );

        // Actualiza o localStorage do frontend via resposta
        const [rows] = await db.execute(
            `SELECT id, nome, email, telefone, tipo_usuario, hospital_id
             FROM usuarios WHERE id = ?`, [req.user.id]
        );

        return res.status(200).json({
            message: "Perfil actualizado com sucesso.",
            usuario: rows[0],
        });

    } catch (error) {
        console.error("Erro ao actualizar perfil:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};

exports.alterarSenha = async(req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Não autenticado." });
        }

        const { senha_actual, nova_senha, confirmar_senha } = req.body;

        if (!senha_actual || !nova_senha || !confirmar_senha) {
            return res.status(400).json({ message: "Todos os campos são obrigatórios." });
        }

        if (nova_senha !== confirmar_senha) {
            return res.status(400).json({ message: "As senhas não coincidem." });
        }

        if (nova_senha.length < 8) {
            return res.status(400).json({ message: "A nova senha deve ter no mínimo 8 caracteres." });
        }

        if (!/[\d!@#$%^&*(),.?":{}|<>]/.test(nova_senha)) {
            return res.status(400).json({ message: "A senha deve conter pelo menos um número ou símbolo." });
        }

        const [rows] = await db.execute(
            `SELECT senha FROM usuarios WHERE id = ?`, [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Utilizador não encontrado." });
        }

        const senhaValida = await bcrypt.compare(senha_actual, rows[0].senha);

        if (!senhaValida) {
            return res.status(400).json({ message: "Senha actual incorrecta." });
        }

        const hashNova = await bcrypt.hash(nova_senha, 10);

        await db.execute(
            `UPDATE usuarios SET senha = ? WHERE id = ?`, [hashNova, req.user.id]
        );

        return res.status(200).json({ message: "Senha alterada com sucesso." });

    } catch (error) {
        console.error("Erro ao alterar senha:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};
const { enviarRecuperacaoSenha } = require("../services/emailService");

// PASSO 1 — Solicitar código de recuperação
exports.solicitarRecuperacaoSenha = async(req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email é obrigatório." });
        }

        const [rows] = await db.execute(
            `SELECT id FROM usuarios WHERE email = ?`, [email]
        );

        // Responde sempre com sucesso para não revelar se o email existe
        if (rows.length === 0) {
            return res.status(200).json({ message: "Se o email existir, receberá um código." });
        }

        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const expiraEm = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

        await db.execute(
            `UPDATE usuarios SET codigo_verificacao = ?, codigo_expira_em = ? WHERE email = ?`, [codigo, expiraEm, email]
        );

        await enviarRecuperacaoSenha(email, codigo);

        return res.status(200).json({ message: "Código enviado para o seu email." });

    } catch (error) {
        console.error("Erro ao solicitar recuperação:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};

// PASSO 2 — Verificar código e redefinir senha
exports.redefinirSenha = async(req, res) => {
    try {
        const { email, codigo, novaSenha } = req.body;

        if (!email || !codigo || !novaSenha) {
            return res.status(400).json({ message: "Todos os campos são obrigatórios." });
        }

        if (novaSenha.length < 6) {
            return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });
        }

        const [rows] = await db.execute(
            `SELECT id, codigo_verificacao, codigo_expira_em FROM usuarios WHERE email = ?`, [email]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: "Email não encontrado." });
        }

        const user = rows[0];

        if (user.codigo_verificacao !== codigo) {
            return res.status(400).json({ message: "Código inválido." });
        }

        if (new Date() > new Date(user.codigo_expira_em)) {
            return res.status(400).json({ message: "Código expirado. Solicite um novo." });
        }

        const senhaHash = await bcrypt.hash(novaSenha, 10);

        await db.execute(
            `UPDATE usuarios 
             SET senha = ?, codigo_verificacao = NULL, codigo_expira_em = NULL 
             WHERE email = ?`, [senhaHash, email]
        );

        return res.status(200).json({ message: "Senha redefinida com sucesso." });

    } catch (error) {
        console.error("Erro ao redefinir senha:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};