import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import { chatStorage } from "./storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const chatMessageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

export function registerChatRoutes(
  app: Express,
  isAdminAuthenticated: (req: Request) => boolean
): void {
  // Get all conversations — admin only
  app.get("/api/conversations", (req: Request, res: Response) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    chatStorage
      .getAllConversations()
      .then((conversations) => res.json(conversations))
      .catch((error) => {
        console.error("Error fetching conversations:", error);
        res.status(500).json({ error: "Failed to fetch conversations" });
      });
  });

  // Get single conversation with messages — admin only
  app.get("/api/conversations/:id", (req: Request, res: Response) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    chatStorage
      .getConversation(id)
      .then(async (conversation) => {
        if (!conversation) {
          return res.status(404).json({ error: "Conversation not found" });
        }
        const messages = await chatStorage.getMessagesByConversation(id);
        res.json({ ...conversation, messages });
      })
      .catch((error) => {
        console.error("Error fetching conversation:", error);
        res.status(500).json({ error: "Failed to fetch conversation" });
      });
  });

  // Create new conversation — admin only
  app.post("/api/conversations", (req: Request, res: Response) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { title } = req.body;
    chatStorage
      .createConversation(title || "New Chat")
      .then((conversation) => res.status(201).json(conversation))
      .catch((error) => {
        console.error("Error creating conversation:", error);
        res.status(500).json({ error: "Failed to create conversation" });
      });
  });

  // Delete conversation — admin only
  app.delete("/api/conversations/:id", (req: Request, res: Response) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = parseInt(req.params.id);
    chatStorage
      .deleteConversation(id)
      .then(() => res.status(204).send())
      .catch((error) => {
        console.error("Error deleting conversation:", error);
        res.status(500).json({ error: "Failed to delete conversation" });
      });
  });

  // Send message and get AI response (streaming) — admin only + rate limited
  app.post(
    "/api/conversations/:id/messages",
    chatMessageRateLimit,
    async (req: Request, res: Response) => {
      if (!isAdminAuthenticated(req)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      try {
        const conversationId = parseInt(req.params.id);
        const { content } = req.body;

        // Save user message
        await chatStorage.createMessage(conversationId, "user", content);

        // Get conversation history for context
        const messages = await chatStorage.getMessagesByConversation(conversationId);
        const chatMessages = messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        // Set up SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // Stream response from OpenAI
        const stream = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: chatMessages,
          stream: true,
          max_completion_tokens: 2048,
        });

        let fullResponse = "";

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }

        // Save assistant message
        await chatStorage.createMessage(conversationId, "assistant", fullResponse);

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (error) {
        console.error("Error sending message:", error);
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
          res.end();
        } else {
          res.status(500).json({ error: "Failed to send message" });
        }
      }
    }
  );
}
