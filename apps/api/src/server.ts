import { json, urlencoded } from "body-parser";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer as createHttpServer, Server } from "http";
import { log } from "@repo/logger";
import { WebsocketServer } from "./websockets";

export const createServer = (): {
  server: Server;
} => {
  const app = express();
  const server = createHttpServer(app);
  const wss = new WebSocketServer({ server: server });
  const wsServer = WebsocketServer.getInstance();

  wss.on("connection", (ws) => {
    log("New client connected");

    // Add client to our WebSocket server
    const userId = wsServer.addClient(ws);

    // Handle messages from this specific client
    ws.on("message", (message) => {
      log(`Received from ${userId}: ${message}`);
      wsServer.handleMessage(ws, message.toString());
    });

    // Handle this client disconnecting
    ws.on("close", () => {
      log(`Client ${userId} disconnected`);
      wsServer.removeClient(ws);
    });

    // Handle WebSocket errors
    ws.on("error", (error) => {
      log(`WebSocket error for ${userId}:`, error);
      wsServer.removeClient(ws);
    });
  });

  app
    .disable("x-powered-by")
    .use(morgan("dev"))
    .use(urlencoded({ extended: true }))
    .use(json())
    .use(cors())
    .get("/message/:name", (req, res) => {
      return res.json({ message: `hello ${req.params.name}` });
    })
    .get("/status", (_, res) => {
      return res.json({
        ok: true,
        clients: wsServer.getClientCount(),
        cursors: wsServer.getCursors().size,
      });
    });

  return { server };
};
