import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageSquareQuote } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const faqs = [
  {
    question: "What is Folio?",
    answer:
      "Folio is an all-in-one PDF management platform designed to simplify your workflow. You can edit, annotate, convert, protect, and organize your PDFs — all in one place, securely.",
  },
  {
    question: "How does Folio work?",
    answer:
      "Simply upload your PDF files to our secure servers, select the tool you need (like merge, split, or compress), and download the processed file in seconds. Our AI-powered tools even help with summaries and translations.",
  },
  {
    question: "Is Folio secure?",
    answer:
      "Yes, security is our top priority. We use industry-standard encryption for all file transfers, and your files are automatically deleted from our servers after processing. We never store your documents.",
  },
  {
    question: "Can Folio integrate with other software?",
    answer:
      "Currently, Folio works as a standalone web application. We are actively working on browser extensions and integrations with popular cloud storage services like Google Drive and Dropbox.",
  },
  {
    question: "What file formats does Folio support?",
    answer:
      "While our primary focus is PDF, we support converting PDF to and from Word, Excel, PowerPoint, JPEG, and Markdown formats.",
  },
  {
    question: "How is my data stored?",
    answer:
      "We don't store your documents long-term. Files are kept in a temporary, encrypted storage area only while they are being processed and for a short window afterward so you can download them. After that, they are permanently purged.",
  },
  {
    question: "Can I use Folio on my mobile device?",
    answer:
      "Yes! Folio is fully responsive and works perfectly on smartphones and tablets through your mobile browser.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Folio offers a generous free tier with access to most tools. For power users needing higher file size limits and bulk processing, we offer a Pro plan.",
  },
  {
    question: "How do I cancel my subscription?",
    answer:
      "You can cancel your subscription at any time from your account settings. You'll continue to have access to Pro features until the end of your current billing period.",
  },
  {
    question: "Who can I contact for more support?",
    answer:
      "Our support team is available via email at support@folio.plus. You can also reach out through our contact form or live chat during business hours.",
  },
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
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
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
              transition={{ delay: 0.8, duration: 1, ease: [0.16, 1, 0.3, 1] }}
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
            <motion.p
              initial={{ opacity: 0, y: 15, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 1.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-slate-500 text-[17px] font-medium leading-relaxed"
            >
              Can't find the answer you're looking for?{" "}
              <Link to="/contact" className="text-[#8B5CF6] font-bold hover:underline decoration-2 underline-offset-4">
                Contact us
              </Link>.
            </motion.p>
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
