import { motion } from 'framer-motion';

export default function Hero() {
  const headline = "Your all-in-one PDF toolkit.";

  const charVariants = {
    hidden: { opacity: 0, y: 10, filter: "blur(10px)" },
    visible: { 
      opacity: 1, 
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
    }
  };

  const wordVariants = {
    hidden: { opacity: 0, y: 5, filter: "blur(10px)" },
    visible: { 
      opacity: 1, 
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
    }
  };

  const containerVariants = {
    visible: {
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.4
      }
    }
  };

  const subheadlineContainer = {
    visible: {
      transition: {
        staggerChildren: 0.2,
        delayChildren: 1.6 
      }
    }
  };

  return (
    <div className="relative w-full overflow-hidden">
      {/* Hero Content Section */}
      <div className="w-full max-w-6xl mx-auto px-6 md:px-12 pt-16 md:pt-20 pb-8">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          {/* Left: Text Content */}
          <div className="max-w-xl text-left">
            {/* Main Heading Character-by-character */}
            <motion.h1 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="text-[38px] sm:text-[46px] md:text-[56px] font-medium tracking-tight text-[#1D3557] leading-[1.1] mb-1 font-serif"
            >
              {headline.split("").map((char, index) => (
                <motion.span 
                  key={index} 
                  variants={charVariants}
                  className="inline-block"
                  style={{ whiteSpace: char === " " ? "pre" : "normal" }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.h1>

            {/* Sub-headline Word-by-word */}
            <motion.h2 
              variants={subheadlineContainer}
              initial="hidden"
              animate="visible"
              className="text-[32px] sm:text-[38px] md:text-[46px] font-medium tracking-tight mb-7 font-serif leading-[1.15]"
            >
              <motion.span variants={wordVariants} className="text-[#FFEABC]">Smart</motion.span>,{' '}
              <motion.span variants={wordVariants} className="text-[#EC4899]">fast</motion.span>,{' '}
              <motion.span variants={wordVariants} className="text-[#E8D6FF]">secure</motion.span>.
            </motion.h2>

            {/* Description Fade in */}
            <motion.p 
              initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.5, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="text-[15px] md:text-[16px] text-slate-600 font-medium max-w-sm leading-relaxed mb-8 font-sans"
            >
              Everything you need to manage, edit,
              <br className="hidden sm:inline" />
              and enhance your PDFs.
              <br />
              Powered by <span className="text-[#EC4899] font-bold">AI</span>.
            </motion.p>
          </div>

          {/* Right: Bird silhouettes */}
          <motion.div 
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 0.6, filter: "blur(0px)" }}
            transition={{ delay: 2.8, duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
            className="hidden md:flex items-start pt-8 pr-8 select-none pointer-events-none"
          >
            <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M45 35 C40 25, 30 20, 20 28 C30 26, 38 28, 45 35 Z" fill="#2D3A4A" />
              <path d="M45 35 C50 25, 60 22, 70 30 C60 27, 52 28, 45 35 Z" fill="#2D3A4A" />
              <path d="M75 22 C72 16, 65 13, 58 18 C65 17, 71 18, 75 22 Z" fill="#2D3A4A" />
              <path d="M75 22 C78 16, 84 14, 90 19 C84 17, 79 18, 75 22 Z" fill="#2D3A4A" />
              <path d="M90 42 C88 38, 83 36, 79 39 C83 38, 87 39, 90 42 Z" fill="#3D4A5A" />
              <path d="M90 42 C92 38, 96 37, 100 40 C96 39, 93 39, 90 42 Z" fill="#3D4A5A" />
            </svg>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
