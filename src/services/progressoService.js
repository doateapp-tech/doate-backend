const META_ANUAL = 4;
const INTERVALO_MINIMO_DIAS = 90;

/**
 * 
 * @param {number} totalDoacoes
 * @param {Date|null} ultimaDoacao
 * @returns {Object}
 */
function calcularProgresso(totalDoacoes, ultimaDoacao) {

    const total = Number(totalDoacoes) || 0;

    const percentual = Math.min(
        Math.round((total / META_ANUAL) * 100),
        100
    );

    const faltamDoacoes = Math.max(META_ANUAL - total, 0);

    let nivel = "Iniciante";

    if (total >= 4) {
        nivel = "Ouro";
    } else if (total >= 2) {
        nivel = "Prata";
    } else if (total >= 1) {
        nivel = "Bronze";
    }

    let diasRestantes = 0;
    let elegivel = true;

    if (ultimaDoacao) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const ultima = new Date(ultimaDoacao);
        ultima.setHours(0, 0, 0, 0);

        const diffMs = hoje.getTime() - ultima.getTime();
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        diasRestantes = Math.max(INTERVALO_MINIMO_DIAS - diffDias, 0);
        elegivel = diasRestantes === 0;
    }

    const mensagem = gerarMensagem({
        total,
        percentual,
        nivel,
        faltamDoacoes,
        diasRestantes,
        elegivel
    });

    return {
        metaAnual: META_ANUAL,
        totalDoacoes: total,
        percentual,
        nivel,
        faltamDoacoes,
        diasRestantes,
        elegivel,
        mensagem
    };
}


function gerarMensagem({
    total,
    percentual,
    nivel,
    faltamDoacoes,
    diasRestantes,
    elegivel
}) {

    if (total === 0) {
        return "Faça sua primeira doação e torne-se um Doador Bronze.";
    }





    if (nivel === "Ouro") {
        return "Meta anual concluída. Você é um Doador Ouro. Obrigado por salvar vidas.";
    }

}

module.exports = {
    calcularProgresso
};