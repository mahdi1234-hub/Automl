import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { analyzeCSVWithGroq } from "@/lib/groq";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { datasetId, mlType, target, features, formValues } = body;

    const dataset = await prisma.dataset.findUnique({
      where: { id: datasetId },
    });

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    // Create analysis record
    const analysis = await prisma.analysis.create({
      data: {
        type: mlType,
        target,
        features: features || null,
        status: "running",
        datasetId,
        userId,
      },
    });

    // Try PyCaret API first, fall back to Groq-based analysis
    let results;
    try {
      const pycaretUrl = process.env.PYCARET_API_URL || "http://localhost:8000";
      const pycaretResponse = await fetch(`${pycaretUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: dataset.data,
          columns: dataset.columns,
          ml_type: mlType,
          target,
          features,
          ...formValues,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (pycaretResponse.ok) {
        results = await pycaretResponse.json();
      } else {
        throw new Error("PyCaret API not available");
      }
    } catch {
      // Fall back to Groq-based analysis
      const cols = dataset.columns as { name: string; type: string }[];
      const dataPreview = (dataset.data as Record<string, unknown>[]).slice(0, 5);
      const summary = `Dataset: ${dataset.name}
Rows: ${dataset.rowCount}
Columns: ${cols.map((c) => `${c.name} (${c.type})`).join(", ")}
ML Type: ${mlType}
Target: ${target || "N/A"}
Data Preview: ${JSON.stringify(dataPreview, null, 2)}`;

      const aiAnalysis = await analyzeCSVWithGroq(
        summary,
        `Perform a complete ${mlType} analysis on this dataset${target ? ` with "${target}" as the target variable` : ""}. Provide:
1. Model comparison with metrics
2. Feature importance
3. SHAP value explanations
4. Recommendations and action plans
5. Visualizations as chart blocks
Include chart blocks for feature importance and model comparison.`
      );

      results = {
        type: "ai_analysis",
        mlType,
        target,
        aiResponse: aiAnalysis,
        status: "completed",
      };
    }

    // Update analysis record
    await prisma.analysis.update({
      where: { id: analysis.id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results: results as any,
        status: "completed",
      },
    });

    // Store in Pinecone
    const summary = `${mlType} analysis on "${dataset.name}"${target ? ` targeting "${target}"` : ""} - completed`;
    try {
      const { storeAnalysisMemory } = await import("@/lib/pinecone");
      await storeAnalysisMemory(userId, analysis.id, summary).catch(() => {});
    } catch {
      // Pinecone not available, skip
    }

    return NextResponse.json({
      analysisId: analysis.id,
      results,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Failed to run analysis" },
      { status: 500 }
    );
  }
}
