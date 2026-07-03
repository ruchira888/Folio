import { motion } from "framer-motion";
import { Heart, Bug, Lightbulb, Star, Globe, ArrowRight } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0, y: 50, filter: "blur(15px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1] as const,
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 25, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function SupportSection() {
  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="w-full max-w-4xl mx-auto px-4 py-6"
    >
      {/* Bug Row */}
      <div className="flex items-center justify-center gap-3">
        <motion.h3
          variants={itemVariants}
          className="text-[14px] font-medium text-[#1D3557]/60"
        >
          found a bug?
        </motion.h3>

        <motion.a
          variants={itemVariants}
          href="https://github.com/ruchira888/Folio/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#FF4D6D]/15 bg-white/80 px-4 py-2 text-[13px] font-medium text-[#1D3557]"
        >
          <Bug className="h-3.5 w-3.5 text-[#FF4D6D]" />
          report a bug
        </motion.a>

        <motion.a
          variants={itemVariants}
          href="https://github.com/ruchira888/Folio/issues/new?labels=enhancement"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#FF4D6D]/15 bg-white/80 px-4 py-2 text-[13px] font-medium text-[#1D3557]"
        >
          <Lightbulb className="h-3.5 w-3.5 text-[#FF4D6D]" />
          share an idea
        </motion.a>
      </div>
      {/* Divider */}
      <div className="my-5 flex items-center gap-4">
        <div className="h-px flex-1 bg-slate-200/60" />
        <Heart className="h-3.5 w-3.5 text-[#FF4D6D]" />
        <div className="h-px flex-1 bg-slate-200/60" />
      </div>

      {/* Github Row */}
      <div className="flex items-center justify-center gap-3">
        <Star className="h-4 w-4 fill-amber-300 text-amber-400" />

        <span className="text-[13px] font-medium text-[#1D3557]">
          drop a star on GitHub
        </span>

        <a
          href="https://github.com/ruchira888/Folio"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#FF4D6D]"
        >
          <Globe className="h-3.5 w-3.5 text-slate-900" />
          <span>View</span>
          <ArrowRight className="h-3.5 w-3.5 text-[#FF4D6D]" />
        </a>
      </div>
    </motion.section>
  );
}
