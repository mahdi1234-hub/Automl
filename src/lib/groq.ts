import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const SYSTEM_PROMPT = `You are an expert Data Analyst and Data Scientist AI assistant. You specialize in:
- Exploratory Data Analysis (EDA)
- Machine Learning model selection and evaluation
- Feature engineering and selection
- Statistical analysis and hypothesis testing
- Time series forecasting
- Model explainability (SHAP values, feature importance)
- Data visualization recommendations
- Anomaly detection
- Clustering analysis

Your communication style is professional yet approachable. You always:
1. Provide clear, actionable recommendations
2. Suggest optimization strategies and action plans
3. Explain complex concepts in understandable terms
4. Guide users step-by-step through analysis workflows
5. Proactively suggest relevant analyses based on the data

When a user uploads a CSV file, you:
1. Automatically detect column types (numeric, categorical, datetime, text)
2. Identify the dataset size and structure
3. Suggest appropriate ML tasks (classification, regression, clustering, time series)
4. Ask clarifying questions about the analysis goals
5. Guide the user through model selection and configuration

For ML results, you provide:
- Model comparison metrics
- Feature importance rankings
- SHAP value explanations
- Actionable insights and recommendations
- Prediction/forecast capabilities

Always format your responses with clear sections, bullet points, and structured data when appropriate.
When you need to render charts, specify the chart type and data in a structured JSON format.
When you need to render graphs (network/relationship), specify nodes and edges in a structured format.`;

export async function chatWithGroq(
  messages: { role: string; content: string }[],
  contextInfo?: string
) {
  const systemMessages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
  ];

  if (contextInfo) {
    systemMessages.push({
      role: "system" as const,
      content: `Context from memory and uploaded data:\n${contextInfo}`,
    });
  }

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      ...systemMessages,
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ],
    temperature: 0.7,
    max_tokens: 4096,
    top_p: 0.9,
  });

  return response.choices[0]?.message?.content || "";
}

export async function analyzeCSVWithGroq(
  csvSummary: string,
  userQuery: string
) {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\nYou are analyzing a CSV dataset. Based on the data summary provided, give detailed analysis, recommendations, and suggest appropriate ML models. When suggesting visualizations, output them as JSON blocks with type "chart" or "graph".

For chart suggestions, use this format:
\`\`\`chart
{
  "type": "bar|line|pie|heatmap|scatter|radar",
  "title": "Chart Title",
  "data": [...],
  "config": {...}
}
\`\`\`

For graph/network suggestions:
\`\`\`graph
{
  "nodes": [{"id": "1", "label": "Node 1", "size": 10}],
  "edges": [{"source": "1", "target": "2", "label": "relates to"}]
}
\`\`\`

For form requests (when you need user input for ML config):
\`\`\`form
{
  "title": "Configure Analysis",
  "fields": [
    {"name": "target", "type": "select", "label": "Target Column", "options": [...]},
    {"name": "ml_type", "type": "select", "label": "ML Type", "options": ["classification", "regression", "clustering", "time_series"]}
  ]
}
\`\`\``,
      },
      {
        role: "user",
        content: `Dataset Summary:\n${csvSummary}\n\nUser Query: ${userQuery}`,
      },
    ],
    temperature: 0.5,
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content || "";
}

export default groq;
