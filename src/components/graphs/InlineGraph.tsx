"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GraphData } from "@/lib/types";

const NODE_COLORS = [
  "#C17F59", "#C9A96E", "#8A9A7B", "#D4A07A", "#C4704E",
  "#DFC08A", "#E8B894", "#6B675E", "#D9D2CA",
];

interface NodeInfo {
  label: string;
  connections: number;
}

export default function InlineGraph({ graph: graphData }: { graph: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<NodeInfo | null>(null);

  const initGraph = useCallback(async () => {
    if (!containerRef.current || !graphData.nodes.length) return;

    // Dynamic imports to avoid SSR issues
    const GraphModule = await import("graphology");
    const SigmaModule = await import("sigma");
    const Graph = GraphModule.default;
    const Sigma = SigmaModule.default;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graph: any = new Graph();

    // Add nodes with force-directed positions
    graphData.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / graphData.nodes.length;
      const radius = 100 + Math.random() * 50;
      graph.addNode(node.id, {
        label: node.label,
        x: node.x ?? Math.cos(angle) * radius,
        y: node.y ?? Math.sin(angle) * radius,
        size: node.size || 12,
        color: node.color || NODE_COLORS[i % NODE_COLORS.length],
      });
    });

    // Add edges
    graphData.edges.forEach((edge) => {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        graph.addEdge(edge.source, edge.target, {
          label: edge.label || "",
          size: edge.weight || 2,
          color: "#2C2B27",
        });
      }
    });

    // Simple force layout iterations
    for (let iteration = 0; iteration < 100; iteration++) {
      graph.forEachNode((nodeId: string) => {
        let fx = 0, fy = 0;
        const nodeAttrs = graph.getNodeAttributes(nodeId);

        graph.forEachNode((otherId: string) => {
          if (nodeId === otherId) return;
          const otherAttrs = graph.getNodeAttributes(otherId);
          const dx = nodeAttrs.x - otherAttrs.x;
          const dy = nodeAttrs.y - otherAttrs.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const repulsion = 500 / (dist * dist);
          fx += (dx / dist) * repulsion;
          fy += (dy / dist) * repulsion;
        });

        graph.forEachEdge(nodeId, (_edge: string, _attrs: Record<string, unknown>, source: string, target: string) => {
          const otherId = source === nodeId ? target : source;
          const otherAttrs = graph.getNodeAttributes(otherId);
          const dx = otherAttrs.x - nodeAttrs.x;
          const dy = otherAttrs.y - nodeAttrs.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const attraction = dist * 0.01;
          fx += (dx / dist) * attraction;
          fy += (dy / dist) * attraction;
        });

        graph.setNodeAttribute(nodeId, "x", nodeAttrs.x + fx * 0.1);
        graph.setNodeAttribute(nodeId, "y", nodeAttrs.y + fy * 0.1);
      });
    }

    const renderer = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: true,
      defaultNodeColor: "#C17F59",
      defaultEdgeColor: "#2C2B27",
      labelColor: { color: "#9C9789" },
      labelFont: "Inter, sans-serif",
      labelSize: 12,
      stagePadding: 30,
    });

    // Drag support
    let isDragging = false;
    let draggedNode: string | null = null;

    renderer.on("downNode", (e) => {
      isDragging = true;
      draggedNode = e.node;
      renderer.getCamera().disable();
    });

    renderer.getMouseCaptor().on("mousemovebody", (e) => {
      if (!isDragging || !draggedNode) return;
      const pos = renderer.viewportToGraph(e);
      graph.setNodeAttribute(draggedNode, "x", pos.x);
      graph.setNodeAttribute(draggedNode, "y", pos.y);
    });

    renderer.getMouseCaptor().on("mouseup", () => {
      isDragging = false;
      draggedNode = null;
      renderer.getCamera().enable();
    });

    renderer.on("clickNode", (e) => {
      const label = graph.getNodeAttribute(e.node, "label") as string;
      const connections = graph.degree(e.node);
      setSelectedNodeInfo({ label, connections });
    });

    renderer.on("clickStage", () => {
      setSelectedNodeInfo(null);
    });

    return () => {
      renderer.kill();
    };
  }, [graphData]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    initGraph().then((fn) => { cleanup = fn; });
    return () => cleanup?.();
  }, [initGraph]);

  return (
    <div className="my-4 rounded-xl border border-[#2C2B27] bg-[#1A1917] p-4">
      {graphData.title && (
        <h4 className="font-display text-sm text-[#D4A07A] mb-3">
          {graphData.title}
        </h4>
      )}
      <div className="text-xs text-[#6B675E] mb-2">
        Drag nodes to rearrange. Click to select. Scroll to zoom.
      </div>
      <div
        ref={containerRef}
        className="h-[400px] w-full rounded-lg bg-[#0F0F0E] overflow-hidden"
      />
      {selectedNodeInfo && (
        <div className="mt-2 p-3 rounded-lg bg-[#22211E] border border-[#2C2B27]">
          <p className="text-xs text-[#C17F59] uppercase tracking-wider mb-1">Selected Node</p>
          <p className="text-sm text-[#F5F0EB]">{selectedNodeInfo.label}</p>
          <p className="text-xs text-[#6B675E] mt-1">
            Connections: {selectedNodeInfo.connections}
          </p>
        </div>
      )}
    </div>
  );
}
