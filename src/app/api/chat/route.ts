import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { chatWithGroq, analyzeCSVWithGroq } from "@/lib/groq";
import { storeConversationMemory, getRelevantContext } from "@/lib/pinecone";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, conversationId, datasetId } = body;

    // Ensure user exists in DB
    await prisma.user.upsert({
      where: { clerkId: userId },
      update: {},
      create: { clerkId: userId, email: `${userId}@temp.com` },
    });

    // Get or create conversation
    let conversation;
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

    // Store user message
    await prisma.message.create({
      data: {
        role: "user",
        content: message,
        conversationId: conversation.id,
      },
    });

    // Store in Pinecone memory
    await storeConversationMemory(userId, conversation.id, "user", message).catch(() => {});

    // Get relevant context from memory
    const memoryContext = await getRelevantContext(userId, message).catch(() => "");

    // Get dataset context if available
    let datasetContext = "";
    if (datasetId) {
      const dataset = await prisma.dataset.findUnique({
        where: { id: datasetId },
      });
      if (dataset) {
        const cols = dataset.columns as { name: string; type: string }[];
        datasetContext = `\nActive Dataset: ${dataset.name}\nColumns: ${cols.map((c) => `${c.name} (${c.type})`).join(", ")}\nRows: ${dataset.rowCount}\n`;
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

    // Generate response
    let response: string;
    if (datasetId) {
      response = await analyzeCSVWithGroq(datasetContext, message);
    } else {
      response = await chatWithGroq(history, contextInfo || undefined);
    }

    // Store assistant message
    const assistantMessage = await prisma.message.create({
      data: {
        role: "assistant",
        content: response,
        conversationId: conversation.id,
      },
    });

    // Store in Pinecone memory
    await storeConversationMemory(userId, conversation.id, "assistant", response).catch(() => {});

    return NextResponse.json({
      message: {
        id: assistantMessage.id,
        role: "assistant",
        content: response,
        createdAt: assistantMessage.createdAt,
      },
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
