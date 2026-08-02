import { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink, Minus, Plus, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import Footer from '@/components/landing/Footer';
import { SEO } from '@/components/landing/SEO';
import { StructuredData } from '@/components/landing/StructuredData';
import { McpConnectionPanel, McpProviderStack } from '@/features/mcp/McpConnectionPanel';
import McpDemoSection from '@/features/mcp/McpDemoSection';
import McpToolGallery from '@/features/mcp/McpToolGallery';
import { MCP_EXPLORE_LINKS, MCP_FAQS, MCP_TOOL_COUNT } from '@/features/mcp/mcpContent';

function McpHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between rounded-[18px] border border-white/[0.07] bg-[#151718]/90 px-4 shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:px-5">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38]"
          aria-label="WagerProof home"
        >
          <img src="/wagerproofGreenDark.png" alt="" className="h-9 w-9 rounded-[10px] object-cover" />
          <span className="text-lg font-black tracking-[-0.03em] text-white sm:text-xl">
            Wager<span className="text-[#b8ff38]">Proof</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-bold text-white/52 md:flex" aria-label="MCP tutorial">
          <a href="#setup" className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38]">
            Connect
          </a>
          <a href="#how-it-works" className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38]">
            How it works
          </a>
          <a href="#tools" className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38]">
            Tools
          </a>
          <a href="#faq" className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38]">
            FAQ
          </a>
        </nav>

        <Link
          to="/account"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#b8ff38] px-4 text-xs font-black text-[#111315] shadow-[0_4px_0_#659912] transition hover:-translate-y-0.5 hover:bg-[#c8ff62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#151718] active:translate-y-[2px] active:shadow-none sm:text-sm"
        >
          Open WagerProof
          <ArrowRight className="hidden h-4 w-4 sm:block" />
        </Link>
      </div>
    </header>
  );
}

function McpFaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="scroll-mt-24 px-4 py-24 sm:px-6 md:py-32">
      <div className="mx-auto max-w-[1180px]">
        <h2 className="text-center text-4xl font-black uppercase leading-none tracking-[-0.045em] text-white sm:text-5xl md:text-6xl">
          Got any questions left?
        </h2>

        <div className="mt-14">
          {MCP_FAQS.map((faq, index) => {
            const open = index === openIndex;
            const answerId = `mcp-faq-answer-${index}`;
            return (
              <div key={faq.question} className="border-b border-white/[0.07] last:border-b-0">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={answerId}
                  onClick={() => setOpenIndex(open ? -1 : index)}
                  className="flex min-h-[72px] w-full items-center justify-between gap-6 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b8ff38] sm:min-h-[82px]"
                >
                  <span className="text-lg font-bold tracking-[-0.01em] text-white sm:text-xl">{faq.question}</span>
                  <span className="grid h-10 w-10 shrink-0 place-items-center text-white/45">
                    {open ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </span>
                </button>
                <div
                  id={answerId}
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                    open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[980px] pb-8 pr-12 text-base leading-7 text-white/47 sm:text-lg sm:leading-8">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ExploreMoreSection() {
  return (
    <section className="px-4 pb-28 pt-16 sm:px-6 md:pb-36 md:pt-24">
      <div className="mx-auto max-w-[1500px] text-center">
        <h2 className="text-4xl font-black uppercase tracking-[-0.045em] text-white sm:text-5xl">
          Explore more WagerProof features
        </h2>
        <div className="mx-auto mt-10 flex max-w-[1400px] flex-wrap justify-center gap-2.5">
          {MCP_EXPLORE_LINKS.map((item) => (
            <Link
              key={`${item.label}-${item.to}`}
              to={item.to}
              className="rounded-[10px] border border-white/[0.055] bg-white/[0.045] px-4 py-2.5 text-sm font-bold text-white/45 transition hover:border-[#b8ff38]/25 hover:bg-[#b8ff38]/[0.075] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function McpTutorial() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="dark min-h-screen bg-[#101213] text-white">
      <SEO
        title="WagerProof MCP Connector Tutorial"
        description="Connect WagerProof to Claude, ChatGPT, Cursor, Claude Code, OpenClaw, or Hermes for secure sports model research and personal agent analytics."
        canonical="https://wagerproof.bet/mcp"
        ogType="website"
      />
      <StructuredData
        type="webpage"
        title="WagerProof MCP Connector Tutorial"
        description={`Connect WagerProof to a compatible AI assistant with secure OAuth and ${MCP_TOOL_COUNT} sports analytics tools.`}
        url="https://wagerproof.bet/mcp"
      />
      <StructuredData type="faq" questions={MCP_FAQS} />

      <McpHeader />

      <main>
        <section className="relative overflow-hidden px-4 pb-10 pt-32 sm:px-6 sm:pt-36 md:pb-14 md:pt-40">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(circle_at_50%_8%,rgba(184,255,56,0.11),transparent_34%),radial-gradient(circle_at_20%_30%,rgba(34,197,94,0.07),transparent_28%),radial-gradient(circle_at_80%_32%,rgba(217,119,87,0.06),transparent_24%)]"
          />
          <div className="relative mx-auto max-w-[1500px]">
            <McpProviderStack />
            <div className="mt-8 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/34">
                Model Context Protocol
              </p>
              <h1 className="mx-auto mt-5 max-w-[1400px] text-balance text-5xl font-black uppercase leading-[0.94] tracking-[-0.055em] text-[#b8ff38] sm:text-[52px] md:text-[58px] lg:text-[64px]">
                WagerProof MCP for your AI
              </h1>
              <p className="mx-auto mt-6 max-w-4xl text-balance text-base font-semibold leading-7 text-white/43 sm:text-lg">
                Bring your prediction agents, pick history, model estimates, and market context into compatible AI
                chats and coding agents through one secure connection.
              </p>
            </div>
          </div>
        </section>

        <section id="setup" className="scroll-mt-24 px-4 pb-16 sm:px-6 md:pb-24">
          <div className="mx-auto max-w-[1500px]">
            <McpConnectionPanel />
            <p className="mt-7 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs font-semibold text-white/38 sm:text-sm">
              <ShieldCheck className="h-4 w-4 text-[#b8ff38]" />
              Setup guides for Claude, ChatGPT, Cursor, Claude Code, OpenClaw, and Hermes. Availability depends on
              client version, plan, and workspace permissions.
              <a
                href="https://wagerproof-mcp.habib225.workers.dev/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-white/70 hover:text-[#b8ff38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38]"
              >
                Check the live connector docs <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </p>
          </div>
        </section>

        <div className="border-t border-white/[0.035]">
          <McpDemoSection />
        </div>
        <div className="border-t border-white/[0.035]">
          <McpToolGallery />
        </div>
        <div className="border-t border-white/[0.035]">
          <McpFaqSection />
        </div>
        <div className="border-t border-white/[0.035]">
          <ExploreMoreSection />
        </div>
      </main>

      <Footer />
    </div>
  );
}
