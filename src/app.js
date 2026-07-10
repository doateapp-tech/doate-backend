const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const exameRoutes = require("./routes/exameRoutes");
const doadorRoutes = require("./routes/doadorRoutes");
const conviteRoutes = require("./routes/conviteRoutes");
const solicitacaoRoutes = require("./routes/solicitacaoRoutes");
const adminHospitalRoutes = require("./routes/adminHospitalRoutes");
const hospitalStaffRoutes = require("./routes/hospitalStaffRoutes");
const estoqueRoutes = require("./routes/estoqueRoutes");
const alertaRoutes = require("./routes/alertaRoutes");
const doacaoRoutes = require("./routes/doacaoRoutes");
const insRoutes = require("./routes/insRoutes");
const relatorioRoutes = require("./routes/relatorioRoutes");
const rankingRoutes = require("./routes/rankingRoutes");

const app = express();

app.use(cors());
app.use(express.json());


app.use("/api/auth", authRoutes);
app.use("/api/hospitais", hospitalRoutes);
app.use("/api/exames", exameRoutes);
app.use("/api/doadores", doadorRoutes);
app.use("/api/convites", conviteRoutes);
app.use("/api/solicitacoes", solicitacaoRoutes);
app.use("/api/admin/hospitais", adminHospitalRoutes);
app.use("/api/hospital", hospitalStaffRoutes);

app.use("/api/estoque", estoqueRoutes);
app.use("/api/alertas", alertaRoutes);
app.use("/api/doacoes", doacaoRoutes);
app.use("/api/ins", insRoutes);
app.use("/api/relatorios", relatorioRoutes);
app.use("/api/ranking", rankingRoutes);

app.get("/", (req, res) => {
    res.send("API Doate está online");
});

module.exports = app;
module.exports = app;