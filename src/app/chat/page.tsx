"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Send,
  Sparkles,
  Database,
  FileSpreadsheet,
  Plus,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import ChatMessageComponent from "@/components/chat/ChatMessage";
import type { ChatMessage, DatasetInfo } from "@/lib/types";

export default function ChatPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeDataset, setActiveDataset] = useState<DatasetInfo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleUrlUpload = async (url: string) => {
    setIsUploading(true);
    const uploadMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: `📊 Loading dataset from URL: ${url}`,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, uploadMsg]);

    try {
      // Download CSV client-side to avoid server-side timeout
      const csvResponse = await fetch(url);
      if (!csvResponse.ok) throw new Error(`Failed to fetch CSV: ${csvResponse.status}`);
      const csvText = await csvResponse.text();
      const fileName = url.split("/").pop() || "remote-dataset.csv";
      const file = new File([csvText], fileName.endsWith(".csv") ? fileName : `${fileName}.csv`, { type: "text/csv" });
      
      // Upload via regular file upload API
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.dataset) {
        setActiveDataset(data.dataset);
        const cols = data.dataset.columns;
        const numericCols = cols.filter((c: { type: string }) => c.type === "numeric");
        const categoricalCols = cols.filter((c: { type: string }) => c.type === "categorical");
        const datetimeCols = cols.filter((c: { type: string }) => c.type === "datetime");

        let suggestions = "";
        if (datetimeCols.length > 0 && numericCols.length > 0) {
          suggestions += "\n- **Time Series Forecasting**: Detected datetime columns - I can forecast future values\n";
        }
        if (categoricalCols.length > 0 && numericCols.length > 0) {
          suggestions += "- **Classification**: Predict categorical outcomes based on features\n";
        }
        if (numericCols.length >= 2) {
          suggestions += "- **Regression**: Predict numerical values\n";
          suggestions += "- **Clustering**: Discover natural groupings in your data\n";
        }
        suggestions += "- **Anomaly Detection**: Find unusual patterns\n";

        const analysisMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          content: `## Dataset Loaded Successfully! 🎉

**${data.dataset.name}** - ${data.dataset.rowCount.toLocaleString()} rows x ${cols.length} columns

### Column Analysis
| Column | Type | Unique Values | Missing |
|--------|------|---------------|---------|
${cols.map((c: { name: string; type: string; uniqueCount: number; nullCount: number }) => `| ${c.name} | \`${c.type}\` | ${c.uniqueCount} | ${c.nullCount} |`).join("\n")}

### Recommended Analyses
${suggestions}

**What would you like to do with this data?** I can:
1. Run a complete **AutoML analysis** with model comparison
2. Generate **exploratory visualizations**
3. Perform **feature importance** analysis
4. Create **correlation** and **relationship** graphs
5. Run **predictions** or **forecasting**

Just tell me what you'd like, or I'll suggest the best approach!`,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, analysisMsg]);

        // Store context
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Dataset loaded from URL with ${data.dataset.rowCount} rows. Columns: ${cols.map((c: { name: string; type: string }) => `${c.name} (${c.type})`).join(", ")}`,
            conversationId,
            datasetId: data.dataset.id,
          }),
        }).then((r) => r.json()).then((d) => {
          if (d.conversationId) setConversationId(d.conversationId);
        }).catch(() => {});
      } else {
        throw new Error(data.error || "Failed to load CSV");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Failed to load the CSV from that URL: ${errorMsg}. Please check the URL and try again, or upload the file directly.`,
          createdAt: new Date(),
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Detect if the message contains a CSV URL
    const urlMatch = input.trim().match(/https?:\/\/[^\s]+\.(csv|CSV)(\?[^\s]*)?|https?:\/\/api\.csvgetter\.com\/[^\s]+/i);
    if (urlMatch) {
      const url = urlMatch[0];
      setInput("");
      await handleUrlUpload(url);
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
          datasetId: activeDataset?.id,
        }),
      });

      const data = await res.json();

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMessage: ChatMessage = {
        id: data.message?.id || `msg-${Date.now()}`,
        role: "assistant",
        content: data.message?.content || data.error || "Something went wrong.",
        createdAt: new Date(data.message?.createdAt || Date.now()),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          createdAt: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    // Add user message about upload
    const uploadMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: `📊 Uploading dataset: ${file.name}`,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, uploadMsg]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.dataset) {
        setActiveDataset(data.dataset);

        // Build analysis summary
        const cols = data.dataset.columns;
        const numericCols = cols.filter((c: { type: string }) => c.type === "numeric");
        const categoricalCols = cols.filter((c: { type: string }) => c.type === "categorical");
        const datetimeCols = cols.filter((c: { type: string }) => c.type === "datetime");

        let suggestions = "";
        if (datetimeCols.length > 0 && numericCols.length > 0) {
          suggestions += "\n- **Time Series Forecasting**: Detected datetime columns - I can forecast future values\n";
        }
        if (categoricalCols.length > 0 && numericCols.length > 0) {
          suggestions += "- **Classification**: Predict categorical outcomes based on features\n";
        }
        if (numericCols.length >= 2) {
          suggestions += "- **Regression**: Predict numerical values\n";
          suggestions += "- **Clustering**: Discover natural groupings in your data\n";
        }
        suggestions += "- **Anomaly Detection**: Find unusual patterns\n";

        const analysisMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          content: `## Dataset Loaded Successfully! 🎉

**${data.dataset.name}** - ${data.dataset.rowCount.toLocaleString()} rows x ${cols.length} columns

### Column Analysis
| Column | Type | Unique Values | Missing |
|--------|------|---------------|---------|
${cols.map((c: { name: string; type: string; uniqueCount: number; nullCount: number }) => `| ${c.name} | \`${c.type}\` | ${c.uniqueCount} | ${c.nullCount} |`).join("\n")}

### Recommended Analyses
${suggestions}

**What would you like to do with this data?** I can:
1. Run a complete **AutoML analysis** with model comparison
2. Generate **exploratory visualizations**
3. Perform **feature importance** analysis
4. Create **correlation** and **relationship** graphs
5. Run **predictions** or **forecasting**

Just tell me what you'd like, or I'll suggest the best approach!`,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, analysisMsg]);

        // Auto-send to chat API for context
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Dataset "${file.name}" uploaded with ${data.dataset.rowCount} rows. Columns: ${cols.map((c: { name: string; type: string }) => `${c.name} (${c.type})`).join(", ")}. Please remember this dataset for our conversation.`,
            conversationId,
            datasetId: data.dataset.id,
          }),
        }).then((r) => r.json()).then((d) => {
          if (d.conversationId) setConversationId(d.conversationId);
        }).catch(() => {});
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Failed to upload the file. Please ensure it's a valid CSV file.",
          createdAt: new Date(),
        },
      ]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFormSubmit = async (formTitle: string, values: Record<string, string | boolean>) => {
    // Send form values to analyze API
    const formMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: `Submitted: ${formTitle}\nConfiguration: ${JSON.stringify(values, null, 2)}`,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, formMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: activeDataset?.id,
          mlType: values.ml_type || values.mlType || "classification",
          target: values.target,
          features: values.features,
          formValues: values,
        }),
      });

      const data = await res.json();

      let content = "";
      if (data.results?.aiResponse) {
        content = data.results.aiResponse;
      } else if (data.results) {
        content = `## Analysis Complete! ✅\n\n**Type:** ${data.results.mlType || data.results.type}\n\n`;
        if (data.results.bestModel) content += `**Best Model:** ${data.results.bestModel}\n\n`;
        content += "```chart\n" + JSON.stringify({
          type: "bar",
          title: "Model Comparison",
          data: data.results.modelComparison || [],
        }, null, 2) + "\n```\n";
      }

      const analysisMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: content || "Analysis completed. Check the results above.",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, analysisMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Failed to run analysis. Please try again.",
          createdAt: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setActiveDataset(null);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 cta-bg-image opacity-[0.07]" />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, #0F0F0E 70%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-[#2C2B27] bg-[#0F0F0E]/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#C17F59]" />
            <h1 className="font-display text-xl text-[#F5F0EB]">
              Auto<em className="gradient-copper italic">ML</em>
            </h1>
          </div>
          <div className="h-4 w-px bg-[#2C2B27]" />
          <Button
            variant="ghost"
            size="sm"
            onClick={startNewConversation}
            className="text-[#9C9789] hover:text-[#D4A07A] hover:bg-[#2C2B27]/50 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">New Chat</span>
          </Button>
        </div>

        <div className="flex items-center gap-4">
          {activeDataset && (
            <Badge className="bg-[#C17F59]/15 text-[#D4A07A] border-[#C17F59]/30 gap-1.5">
              <Database className="h-3 w-3" />
              {activeDataset.name} ({activeDataset.rowCount} rows)
            </Badge>
          )}
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              },
            }}
          />
        </div>
      </header>

      {/* Chat Area */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div ref={scrollRef} className="h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
              {messages.length === 0 ? (
                <EmptyState
                  onUploadClick={() => fileInputRef.current?.click()}
                  onSuggestionClick={(text) => {
                    setInput(text);
                    textareaRef.current?.focus();
                  }}
                  onUrlLoad={handleUrlUpload}
                />
              ) : (
                messages.map((msg) => (
                  <ChatMessageComponent
                    key={msg.id}
                    message={msg}
                    onFormSubmit={handleFormSubmit}
                  />
                ))
              )}

              {isLoading && (
                <div className="flex gap-3 animate-fade-in-up">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#C17F59] to-[#C9A96E] flex items-center justify-center">
                    <span className="text-xs font-bold text-[#0F0F0E]">AI</span>
                  </div>
                  <div className="bg-[#1A1917] border border-[#2C2B27] rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#C17F59] typing-dot" />
                      <div className="w-2 h-2 rounded-full bg-[#C9A96E] typing-dot" />
                      <div className="w-2 h-2 rounded-full bg-[#8A9A7B] typing-dot" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="relative z-10 border-t border-[#2C2B27] bg-[#0F0F0E]/80 backdrop-blur-sm px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            {/* File Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-shrink-0 h-10 w-10 rounded-full border border-[#2C2B27] text-[#9C9789] hover:text-[#D4A07A] hover:border-[#C17F59] hover:bg-[#C17F59]/10"
            >
              {isUploading ? (
                <div className="w-4 h-4 border-2 border-[#C17F59] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </Button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your data, upload a CSV, or request an analysis..."
                className="min-h-[44px] max-h-[120px] resize-none bg-[#1A1917] border-[#2C2B27] text-[#F5F0EB] placeholder:text-[#6B675E] focus:border-[#C17F59] focus:ring-[#C17F59]/20 rounded-2xl pr-12 py-3"
                rows={1}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 bottom-2 h-8 w-8 rounded-full bg-[#C17F59] hover:bg-[#D4A07A] text-[#0F0F0E] disabled:opacity-30"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-center text-[10px] text-[#6B675E] mt-2 tracking-wider">
            AI-powered data analysis with AutoML capabilities
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  onUploadClick,
  onSuggestionClick,
  onUrlLoad,
}: {
  onUploadClick: () => void;
  onSuggestionClick: (text: string) => void;
  onUrlLoad?: (url: string) => void;
}) {
  const suggestions = [
    {
      icon: FileSpreadsheet,
      title: "Upload & Analyze CSV",
      description: "Upload a dataset for automated ML analysis",
      action: onUploadClick,
    },
    {
      icon: MessageSquare,
      title: "Classification Analysis",
      text: "I want to classify data into categories. Can you help me set up a classification model?",
      description: "Predict categories from features",
    },
    {
      icon: Database,
      title: "Time Series Forecast",
      text: "I have time series data and need to forecast future values. What approach should I use?",
      description: "Predict future trends and values",
    },
    {
      icon: Sparkles,
      title: "Load Test Dataset",
      text: "",
      description: "Load a solar energy weather dataset from URL",
      action: () => onUrlLoad?.("https://api.csvgetter.com/eQpQkaTDwkpqdQMbojaM"),
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="mb-8">
        <div className="section-label justify-center mb-4">Data Analytics Agent</div>
        <h2 className="font-display text-3xl md:text-4xl text-[#F5F0EB] mb-3">
          Let&apos;s create something <em className="gradient-copper italic">extraordinary</em>
        </h2>
        <p className="text-[#9C9789] max-w-md mx-auto">
          Upload your data and I&apos;ll provide comprehensive ML analysis with
          model comparison, feature importance, SHAP explanations, and
          actionable recommendations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => (s.action ? s.action() : s.text && onSuggestionClick(s.text))}
            className="group text-left p-4 rounded-xl border border-[#2C2B27] bg-[#1A1917]/50 hover:bg-[#1A1917] hover:border-[#C17F59]/30 transition-all duration-300"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#C17F59]/10 text-[#C17F59] group-hover:bg-[#C17F59]/20 transition-colors">
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[#F5F0EB] mb-0.5 group-hover:text-[#D4A07A] transition-colors flex items-center gap-1.5">
                  {s.title}
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-[#6B675E]">{s.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
