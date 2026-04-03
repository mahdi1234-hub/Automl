import { Pinecone } from "@pinecone-database/pinecone";
import Groq from "groq-sdk";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || "rag-knowledge-base";

function getIndex() {
  return pinecone.index(INDEX_NAME);
}

// Generate embeddings using Groq (we'll use a simple hash-based approach
// since Groq doesn't have embedding models, we'll use a deterministic approach)
async function generateEmbedding(text: string): Promise<number[]> {
  // Use a simple but effective text-to-vector approach
  // In production, you'd use an embedding model
  const dimension = 1536;
  const vector = new Array(dimension).fill(0);
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  for (let i = 0; i < data.length; i++) {
    vector[i % dimension] += data[i] / 255;
  }

  // Normalize
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

export async function storeMemory(
  userId: string,
  content: string,
  metadata: Record<string, unknown> = {}
) {
  const index = getIndex();
  const namespace = index.namespace(`user-${userId}`);
  const embedding = await generateEmbedding(content);
  const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await namespace.upsert({
    records: [
      {
        id,
        values: embedding,
        metadata: {
          content,
          userId,
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      },
    ],
  });

  return id;
}

export async function retrieveMemories(
  userId: string,
  query: string,
  topK: number = 5
) {
  const index = getIndex();
  const namespace = index.namespace(`user-${userId}`);
  const queryEmbedding = await generateEmbedding(query);

  const results = await namespace.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  return (
    results.matches?.map((match) => ({
      id: match.id,
      score: match.score,
      content: (match.metadata as Record<string, unknown>)?.content as string,
      metadata: match.metadata,
    })) || []
  );
}

export async function storeConversationMemory(
  userId: string,
  conversationId: string,
  role: string,
  content: string
) {
  return storeMemory(userId, content, {
    type: "conversation",
    conversationId,
    role,
  });
}

export async function storeDatasetMemory(
  userId: string,
  datasetId: string,
  summary: string
) {
  return storeMemory(userId, summary, {
    type: "dataset",
    datasetId,
  });
}

export async function storeAnalysisMemory(
  userId: string,
  analysisId: string,
  summary: string
) {
  return storeMemory(userId, summary, {
    type: "analysis",
    analysisId,
  });
}

export async function getRelevantContext(
  userId: string,
  query: string
): Promise<string> {
  const memories = await retrieveMemories(userId, query, 8);

  if (memories.length === 0) return "";

  return memories
    .filter((m) => m.score && m.score > 0.3)
    .map((m) => `[Memory - ${(m.metadata as Record<string, unknown>)?.type || "general"}]: ${m.content}`)
    .join("\n\n");
}

export default pinecone;
