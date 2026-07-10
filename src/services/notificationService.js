const fetch = require("node-fetch");

// Haversine — distância entre dois pontos em km
function calcularDistancia(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return null;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

exports.enviarPushParaDoadores = async({
    doadores,
    tipo_sanguineo,
    mensagem,
    hospital,
}) => {
    try {
        if (!doadores || doadores.length === 0) {
            console.log("Nenhum doador para notificar");
            return { success: false, message: "Sem doadores" };
        }

        const doadoresValidos = doadores.filter(
            d => d.push_token && d.push_token.trim() !== ""
        );

        if (doadoresValidos.length === 0) {
            console.log("Nenhum push_token válido");
            return { success: false, message: "Sem tokens válidos" };
        }

        const nomeHospital = hospital ? hospital.nome : "Hospital parceiro";
        const localizacao = hospital ?
            `${hospital.municipio}, ${hospital.provincia}` :
            "";

        const messages = doadoresValidos.map(d => {
            // distância personalizada por doador com base na localização actual
            const distancia = calcularDistancia(
                d.doador_lat, d.doador_lng,
                hospital ? Number(hospital.latitude) : null,
                hospital ? Number(hospital.longitude) : null
            );

            const bodyText = mensagem || (
                `${nomeHospital} precisa de sangue ${tipo_sanguineo}.` +
                (localizacao ? ` Localizado em ${localizacao}.` : "") +
                (distancia ? ` A ${distancia} km de si.` : "") +
                ` Esta é a sua oportunidade de salvar vidas.`
            );

            return {
                to: d.push_token,
                sound: "default",
                title: `🚨 Doação urgente — ${tipo_sanguineo}`,
                body: bodyText,
                data: {
                    screen: "alerta",
                    tipo_sanguineo,
                    hospital_id: hospital ? hospital.id : null,
                    hospital_nome: nomeHospital,
                    hospital_provincia: hospital ? hospital.provincia : null,
                    hospital_municipio: hospital ? hospital.municipio : null,
                    hospital_latitude: hospital ? Number(hospital.latitude) : null,
                    hospital_longitude: hospital ? Number(hospital.longitude) : null,
                    distancia_km: distancia,
                },
                priority: "high",
                channelId: "alertas-doacao",
            };
        });

        // Expo limita a 100 por chunk
        const chunks = [];
        for (let i = 0; i < messages.length; i += 100) {
            chunks.push(messages.slice(i, i + 100));
        }

        let totalEnviado = 0;

        for (const chunk of chunks) {
            const response = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(chunk),
            });

            const data = await response.json();
            // TEMPORÁRIO — ver resposta completa do Expo
            console.log("RESPOSTA EXPO:", JSON.stringify(data));

            if (!response.ok) {
                console.error("Erro na API do Expo:", data);
                continue;
            }

            totalEnviado += chunk.length;
            console.log(`Chunk enviado: ${chunk.length} notificações`);
        }

        return { success: true, total_enviado: totalEnviado };

    } catch (error) {
        console.error("Erro ao enviar push:", error);
        throw new Error("Falha ao enviar notificações");
    }
};