require("dotenv").config();
const app = require("./app");
const pool = require("./config/db");
const locationRoutes = require("./routes/locationRoutes");
const cron = require("node-cron");
const { cleanupIncompleteUsers } = require("./jobs/cleanupUsers");

app.use("/api/location", locationRoutes);

const PORT = process.env.PORT || 3333;

(async() => {
    try {
        await pool.query("SELECT 1");
        console.log(" MySQL conectado com sucesso");


        cron.schedule("0 * * * *", async() => {
            console.log(" Executando limpeza automática...");
            await cleanupIncompleteUsers();
        });

        app.listen(PORT, "0.0.0.0", () => {
            console.log(` Servidor a correr na porta ${PORT}`);
        });

    } catch (error) {
        console.error(" Erro ao conectar ao MySQL:", error.message);
    }
})();