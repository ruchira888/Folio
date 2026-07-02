import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function Hero() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Character-by-character animation for main headline
  const mainHeadline = "Your all-in-one PDF toolkit";
  const mainHeadlineChars = mainHeadline.split('');

  const charVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.2 + i * 0.03,
        duration: 0.4,
        ease: 'easeOut',
      },
    }),
  };

  // Word-by-word animation for tagline
  const taglineWords = ['Smart', 'fast', 'secure'];
  const colors = ['text-[#FFEABC]', 'text-[#EC4899]', 'text-[#E8D6FF]'];

  const wordVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.2 + mainHeadlineChars.length * 0.03 + 0.3 + i * 0.15,
        duration: 0.5,
        ease: 'easeOut',
      },
    }),
  };

  // Description fade-in
  const descriptionVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delay: 0.2 + mainHeadlineChars.length * 0.03 + 0.3 + taglineWords.length * 0.15 + 0.2,
        duration: 0.6,
        ease: 'easeOut',
      },
    },
  };

  // Container fade and slide down
  const containerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.2,
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  return (
    <div className="relative w-full overflow-hidden">
      {/* Navigation fade-in and slide down */}
      {isLoaded && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.2,
            duration: 0.5,
            ease: 'easeOut',
          }}
        />
      )}

      {/* Hero Content Section */}
      <div className="w-full max-w-6xl mx-auto px-6 md:px-12 pt-16 md:pt-20 pb-8">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          {/* Left: Text Content */}
          <motion.div
            className="max-w-xl text-left"
            initial="hidden"
            animate={isLoaded ? 'visible' : 'hidden'}
            variants={containerVariants}
          >
            {/* Main Heading - Character by character */}
            <motion.h1 className="text-[38px] sm:text-[46px] md:text-[56px] font-medium tracking-tight text-[#1D3557] leading-[1.1] mb-1 font-serif">
              {mainHeadlineChars.map((char, i) => (
                <motion.span
                  key={i}
                  custom={i}
                  variants={charVariants}
                  initial="hidden"
                  animate={isLoaded ? 'visible' : 'hidden'}
                  className="inline-block"
                >
                  {char === ' ' ? '\u00A0' : char}
                </motion.span>
              ))}
            </motion.h1>

            {/* Tagline - Word by word with colors */}
            <motion.h2 className="text-[32px] sm:text-[38px] md:text-[46px] font-medium tracking-tight mb-7 font-serif leading-[1.15]">
              {taglineWords.map((word, i) => (
                <motion.span
                  key={word}
                  custom={i}
                  variants={wordVariants}
                  initial="hidden"
                  animate={isLoaded ? 'visible' : 'hidden'}
                  className={`inline-block ${colors[i]} mr-3`}
                >
                  {word}
                </motion.span>
              ))}
              {taglineWords.length > 0 && <span className="mr-0">.</span>}
            </motion.h2>

            {/* Description - Fade in */}
            <motion.p
              className="text-[15px] md:text-[16px] text-slate-500 font-medium max-w-sm leading-relaxed mb-8 font-sans"
              initial="hidden"
              animate={isLoaded ? 'visible' : 'hidden'}
              variants={descriptionVariants}
            >
              Everything you need to manage, edit,
              <br className="hidden sm:inline" />
              and enhance your PDFs.
              <br />
              Powered by <span className="text-[#EC4899] font-bold">AI</span>.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex items-center gap-4 flex-wrap"
              initial={{ opacity: 0 }}
              animate={isLoaded ? { opacity: 1 } : { opacity: 0 }}
              transition={{
                delay: 0.2 + mainHeadlineChars.length * 0.03 + 0.3 + taglineWords.length * 0.15 + 0.2 + 0.3,
                duration: 0.6,
              }}
            />
          </motion.div>

          {/* Right: Bird silhouettes with subtle animation */}
          <motion.div
            className="hidden md:flex items-start pt-8 pr-8 select-none pointer-events-none"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isLoaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            transition={{
              delay: 0.5,
              duration: 0.8,
              ease: 'easeOut',
            }}
          >
            <svg
              width="120"
              height="90"
              viewBox="0 0 120 90"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="opacity-60"
            >
              {/* Bird 1 - larger */}
              <path d="M45 35 C40 25, 30 20, 20 28 C30 26, 38 28, 45 35 Z" fill="#2D3A4A" />
              <path d="M45 35 C50 25, 60 22, 70 30 C60 27, 52 28, 45 35 Z" fill="#2D3A4A" />
              {/* Bird 2 - smaller, offset */}
              <path d="M75 22 C72 16, 65 13, 58 18 C65 17, 71 18, 75 22 Z" fill="#2D3A4A" />
              <path d="M75 22 C78 16, 84 14, 90 19 C84 17, 79 18, 75 22 Z" fill="#2D3A4A" />
              {/* Bird 3 - smallest */}
              <path d="M90 42 C88 38, 83 36, 79 39 C83 38, 87 39, 90 42 Z" fill="#3D4A5A" />
              <path d="M90 42 C92 38, 96 37, 100 40 C96 39, 93 39, 90 42 Z" fill="#3D4A5A" />
            </svg>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
