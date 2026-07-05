import React from "react";
import {
  Sparkles,
  PenTool,
  Moon,
  Languages,
  FileText,
  Lock,
  LayoutGrid,
  Scissors,
  Type,
  Activity,
  Eye,
  GitMerge,
  Settings,
} from "lucide-react";

export interface ToolItem {
  id: string;
  category: string;
  title: string;
  description: string;
  tag: string;
  tagIcon?: React.ComponentType<any>;
  icon: React.ComponentType<any>;
  color: string;
  row: number;
  isSpecial?: boolean;
}

export const TOOLS: ToolItem[] = [
  // Row 1
  {
    id: "summarize",
    category: "AI ASSISTANT",
    title: "Summarize PDF",
    description: "Get AI-generated summaries of your PDF in seconds.",
    tag: "AI Powered",
    tagIcon: Sparkles,
    icon: Sparkles,
    color: "pink",
    row: 1,
  },
  {
    id: "annotate",
    category: "EDITOR",
    title: "Annotate PDF",
    description: "Highlight, draw, and add notes to your PDF with ease.",
    tag: "Freehand + Shapes",
    tagIcon: Activity,
    icon: PenTool,
    color: "blue",
    row: 1,
  },
  {
    id: "merge",
    category: "MERGE",
    title: "Merge PDF",
    description: "Combine multiple PDF files into a single document.",
    tag: "Fast & Easy",
    tagIcon: Sparkles,
    icon: GitMerge,
    color: "green",
    row: 1,
  },
  // Row 2
  {
    id: "dark-mode",
    category: "DARK MODE",
    title: "Dark Mode",
    description: "Download a dark-theme PDF without inverting images.",
    tag: "Download-ready",
    tagIcon: Eye,
    icon: Moon,
    color: "yellow",
    row: 2,
  },
  {
    id: "translate",
    category: "TRANSLATE",
    title: "Translate PDF",
    description: "Translate your PDF to any language with one click.",
    tag: "AI Translation",
    tagIcon: Sparkles,
    icon: Languages,
    color: "purple",
    row: 2,
  },
  // Row 3
  {
    id: "delete-pages",
    category: "EDIT",
    title: "Delete Pages",
    description: "Remove specific pages from your PDF instantly.",
    tag: "Precision Edit",
    tagIcon: Scissors,
    icon: Scissors,
    color: "orange",
    row: 3,
  },
  {
    id: "convert",
    category: "CONVERT",
    title: "Convert to Markdown",
    description: "Extract text-based PDFs into clean Markdown files.",
    tag: "Many Formats",
    tagIcon: FileText,
    icon: FileText,
    color: "sky",
    row: 3,
  },
  {
    id: "protect",
    category: "PROTECT",
    title: "Protect PDF",
    description: "Password protect your PDF and keep it secure.",
    tag: "Secure",
    tagIcon: Lock,
    icon: Lock,
    color: "rose",
    row: 3,
  },
  // Row 4
  {
    id: "page-numbers",
    category: "EDIT",
    title: "Add Page Numbers",
    description: "Add page numbers in the format and position you choose.",
    tag: "Page Customization",
    tagIcon: Type,
    icon: FileText,
    color: "indigo",
    row: 4,
  },
  {
    id: "convert-pdf",
    category: "CONVERT",
    title: "More conversion tools coming soon.",
    description: "",
    tag: "",
    tagIcon: Settings,
    icon: Settings,
    color: "teal",
    row: 4,
  },
  // Row 5 (Special)
  {
    id: "more",
    category: "MORE TOOLS",
    title: "Add more tools",
    description: "Split, Reorder, Watermark, Rotate, Extract Images and more.",
    tag: "",
    icon: LayoutGrid,
    color: "indigo",
    isSpecial: true,
    row: 5,
  },
];
