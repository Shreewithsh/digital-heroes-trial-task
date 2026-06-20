"use client";

/**
 * ImageCompressor.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Tool 3 – Reduce image file size using browser-image-compression.
 *
 * Key features:
 *  • Drag-and-drop OR click-to-browse single image upload
 *  • Quality slider (0 – 100 %)
 *  • Max size target input (KB)
 *  • Live before/after size comparison with animated progress bar
 *  • Estimated compressed size preview (via a quick trial compression)
 *  • "Compress & Download" button
 *  • Graceful loading and error states
 * ──────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
  Gauge,
  HardDrive,
  TrendingDown,
  Image as ImageIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | null;

interface ImageState {
  file: File;
  previewUrl: string;
  sizeBytes: number;
  name: string;
  mimeType: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(decimals)} MB`;
}

/** Clamp a number between min and max */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Percentage reduction between original and compressed size */
function reductionPct(original: number, compressed: number): number {
  if (original === 0) return 0;
  return Math.max(0, Math.round(((original - compressed) / original) * 100));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageCompressor() {
  // Uploaded image state
  const [image, setImage] = useState<ImageState | null>(null);

  // Compression settings
  const [quality, setQuality] = useState(80);           // 0–100
  const [maxSizeKB, setMaxSizeKB] = useState(500);       // target max KB

  // Drag-over state
  const [isDragOver, setIsDragOver] = useState(false);

  // Estimated compressed size (from live preview compression)
  const [estimatedSizeBytes, setEstimatedSizeBytes] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  // Full compression state
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);

  // Toast
  const [toast, setToast] = useState<{ type: ToastType; message: string }>({
    type: null,
    message: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const estimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Toast helper ────────────────────────────────────────────────────────
  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast({ type: null, message: "" }), 4000);
  }, []);

  // ─── Accept file ──────────────────────────────────────────────────────────
  const acceptFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        showToast("error", "Please upload a JPG, PNG, or WebP image.");
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setImage({
        file,
        previewUrl,
        sizeBytes: file.size,
        name: file.name,
        mimeType: file.type,
      });
      setEstimatedSizeBytes(null);
      setCompressedBlob(null);
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

  // ─── Clear uploaded image ─────────────────────────────────────────────────
  const clearImage = () => {
    if (image) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    setEstimatedSizeBytes(null);
    setCompressedBlob(null);
  };

  // ─── Live estimation: debounced on quality / maxSizeKB change ────────────
  useEffect(() => {
    if (!image) return;

    // Clear any pending estimation
    if (estimationTimerRef.current) clearTimeout(estimationTimerRef.current);

    setIsEstimating(true);

    // Debounce 400ms so we don't fire on every slider tick
    estimationTimerRef.current = setTimeout(async () => {
      try {
        const imageCompression = (await import("browser-image-compression")).default;

        const qualityDecimal = clamp(quality / 100, 0.05, 1);
        const maxSizeMB = clamp(maxSizeKB / 1024, 0.01, 100);

        const options = {
          maxSizeMB,
          initialQuality: qualityDecimal,
          useWebWorker: true,
          // Keep the output format matching the input
          fileType: image.mimeType as "image/jpeg" | "image/png" | "image/webp",
        };

        const compressed = await imageCompression(image.file, options);
        setEstimatedSizeBytes(compressed.size);
      } catch {
        // Estimation errors are silent; we just don't show an estimate
        setEstimatedSizeBytes(null);
      } finally {
        setIsEstimating(false);
      }
    }, 400);

    return () => {
      if (estimationTimerRef.current) clearTimeout(estimationTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, quality, maxSizeKB]);

  // ─── Core: full compression + download ───────────────────────────────────
  const compressAndDownload = async () => {
    if (!image) {
      showToast("error", "Please upload an image first.");
      return;
    }

    setIsCompressing(true);
    setCompressedBlob(null);

    try {
      const imageCompression = (await import("browser-image-compression")).default;

      const qualityDecimal = clamp(quality / 100, 0.05, 1);
      const maxSizeMB = clamp(maxSizeKB / 1024, 0.01, 100);

      const options = {
        maxSizeMB,
        initialQuality: qualityDecimal,
        useWebWorker: true,
        fileType: image.mimeType as "image/jpeg" | "image/png" | "image/webp",
      };

      const compressedFile = await imageCompression(image.file, options);
      setCompressedBlob(compressedFile);
      setEstimatedSizeBytes(compressedFile.size);

      // Build download link
      const ext = image.name.split(".").pop() ?? "jpg";
      const baseName = image.name.replace(/\.[^.]+$/, "");
      const url = URL.createObjectURL(compressedFile);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}-compressed.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      const pct = reductionPct(image.sizeBytes, compressedFile.size);
      showToast("success", `Compressed! Size reduced by ${pct}% (${formatBytes(compressedFile.size)})`);
    } catch (err) {
      console.error("[ImageCompressor] Error:", err);
      showToast("error", "Compression failed. Try adjusting quality or max size.");
    } finally {
      setIsCompressing(false);
    }
  };

  // Computed reduction %
  const pct = estimatedSizeBytes !== null && image
    ? reductionPct(image.sizeBytes, estimatedSizeBytes)
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Upload Zone ── */}
      {!image ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload an image by clicking or dropping it here"
          className={`
            drop-zone relative flex flex-col items-center justify-center
            min-h-[200px] rounded-2xl border-2 border-dashed cursor-pointer
            transition-all duration-300
            ${isDragOver
              ? "border-pink-500 bg-pink-500/10 scale-[1.01]"
              : "border-[#2a2a3d] bg-[#16161f] hover:border-pink-500/50 hover:bg-pink-500/5"
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
            id="compressor-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />

          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-pink-500/20 to-rose-600/20 border border-pink-500/20">
            <Upload size={28} className="text-pink-400" />
          </div>

          <p className="text-[#f1f5f9] font-semibold text-lg mb-1">
            {isDragOver ? "Release to upload" : "Drop your image here"}
          </p>
          <p className="text-[#64748b] text-sm mb-3">
            or click to browse · JPG, PNG, WebP
          </p>
          <span className="px-4 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-medium">
            Single image
          </span>
        </div>
      ) : (
        /* Image preview card shown when a file is loaded */
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#16161f] border border-[#2a2a3d] animate-scale-in">
          {/* Thumbnail */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.previewUrl}
            alt={image.name}
            className="w-16 h-16 rounded-xl object-cover border border-[#2a2a3d] flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[#f1f5f9] font-semibold text-sm truncate">{image.name}</p>
            <p className="text-[#64748b] text-xs">{image.mimeType} · {formatBytes(image.sizeBytes)}</p>
          </div>
          <button
            id="remove-image-compressor-btn"
            onClick={clearImage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#64748b] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
          >
            <Trash2 size={13} />
            Remove
          </button>
        </div>
      )}


      {/* ── Controls ── */}
      {image && (
        <div className="animate-fade-in-up space-y-5">
          <div className="p-5 rounded-2xl bg-[#16161f] border border-[#2a2a3d] space-y-5">
            {/* Quality slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="quality-slider"
                  className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]"
                >
                  <Gauge size={15} className="text-pink-400" />
                  Quality
                </label>
                <span
                  className={`
                    px-3 py-0.5 rounded-lg text-sm font-bold border
                    ${quality >= 70
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : quality >= 40
                      ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                      : "bg-red-500/15 border-red-500/30 text-red-400"
                    }
                  `}
                >
                  {quality}%
                </span>
              </div>

              <input
                id="quality-slider"
                type="range"
                min={5}
                max={100}
                step={1}
                value={quality}
                onChange={(e) => {
                  setQuality(Number(e.target.value));
                  setCompressedBlob(null);
                }}
                className="w-full"
                aria-label="Compression quality"
              />

              {/* Quality labels */}
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Smallest file</span>
                <span>Best quality</span>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-[#2a2a3d]" />

            {/* Max size input */}
            <div className="space-y-2">
              <label
                htmlFor="max-size-input"
                className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]"
              >
                <HardDrive size={15} className="text-pink-400" />
                Target Max Size (KB)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="max-size-input"
                  type="number"
                  min={10}
                  max={50000}
                  value={maxSizeKB}
                  onChange={(e) => {
                    const val = clamp(Number(e.target.value), 10, 50000);
                    setMaxSizeKB(val);
                    setCompressedBlob(null);
                  }}
                  className="
                    flex-1 px-4 py-2.5 rounded-xl
                    bg-[#0a0a0f] border border-[#2a2a3d]
                    text-[#f1f5f9] font-semibold text-sm
                    focus:outline-none focus:border-pink-500/50
                    focus:ring-1 focus:ring-pink-500/20
                    transition-all duration-200
                  "
                  aria-label="Maximum output file size in KB"
                />
                <span className="text-sm font-medium text-[#64748b] w-6">KB</span>
              </div>
              <p className="text-xs text-[#64748b]">
                ≈ {maxSizeKB >= 1024 ? `${(maxSizeKB / 1024).toFixed(2)} MB` : `${maxSizeKB} KB`} — the library will try to stay under this limit.
              </p>
            </div>
          </div>

          {/* ── Live size comparison ── */}
          <div className="p-5 rounded-2xl bg-[#16161f] border border-[#2a2a3d] space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
              <TrendingDown size={15} className="text-pink-400" />
              Size Comparison
              {isEstimating && (
                <Loader2 size={13} className="animate-spin text-[#64748b] ml-auto" />
              )}
            </div>

            {/* Before / After metrics */}
            <div className="grid grid-cols-2 gap-3">
              {/* Original */}
              <div className="p-3 rounded-xl bg-[#0a0a0f] border border-[#2a2a3d] space-y-1">
                <p className="text-xs text-[#64748b] font-medium uppercase tracking-wider">Original</p>
                <p className="text-lg font-bold text-[#f1f5f9]">{formatBytes(image.sizeBytes)}</p>
                <div className="h-1.5 rounded-full bg-[#2a2a3d]">
                  <div className="h-full rounded-full bg-gradient-to-r from-slate-500 to-slate-400 w-full" />
                </div>
              </div>

              {/* Estimated / Compressed */}
              <div className="p-3 rounded-xl bg-[#0a0a0f] border border-[#2a2a3d] space-y-1">
                <p className="text-xs text-[#64748b] font-medium uppercase tracking-wider">
                  {compressedBlob ? "Compressed" : "Estimated"}
                </p>
                <p
                  className={`text-lg font-bold ${
                    estimatedSizeBytes !== null && estimatedSizeBytes < image.sizeBytes
                      ? "text-emerald-400"
                      : "text-[#94a3b8]"
                  }`}
                >
                  {estimatedSizeBytes !== null ? formatBytes(estimatedSizeBytes) : "—"}
                </p>
                <div className="h-1.5 rounded-full bg-[#2a2a3d] overflow-hidden">
                  {estimatedSizeBytes !== null && (
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (estimatedSizeBytes / image.sizeBytes) * 100)}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Reduction badge */}
            {pct !== null && (
              <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <TrendingDown size={15} className="text-emerald-400" />
                <span className="text-emerald-400 font-bold text-sm">
                  {pct > 0
                    ? `~${pct}% smaller than original`
                    : "Size unchanged (already optimal)"}
                </span>
              </div>
            )}

            {isEstimating && (
              <p className="text-xs text-[#64748b] text-center">
                Estimating compressed size…
              </p>
            )}
          </div>

          {/* Compress & Download button */}
          <button
            id="compress-download-btn"
            onClick={compressAndDownload}
            disabled={isCompressing || !image}
            className="
              w-full flex items-center justify-center gap-3
              py-4 rounded-xl font-bold text-base text-white
              bg-gradient-to-r from-pink-500 to-rose-600
              hover:from-pink-400 hover:to-rose-500
              transition-all duration-300
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:shadow-[0_8px_30px_rgba(236,72,153,0.4)]
              hover:-translate-y-0.5 active:translate-y-0
            "
          >
            {isCompressing ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Compressing…
              </>
            ) : (
              <>
                <Download size={20} />
                Compress & Download Image
              </>
            )}
          </button>

          {/* Success note */}
          {compressedBlob && !isCompressing && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 justify-center animate-fade-in-up">
              <CheckCircle size={16} />
              Download started! Final size: {formatBytes(compressedBlob.size)}
            </div>
          )}
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
