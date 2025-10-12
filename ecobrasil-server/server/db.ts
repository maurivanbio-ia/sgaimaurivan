import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";

const dbPath = path.resolve("data/database.sqlite");

export const dbPromise = open({
  filename: dbPath,
  driver: sqlite3.Database,
});

export async function initDB() {
  const db = await dbPromise;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS datasets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empreendimentoId INTEGER NOT NULL,
      nome TEXT NOT NULL,
      descricao TEXT,
      tipo TEXT NOT NULL,
      tamanho INTEGER,
      usuario TEXT,
      url TEXT,
      dataUpload TEXT
    );
  `);

  return db;
}