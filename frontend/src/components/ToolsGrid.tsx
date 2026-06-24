import React, { useState, useRef } from 'react';
import { 
  Search, Sparkles, PenTool, GitMerge, Files, Languages, 
  Minimize2, FileText, Lock, LayoutGrid, ShieldCheck, EyeOff, Monitor 
} from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface ToolsGridProps {
  setActiveTool: (tool: string) => void
}
interface ToolItem {
  id: string;
  category: string;
  title: string;
  description: string;
  tag: string;
  icon: React.ComponentType<any>;
  color: string;
  avatars?: string[];
  avatarCount?: string;
  isSpecial?: boolean;
}

export default function ToolsGrid({
  setActiveTool
}: ToolsGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // Elegant scroll dynamics (emerges out of the clouds and blurs)
  const y = useTransform(scrollYProgress, [0, 0.4], [120, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0.4, 1]);
  const backdropFilter = useTransform(
    scrollYProgress,
    [0, 0.35],
    ["blur(4px)", "blur(24px)"]
  );
  const backgroundColor = useTransform(
    scrollYProgress,
    [0, 0.35],
    ["rgba(255, 255, 255, 0.2)", "rgba(250, 249, 252, 0.55)"]
  );

  const tools: ToolItem[] = [
    {
      id: 'summarize',
      category: 'AI ASSISTANT',
      title: 'Summarize PDF',
      description: 'Get AI-generated summaries of your PDF in seconds.',
      tag: 'AI Powered',
      icon: Sparkles,
      color: 'pink',
      avatars: [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80'
      ],
      avatarCount: '+8K'
    },
    {
      id: 'annotate',
      category: 'EDITOR',
      title: 'Annotate PDF',
      description: 'Highlight, draw, and add notes to your PDF with ease.',
      tag: 'Freehand + Shapes',
      icon: PenTool,
      color: 'blue',
      avatars: [
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80',
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&h=100&q=80'
      ],
      avatarCount: '+6K'
    },
    {
      id: 'merge',
      category: 'MERGE',
      title: 'Merge PDF',
      description: 'Combine multiple PDF files into a single document.',
      tag: 'Fast & Easy',
      icon: GitMerge,
      color: 'green'
    },
    {
      id: 'compare',
      category: 'COMPARE',
      title: 'Compare PDFs',
      description: 'Spot differences between two PDF files instantly.',
      tag: 'Visual + Text Diff',
      icon: Files,
      color: 'yellow',
      avatars: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80',
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&h=100&q=80'
      ],
      avatarCount: '+3K'
    },
    {
      id: 'translate',
      category: 'TRANSLATE',
      title: 'Translate PDF',
      description: 'Translate your PDF to any language with one click.',
      tag: 'AI Translation',
      icon: Languages,
      color: 'purple'
    },
    {
      id: 'compress',
      category: 'COMPRESS',
      title: 'Compress PDF',
      description: 'Reduce PDF file size without losing quality.',
      tag: 'High Quality',
      icon: Minimize2,
      color: 'orange'
    },
    {
      id: 'convert',
      category: 'CONVERT',
      title: 'Convert to PDF',
      description: 'Convert Word, Excel, images and more to PDF.',
      tag: 'Many Formats',
      icon: FileText,
      color: 'sky'
    },
    {
      id: 'protect',
      category: 'PROTECT',
      title: 'Protect PDF',
      description: 'Password protect your PDF and keep it secure.',
      tag: 'Secure',
      icon: Lock,
      color: 'rose'
    },
    {
      id: 'more',
      category: 'MORE TOOLS',
      title: 'And more tools',
      description: 'Split, Reorder, Watermark, Rotate, Extract Images and more.',
      tag: '',
      icon: LayoutGrid,
      color: 'indigo',
      isSpecial: true
    }
  ];

  const filteredTools = tools.filter(tool => 
    tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getColorStyles = (color: string) => {
    switch (color) {
      case 'pink':
        return {
          bg: 'bg-[#FFF5F7] hover:bg-[#FFF0F3]',
          border: 'border-[#FFE4E9]',
          iconBg: 'bg-[#FFE4E9] text-[#E05297]',
          tagBg: 'bg-[#FFF0F3] text-[#E05297]',
        };
      case 'blue':
        return {
          bg: 'bg-[#F5F8FF] hover:bg-[#EEF3FF]',
          border: 'border-[#E0E9FF]',
          iconBg: 'bg-[#E0E9FF] text-[#3B82F6]',
          tagBg: 'bg-[#EEF3FF] text-[#3B82F6]',
        };
      case 'green':
        return {
          bg: 'bg-[#F4FBF7] hover:bg-[#EDF8F2]',
          border: 'border-[#E2F7EB]',
          iconBg: 'bg-[#E2F7EB] text-[#10B981]',
          tagBg: 'bg-[#EDF8F2] text-[#10B981]',
        };
      case 'yellow':
        return {
          bg: 'bg-[#FCFAF2] hover:bg-[#FAF6E6]',
          border: 'border-[#F8F2D5]',
          iconBg: 'bg-[#F8F2D5] text-[#D97706]',
          tagBg: 'bg-[#FAF6E6] text-[#D97706]',
        };
      case 'purple':
        return {
          bg: 'bg-[#FAF8FF] hover:bg-[#F4F0FF]',
          border: 'border-[#F0E6FF]',
          iconBg: 'bg-[#F0E6FF] text-[#8B5CF6]',
          tagBg: 'bg-[#F4F0FF] text-[#8B5CF6]',
        };
      case 'orange':
        return {
          bg: 'bg-[#FFFBF7] hover:bg-[#FFF5EB]',
          border: 'border-[#FFEAD5]',
          iconBg: 'bg-[#FFEAD5] text-[#F97316]',
          tagBg: 'bg-[#FFF5EB] text-[#F97316]',
        };
      case 'sky':
        return {
          bg: 'bg-[#F5FBFF] hover:bg-[#EDF7FF]',
          border: 'border-[#E0F2FE]',
          iconBg: 'bg-[#E0F2FE] text-[#0284C7]',
          tagBg: 'bg-[#EDF7FF] text-[#0284C7]',
        };
      case 'rose':
        return {
          bg: 'bg-[#FFF8F8] hover:bg-[#FFF2F2]',
          border: 'border-[#FFE4E4]',
          iconBg: 'bg-[#FFE4E4] text-[#F43F5E]',
          tagBg: 'bg-[#FFF2F2] text-[#F43F5E]',
        };
      default: // indigo / special card
        return {
          bg: 'bg-[#FAF9FF] hover:bg-[#F3F1FF]',
          border: 'border-[#EDE9FE]',
          iconBg: 'bg-[#EDE9FE] text-[#6366F1]',
          tagBg: 'bg-[#F3F1FF] text-[#6366F1]',
        };
    }
  };

  return (
    <div ref={containerRef} className="relative z-20 w-full max-w-[1240px] mx-auto px-4 sm:px-6 md:px-8 -mt-20 md:-mt-28 mb-16">
      {/* Floating Tool Section Container Card with Glassmorphism and Framer Motion Scroll Effects */}
      <motion.div
        style={{ y, opacity, backdropFilter, backgroundColor }}
        className="rounded-[32px] md:rounded-[40px] border border-white/30 shadow-[0_-12px_40px_-10px_rgba(15,23,42,0.02),0_24px_48px_-15px_rgba(15,23,42,0.05)] p-6 sm:p-8 md:p-12"
      >
        
        {/* Header content and search box */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-slate-100">
          <div className="text-left">
            <h3 className="text-3xl md:text-[34px] font-medium text-[#0F172A] mb-2 font-serif">
              All PDF Tools
            </h3>
            <p className="text-[15px] text-slate-500 font-medium font-sans">
              Powerful tools to work with your PDFs in simple steps.
            </p>
          </div>

          {/* Search Box input */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-5 py-3 rounded-full border border-slate-200/80 bg-white text-[14px] text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:border-indigo-400/80 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
            />
          </div>
        </div>

        {/* Tools Cards Grid */}
        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 text-left">
            {filteredTools.map((tool) => {
              const styles = getColorStyles(tool.color);
              const Icon = tool.icon;

              if (tool.isSpecial) {
                return (
                  <div
                    key={tool.id}
                    className={`flex flex-col justify-between p-6 md:p-8 rounded-2xl border ${styles.border} ${styles.bg} transition-all duration-300 shadow-sm relative overflow-hidden`}
                  >
                    <div>
                      {/* Icon & Category */}
                      <div className="flex items-center gap-3 mb-6">
                        <div className={`p-2.5 rounded-xl ${styles.iconBg}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-bold tracking-wider text-slate-400 font-sans">
                          {tool.category}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h4 className="text-xl font-bold text-[#0F172A] mb-2 font-serif">
                        {tool.title}
                      </h4>
                      <p className="text-[14px] leading-relaxed text-slate-500 font-medium font-sans">
                        {tool.description}
                      </p>
                    </div>

                    <div className="mt-8 flex justify-end">
                      <button className="bg-white text-[#0F172A] font-semibold text-[13px] px-5 py-2.5 rounded-full border border-slate-200 shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all">
                        View all tools
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={tool.id}
                  className={`flex flex-col justify-between p-6 md:p-8 rounded-2xl border ${styles.border} ${styles.bg} hover:shadow-md hover:shadow-slate-100/80 hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer`}
                  onClick={() => {
  if (tool.id === 'summarize') {
    setActiveTool('summarize')
  }
}}
                >
                  <div>
                    {/* Icon & Category */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`p-2.5 rounded-xl ${styles.iconBg} group-hover:scale-105 transition-transform`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold tracking-wider text-slate-400 font-sans">
                        {tool.category}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h4 className="text-xl font-bold text-[#0F172A] mb-2 font-serif group-hover:text-slate-900">
                      {tool.title}
                    </h4>
                    <p className="text-[14px] leading-relaxed text-slate-500 font-medium font-sans">
                      {tool.description}
                    </p>
                  </div>

                  {/* Badges and Users Row */}
                  <div className="mt-8 pt-4 border-t border-slate-200/40 flex items-center justify-between flex-wrap gap-3">
                    {tool.tag && (
                      <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${styles.tagBg}`}>
                        {tool.tag}
                      </span>
                    )}
                    
                    {tool.avatars && (
                      <div className="flex items-center gap-2 ml-auto">
                        <div className="flex -space-x-2">
                          {tool.avatars.map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt="User avatar"
                              className="w-6 h-6 rounded-full border border-white object-cover shadow-sm"
                            />
                          ))}
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">
                          {tool.avatarCount}
                        </span>
                      </div>
                    )}
                  </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-10 mt-10 border-t border-slate-100 text-center font-sans">
          <div className="flex items-center justify-center gap-2.5 text-slate-500 font-medium text-[13.5px]">
            <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <span>Your files are secure and private.</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 text-slate-500 font-medium text-[13.5px] border-y sm:border-y-0 sm:border-x border-slate-100 py-3 sm:py-0">
            <EyeOff className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            <span>We never store your documents.</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 text-slate-500 font-medium text-[13.5px]">
            <Monitor className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <span>Works on any device.</span>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
