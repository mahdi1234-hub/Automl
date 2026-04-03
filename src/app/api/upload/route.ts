import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

export const maxDuration = 60;

interface ColumnInfo {
  name: string;
  type: "numeric" | "categorical" | "datetime" | "text" | "boolean";
  uniqueCount: number;
  nullCount: number;
  sampleValues: string[];
}

function detectColumnType(values: string[]): "numeric" | "categorical" | "datetime" | "text" | "boolean" {
  const nonEmpty = values.filter((v) => v !== "" && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return "text";

  const booleans = nonEmpty.filter(
    (v) => ["true", "false", "yes", "no", "1", "0"].includes(v.toLowerCase())
  );
  if (booleans.length / nonEmpty.length > 0.9) return "boolean";

  const numbers = nonEmpty.filter((v) => !isNaN(Number(v)) && v.trim() !== "");
  if (numbers.length / nonEmpty.length > 0.8) return "numeric";

  const datePatterns = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/;
  const dates = nonEmpty.filter((v) => datePatterns.test(v) || !isNaN(Date.parse(v)));
  if (dates.length / nonEmpty.length > 0.7) return "datetime";

  const uniqueRatio = new Set(nonEmpty).size / nonEmpty.length;
  if (uniqueRatio < 0.5 && nonEmpty.length > 10) return "categorical";

  return nonEmpty.every((v) => v.length > 100) ? "text" : "categorical";
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists
    await prisma.user.upsert({
      where: { clerkId: userId },
      update: {},
      create: { clerkId: userId, email: `${userId}@temp.com` },
    });

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (parsed.errors.length > 0 && !parsed.data.length) {
      return NextResponse.json(
        { error: "Failed to parse CSV", details: parsed.errors },
        { status: 400 }
      );
    }

    const data = parsed.data as Record<string, string>[];
    const headers = parsed.meta.fields || [];

    // Analyze columns
    const columns: ColumnInfo[] = headers.map((header) => {
      const values = data.map((row) => row[header] || "");
      const nonEmpty = values.filter((v) => v !== "");
      const unique = new Set(nonEmpty);

      return {
        name: header,
        type: detectColumnType(values),
        uniqueCount: unique.size,
        nullCount: values.length - nonEmpty.length,
        sampleValues: Array.from(unique).slice(0, 5),
      };
    });

    // Store dataset in DB (limit to 500 rows to avoid DB size limits)
    const storedData = data.length > 500 ? data.slice(0, 500) : data;
    const dataset = await prisma.dataset.create({
      data: {
        name: file.name.replace(/\.csv$/i, ""),
        fileName: file.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        columns: columns as any,
        rowCount: data.length,
        fileSize: file.size,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: storedData as any,
        userId,
      },
    });

    // Store dataset info in Pinecone memory (optional)
    const summary = `Dataset "${file.name}" uploaded with ${data.length} rows and ${columns.length} columns. Columns: ${columns.map((c) => `${c.name} (${c.type})`).join(", ")}`;
    try {
      const { storeDatasetMemory } = await import("@/lib/pinecone");
      await storeDatasetMemory(userId, dataset.id, summary).catch(() => {});
    } catch {
      // Pinecone not available, skip
    }

    return NextResponse.json({
      dataset: {
        id: dataset.id,
        name: dataset.name,
        fileName: dataset.fileName,
        columns,
        rowCount: dataset.rowCount,
        fileSize: dataset.fileSize,
      },
      summary,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
