const express = require("express");
const cors = require("cors");
require("dotenv").config();

const routes = require("./routes");
const webhookRoutes = require("./routes/webhook.routes");
const errorHandler = require("./middlewares/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Mateos Pet AI funcionando 🚀");
});

app.use("/webhook", webhookRoutes);
app.use("/api", routes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});