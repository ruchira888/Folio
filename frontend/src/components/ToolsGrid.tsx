import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, ShieldCheck, EyeOff, Monitor
} from 'lucide-react';
import { motion } from 'framer-motion';
import ToolCard from './ToolCard';
import { isModalTool, TOOL_MODAL_CONFIG, type ToolType } from '../config/toolConfigs';
import { TOOLS } from '../config/tools';

interface ToolsGridProps {
  setActiveTool: (tool: ToolType) => void;
}

export default function ToolsGrid({
  setActiveTool
}: ToolsGridProps) {
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
    tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const row1 = filteredTools.filter(t => t.row === 1);
  const row2 = filteredTools.filter(t => t.row === 2);
  const row3 = filteredTools.filter(t => t.row === 3);
  const row4 = filteredTools.filter(t => t.row === 4);
  const specialTools = filteredTools.filter(t => t.isSpecial);
  const hasResults = filteredTools.length > 0;

  // Animation variants with blur
  const containerVariants = {
    hidden: { opacity: 0, y: 40, filter: "blur(15px)" },
    visible: { 
      opacity: 1, 
      y: 0,
      filter: "blur(0px)",
      transition: { 
        duration: 1.2, 
        ease: [0.16, 1, 0.3, 1] as const,
        delay: 2.4, 
        staggerChildren: 0.1,
        delayChildren: 2.6
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, filter: "blur(12px)" },
    visible: { 
      opacity: 1, 
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      className="relative z-20 w-full max-w-275 mx-auto px-4 sm:px-6 md:px-8 mt-6 md:mt-10 mb-16"
    >
      <div className="rounded-[28px] md:rounded-[36px] border border-white/80 bg-[#FAF8FB]/95 backdrop-blur-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.05)] p-5 sm:p-7 md:p-10">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8 pb-5 border-b border-slate-100/80">
          <div className="text-left">
            <h3 className="text-2xl md:text-[30px] font-medium text-[#0F172A] mb-1.5 font-serif">
              All PDF Tools
            </h3>
            <p className="text-[14px] text-slate-400 font-medium font-sans">
              Powerful tools to work with your PDFs in simple steps.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200/70 bg-white/80 text-[13px] text-slate-800 font-medium placeholder-slate-300 focus:outline-none focus:border-indigo-300/80 focus:ring-3 focus:ring-indigo-100/40 transition-all font-sans"
            />
          </div>
        </div>

        {hasResults ? (
          <div className="flex flex-col gap-4 md:gap-5 text-left">
            {row1.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {row1.map((tool) => (
                  <motion.div key={tool.id} variants={itemVariants}>
                    <ToolCard {...tool} styles={getColorStyles(tool.id)} onClick={isModalTool(tool.id) ? () => setActiveTool(tool.id as ToolType) : undefined} />
                  </motion.div>
                ))}
              </div>
            )}

            {row2.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                {row2.map((tool) => (
                  <motion.div key={tool.id} variants={itemVariants}>
                    <ToolCard {...tool} styles={getColorStyles(tool.id)} onClick={isModalTool(tool.id) ? () => setActiveTool(tool.id as ToolType) : undefined} />
                  </motion.div>
                ))}
              </div>
            )}

            {row3.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {row3.map((tool) => (
                  <motion.div key={tool.id} variants={itemVariants}>
                    <ToolCard {...tool} styles={getColorStyles(tool.id)} onClick={isModalTool(tool.id) ? () => setActiveTool(tool.id as ToolType) : undefined} />
                  </motion.div>
                ))}
              </div>
            )}

            {row4.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 lg:w-2/3">
                {row4.map((tool) => (
                  <motion.div key={tool.id} variants={itemVariants}>
                    <ToolCard {...tool} styles={getColorStyles(tool.id)} onClick={isModalTool(tool.id) ? () => setActiveTool(tool.id as ToolType) : undefined} />
                  </motion.div>
                ))}
              </div>
            )}

            {specialTools.map((tool) => {
              const styles = getColorStyles(tool.id);
              const Icon = tool.icon;
              return (
                <motion.div 
                  key={tool.id} 
                  variants={itemVariants}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 md:p-6 rounded-2xl border ${styles.border} ${styles.bg} transition-all duration-300 hover:shadow-lg hover:shadow-indigo-100/50 cursor-pointer group`}
                  onClick={() => navigate('/tools')}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl ${styles.iconBg} shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 mb-0.5">
                        <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 font-sans">
                          {tool.category}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-[#0F172A] font-serif transition-colors group-hover:text-indigo-900">{tool.title}</h4>
                      <p className="text-[13px] text-slate-400 font-medium font-sans mt-0.5">{tool.description}</p>
                    </div>
                  </div>
                  <button className="mt-4 sm:mt-0 bg-white text-[#0F172A] font-semibold text-[12px] px-4 py-2.5 rounded-full border border-slate-200 shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center gap-2 shrink-0 cursor-pointer">
                    <LayoutGrid className="w-3.5 h-3.5" />
                    View all tools
                  </button>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400 font-medium">No tools found matching your search.</p>
          </div>
        )}

        <motion.div 
          initial={{ opacity: 0, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] as const }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-8 mt-8 border-t border-slate-100/60 text-center font-sans"
        >
          <div className="flex items-center justify-center gap-2 text-slate-400 font-medium text-[12.5px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Your files are secure and private.</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-400 font-medium text-[12.5px] border-y sm:border-y-0 sm:border-x border-slate-100/60 py-3 sm:py-0">
            <EyeOff className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Files deleted after 45 minutes.</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-400 font-medium text-[12.5px]">
            <Monitor className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Works on any device.</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
