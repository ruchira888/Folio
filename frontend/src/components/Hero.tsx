import { CloudUpload, ArrowRight } from 'lucide-react';

export default function Hero() {
  return (
    <div className="relative w-full h-[calc(100vh-80px)] min-h-[580px] flex flex-col items-center justify-center px-6 md:px-12 text-center bg-transparent">
      {/* Hero Content */}
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
        {/* Main Heading */}
        <h1 className="text-[42px] sm:text-5xl md:text-[68px] font-medium tracking-tight text-[#0F172A] leading-[1.1] mb-2 font-serif">
          Your all-in-one
          <br />
          PDF toolkit.
        </h1>
        
        <h2 className="text-[36px] sm:text-4xl md:text-[56px] font-medium tracking-tight mb-8 font-serif leading-[1.1]">
          <span className="text-[#6366F1]">Smart</span>,{' '}
          <span className="text-[#EC4899]">fast</span>,{' '}
          <span className="text-[#3B82F6]">secure</span>.
        </h2>

        {/* Description Paragraph */}
        <p className="text-base md:text-[17px] text-slate-600 font-medium max-w-md leading-relaxed mb-9 font-sans">
          Everything you need to manage, edit, <br className="hidden sm:inline" />
          and enhance your PDFs.
          <br />
          Powered by <span className="text-[#EC4899] font-bold">AI</span>.
        </p>

      
      </div>
    </div>
  );
}
