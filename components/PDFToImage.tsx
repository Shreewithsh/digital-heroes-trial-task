"use client";

/**
 * PDFToImage.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Tool 2 – Extract every page of a PDF as a JPG or PNG image.
 *
 * Key features:
 *  • Drag-and-drop OR click-to-browse single PDF upload
 *  • Format selector: JPG or PNG
 *  • pdfjs-dist rendering of each page to a canvas → Blob
 *  • Progress bar during extraction
 *  • Preview grid with per-page download buttons
 *  • "Download All as ZIP" using JSZip
 *  • CDN worker source to avoid Next.js SSR / worker bundling issues
 * ──────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileText,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Package,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ImageFormat = "jpeg" | "png";
type ToastType = "success" | "error" | null;

interface ExtractedPage {
  pageNumber: number;
  dataUrl: string;
  blob: Blob;
}

// ─── Helper: format bytes ─────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PDFToImage() {
  // Uploaded PDF file
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Extracted pages
  const [pages, setPages] = useState<ExtractedPage[]>([]);

  // Format choice
  const [format, setFormat] = useState<ImageFormat>("jpeg");

  // Drag-over state for the upload zone
  const [isDragOver, setIsDragOver] = useState(false);

  // Extraction progress (0–100)
  const [progress, setProgress] = useState(0);

  // Loading / status state
  const [isExtracting, setIsExtracting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ type: ToastType; message: string }>({
    type: null,
    message: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Toast helper ────────────────────────────────────────────────────────
  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast({ type: null, message: "" }), 4000);
  }, []);

  // ─── File validation & acceptance ────────────────────────────────────────
  const acceptFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (file.type !== "application/pdf") {
        showToast("error", "Please upload a valid PDF file.");
        return;
      }
      // Reset previous extraction results when a new file is loaded
      setPages([]);
      setProgress(0);
      setPdfFile(file);
    },
    [showToast]
  );

  // ─── Drop-zone handlers ───────────────────────────────────────────────────
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    acceptFile(e.dataTransfer.files[0]);
  };

  // ─── Clear uploaded PDF ───────────────────────────────────────────────────
  const clearPDF = () => {
    setPdfFile(null);
    setPages([]);
    setProgress(0);
  };

  // ─── Core: extract pages using PDF.js ────────────────────────────────────
  const extractPages = async () => {
    if (!pdfFile) {
      showToast("error", "Please upload a PDF file first.");
      return;
    }

    setIsExtracting(true);
    setPages([]);
    setProgress(0);

    try {
      /**
       * Dynamically import pdfjs-dist to ensure it only runs in the browser.
       *
       * IMPORTANT – Worker configuration:
       *   PDF.js requires a Web Worker to function. In a Next.js environment the
       *   bundler cannot automatically resolve the worker file, so we point the
       *   library at a pre-built worker hosted on the official CDN. This avoids
       *   all SSR / webpack bundling complications.
       */
      const pdfjsLib = await import("pdfjs-dist");

      // Set the CDN worker URL before loading any document
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      // Read the uploaded file as an ArrayBuffer
      const arrayBuffer = await pdfFile.arrayBuffer();

      // Load the PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;

      const extracted: ExtractedPage[] = [];

      // Iterate through every page and render it to a canvas
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);

        // Scale factor: 2× for high-DPI / Retina output
        const scale = 2;
        const viewport = page.getViewport({ scale });

        // Create an off-screen canvas matching the page dimensions
        const canvas = document.createElement("canvas");
        canvas.width  = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable.");

        // Render the PDF page into the canvas
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Export canvas to Blob
        const mimeType = format === "png" ? "image/png" : "image/jpeg";
        const quality  = format === "jpeg" ? 0.92 : undefined;

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Blob conversion failed"))),
            mimeType,
            quality
          );
        });

        const dataUrl = canvas.toDataURL(mimeType, quality);
        extracted.push({ pageNumber: pageNum, dataUrl, blob });

        // Update progress
        setProgress(Math.round((pageNum / totalPages) * 100));
      }

      setPages(extracted);
      showToast(
        "success",
        `Extracted ${totalPages} page${totalPages > 1 ? "s" : ""} as ${format.toUpperCase()}!`
      );
    } catch (err) {
      console.error("[PDFToImage] Extraction error:", err);
      showToast("error", "Failed to extract PDF pages. Is this a valid, non-encrypted PDF?");
    } finally {
      setIsExtracting(false);
    }
  };

  // ─── Download a single page ───────────────────────────────────────────────
  const downloadPage = (page: ExtractedPage) => {
    const ext = format === "png" ? "png" : "jpg";
    const url = URL.createObjectURL(page.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `page-${page.pageNumber}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Download all pages as a ZIP ─────────────────────────────────────────
  const downloadAllAsZip = async () => {
    if (pages.length === 0) return;
    setIsZipping(true);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const ext = format === "png" ? "png" : "jpg";

      pages.forEach((page) => {
        zip.file(`page-${page.pageNumber}.${ext}`, page.blob);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pdf-pages.zip`;
      a.click();
      URL.revokeObjectURL(url);

      showToast("success", `Zipped ${pages.length} pages and started download!`);
    } catch (err) {
      console.error("[PDFToImage] ZIP error:", err);
      showToast("error", "Failed to create ZIP archive.");
    } finally {
      setIsZipping(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Upload Zone ── */}
      {!pdfFile ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a PDF file by clicking or dropping it here"
          className={`
            drop-zone relative flex flex-col items-center justify-center
            min-h-[200px] rounded-2xl border-2 border-dashed cursor-pointer
            transition-all duration-300
            ${isDragOver
              ? "border-cyan-500 bg-cyan-500/10 scale-[1.01]"
              : "border-[#2a2a3d] bg-[#16161f] hover:border-cyan-500/50 hover:bg-cyan-500/5"
            }
          `}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            id="pdf-to-image-input"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />

          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20">
            <Upload size={28} className="text-cyan-400" />
          </div>

          <p className="text-[#f1f5f9] font-semibold text-lg mb-1">
            {isDragOver ? "Release to upload" : "Drop your PDF here"}
          </p>
          <p className="text-[#64748b] text-sm mb-3">or click to browse · PDF only</p>
          <span className="px-4 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium">
            Single PDF file
          </span>
        </div>
      ) : (
        /* ── Loaded PDF card ── */
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#16161f] border border-[#2a2a3d] animate-scale-in">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex-shrink-0">
            <FileText size={22} className="text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#f1f5f9] font-semibold text-sm truncate">{pdfFile.name}</p>
            <p className="text-[#64748b] text-xs">{formatBytes(pdfFile.size)}</p>
          </div>
          <button
            id="remove-pdf-btn"
            onClick={clearPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#64748b] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
          >
            <Trash2 size={13} />
            Remove
          </button>
        </div>
      )}

      {/* ── Configuration ── */}
      {pdfFile && (
        <div className="animate-fade-in-up space-y-4">
          {/* Format selector */}
          <div className="p-4 rounded-2xl bg-[#16161f] border border-[#2a2a3d] space-y-3">
            <label className="text-sm font-semibold text-[#94a3b8] flex items-center gap-2">
              <ImageIcon size={15} className="text-cyan-400" />
              Output Format
            </label>
            <div className="flex gap-3">
              {(["jpeg", "png"] as ImageFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  id={`format-${fmt}-btn`}
                  onClick={() => setFormat(fmt)}
                  className={`
                    flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200
                    ${format === fmt
                      ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                      : "bg-transparent border-[#2a2a3d] text-[#64748b] hover:border-[#4a4a6a] hover:text-[#94a3b8]"
                    }
                  `}
                >
                  .{fmt === "jpeg" ? "JPG" : "PNG"}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#64748b]">
              {format === "jpeg"
                ? "JPG – smaller file size, ideal for photos and general use."
                : "PNG – lossless quality, best for diagrams, text, and transparency."}
            </p>
          </div>

          {/* Extract button */}
          <button
            id="extract-pages-btn"
            onClick={extractPages}
            disabled={isExtracting}
            className="
              w-full flex items-center justify-center gap-3
              py-4 rounded-xl font-bold text-base text-white
              bg-gradient-to-r from-cyan-500 to-blue-600
              hover:from-cyan-400 hover:to-blue-500
              transition-all duration-300
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:shadow-[0_8px_30px_rgba(6,182,212,0.4)]
              hover:-translate-y-0.5 active:translate-y-0
            "
          >
            {isExtracting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Extracting pages… {progress}%
              </>
            ) : (
              <>
                <Download size={20} />
                Extract Pages
              </>
            )}
          </button>

          {/* Progress bar */}
          {isExtracting && (
            <div className="w-full h-2 rounded-full bg-[#2a2a3d] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Extracted pages grid ── */}
      {pages.length > 0 && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Grid header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <ImageIcon size={16} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-[#f1f5f9] font-semibold text-sm">
                  {pages.length} page{pages.length > 1 ? "s" : ""} extracted
                </p>
                <p className="text-[#64748b] text-xs">
                  as .{format === "jpeg" ? "jpg" : "png"}
                </p>
              </div>
            </div>

            {/* Download all as ZIP */}
            <button
              id="download-all-zip-btn"
              onClick={downloadAllAsZip}
              disabled={isZipping}
              className="
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                bg-gradient-to-r from-cyan-500/20 to-blue-600/20
                border border-cyan-500/30 text-cyan-300
                hover:from-cyan-500/30 hover:to-blue-600/30
                hover:border-cyan-400/50
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {isZipping ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Package size={15} />
              )}
              Download All (.zip)
            </button>
          </div>

          {/* Page grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {pages.map((page) => (
              <div
                key={page.pageNumber}
                className="
                  group relative rounded-xl overflow-hidden border border-[#2a2a3d]
                  bg-[#16161f] hover:border-cyan-500/40
                  transition-all duration-200
                  hover:shadow-[0_4px_20px_rgba(6,182,212,0.15)]
                "
              >
                {/* Page number badge */}
                <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-xs font-bold text-white border border-white/10">
                  Page {page.pageNumber}
                </div>

                {/* Preview image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.dataUrl}
                  alt={`PDF page ${page.pageNumber}`}
                  className="w-full aspect-[3/4] object-cover"
                />

                {/* Download overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                  <button
                    id={`download-page-${page.pageNumber}-btn`}
                    onClick={() => downloadPage(page)}
                    className="
                      flex items-center gap-2 px-4 py-2 rounded-xl
                      bg-cyan-500 hover:bg-cyan-400
                      text-white text-sm font-semibold
                      transition-colors duration-200
                    "
                  >
                    <Download size={15} />
                    Download
                  </button>
                </div>

                {/* File size label */}
                <div className="px-2 py-1.5 bg-[#0a0a0f]/80 backdrop-blur-sm">
                  <p className="text-xs text-[#64748b]">{formatBytes(page.blob.size)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast.type && (
        <div
          className={`toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}
          role="alert"
        >
          {toast.type === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
