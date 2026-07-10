const db = require("../config/db");

exports.getNearestHospital = async(req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Usuário não autenticado." });
        }

        const userId = req.user.id;

        const [locations] = await db.execute(
            "SELECT latitude, longitude FROM localizacoes_usuario WHERE id_usuario = ?", [userId]
        );

        if (locations.length === 0) {
            return res.status(404).json({ message: "Localização do usuário não encontrada." });
        }

        const lat = Number(locations[0].latitude);
        const lng = Number(locations[0].longitude);

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ message: "Coordenadas inválidas." });
        }

        const query = `
    SELECT 
        h.id,
        h.nome,
        h.provincia,
        h.municipio,
        CAST(h.latitude AS DECIMAL(10,8)) AS latitude,
        CAST(h.longitude AS DECIMAL(11,8)) AS longitude,
        (
            6371 * acos(
                cos(radians(?)) *
                cos(radians(h.latitude)) *
                cos(radians(h.longitude) - radians(?)) +
                sin(radians(?)) *
                sin(radians(h.latitude))
            )
        ) AS distancia_km
    FROM hospitais h
    WHERE h.ativo = 1
    AND h.latitude IS NOT NULL
    AND h.longitude IS NOT NULL
    ORDER BY distancia_km ASC
    LIMIT 10
`;

        const [rows] = await db.execute(query, [lat, lng, lat]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Nenhum hospital parceiro disponível." });
        }

        const hospitais = rows.map(h => ({
            id: h.id,
            nome: h.nome,
            provincia: h.provincia,
            municipio: h.municipio,
            latitude: Number(h.latitude),
            longitude: Number(h.longitude),
            distancia_km: Number(h.distancia_km),
        }));

        return res.status(200).json({
            hospital: hospitais[0], // sugerido (mais próximo)
            hospitais, // lista completa
            userLocation: { latitude: lat, longitude: lng },
        });


    } catch (error) {
        console.error("ERRO REAL:", error);
        return res.status(500).json({ message: "Erro interno ao buscar hospital." });
    }
};
exports.getMeuHospital = async(req, res) => {
    try {
        let hospital_id = req.user.hospital_id;
        if (!hospital_id) {
            const [h] = await db.execute(
                `SELECT id FROM hospitais WHERE id_usuario = ?`, [req.user.id]
            );
            if (h.length === 0) return res.status(404).json({ message: "Hospital não encontrado." });
            hospital_id = h[0].id;
        }
        const [rows] = await db.execute(
            `SELECT nome, provincia, municipio FROM hospitais WHERE id = ?`, [hospital_id]
        );
        if (rows.length === 0) return res.status(404).json({ message: "Hospital não encontrado." });
        return res.status(200).json(rows[0]);
    } catch (error) {
        console.error("Erro ao buscar hospital:", error);
        return res.status(500).json({ message: "Erro interno." });
    }
};