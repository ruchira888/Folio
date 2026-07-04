import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageSquareQuote } from "lucide-react";
import { useState } from "react";


const faqs = [
  {
    question: "What is Folio?",
    answer:
      "Folio is an all-in-one PDF management platform designed to simplify your workflow. You can edit, annotate, convert, protect, and organize your PDFs — all in one place, securely.",
  },
  {
    question: "How does Folio work?",
    answer:
      "Simply upload your PDF files , select the tool you need and download the processed file in seconds. Our AI-powered tools even help with summaries",
  },
  {
    question: "Is Folio secure?",
    answer:
      "Security is our top priority. All uploaded files are processed securely and automatically deleted within 45 minutes of upload",
  },
  {
    question: "What happens to my files after upload?",
    answer:
      "Files are stored temporarily to process your request and are automatically removed within 45 minutes. Once deleted, they cannot be recovered."
  },
  {
    question: "Do I need to create an account?",
    answer:
      "No.Folio tools can be used without creating an account. Simply upload your PDF and start working immediately."
  },
  {
    question: "Does Folio use AI?",
    answer:
      "Yes. Features such as PDF Summarization use AI to help you extract key insights faster while preserving the original document."
  },
  {
    question: "Can I annotate PDFs online?",
    answer:
      "Yes. You can highlight, underline, strike through text, draw freehand, and add notes directly to your PDF."
  },
  {
    question: "What file formats does Folio support?",
    answer:
      "Folio primarily supports PDF documents and can convert PDFs to and from formats such as JPG, Markdown, and common image formats."
  },
  {
    question: "Can I use Folio on my mobile device?",
    answer:
      "Yes. Folio is fully responsive and works on desktops, tablets, and mobile devices through any modern web browser."
  },
  {
    question: "Are my documents shared with anyone?",
    answer:
      "No. Your files remain private and are only used to provide the requested PDF processing service. We do not share your documents with third parties."
  }
];

function FAQItem({ question, answer, isOpen, onClick, index }: { 
  question: string; 
  answer: string; 
  isOpen: boolean; 
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: "blur(12px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true }}
      transition={{ 
        delay: index * 0.08, 
        duration: 1, 
        ease: [0.16, 1, 0.3, 1] 
      }}
      className="mb-4"
    >
      <button
        onClick={onClick}
        className={`w-full flex items-center justify-between p-7 text-left transition-all rounded-[24px] border border-white/40 ${
          isOpen 
            ? "bg-white/80 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] backdrop-blur-md" 
            : "bg-white/40 hover:bg-white/60"
        }`}
      >
        <span className="text-[19px] font-semibold text-[#1D3557] font-serif leading-tight">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="p-2 rounded-full bg-slate-100/50"
        >
          <ChevronDown className="w-4 h-4 text-[#1D3557] opacity-60" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-7 pb-8 pt-3 text-slate-500 leading-relaxed font-sans text-[16px] max-w-[92%]">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const headlineWords = "Frequently asked".split(" ");

  const charVariants = {
    hidden: { opacity: 0, y: 15, filter: "blur(10px)" },
    visible: { 
      opacity: 1, 
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1]as const }
    }
  };

  const containerVariants = {
    visible: {
      transition: {
        staggerChildren: 0.04,
        delayChildren: 0.3
      }
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-6 md:px-12 py-16 md:py-28 relative z-10">
      <div className="flex flex-col lg:flex-row gap-20 items-start">
        {/* Left Content */}
        <div className="lg:w-[42%] lg:sticky lg:top-32">
          <motion.div
            initial={{ opacity: 0, x: -20, filter: "blur(10px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#FFCCD5] text-[#FF4D6D] text-[10px] font-bold tracking-[0.2em] uppercase mb-8 shadow-sm"
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            FAQ
          </motion.div>

          <motion.h1 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-[56px] md:text-[72px] font-medium tracking-tight text-[#1D3557] leading-[1.02] mb-10 font-serif"
          >
            {headlineWords.map((word, wIndex) => (
              <span key={wIndex} className="inline-block mr-[0.25em]">
                {word.split("").map((char, cIndex) => (
                  <motion.span 
                    key={cIndex} 
                    variants={charVariants}
                    className="inline-block"
                  >
                    {char}
                  </motion.span>
                ))}
              </span>
            ))}
            <motion.span
              initial={{ opacity: 0, y: 20, filter: "blur(15px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.8, duration: 1, ease: [0.16, 1, 0.3, 1] as const }}
              className="text-[#8B5CF6] block mt-1"
            >
              questions
            </motion.span>
          </motion.h1>

          <div className="space-y-6">
            <motion.p
              initial={{ opacity: 0, y: 15, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 1.1, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-slate-500 text-[18px] font-medium leading-relaxed max-w-sm"
            >
              Everything you need to know about Folio.
            </motion.p>
            {/* <motion.p
              initial={{ opacity: 0, y: 15, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 1.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-slate-500 text-[17px] font-medium leading-relaxed"
            >
              Can't find the answer you're looking for?{" "}
              <Link to="/contact" className="text-[#8B5CF6] font-bold hover:underline decoration-2 underline-offset-4">
                Contact us
              </Link>.
            </motion.p> */}
          </div>
        </div>

        {/* Right Content - Accordion */}
        <div className="lg:w-[58%]">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              index={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
