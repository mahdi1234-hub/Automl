"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { ChatMessage as ChatMessageType, ChartData, GraphData, FormData } from "@/lib/types";

const InlineChart = dynamic(() => import("@/components/charts/InlineChart"), { ssr: false });
const InlineGraph = dynamic(() => import("@/components/graphs/InlineGraph"), { ssr: false });
const InlineForm = dynamic(() => import("@/components/chat/InlineForm"), { ssr: false });

interface ChatMessageProps {
  message: ChatMessageType;
  onFormSubmit?: (formTitle: string, values: Record<string, string | boolean>) => void;
}

interface ParsedBlock {
  type: "text" | "chart" | "graph" | "form";
  content: string;
  data?: ChartData | GraphData | FormData;
}

export default function ChatMessage({ message, onFormSubmit }: ChatMessageProps) {
  const blocks = useMemo(() => parseContent(message.content, message.metadata), [message.content, message.metadata]);

  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 animate-fade-in-up ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#C17F59] to-[#C9A96E] flex items-center justify-center">
          <span className="text-xs font-bold text-[#0F0F0E]">AI</span>
        </div>
      )}
      <div
        className={`max-w-[85%] ${
          isUser
            ? "bg-[#C17F59]/15 border border-[#C17F59]/30 rounded-2xl rounded-tr-sm px-4 py-3"
            : "bg-[#1A1917] border border-[#2C2B27] rounded-2xl rounded-tl-sm px-4 py-3"
        }`}
      >
        {blocks.map((block, i) => {
          switch (block.type) {
            case "chart":
              return <InlineChart key={i} chart={block.data as ChartData} />;
            case "graph":
              return <InlineGraph key={i} graph={block.data as GraphData} />;
            case "form":
              return (
                <InlineForm
                  key={i}
                  form={block.data as FormData}
                  onSubmit={(values) =>
                    onFormSubmit?.((block.data as FormData).title, values)
                  }
                />
              );
            case "text":
            default:
              return (
                <div
                  key={i}
                  className="prose prose-sm max-w-none text-[#D9D2CA] prose-headings:text-[#F5F0EB] prose-headings:font-display prose-strong:text-[#D4A07A] prose-em:text-[#C9A96E] prose-code:text-[#C17F59] prose-code:bg-[#22211E] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-li:text-[#D9D2CA] prose-a:text-[#C17F59]"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(block.content) }}
                />
              );
          }
        })}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2C2B27] flex items-center justify-center">
          <span className="text-xs font-medium text-[#9C9789]">U</span>
        </div>
      )}
    </div>
  );
}

function parseContent(content: string, metadata?: ChatMessageType["metadata"]): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const codeBlockRegex = /```(chart|graph|form)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before this block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) blocks.push({ type: "text", content: text });
    }

    const blockType = match[1] as "chart" | "graph" | "form";
    try {
      const data = JSON.parse(match[2]);
      blocks.push({ type: blockType, content: "", data });
    } catch {
      blocks.push({ type: "text", content: match[2] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  const remaining = content.slice(lastIndex).trim();
  if (remaining) blocks.push({ type: "text", content: remaining });

  // Add charts/graphs/forms from metadata
  if (metadata?.charts) {
    metadata.charts.forEach((chart) => {
      blocks.push({ type: "chart", content: "", data: chart });
    });
  }
  if (metadata?.graphs) {
    metadata.graphs.forEach((graph) => {
      blocks.push({ type: "graph", content: "", data: graph });
    });
  }
  if (metadata?.forms) {
    metadata.forms.forEach((form) => {
      blocks.push({ type: "form", content: "", data: form });
    });
  }

  if (blocks.length === 0) {
    blocks.push({ type: "text", content });
  }

  return blocks;
}

function formatMarkdown(text: string): string {
  let html = text;

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-display text-[#F5F0EB] mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-display text-[#F5F0EB] mt-4 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-display text-[#F5F0EB] mt-4 mb-2">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="text-[#D4A07A]"><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-[#D4A07A]">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="text-[#C9A96E]">$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-[#22211E] text-[#C17F59] px-1.5 py-0.5 rounded text-xs">$1</code>');

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li class="text-[#D9D2CA] ml-4 list-disc">$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="text-[#D9D2CA] ml-4 list-decimal">$2</li>');

  // Wrap consecutive list items
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="space-y-1 my-2">$1</ul>');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p class="my-2">');
  html = html.replace(/\n/g, "<br/>");

  // Wrap in paragraph
  if (!html.startsWith("<h") && !html.startsWith("<ul") && !html.startsWith("<p")) {
    html = `<p class="my-1">${html}</p>`;
  }

  return html;
}
