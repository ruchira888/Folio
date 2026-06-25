import React, { useState } from 'react';
import { 
  Search, Sparkles, PenTool, GitMerge, Files, Languages, 
  FileText, Lock, LayoutGrid, ShieldCheck, EyeOff, Monitor,
  Zap, Eye, Activity, Scissors
} from 'lucide-react';
import ToolCard from './ToolCard';
import { isModalTool, TOOL_MODAL_CONFIG, type ToolType } from '../config/toolConfigs';

interface ToolsGridProps {
  setActiveTool: (tool: ToolType) => void;
}
interface ToolItem {
  id: string;
  category: string;
  title: string;
  description: string;
  tag: string;
  tagIcon?: React.ComponentType<any>;
  icon: React.ComponentType<any>;
  color: string;
  avatars?: string[];
  avatarCount?: string;
  isSpecial?: boolean;
  row: number;
}

export default function ToolsGrid({
  setActiveTool
}: ToolsGridProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const tools: ToolItem[] = [
    // Row 1: 3 columns
    {
      id: 'summarize',
      category: 'AI ASSISTANT',
      title: 'Summarize PDF',
      description: 'Get AI-generated summaries of your PDF in seconds.',
      tag: 'AI Powered',
      tagIcon: Sparkles,
      icon: Sparkles,
      color: 'pink',
      
      
      row: 1
    },
    {
      id: 'annotate',
      category: 'EDITOR',
      title: 'Annotate PDF',
      description: 'Highlight, draw, and add notes to your PDF with ease.',
      tag: 'Freehand + Shapes',
      tagIcon: Activity,
      icon: PenTool,
      color: 'blue',
     
    
      row: 1
    },
    {
      id: 'merge',
      category: 'MERGE',
      title: 'Merge PDF',
      description: 'Combine multiple PDF files into a single document.',
      tag: 'Fast & Easy',
      tagIcon: Zap,
      icon: GitMerge,
      color: 'green',
      row: 1
    },
    // Row 2: 2 columns (wider)
    {
      id: 'compare',
      category: 'COMPARE',
      title: 'Compare PDFs',
      description: 'Spot differences between two PDF files instantly.',
      tag: 'Visual + Text Diff',
      tagIcon: Eye,
      icon: Files,
      color: 'yellow',
     
     
      row: 2
    },
    {
      id: 'translate',
      category: 'TRANSLATE',
      title: 'Translate PDF',
      description: 'Translate your PDF to any language with one click.',
      tag: 'AI Translation',
      tagIcon: Sparkles,
      icon: Languages,
      color: 'purple',
      row: 2
    },
    // Row 3: 3 columns
    {
      id: 'delete-pages',
      category: 'EDIT',
      title: 'Delete Pages',
      description: 'Remove specific pages from your PDF instantly.',
      tag: 'Precision Edit',
      tagIcon: Scissors,
      icon: Scissors,
      color: 'orange',
      row: 3
    },
    {
      id: 'convert',
      category: 'CONVERT',
      title: 'Convert to PDF',
      description: 'Convert Word, Excel, images and more to PDF.',
      tag: 'Many Formats',
      tagIcon: FileText,
      icon: FileText,
      color: 'sky',
      row: 3
    },
    {
      id: 'protect',
      category: 'PROTECT',
      title: 'Protect PDF',
      description: 'Password protect your PDF and keep it secure.',
      tag: 'Secure',
      tagIcon: Lock,
      icon: Lock,
      color: 'rose',
      row: 3
    },
    // Row 4: Full-width
    {
      id: 'more',
      category: 'MORE TOOLS',
      title: 'And more tools',
      description: 'Split, Reorder, Watermark, Rotate, Extract Images and more.',
      tag: '',
      icon: LayoutGrid,
      color: 'indigo',
      isSpecial: true,
      row: 4
    }
  ];

  const filteredTools = tools.filter(tool => 
    tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getColorStyles = (id: string) => {
    if (isModalTool(id)) {
      const config = TOOL_MODAL_CONFIG[id as ToolType];
      return {
        bg: config.cardBg,
        border: config.cardBorder,
        iconBg: config.iconBg,
        iconColor: config.iconColor,
        tagBg: config.tagBg,
        tagColor: config.tagColor,
      };
    }
    // Default/More tools fallback (Lavender)
    return {
      bg: 'bg-[#F3F0FF]',
      border: 'border-[#EBE0FF]',
      iconBg: 'bg-white',
      iconColor: 'text-[#6366F1]',
      tagBg: 'bg-[#F3F1FF]',
      tagColor: 'text-[#6366F1]',
    };
  };

  // Group filtered tools by row for the specific layout
  const row1 = filteredTools.filter(t => t.row === 1);
  const row2 = filteredTools.filter(t => t.row === 2);
  const row3 = filteredTools.filter(t => t.row === 3);
  const row4 = filteredTools.filter(t => t.row === 4);
  const hasResults = filteredTools.length > 0;

  return (
    <div className="relative z-20 w-full max-w-[1100px] mx-auto px-4 sm:px-6 md:px-8 mt-6 md:mt-10 mb-16">
      {/* Tool Section Container Card - clean, solid and elegant */}
      <div
        className="rounded-[28px] md:rounded-[36px] border border-white/80 bg-[#FAF8FB]/95 backdrop-blur-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.05)] p-5 sm:p-7 md:p-10"
      >
        
        {/* Header content and search box */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8 pb-5 border-b border-slate-100/80">
          <div className="text-left">
            <h3 className="text-2xl md:text-[30px] font-medium text-[#0F172A] mb-1.5 font-serif">
              All PDF Tools
            </h3>
            <p className="text-[14px] text-slate-400 font-medium font-sans">
              Powerful tools to work with your PDFs in simple steps.
            </p>
          </div>

          {/* Search Box input */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-slate-300 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200/70 bg-white/80 text-[13px] text-slate-800 font-medium placeholder-slate-300 focus:outline-none focus:border-indigo-300/80 focus:ring-3 focus:ring-indigo-100/40 transition-all font-sans"
            />
          </div>
        </div>

        {/* Tools Cards Grid — Specific row-based layout */}
        {hasResults ? (
          <div className="flex flex-col gap-4 md:gap-5 text-left">
            {/* Row 1: 3 equal columns */}
            {row1.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {row1.map((tool) => {
                  const styles = getColorStyles(tool.id);
                  const Icon = tool.icon;
                  return (
                    <ToolCard
                      key={tool.id}
                      category={tool.category}
                      title={tool.title}
                      description={tool.description}
                      tag={tool.tag}
                      tagIcon={tool.tagIcon}
                      icon={Icon}
                      styles={styles}
                    
                      avatarCount={tool.avatarCount}
                      onClick={
                        isModalTool(tool.id)
                          ? () => setActiveTool(tool.id as ToolType)
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            )}

            {/* Row 2: 2 wider columns */}
            {row2.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                {row2.map((tool) => {
                  const styles = getColorStyles(tool.id);
                  const Icon = tool.icon;
                  return (
                    <ToolCard
                      key={tool.id}
                      category={tool.category}
                      title={tool.title}
                      description={tool.description}
                      tag={tool.tag}
                      tagIcon={tool.tagIcon}
                      icon={Icon}
                      styles={styles}
                      avatars={tool.avatars}
                      avatarCount={tool.avatarCount}
                      onClick={
                        isModalTool(tool.id)
                          ? () => setActiveTool(tool.id as ToolType)
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            )}

            {/* Row 3: 3 equal columns */}
            {row3.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {row3.map((tool) => {
                  const styles = getColorStyles(tool.id);
                  const Icon = tool.icon;
                  return (
                    <ToolCard
                      key={tool.id}
                      category={tool.category}
                      title={tool.title}
                      description={tool.description}
                      tag={tool.tag}
                      tagIcon={tool.tagIcon}
                      icon={Icon}
                      styles={styles}
                      avatars={tool.avatars}
                      avatarCount={tool.avatarCount}
                      onClick={
                        isModalTool(tool.id)
                          ? () => setActiveTool(tool.id as ToolType)
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            )}

            {/* Row 4: Full-width "And more tools" card */}
            {row4.map((tool) => {
              const styles = getColorStyles(tool.id);
              const Icon = tool.icon;
              return (
                <div
                  key={tool.id}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 md:p-6 rounded-2xl border ${styles.border} ${styles.bg} transition-all duration-300`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl ${styles.iconBg} flex-shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 mb-0.5">
                        <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 font-sans">
                          {tool.category}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-[#0F172A] font-serif">
                        {tool.title}
                      </h4>
                      <p className="text-[13px] text-slate-400 font-medium font-sans mt-0.5">
                        {tool.description}
                      </p>
                    </div>
                  </div>

                  <button className="mt-4 sm:mt-0 bg-white text-[#0F172A] font-semibold text-[12px] px-4 py-2.5 rounded-full border border-slate-200 shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center gap-2 flex-shrink-0">
                    <LayoutGrid className="w-3.5 h-3.5" />
                    View all tools
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400 font-medium">No tools found matching your search.</p>
          </div>
        )}

        {/* Core Promises Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-8 mt-8 border-t border-slate-100/60 text-center font-sans">
          <div className="flex items-center justify-center gap-2 text-slate-400 font-medium text-[12.5px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Your files are secure and private.</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-400 font-medium text-[12.5px] border-y sm:border-y-0 sm:border-x border-slate-100/60 py-3 sm:py-0">
            <EyeOff className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>We never store your documents.</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-400 font-medium text-[12.5px]">
            <Monitor className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>Works on any device.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
