const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function enviarCodigo(email, codigo) {
    try {
        await resend.emails.send({
            from: "Doate <onboarding@resend.dev>",
            to: email,
            subject: "Código de verificação Doate",
            html: `
                <h2>Verificação de Email</h2>
                <p>Seu código é:</p>
                <h1>${codigo}</h1>
                <p>Este código expira em 1 minuto.</p>
            `,
        });
    } catch (error) {
        console.error("ERRO AO ENVIAR EMAIL:", error.message);
        throw error;
    }
}

async function enviarConviteHospital(email, link) {
    try {
        await resend.emails.send({
            from: "Doate <onboarding@resend.dev>",
            to: email,
            subject: "Convite para acesso ao painel hospitalar - Doate",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2 style="color: #ff3b3b;">Bem-vindo ao Doate</h2>
                  <p>O seu hospital foi aprovado para utilizar o nosso sistema.</p>
                  <p>Clique no botão abaixo para completar o seu cadastro:</p>
                  <a href="${link}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #ff3b3b; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Ativar Conta
                  </a>
                  <p style="margin-top: 20px;">Ou copie e cole este link no seu navegador:</p>
                  <p style="color: #555;">${link}</p>
                  <hr style="margin: 30px 0;" />
                  <p style="font-size: 12px; color: #999;">Este link expira automaticamente. Caso não tenha solicitado, ignore este email.</p>
                </div>
            `,
        });
    } catch (error) {
        console.error("ERRO AO ENVIAR CONVITE:", error.message);
        throw error;
    }
}

async function enviarConviteUsuario(email, link, tipo) {
    try {
        const tipoFormatado =
            tipo === "SECRETARIO" ? "Secretário" :
            tipo === "ESTOQUE" ? "Responsável de Estoque" :
            "Usuário";

        await resend.emails.send({
            from: "Doate <onboarding@resend.dev>",
            to: email,
            subject: "Convite para acesso ao sistema Doate",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2 style="color: #ff3b3b;">Convite Doate</h2>
                  <p>Você foi convidado para acessar o sistema como:</p>
                  <p><strong>${tipoFormatado}</strong></p>
                  <p>Clique no botão abaixo para ativar a sua conta:</p>
                  <a href="${link}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #ff3b3b; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Ativar Conta
                  </a>
                  <p style="margin-top: 20px;">Ou copie e cole este link:</p>
                  <p style="color: #555;">${link}</p>
                  <hr style="margin: 30px 0;" />
                  <p style="font-size: 12px; color: #999;">Este convite expira em 48 horas.</p>
                </div>
            `,
        });
    } catch (error) {
        console.error("ERRO AO ENVIAR CONVITE USUÁRIO:", error.message);
        throw error;
    }
}

async function enviarSolicitacaoHospital(dados) {
    try {
        const { nome, email, nif, provincia, municipio, telefone, mensagem } = dados;

        await resend.emails.send({
            from: "Doate Sistema <onboarding@resend.dev>",
            to: process.env.EMAIL_USER,
            replyTo: email,
            subject: `Nova solicitação de acesso hospitalar - ${nome}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2 style="color: #ff3b3b;">Nova Solicitação de Hospital</h2>
                  <p>Um hospital solicitou acesso ao sistema DOATE.</p>
                  <hr style="margin: 20px 0;" />
                  <p><strong>Nome:</strong> ${nome}</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>NIF:</strong> ${nif}</p>
                  <p><strong>Província:</strong> ${provincia}</p>
                  <p><strong>Município:</strong> ${municipio}</p>
                  <p><strong>Telefone:</strong> ${telefone || "-"}</p>
                  <p><strong>Mensagem:</strong> ${mensagem || "-"}</p>
                </div>
            `,
        });
    } catch (error) {
        console.error("ERRO AO ENVIAR SOLICITAÇÃO:", error.message);
        throw error;
    }
}

async function enviarRecuperacaoSenha(email, codigo) {
    try {
        await resend.emails.send({
            from: "Doate <onboarding@resend.dev>",
            to: email,
            subject: "Recuperação de senha — Doate",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fff; border-radius: 12px;">
                    <div style="text-align: center; margin-bottom: 28px;">
                        <h1 style="color: #E53935; font-size: 28px; margin: 0;">DOATE</h1>
                        <p style="color: #9ca3af; font-size: 13px; margin-top: 4px;">Sistema de Doação de Sangue</p>
                    </div>
                    <h2 style="color: #1e1e2f; font-size: 20px; margin-bottom: 8px;">Recuperação de senha</h2>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 28px;">
                        Recebemos um pedido para redefinir a senha da sua conta. Use o código abaixo para continuar.
                    </p>
                    <div style="background: #fff5f5; border: 1px solid #fecaca; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.1em;">Código de verificação</p>
                        <h1 style="color: #E53935; font-size: 42px; font-weight: 800; letter-spacing: 12px; margin: 0;">${codigo}</h1>
                        <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0 0;">Expira em 10 minutos</p>
                    </div>
                    <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin-bottom: 0;">
                        Se não solicitou esta recuperação, ignore este email. A sua senha permanece inalterada.
                    </p>
                    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
                    <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">© 2026 Doate · Dar vida para salvar vida</p>
                </div>
            `,
        });
    } catch (error) {
        console.error("ERRO AO ENVIAR EMAIL DE RECUPERAÇÃO:", error.message);
        throw error;
    }
}

module.exports = {
    enviarCodigo,
    enviarConviteHospital,
    enviarConviteUsuario,
    enviarSolicitacaoHospital,
    enviarRecuperacaoSenha,
};