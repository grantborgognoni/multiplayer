import { WebSocket } from "ws";

interface Cursor {
  color: string;
  x: number;
  y: number;
  lastSeen: Date;
}

interface Client {
  ws: WebSocket;
  userId: string;
  cursor?: Cursor;
}

interface Message {
  type: "cursor_update" | "chat_message" | "user_joined" | "user_left";
  userId?: string;
  data: any;
}

// interface Annotations {
//   annotationId: string;
//   boardId: string;
//   userId: string;
//   x: number;
//   y: number;
//   text: string;
//   createdAt: Date;
//   updatedAt: Date;
//   createdBy: string;
// }

/**
 * Follows a singleton pattern and acts as the global
 * entry point for all websocket operations.
 */
export class WebsocketServer {
  private static instance: WebsocketServer;
  private clients: Map<WebSocket, Client>;
  private cursors: Map<string, Cursor>;

  private constructor() {
    this.clients = new Map();
    this.cursors = new Map();
  }

  public static getInstance(): WebsocketServer {
    if (!WebsocketServer.instance) {
      WebsocketServer.instance = new WebsocketServer();
    }
    return WebsocketServer.instance;
  }

  // Generate a random color for new users
  private generateRandomColor(): string {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E9",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Add a new client connection
  addClient(ws: WebSocket): string {
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const client: Client = {
      ws,
      userId,
    };

    this.clients.set(ws, client);
    console.log(
      `Client ${userId} connected. Total clients: ${this.clients.size}`
    );

    // Send welcome message with user ID
    this.sendToClient(ws, {
      type: "user_joined",
      userId,
      data: {
        userId,
        message: "Connected successfully!",
        cursors: Object.fromEntries(this.cursors),
      },
    });

    // Notify other clients about new user
    this.broadcastToOthers(ws, {
      type: "user_joined",
      userId,
      data: { userId, message: `${userId} joined the session` },
    });

    return userId;
  }

  // Remove a client connection
  removeClient(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (client) {
      const { userId } = client;
      this.clients.delete(ws);
      this.cursors.delete(userId);

      console.log(
        `Client ${userId} disconnected. Total clients: ${this.clients.size}`
      );

      // Notify other clients about user leaving
      this.broadcastToOthers(ws, {
        type: "user_left",
        userId,
        data: { userId, message: `${userId} left the session` },
      });
    }
  }

  // Handle incoming messages
  handleMessage(ws: WebSocket, message: string): void {
    try {
      const client = this.clients.get(ws);
      if (!client) return;

      // Try to parse as JSON for structured messages
      let parsedMessage: Message;
      try {
        parsedMessage = JSON.parse(message);
      } catch {
        // If not JSON, treat as a simple chat message
        parsedMessage = {
          type: "chat_message",
          userId: client.userId,
          data: { message },
        };
      }

      // Handle different message types
      switch (parsedMessage.type) {
        case "cursor_update":
          this.handleCursorUpdate(client, parsedMessage.data);
          break;
        case "chat_message":
          this.handleChatMessage(client, parsedMessage.data);
          break;
        default:
          console.log(`Unknown message type: ${parsedMessage.type}`);
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  }

  // Handle cursor position updates
  private handleCursorUpdate(
    client: Client,
    data: { x: number; y: number }
  ): void {
    const cursor: Cursor = {
      color:
        this.cursors.get(client.userId)?.color || this.generateRandomColor(),
      x: data.x,
      y: data.y,
      lastSeen: new Date(),
    };

    this.cursors.set(client.userId, cursor);
    client.cursor = cursor;

    // Broadcast cursor update to all other clients
    this.broadcastToOthers(client.ws, {
      type: "cursor_update",
      userId: client.userId,
      data: { userId: client.userId, cursor },
    });
  }

  // Handle chat messages
  private handleChatMessage(client: Client, data: { message: string }): void {
    // Broadcast chat message to all clients (including sender for confirmation)
    this.broadcastToAll({
      type: "chat_message",
      userId: client.userId,
      data: {
        userId: client.userId,
        message: data.message,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Send message to a specific client
  private sendToClient(ws: WebSocket, message: Message): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Broadcast message to all clients except sender
  private broadcastToOthers(senderWs: WebSocket, message: Message): void {
    this.clients.forEach((client, ws) => {
      if (ws !== senderWs) {
        this.sendToClient(ws, message);
      }
    });
  }

  // Broadcast message to all clients
  private broadcastToAll(message: Message): void {
    this.clients.forEach((client, ws) => {
      this.sendToClient(ws, message);
    });
  }

  // Get current cursor positions
  getCursors(): Map<string, Cursor> {
    return this.cursors;
  }

  // Get connected clients count
  getClientCount(): number {
    return this.clients.size;
  }
}
