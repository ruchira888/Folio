

export default function Hero() {
  return (
    <div className="relative w-full overflow-hidden">
      {/* Hero Content Section */}
      <div className="w-full max-w-6xl mx-auto px-6 md:px-12 pt-16 md:pt-20 pb-8">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          {/* Left: Text Content */}
          <div className="max-w-xl text-left">
            {/* Main Heading */}
            <h1 className="text-[38px] sm:text-[46px] md:text-[56px] font-medium tracking-tight text-[#1D3557] leading-[1.1] mb-1 font-serif">
              Your all-in-one
              <br />
              PDF toolkit.
            </h1>

            <h2 className="text-[32px] sm:text-[38px] md:text-[46px] font-medium tracking-tight mb-7 font-serif leading-[1.15]">
              <span className="text-[#FFEABC]">Smart</span>,{' '}
              <span className="text-[#EC4899]">fast</span>,{' '}
              <span className="text-[#E8D6FF]">secure</span>.
            </h2>

            {/* Description */}
            <p className="text-[15px] md:text-[16px] text-slate-500 font-medium max-w-sm leading-relaxed mb-8 font-sans">
              Everything you need to manage, edit,
              <br className="hidden sm:inline" />
              and enhance your PDFs.
              <br />
              Powered by <span className="text-[#EC4899] font-bold">AI</span>.
            </p>

            {/* CTA Buttons */}
            <div className="flex items-center gap-4 flex-wrap">
             
             
            
            </div>
          </div>

          {/* Right: Bird silhouettes */}
          <div className="hidden md:flex items-start pt-8 pr-8 select-none pointer-events-none">
            <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-60">
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
          </div>
        </div>
      </div>

    </div>
  );
}
