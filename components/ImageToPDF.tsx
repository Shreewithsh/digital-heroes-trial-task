"use client";

/**
 * ImageToPDF.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Tool 1 – Convert multiple JPG/PNG images into a single multi-page PDF.
 *
 * Key features:
 *  • Drag-and-drop OR click-to-browse file upload
 *  • Image preview grid with drag-to-reorder (HTML5 Drag API)
 *  • Per-image remove button
 *  • jsPDF-powered PDF generation that respects each image's aspect ratio
 *  • Graceful loading / success / error states with toast feedback
 * ──────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileImage,
  X,
  GripVertical,
  FilePlus2,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Represents one uploaded image with its preview URL and ordering index. */
interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
}

type ToastType = "success" | "error" | null;

// ─── Helper: generate a short unique ID ──────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

// ─── Helper: format bytes ─────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageToPDF() {
  // Uploaded images in display order
  const [images, setImages] = useState<ImageItem[]>([]);

  // Drop-zone drag state
  const [isDragOver, setIsDragOver] = useState(false);

  // Image-grid drag-reorder state
  const dragItemIndex = useRef<number | null>(null);
  const dragOverItemIndex = useRef<number | null>(null);

  // Conversion state
  const [isConverting, setIsConverting] = useState(false);
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

  // ─── Accept and process dropped / selected files ─────────────────────────
  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const accepted: ImageItem[] = [];

    Array.from(fileList).forEach((file) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return;
      const previewUrl = URL.createObjectURL(file);
      accepted.push({ id: uid(), file, previewUrl, name: file.name });
    });

    if (accepted.length === 0) {
      showToast("error", "Please upload JPG or PNG images.");
      return;
    }

    setImages((prev) => [...prev, ...accepted]);
  }, [showToast]);

  // ─── Drop-zone event handlers ─────────────────────────────────────────────
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  // ─── Remove individual image ──────────────────────────────────────────────
  const removeImage = (id: string) => {
    setImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  // ─── Clear all images ─────────────────────────────────────────────────────
  const clearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  };

  // ─── Drag-to-reorder handlers ─────────────────────────────────────────────
  const onDragStart = (index: number) => {
    dragItemIndex.current = index;
  };

  const onDragEnterCard = (index: number) => {
    dragOverItemIndex.current = index;
  };

  const onDragEndCard = () => {
    if (
      dragItemIndex.current === null ||
      dragOverItemIndex.current === null ||
      dragItemIndex.current === dragOverItemIndex.current
    ) {
      dragItemIndex.current = null;
      dragOverItemIndex.current = null;
      return;
    }

    const updated = [...images];
    const dragged = updated.splice(dragItemIndex.current, 1)[0];
    updated.splice(dragOverItemIndex.current, 0, dragged);
    setImages(updated);

    dragItemIndex.current = null;
    dragOverItemIndex.current = null;
  };

  // ─── Core: generate PDF using jsPDF ──────────────────────────────────────
  const convertToPDF = async () => {
    if (images.length === 0) {
      showToast("error", "Please add at least one image.");
      return;
    }

    setIsConverting(true);

    try {
      // Dynamically import jsPDF to avoid SSR issues
      const { jsPDF } = await import("jspdf");

      let pdf: InstanceType<typeof jsPDF> | null = null;

      for (let i = 0; i < images.length; i++) {
        const img = images[i];

        // Load image into an HTMLImageElement to read its natural dimensions
        const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new window.Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = img.previewUrl;
        });

        const { naturalWidth, naturalHeight } = imageElement;

        // Determine page orientation based on image aspect ratio
        const orientation = naturalWidth >= naturalHeight ? "landscape" : "portrait";

        if (!pdf) {
          // First page: create the PDF with the first image's dimensions
          pdf = new jsPDF({
            orientation,
            unit: "px",
            format: [naturalWidth, naturalHeight],
            compress: true,
          });
        } else {
          // Subsequent pages: add a page matching the image's dimensions
          pdf.addPage([naturalWidth, naturalHeight], orientation);
        }

        // Draw image to fill the entire page
        pdf.addImage(
          img.previewUrl,
          img.file.type === "image/png" ? "PNG" : "JPEG",
          0,
          0,
          naturalWidth,
          naturalHeight,
          undefined,
          "FAST"
        );
      }

      if (!pdf) throw new Error("PDF generation failed.");

      // Trigger browser download
      pdf.save("converted-images.pdf");
      showToast("success", `PDF created with ${images.length} page${images.length > 1 ? "s" : ""}!`);
    } catch (err) {
      console.error("[ImageToPDF] Conversion error:", err);
      showToast("error", "Failed to generate PDF. Please try again.");
    } finally {
      setIsConverting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Upload Zone ── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload images by clicking or dropping files here"
        className={`
          drop-zone relative flex flex-col items-center justify-center
          min-h-[200px] rounded-2xl border-2 border-dashed cursor-pointer
          transition-all duration-300
          ${isDragOver
            ? "border-violet-500 bg-violet-500/10 scale-[1.01]"
            : "border-[#2a2a3d] bg-[#16161f] hover:border-violet-500/50 hover:bg-violet-500/5"
          }
        `}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          id="img-to-pdf-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        {/* Upload icon */}
        <div
          className={`
            w-16 h-16 rounded-2xl flex items-center justify-center mb-4
            bg-gradient-to-br from-violet-600/20 to-indigo-600/20
            border border-violet-500/20
            transition-transform duration-300
            ${isDragOver ? "scale-110" : ""}
          `}
        >
          <Upload size={28} className="text-violet-400" />
        </div>

        <p className="text-[#f1f5f9] font-semibold text-lg mb-1">
          {isDragOver ? "Release to upload" : "Drop images here"}
        </p>
        <p className="text-[#64748b] text-sm mb-3">
          or click to browse · JPG, PNG, WebP accepted
        </p>
        <span className="px-4 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-medium">
          Multiple images supported
        </span>
      </div>

      {/* ── Image Grid & Controls ── */}
      {images.length > 0 && (
        <div className="animate-fade-in-up space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                <FileImage size={16} className="text-violet-400" />
              </div>
              <div>
                <p className="text-[#f1f5f9] font-semibold text-sm">
                  {images.length} image{images.length > 1 ? "s" : ""} ready
                </p>
                <p className="text-[#64748b] text-xs">Drag cards to reorder pages</p>
              </div>
            </div>

            <button
              id="clear-all-images-btn"
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#64748b] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
            >
              <Trash2 size={13} />
              Clear all
            </button>
          </div>

          {/* Reorderable image grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img, index) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => onDragStart(index)}
                onDragEnter={() => onDragEnterCard(index)}
                onDragEnd={onDragEndCard}
                onDragOver={(e) => e.preventDefault()}
                className="
                  relative group rounded-xl overflow-hidden border border-[#2a2a3d]
                  bg-[#16161f] cursor-grab active:cursor-grabbing
                  hover:border-violet-500/40 transition-all duration-200
                  hover:shadow-[0_4px_20px_rgba(124,58,237,0.15)]
                "
              >
                {/* Page number badge */}
                <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-md bg-black/70 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-white border border-white/10">
                  {index + 1}
                </div>

                {/* Remove button */}
                <button
                  id={`remove-image-${img.id}`}
                  aria-label={`Remove ${img.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(img.id);
                  }}
                  className="
                    absolute top-2 right-2 z-10 w-6 h-6 rounded-md
                    bg-red-500/80 hover:bg-red-500
                    flex items-center justify-center
                    opacity-0 group-hover:opacity-100
                    transition-all duration-200
                  "
                >
                  <X size={12} className="text-white" />
                </button>

                {/* Drag handle */}
                <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-60 transition-opacity">
                  <GripVertical size={14} className="text-white" />
                </div>

                {/* Image preview */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl}
                  alt={img.name}
                  className="w-full aspect-square object-cover"
                />

                {/* Filename */}
                <div className="px-2 py-1.5 bg-[#0a0a0f]/80 backdrop-blur-sm">
                  <p className="text-xs text-[#94a3b8] truncate">{img.name}</p>
                  <p className="text-[10px] text-[#64748b]">{formatBytes(img.file.size)}</p>
                </div>
              </div>
            ))}

            {/* Add more button */}
            <button
              id="add-more-images-btn"
              onClick={() => fileInputRef.current?.click()}
              className="
                flex flex-col items-center justify-center aspect-square
                rounded-xl border-2 border-dashed border-[#2a2a3d]
                hover:border-violet-500/50 hover:bg-violet-500/5
                text-[#64748b] hover:text-violet-400
                transition-all duration-200 cursor-pointer
              "
            >
              <FilePlus2 size={24} className="mb-2" />
              <span className="text-xs font-medium">Add more</span>
            </button>
          </div>

          {/* Convert button */}
          <button
            id="convert-to-pdf-btn"
            onClick={convertToPDF}
            disabled={isConverting || images.length === 0}
            className="
              w-full flex items-center justify-center gap-3
              py-4 rounded-xl font-bold text-base
              bg-gradient-to-r from-violet-600 to-indigo-600
              hover:from-violet-500 hover:to-indigo-500
              text-white transition-all duration-300
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:shadow-[0_8px_30px_rgba(124,58,237,0.4)]
              hover:-translate-y-0.5 active:translate-y-0
            "
          >
            {isConverting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Generating PDF…
              </>
            ) : (
              <>
                <Download size={20} />
                Convert & Download PDF
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Empty state hint ── */}
      {images.length === 0 && (
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-6 text-sm text-[#64748b]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-500"></span>
              Upload images above
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Reorder by dragging
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              Download PDF
            </span>
          </div>
        </div>
      )}

      {/* ── Toast notification ── */}
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
