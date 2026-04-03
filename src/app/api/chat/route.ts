import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { chatWithGroq, analyzeCSVWithGroq } from "@/lib/groq";
import { prisma } from "@/lib/prisma";

// Allow up to 60 seconds for AI responses
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, conversationId, datasetId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Ensure user exists in DB
    try {
      await prisma.user.upsert({
        where: { clerkId: userId },
        update: {},
        create: { clerkId: userId, email: `${userId}@temp.com` },
      });
    } catch (dbError) {
      console.error("DB user upsert error:", dbError);
      // Continue without DB - just use Groq
    }

    // Get or create conversation
    let conversation: { id: string; messages?: { role: string; content: string }[] } | null = null;
    try {
      if (conversationId) {
        conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
        });
      }

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
            userId,
          },
          include: { messages: true },
        });
      }
    } catch (dbError) {
      console.error("DB conversation error:", dbError);
      conversation = { id: `temp-${Date.now()}`, messages: [] };
    }

    // Store user message in DB (non-blocking)
    try {
      if (!conversation.id.startsWith("temp-")) {
        await prisma.message.create({
          data: {
            role: "user",
            content: message,
            conversationId: conversation.id,
          },
        });
      }
    } catch (e) {
      console.error("DB message store error:", e);
    }

    // Store in Pinecone memory (non-blocking, optional)
    try {
      const { storeConversationMemory } = await import("@/lib/pinecone");
      storeConversationMemory(userId, conversation.id, "user", message).catch(() => {});
    } catch {
      // Pinecone not available, skip
    }

    // Get relevant context from Pinecone memory (optional)
    let memoryContext = "";
    try {
      const { getRelevantContext } = await import("@/lib/pinecone");
      memoryContext = await getRelevantContext(userId, message);
    } catch {
      // Pinecone not available, skip
    }

    // Get dataset context if available
    let datasetContext = "";
    if (datasetId) {
      try {
        const dataset = await prisma.dataset.findUnique({
          where: { id: datasetId },
        });
        if (dataset) {
          const cols = dataset.columns as { name: string; type: string }[];
          datasetContext = `\nActive Dataset: ${dataset.name}\nColumns: ${cols.map((c) => `${c.name} (${c.type})`).join(", ")}\nRows: ${dataset.rowCount}\n`;
        }
      } catch {
        // Dataset not found, skip
      }
    }

    // Build message history
    const history = (conversation.messages || []).map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }));
    history.push({ role: "user", content: message });

    // Get context info
    const contextInfo = [memoryContext, datasetContext].filter(Boolean).join("\n\n");

    // Generate response from Groq
    let response: string;
    try {
      if (datasetId && datasetContext) {
        response = await analyzeCSVWithGroq(datasetContext, message);
      } else {
        response = await chatWithGroq(history, contextInfo || undefined);
      }
    } catch (groqError) {
      console.error("Groq API error:", groqError);
      response = "I apologize, but I encountered an issue processing your request. Please try again in a moment.";
    }

    // Store assistant message in DB (non-blocking)
    let assistantMessageId = `msg-${Date.now()}`;
    try {
      if (!conversation.id.startsWith("temp-")) {
        const assistantMessage = await prisma.message.create({
          data: {
            role: "assistant",
            content: response,
            conversationId: conversation.id,
          },
        });
        assistantMessageId = assistantMessage.id;
      }
    } catch (e) {
      console.error("DB assistant message store error:", e);
    }

    // Store in Pinecone memory (non-blocking, optional)
    try {
      const { storeConversationMemory } = await import("@/lib/pinecone");
      storeConversationMemory(userId, conversation.id, "assistant", response).catch(() => {});
    } catch {
      // Pinecone not available, skip
    }

    return NextResponse.json({
      message: {
        id: assistantMessageId,
        role: "assistant",
        content: response,
        createdAt: new Date().toISOString(),
      },
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process message",
        message: {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "I apologize, but I encountered an error. Please try again.",
          createdAt: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
