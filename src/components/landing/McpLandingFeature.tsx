import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { McpConnectionPanel, McpProviderStack } from '@/features/mcp/McpConnectionPanel';
import { MCP_TOOL_COUNT } from '@/features/mcp/mcpContent';

export default function McpLandingFeature() {
  return (
    <section id="mcp" className="relative isolate overflow-hidden bg-[#101213] px-4 py-24 text-white sm:px-6 md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_50%_12%,rgba(184,255,56,0.11),transparent_36%),radial-gradient(circle_at_16%_50%,rgba(34,197,94,0.06),transparent_24%),radial-gradient(circle_at_86%_48%,rgba(217,119,87,0.055),transparent_24%)]"
      />

      <div className="mx-auto max-w-[1500px]">
        <McpProviderStack compact />

        <div className="mx-auto mt-10 max-w-6xl text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/34">Model Context Protocol</p>
          <h2 className="mt-4 text-balance text-4xl font-black uppercase leading-[0.96] tracking-[-0.05em] text-[#b8ff38] sm:text-5xl md:text-[58px]">
            WagerProof MCP for your AI
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-sm font-semibold leading-6 text-white/43 sm:text-base">
            Bring WagerProof research into Claude, ChatGPT, Cursor, Claude Code, OpenClaw, or Hermes with one secure,
            custom connection.
          </p>
        </div>

        <div className="mt-12">
          <McpConnectionPanel compact />
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/mcp"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#b8ff38] px-6 text-sm font-black text-[#111315] shadow-[0_4px_0_#659912] transition hover:-translate-y-0.5 hover:bg-[#c8ff62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#101213] active:translate-y-[2px] active:shadow-none"
          >
            Explore the full MCP tutorial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-white/36">
            <ShieldCheck className="h-4 w-4 text-[#b8ff38]" />
            OAuth sign-in · {MCP_TOOL_COUNT} tools
          </p>
        </div>
      </div>
    </section>
  );
}
