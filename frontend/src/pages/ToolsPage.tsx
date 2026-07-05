import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, ShieldCheck, EyeOff, Monitor, LayoutGrid
} from 'lucide-react';
import { isModalTool, TOOL_MODAL_CONFIG, type ToolType } from '../config/toolConfigs';
import { TOOLS } from '../config/tools';
import ToolCard from '../components/ToolCard';

interface ToolsPageProps {
  setActiveTool: (tool: ToolType) => void;
}

export default function ToolsPage({ setActiveTool }: ToolsPageProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

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
    return {
      bg: 'bg-[#F3F0FF]',
      border: 'border-[#EBE0FF]',
      iconBg: 'bg-white',
      iconColor: 'text-[#6366F1]',
      tagBg: 'bg-[#F3F1FF]',
      tagColor: 'text-[#6366F1]',
    };
  };

  const filteredTools = TOOLS.filter(tool => 
    !tool.isSpecial && (
    tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const row1 = filteredTools.filter(t => t.row === 1);
  const row2 = filteredTools.filter(t => t.row === 2);
  const row3 = filteredTools.filter(t => t.row === 3);
  const row4 = filteredTools.filter(t => t.row === 4);

  return (
    <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 mt-6 md:mt-10 mb-16">
      <div className="rounded-[32px] md:rounded-[40px] border border-white/80 bg-white/95 backdrop-blur-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.05)] p-5 sm:p-7 md:p-10">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-600 mb-8 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span className="text-[14px] font-medium font-sans">Back to Home</span>
        </button>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-10 pb-6 border-b border-slate-100/80">
          <div className="text-left">
            <h1 className="text-3xl md:text-[34px] font-medium text-[#0F172A] mb-1.5 font-serif">
              All PDF Tools
            </h1>
            <p className="text-[15px] text-slate-400 font-medium font-sans">
              Powerful tools to work with your PDFs in simple steps.
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-5 py-3 rounded-full border border-slate-200/80 bg-white text-[14px] text-slate-800 placeholder-slate-300 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all font-sans"
            />
          </div>
        </div>

        {/* Tools Cards Grid */}
        <div className="flex flex-col gap-6">
          {row1.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {row1.map(tool => (
                <ToolCard key={tool.id} {...tool} styles={getColorStyles(tool.id)} onClick={isModalTool(tool.id) ? () => setActiveTool(tool.id as ToolType) : undefined} />
              ))}
            </div>
          )}

          {row2.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {row2.map(tool => (
                <ToolCard key={tool.id} {...tool} styles={getColorStyles(tool.id)} onClick={isModalTool(tool.id) ? () => setActiveTool(tool.id as ToolType) : undefined} />
              ))}
            </div>
          )}

          {row3.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {row3.map(tool => (
                <ToolCard key={tool.id} {...tool} styles={getColorStyles(tool.id)} onClick={isModalTool(tool.id) ? () => setActiveTool(tool.id as ToolType) : undefined} />
              ))}
            </div>
          )}

          {row4.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:w-2/3">
              {row4.map(tool => (
                <ToolCard key={tool.id} {...tool} styles={getColorStyles(tool.id)} onClick={isModalTool(tool.id) ? () => setActiveTool(tool.id as ToolType) : undefined} />
              ))}
            </div>
          )}

          {/* Special "Add more tools" card */}
          {/* <div className="bg-[#F8F7FF] border border-[#EDE9FF] rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white shadow-sm shrink-0">
                <LayoutGrid className="w-5 h-5 text-[#6366F1]" />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-sans mb-0.5">More Tools</div>
                <h3 className="text-lg font-bold text-[#0F172A] font-serif">Add more tools</h3>
                <p className="text-[13px] text-slate-400 font-medium font-sans">Split, Reorder, Watermark, Rotate, Extract Images and more.</p>
              </div>
            </div>
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="bg-white text-[#0F172A] font-bold text-[12px] px-5 py-2.5 rounded-full border border-slate-200 shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <LayoutGrid className="w-4 h-4" />
              View all tools
            </button>
          </div> */}
        </div>

        {/* Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-10 mt-10 border-t border-slate-100">
          <div className="flex items-center justify-center gap-2.5 text-slate-400 font-medium text-[12.5px]">
            <ShieldCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
            <span>Your files are secure and private.</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 text-slate-400 font-medium text-[12.5px] border-y sm:border-y-0 sm:border-x border-slate-100/60 py-4 sm:py-0">
            <EyeOff className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
            <span>Files deleted after 45 minutes.</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 text-slate-400 font-medium text-[12.5px]">
            <Monitor className="w-4.5 h-4.5 text-blue-400 shrink-0" />
            <span>Works on any device.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
