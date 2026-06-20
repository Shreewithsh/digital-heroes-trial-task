"use client";

/**
 * FileConverter.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Root orchestrating component for the All-in-One File Converter & Compressor.
 * Renders the page shell (hero, tabs, footer) and conditionally mounts each
 * tool panel based on the active tab.
 *
 * Architecture:
 *   FileConverter (this file)
 *   ├── ImageToPDF      – Tab 1: compile images into a multi-page PDF
 *   ├── PDFToImage      – Tab 2: extract PDF pages as JPG / PNG
 *   └── ImageCompressor – Tab 3: reduce image file size
 * ──────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from "react";
import {
  FileImage,
  FileText,
  Minimize2,
  Zap,
  Shield,
  Globe,
  Layers,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import ImageToPDF from "./ImageToPDF";
import PDFToImage from "./PDFToImage";
import ImageCompressor from "./ImageCompressor";

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = "image-to-pdf" | "pdf-to-image" | "compress";

interface Tab {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
  description: string;
  gradient: string;
  glowColor: string;
  accentClass: string;
}

const TABS: Tab[] = [
  {
    id: "image-to-pdf",
    label: "Image → PDF",
    shortLabel: "Img→PDF",
    icon: FileImage,
    description: "Combine multiple images into a single PDF",
    gradient: "from-violet-600 to-indigo-600",
    glowColor: "rgba(124,58,237,0.4)",
    accentClass: "text-violet-400",
  },
  {
    id: "pdf-to-image",
    label: "PDF → Image",
    shortLabel: "PDF→Img",
    icon: FileText,
    description: "Extract PDF pages as JPG or PNG images",
    gradient: "from-cyan-500 to-blue-600",
    glowColor: "rgba(6,182,212,0.4)",
    accentClass: "text-cyan-400",
  },
  {
    id: "compress",
    label: "Image Compressor",
    shortLabel: "Compress",
    icon: Minimize2,
    description: "Reduce image file size with quality control",
    gradient: "from-pink-500 to-rose-600",
    glowColor: "rgba(236,72,153,0.4)",
    accentClass: "text-pink-400",
  },
];

// ─── Feature badge data ───────────────────────────────────────────────────────

const FEATURES = [
  { icon: Shield, text: "100% Private" },
  { icon: Zap, text: "Lightning Fast" },
  { icon: Globe, text: "Works Offline" },
  { icon: Layers, text: "No Limits" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FileConverter() {
  const [activeTab, setActiveTab] = useState<TabId>("image-to-pdf");

  const currentTab = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-[#0a0a0f] bg-grid flex flex-col">
      {/* ── Ambient background orbs ── */}
      <div
        aria-hidden
        className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }}
      />
      <div
        aria-hidden
        className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15 blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, #06b6d4, transparent)" }}
      />
      <div
        aria-hidden
        className="fixed top-[40%] right-[20%] w-[300px] h-[300px] rounded-full opacity-10 blur-[100px] pointer-events-none"
        style={{ background: "radial-gradient(circle, #ec4899, transparent)" }}
      />

      {/* ── Hero Header ── */}
      <header className="relative pt-14 pb-8 px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm font-medium mb-6 animate-fade-in-up">
          <Sparkles size={14} className="text-violet-400 animate-pulse" />
          All-in-One File Toolkit
          <ChevronRight size={14} />
        </div>

        {/* Main heading */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4 animate-fade-in-up">
          <span className="text-white">File</span>
          <span className="text-gradient-violet">Forge</span>
        </h1>
        <p className="text-[#94a3b8] text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed animate-fade-in-up">
          Convert, compress, and transform your files instantly — all processed{" "}
          <span className="text-violet-400 font-medium">directly in your browser</span>.
          No uploads. No servers. Zero privacy risk.
        </p>

        {/* Feature badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-2 animate-fade-in-up">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-sm text-[#94a3b8]"
            >
              <Icon size={13} className="text-violet-400" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pb-10">
        {/* Tab Navigation */}
        <nav
          className="flex gap-1 p-1.5 rounded-2xl glass mb-8 shadow-xl overflow-x-auto"
          role="tablist"
          aria-label="File conversion tools"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm
                  transition-all duration-300 cursor-pointer whitespace-nowrap min-w-[110px]
                  ${isActive
                    ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg`
                    : "text-[#64748b] hover:text-[#94a3b8] hover:bg-white/5"
                  }
                `}
                style={isActive ? { boxShadow: `0 4px 24px ${tab.glowColor}` } : {}}
              >
                <Icon size={17} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab panels */}
        <div
          id={`panel-${currentTab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${currentTab.id}`}
          className="animate-scale-in"
        >
          {activeTab === "image-to-pdf" && <ImageToPDF />}
          {activeTab === "pdf-to-image" && <PDFToImage />}
          {activeTab === "compress" && <ImageCompressor />}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full py-6 px-6 border-t border-white/5 glass mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          {/* Developer credit */}
          <p className="text-[#64748b] text-center sm:text-left">
            Developed by{" "}
            <span className="text-[#94a3b8] font-medium">Shreeprakash Shukla</span>{" "}
            |{" "}
            <a
              href="mailto:shreeshukla54@gmail.com"
              className="text-violet-400 hover:text-violet-300 transition-colors"
            >
              shreeshukla54@gmail.com
            </a>
          </p>

          {/* Digital Heroes CTA */}
          <a
            href="https://digitalheroesco.com"
            target="_blank"
            rel="noopener noreferrer"
            id="footer-digital-heroes-link"
            className="group"
          >
            <button
              id="btn-digital-heroes"
              className="
                flex items-center gap-2 px-5 py-2.5 rounded-xl
                bg-gradient-to-r from-violet-600/20 to-indigo-600/20
                border border-violet-500/30
                text-violet-300 font-semibold text-sm
                hover:from-violet-600/30 hover:to-indigo-600/30
                hover:border-violet-400/50 hover:text-violet-200
                transition-all duration-300
                group-hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]
              "
            >
              <Zap size={15} className="text-violet-400 group-hover:animate-pulse" />
              Built for Digital Heroes
            </button>
          </a>
        </div>
      </footer>
    </div>
  );
}
