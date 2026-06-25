import {
  Sparkles,
  PenTool,
  GitMerge,
  Files,
  Languages,
  Lock,
  FileText,
  Scissors,
  type LucideIcon,
} from 'lucide-react';

export type ToolType =
  | 'summarize'
  | 'annotate'
  | 'merge'
  | 'compare'
  | 'translate'
  | 'protect'
  | 'convert'
  | 'delete-pages';

export interface ToolModalConfig {
  title: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  buttonText: string;
  dropHint: string;
  accept: string;
  multiple: boolean;
  maxFiles: number;
  maxSizeMb: number;
  accentButton: string;
  accentButtonHover: string;
  dropzoneBorder: string;
  dropzoneBg: string;
  formatsLabel: string;
}

export const TOOL_MODAL_CONFIG: Record<ToolType, ToolModalConfig> = {
  summarize: {
    title: 'Summarize PDF',
    description: 'Get instant AI-generated summaries of your PDFs in seconds.',
    icon: Sparkles,
    iconBg: 'bg-[#FFE4E9]',
    iconColor: 'text-[#E05297]',
    buttonText: 'Select PDF File',
    dropHint: 'or drag & drop PDF here',
    accept: 'application/pdf,.pdf',
    multiple: false,
    maxFiles: 1,
    maxSizeMb: 20,
    accentButton: 'bg-[#E05297]',
    accentButtonHover: 'hover:bg-[#c94385]',
    dropzoneBorder: 'border-[#F5C2D4]',
    dropzoneBg: 'bg-[#FFF5F7]',
    formatsLabel: 'PDF',
  },
  annotate: {
    title: 'Annotate PDF',
    description: 'Highlight, draw, and add notes to your PDF with ease.',
    icon: PenTool,
    iconBg: 'bg-[#E0E9FF]',
    iconColor: 'text-[#3B82F6]',
    buttonText: 'Select PDF File',
    dropHint: 'or drag & drop PDF here',
    accept: 'application/pdf,.pdf',
    multiple: false,
    maxFiles: 1,
    maxSizeMb: 20,
    accentButton: 'bg-[#3B82F6]',
    accentButtonHover: 'hover:bg-[#2563EB]',
    dropzoneBorder: 'border-[#C7D9FF]',
    dropzoneBg: 'bg-[#F5F8FF]',
    formatsLabel: 'PDF',
  },
  merge: {
    title: 'Merge PDF',
    description: 'Combine multiple PDF files into a single document.',
    icon: GitMerge,
    iconBg: 'bg-[#E2F7EB]',
    iconColor: 'text-[#10B981]',
    buttonText: 'Select Multiple PDFs',
    dropHint: 'or drag & drop PDFs here',
    accept: 'application/pdf,.pdf',
    multiple: true,
    maxFiles: 10,
    maxSizeMb: 20,
    accentButton: 'bg-[#10B981]',
    accentButtonHover: 'hover:bg-[#059669]',
    dropzoneBorder: 'border-[#B8EAD0]',
    dropzoneBg: 'bg-[#F4FBF7]',
    formatsLabel: 'PDF',
  },
  compare: {
    title: 'Compare PDFs',
    description: 'Spot differences between two PDF files instantly.',
    icon: Files,
    iconBg: 'bg-[#F8F2D5]',
    iconColor: 'text-[#D97706]',
    buttonText: 'Select 2 PDF Files',
    dropHint: 'or drag & drop 2 PDFs here',
    accept: 'application/pdf,.pdf',
    multiple: true,
    maxFiles: 2,
    maxSizeMb: 20,
    accentButton: 'bg-[#D97706]',
    accentButtonHover: 'hover:bg-[#B45309]',
    dropzoneBorder: 'border-[#F0E4B8]',
    dropzoneBg: 'bg-[#FCFAF2]',
    formatsLabel: 'PDF',
  },
  translate: {
    title: 'Translate PDF',
    description: 'Translate your PDF to any language with one click.',
    icon: Languages,
    iconBg: 'bg-[#F0E6FF]',
    iconColor: 'text-[#8B5CF6]',
    buttonText: 'Select PDF File',
    dropHint: 'or drag & drop PDF here',
    accept: 'application/pdf,.pdf',
    multiple: false,
    maxFiles: 1,
    maxSizeMb: 20,
    accentButton: 'bg-[#8B5CF6]',
    accentButtonHover: 'hover:bg-[#7C3AED]',
    dropzoneBorder: 'border-[#DDD0FF]',
    dropzoneBg: 'bg-[#FAF8FF]',
    formatsLabel: 'PDF',
  },
  protect: {
    title: 'Protect PDF',
    description: 'Password protect your PDF and keep it secure.',
    icon: Lock,
    iconBg: 'bg-[#FFE4E4]',
    iconColor: 'text-[#F43F5E]',
    buttonText: 'Select PDF File',
    dropHint: 'or drag & drop PDF here',
    accept: 'application/pdf,.pdf',
    multiple: false,
    maxFiles: 1,
    maxSizeMb: 20,
    accentButton: 'bg-[#F43F5E]',
    accentButtonHover: 'hover:bg-[#E11D48]',
    dropzoneBorder: 'border-[#FECACA]',
    dropzoneBg: 'bg-[#FFF8F8]',
    formatsLabel: 'PDF',
  },
  'delete-pages': {
    title: 'Delete Pages',
    description: 'Remove specific pages from your PDF instantly.',
    icon: Scissors,
    iconBg: 'bg-[#FFEAD5]',
    iconColor: 'text-[#F97316]',
    buttonText: 'Select PDF File',
    dropHint: 'or drag & drop PDF here',
    accept: 'application/pdf,.pdf',
    multiple: false,
    maxFiles: 1,
    maxSizeMb: 20,
    accentButton: 'bg-[#F97316]',
    accentButtonHover: 'hover:bg-[#EA6C00]',
    dropzoneBorder: 'border-[#FFCFA0]',
    dropzoneBg: 'bg-[#FFFBF7]',
    formatsLabel: 'PDF',
  },
  convert: {
    title: 'Convert to PDF',
    description: 'Convert Word, Excel, images and more to PDF.',
    icon: FileText,
    iconBg: 'bg-[#E0F2FE]',
    iconColor: 'text-[#0284C7]',
    buttonText: 'Select File',
    dropHint: 'or drag & drop file here',
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg',
    multiple: false,
    maxFiles: 1,
    maxSizeMb: 20,
    accentButton: 'bg-[#0284C7]',
    accentButtonHover: 'hover:bg-[#0369A1]',
    dropzoneBorder: 'border-[#BAE6FD]',
    dropzoneBg: 'bg-[#F5FBFF]',
    formatsLabel: 'PDF, DOC, XLS, Images',
  },
};

export const MODAL_TOOL_IDS: ToolType[] = [
  'summarize',
  'annotate',
  'merge',
  'compare',
  'translate',
  'protect',
  'convert',
  'delete-pages',
];

export function isModalTool(id: string): id is ToolType {
  return MODAL_TOOL_IDS.includes(id as ToolType);
}
