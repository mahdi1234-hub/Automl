export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: MessageMetadata;
  createdAt: Date;
}

export interface MessageMetadata {
  charts?: ChartData[];
  graphs?: GraphData[];
  forms?: FormData[];
  datasetId?: string;
  analysisId?: string;
}

export interface ChartData {
  type: "bar" | "line" | "pie" | "heatmap" | "scatter" | "radar" | "funnel" | "sankey";
  title: string;
  data: unknown;
  config?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  title?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  size?: number;
  color?: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  weight?: number;
}

export interface FormData {
  title: string;
  fields: FormField[];
}

export interface FormField {
  name: string;
  type: "select" | "input" | "checkbox" | "number";
  label: string;
  options?: string[];
  defaultValue?: string;
  required?: boolean;
}

export interface DatasetInfo {
  id: string;
  name: string;
  fileName: string;
  columns: ColumnInfo[];
  rowCount: number;
  fileSize: number;
}

export interface ColumnInfo {
  name: string;
  type: "numeric" | "categorical" | "datetime" | "text" | "boolean";
  uniqueCount: number;
  nullCount: number;
  sampleValues: string[];
}

export interface AnalysisResult {
  id: string;
  type: string;
  status: string;
  results: {
    bestModel?: string;
    metrics?: Record<string, number>;
    featureImportance?: { feature: string; importance: number }[];
    shapValues?: { feature: string; shapValue: number }[];
    predictions?: unknown[];
    modelComparison?: ModelComparison[];
    confusionMatrix?: number[][];
    classificationReport?: Record<string, Record<string, number>>;
  };
}

export interface ModelComparison {
  model: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  rmse?: number;
  mae?: number;
  r2?: number;
  mape?: number;
}
