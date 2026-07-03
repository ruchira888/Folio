import Hero from "../components/Hero";
import ToolsGrid from "../components/ToolsGrid";
import SupportSection from "../components/SupportSection";
import { type ToolType } from "../config/toolConfigs";

interface HomeProps {
  setActiveTool: (tool: ToolType) => void;
}

export default function Home({ setActiveTool }: HomeProps) {
  return (
    <>
      <Hero />
      <ToolsGrid setActiveTool={setActiveTool} />
      <SupportSection />
    </>
  );
}
