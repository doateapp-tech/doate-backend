const solicitacaoService = require("../services/solicitacaoService");

exports.criarSolicitacao = async(req, res) => {
    try {
        const result = await solicitacaoService.criarSolicitacao(req.body);

        return res.status(201).json({
            success: true,
            message: result.message,
            id: result.id,
        });

    } catch (error) {
        console.error("Erro ao criar solicitação:", error);

        return res.status(400).json({
            success: false,

            message: error.message || "Erro ao enviar solicitação",
        });
    }
};

exports.listarSolicitacoes = async(req, res) => {
    try {
        const result = await solicitacaoService.listarSolicitacoes();

        return res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error("Erro ao listar solicitações:", error);

        return res.status(500).json({
            success: false,
            message: "Erro ao listar solicitações",
        });
    }
};


exports.getSolicitacaoById = async(req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "ID é obrigatório",
            });
        }

        const result = await solicitacaoService.getSolicitacaoById(id);

        return res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error("Erro ao buscar solicitação:", error);

        return res.status(404).json({
            success: false,
            message: error.message || "Solicitação não encontrada",
        });
    }
};
exports.atualizarStatus = async(req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, message: "ID é obrigatório" });
        }

        if (!status) {
            return res.status(400).json({ success: false, message: "Status é obrigatório" });
        }

        const statusPermitidos = ["pendente", "aprovado", "rejeitado"];

        if (!statusPermitidos.includes(status)) {
            return res.status(400).json({ success: false, message: "Status inválido" });
        }

        const result = await solicitacaoService.atualizarStatus(id, status);

        return res.status(200).json({
            success: true,
            message: result.message,
            hospital_id: result.hospital_id || null,
        });

    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Erro ao atualizar status",
        });
    }
};