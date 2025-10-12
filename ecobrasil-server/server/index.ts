import express from "express";
import cors from "cors";
import { initDB } from "./db.js";
import datasetsRouter from "./routes/datasets.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// Inicializa DB
await initDB();

// Rotas
app.use("/api/datasets", datasetsRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ EcoBrasil Server rodando em http://localhost:${PORT}`);
});