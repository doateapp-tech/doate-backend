const hospitalService = require("../services/hospitalService");

exports.listarHospitais = async(req, res) => {
    try {
        const hospitais = await hospitalService.listarHospitais();

        return res.status(200).json(hospitais);

    } catch (error) {
        console.error("Erro ao listar hospitais:", error);

        return res.status(500).json({
            message: "Erro ao listar hospitais",
        });
    }
};


exports.getHospitalById = async(req, res) => {
    try {
        const { id } = req.params;

        const hospital = await hospitalService.getHospitalById(id);

        return res.status(200).json(hospital);

    } catch (error) {
        console.error("Erro ao buscar hospital:", error);

        return res.status(404).json({
            message: error.message || "Hospital não encontrado",
        });
    }
};


exports.atualizarHospital = async(req, res) => {
    try {
        const { id } = req.params;
        const {
            nome,
            provincia,
            municipio,
            latitude,
            longitude
        } = req.body;

        if (!nome || !nome.trim()) {
            return res.status(400).json({
                message: "Nome é obrigatório",
            });
        }

        const result = await hospitalService.atualizarHospital(id, {
            nome,
            provincia,
            municipio,
            latitude,
            longitude
        });

        return res.status(200).json(result);

    } catch (error) {
        console.error("Erro ao atualizar hospital:", error);

        return res.status(400).json({
            message: error.message || "Erro ao atualizar hospital",
        });
    }
};


exports.desativarHospital = async(req, res) => {
    try {
        const { id } = req.params;

        const result = await hospitalService.desativarHospital(id);

        return res.status(200).json(result);

    } catch (error) {
        console.error("Erro ao desativar hospital:", error);

        return res.status(400).json({
            message: error.message || "Erro ao desativar hospital",
        });
    }
};