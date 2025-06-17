import "@repo/design-system/styles/globals.css";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { useEffect, useState, useRef, useCallback } from "react";

interface Cursor {
  color: string;
  x: number;
  y: number;
  lastSeen: Date;
}

interface Message {
  type: "cursor_update" | "chat_message" | "user_joined" | "user_left";
  userId?: string;
  data: any;
}

function App() {
  const [messages, setMessages] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Throttled cursor update function
  const sendCursorUpdate = useCallback(
    throttle((x: number, y: number) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const message: Message = {
          type: "cursor_update",
          data: { x, y },
        };
        wsRef.current.send(JSON.stringify(message));
      }
    }, 16), // ~60fps
    []
  );

  useEffect(() => {
    // Create WebSocket connection
    const ws = new WebSocket("ws://localhost:5001");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to WebSocket server");
    };

    ws.onmessage = (event) => {
      try {
        const message: Message = JSON.parse(event.data);

        switch (message.type) {
          case "user_joined":
            if (message.data.userId && !userId) {
              setUserId(message.data.userId);
            }
            // Load existing cursors if provided
            if (message.data.cursors) {
              const cursorMap = new Map();
              Object.entries(message.data.cursors).forEach(([id, cursor]) => {
                cursorMap.set(id, cursor);
              });
              setCursors(cursorMap);
            }
            setMessages((prev) => [...prev, message.data.message]);
            break;

          case "user_left":
            setCursors((prev) => {
              const newCursors = new Map(prev);
              newCursors.delete(message.userId!);
              return newCursors;
            });
            setMessages((prev) => [...prev, message.data.message]);
            break;

          case "cursor_update":
            if (message.userId !== userId) {
              // Don't show our own cursor
              setCursors((prev) => {
                const newCursors = new Map(prev);
                newCursors.set(message.userId!, message.data.cursor);
                return newCursors;
              });
            }
            break;

          case "chat_message":
            const chatMsg = `${message.data.userId}: ${message.data.message}`;
            setMessages((prev) => [...prev, chatMsg]);
            break;

          default:
            console.log("Received message:", event.data);
            setMessages((prev) => [...prev, event.data]);
        }
      } catch (error) {
        // Fallback for non-JSON messages
        console.log("Received message:", event.data);
        setMessages((prev) => [...prev, event.data]);
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from WebSocket server");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    // Cleanup on component unmount
    return () => {
      ws.close();
    };
  }, [userId]);

  // Handle mouse movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        sendCursorUpdate(x, y);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      return () => {
        container.removeEventListener("mousemove", handleMouseMove);
      };
    }
  }, [sendCursorUpdate]);

  const sendMessage = () => {
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      message.trim()
    ) {
      const chatMessage: Message = {
        type: "chat_message",
        data: { message },
      };
      wsRef.current.send(JSON.stringify(chatMessage));
      setMessage(""); // Clear input after sending
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <div
      ref={containerRef}
      className="container mx-auto p-4 h-screen relative overflow-hidden"
    >
      {/* Render other users' cursors */}
      {Array.from(cursors.entries()).map(([id, cursor]) => (
        <div
          key={id}
          className="absolute pointer-events-none z-50"
          style={{
            left: cursor.x,
            top: cursor.y,
            transform: "translate(-2px, -2px)",
          }}
        >
          <div
            className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
            style={{ backgroundColor: cursor.color }}
          />
          <div className="text-xs text-white bg-black bg-opacity-75 px-1 py-0.5 rounded mt-1 whitespace-nowrap">
            {id}
          </div>
        </div>
      ))}

      <div className="flex h-full justify-center items-center">
        <div className="flex flex-col gap-4 w-full max-w-md">
          <div className="text-center text-sm text-gray-600">
            {userId ? `Connected as: ${userId}` : "Connecting..."}
            <br />
            Active cursors: {cursors.size}
          </div>

          <div className="border rounded p-4 h-64 overflow-y-auto bg-gray-50">
            {messages.length === 0 ? (
              <p className="text-gray-500">No messages yet...</p>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className="mb-2 p-2 bg-white rounded text-sm">
                  {msg}
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <Input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
            />
            <Button onClick={sendMessage} disabled={!message.trim()}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Throttle function to limit cursor updates
function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;

  return ((...args: Parameters<T>) => {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(
        () => {
          func(...args);
          lastExecTime = Date.now();
        },
        delay - (currentTime - lastExecTime)
      );
    }
  }) as T;
}

export default App;
