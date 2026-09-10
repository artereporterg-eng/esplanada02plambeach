import "dotenv/config";
import path from "path";
import fs from "fs";
import express from "express";
import { createServer as createViteServer } from "vite";
import app from "./api/index.ts";

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pérola do Oceano ERP running on http://0.0.0.0:${PORT} (Vercel & Turso Ready)`);
  });
}

startServer();
