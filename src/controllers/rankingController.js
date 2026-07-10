const db = require("../config/db");

exports.rankingSemanal = async(req, res) => {
    try {
        // Semana actual — últimos 7 dias
        const [rankingAtual] = await db.execute(
            `SELECT h.id, h.nome, h.provincia, h.municipio,
                    COUNT(*) AS total_doacoes,
                    COUNT(DISTINCT dc.id_doador) AS doadores_unicos
             FROM doacoes dc
             JOIN hospitais h ON h.id = dc.id_hospital
             WHERE dc.data_doacao >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             GROUP BY h.id, h.nome, h.provincia, h.municipio
             ORDER BY total_doacoes DESC
             LIMIT 5`
        );

        // Semana anterior — 7 a 14 dias atrás (para calcular tendência)
        const [rankingAnterior] = await db.execute(
            `SELECT h.id,
                    COUNT(*) AS total_doacoes
             FROM doacoes dc
             JOIN hospitais h ON h.id = dc.id_hospital
             WHERE dc.data_doacao >= DATE_SUB(NOW(), INTERVAL 14 DAY)
             AND dc.data_doacao < DATE_SUB(NOW(), INTERVAL 7 DAY)
             GROUP BY h.id
             ORDER BY total_doacoes DESC`
        );

        // Mapa de posições da semana anterior
        const posicoesAnteriores = new Map();
        rankingAnterior.forEach((h, index) => {
            posicoesAnteriores.set(h.id, index + 1);
        });

        const ranking = rankingAtual.map((h, index) => {
            const posicaoAtual = index + 1;
            const posicaoAnterior = posicoesAnteriores.get(h.id);

            let tendencia = "novo";
            let diferenca = 0;

            if (posicaoAnterior !== undefined) {
                if (posicaoAnterior > posicaoAtual) {
                    tendencia = "subiu";
                    diferenca = posicaoAnterior - posicaoAtual;
                } else if (posicaoAnterior < posicaoAtual) {
                    tendencia = "desceu";
                    diferenca = posicaoAtual - posicaoAnterior;
                } else {
                    tendencia = "manteve";
                }
            }

            return {
                posicao: posicaoAtual,
                hospital_id: h.id,
                hospital_nome: h.nome,
                provincia: h.provincia,
                municipio: h.municipio,
                total_doacoes: Number(h.total_doacoes),
                doadores_unicos: Number(h.doadores_unicos),
                tendencia,
                diferenca,
            };
        });

        // Stats gerais da semana
        const [statsGerais] = await db.execute(
            `SELECT COUNT(*) AS total_doacoes,
                    COUNT(DISTINCT id_doador) AS total_doadores
             FROM doacoes
             WHERE data_doacao >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
        );

        return res.status(200).json({
            ranking,
            total_doacoes_semana: Number(statsGerais[0].total_doacoes),
            total_doadores_semana: Number(statsGerais[0].total_doadores),
            periodo: {
                inicio: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                fim: new Date().toISOString(),
            },
        });

    } catch (error) {
        console.error("Erro ao buscar ranking semanal:", error);
        return res.status(500).json({ message: "Erro interno ao carregar ranking." });
    }
};