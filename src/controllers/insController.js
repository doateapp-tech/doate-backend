const db = require("../config/db");

function classificarNivel(quantidade) {
    if (quantidade <= 9) return "critico";
    if (quantidade <= 19) return "baixo";
    return "normal";
}

exports.dashboardOverview = async(req, res) => {
    try {
        // Hospitais activos
        const [hospitaisAtivos] = await db.execute(
            `SELECT COUNT(*) AS total FROM hospitais WHERE ativo = 1`
        );

        // Doadores registados (total nacional)
        const [doadoresRegistados] = await db.execute(
            `SELECT COUNT(*) AS total FROM doadores`
        );

        // Relatórios recebidos este mês
        const [relatoriosMes] = await db.execute(
            `SELECT COUNT(*) AS total FROM relatorios_ins
             WHERE status = 'enviado'
             AND MONTH(enviado_em) = MONTH(NOW())
             AND YEAR(enviado_em) = YEAR(NOW())`
        );

        // Estoque agregado por tipo sanguíneo (nacional)
        const [estoqueNacional] = await db.execute(
            `SELECT tipo_sanguineo AS tipo, SUM(quantidade) AS total
             FROM estoque_sangue
             GROUP BY tipo_sanguineo
             ORDER BY FIELD(tipo_sanguineo, 'O-','O+','A-','A+','B-','B+','AB-','AB+')`
        );

        const estoqueComNivel = estoqueNacional.map(e => ({
            tipo: e.tipo,
            total: Number(e.total),
            nivel: classificarNivel(Number(e.total)),
        }));

        // Tipos sanguíneos distintos que estão críticos em pelo menos um hospital
        const [tiposCriticosRaw] = await db.execute(
            `SELECT DISTINCT tipo_sanguineo
             FROM estoque_sangue
             WHERE quantidade <= 9`
        );

        const tiposCriticos = tiposCriticosRaw.length;

        // Hospitais com pelo menos um tipo crítico
        const [hospitaisCriticosRaw] = await db.execute(
            `SELECT h.id, h.nome, h.provincia, h.municipio,
                    es.tipo_sanguineo, es.quantidade
             FROM estoque_sangue es
             JOIN hospitais h ON h.id = es.hospital_id
             WHERE es.quantidade <= 9
             ORDER BY es.quantidade ASC`
        );

        // Agrupa por hospital
        const hospitaisCriticosMap = new Map();
        hospitaisCriticosRaw.forEach(row => {
            if (!hospitaisCriticosMap.has(row.id)) {
                hospitaisCriticosMap.set(row.id, {
                    id: row.id,
                    nome: row.nome,
                    provincia: row.provincia,
                    municipio: row.municipio,
                    tipos_criticos: [],
                });
            }
            hospitaisCriticosMap.get(row.id).tipos_criticos.push({
                tipo: row.tipo_sanguineo,
                quantidade: row.quantidade,
            });
        });

        const hospitaisCriticos = Array.from(hospitaisCriticosMap.values());

        return res.status(200).json({
            hospitais_ativos: Number(hospitaisAtivos[0].total),
            tipos_criticos: tiposCriticos,
            tipos_criticos_lista: tiposCriticosRaw.map(t => t.tipo_sanguineo),
            doadores_registados: Number(doadoresRegistados[0].total),
            relatorios_recebidos: Number(relatoriosMes[0].total),
            estoque_nacional: estoqueComNivel,
            hospitais_criticos: hospitaisCriticos,
        });

    } catch (error) {
        console.error("Erro ao buscar dashboard INS:", error);
        return res.status(500).json({ message: "Erro interno ao carregar dashboard." });
    }
};