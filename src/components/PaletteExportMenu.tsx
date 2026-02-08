'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Copy, Image as ImageIcon, Share2, FileText, Code, Palette, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  downloadPaletteImage,
  copyPaletteToClipboard,
  generatePaletteDataURL,
  type PaletteData,
} from '@/lib/paletteExport';

interface PaletteExportMenuProps {
  palette: PaletteData;
  onClose?: () => void;
}

export function PaletteExportMenu({ palette, onClose }: PaletteExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<'horizontal' | 'grid' | 'swatch'>('horizontal');
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    onClose?.();
    // Restore focus to the trigger element
    previousFocusRef.current?.focus();
  }, [onClose]);

  // Keyboard escape handler and focus trap
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        return;
      }
      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Focus the modal on open
    requestAnimationFrame(() => {
      modalRef.current?.focus();
    });
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeModal]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showSuccessToast = (message: string) => setToast({ message, type: 'success' });
  const showErrorToast = (message: string) => setToast({ message, type: 'error' });

  const handleDownloadImage = async (format: 'horizontal' | 'grid' | 'swatch') => {
    try {
      setIsGenerating(true);
      await downloadPaletteImage(palette, format);
      showSuccessToast('Image downloaded successfully!');
    } catch (error) {
      console.error('Error downloading image:', error);
      showErrorToast('Failed to download image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyColors = async (format: 'hex' | 'rgb' | 'css' | 'json' | 'tailwind' | 'text') => {
    try {
      await copyPaletteToClipboard(palette, format);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
      showSuccessToast(`Colors copied as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error copying colors:', error);
      showErrorToast('Failed to copy colors');
    }
  };

  const handlePreview = async (format: 'horizontal' | 'grid' | 'swatch') => {
    try {
      setIsGenerating(true);
      setPreviewFormat(format);
      const dataURL = await generatePaletteDataURL(palette, format);
      setPreviewURL(dataURL);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      showErrorToast('Failed to generate preview');
    } finally {
      setIsGenerating(false);
    }
  };

  // Toasts are now React state-based (see above)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Download className="w-4 h-4" />
        Export
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-label="Export palette"
              tabIndex={-1}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Download className="w-6 h-6 text-accent" />
                      Export Palette
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Download images, copy colors, or share your palette
                    </p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    aria-label="Close export dialog"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Download as Image */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="w-5 h-5 text-accent" />
                    <h3 className="font-semibold text-lg">Download as Image</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => handleDownloadImage('horizontal')}
                      disabled={isGenerating}
                      className="group relative aspect-video bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-accent transition-all overflow-hidden disabled:opacity-50"
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="w-2 h-8 bg-gradient-to-b from-purple-400 to-blue-400 rounded" />
                          ))}
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2 bg-white/90 dark:bg-gray-900/90 rounded px-2 py-1">
                        <p className="text-xs font-medium text-gray-900 dark:text-white">Horizontal</p>
                        <p className="text-[10px] text-gray-500">1200×400</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleDownloadImage('grid')}
                      disabled={isGenerating}
                      className="group relative aspect-video bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950/20 dark:to-teal-950/20 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-accent transition-all overflow-hidden disabled:opacity-50"
                    >
                      <div className="absolute inset-0 flex items-center justify-center p-2">
                        <div className="grid grid-cols-2 gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="w-6 h-6 bg-gradient-to-br from-green-400 to-teal-400 rounded" />
                          ))}
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2 bg-white/90 dark:bg-gray-900/90 rounded px-2 py-1">
                        <p className="text-xs font-medium text-gray-900 dark:text-white">Grid</p>
                        <p className="text-[10px] text-gray-500">800×800</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleDownloadImage('swatch')}
                      disabled={isGenerating}
                      className="group relative aspect-video bg-gradient-to-br from-pink-50 to-orange-50 dark:from-pink-950/20 dark:to-orange-950/20 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-accent transition-all overflow-hidden disabled:opacity-50"
                    >
                      <div className="absolute inset-0 flex items-center justify-center gap-1">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="w-5 h-5 bg-gradient-to-br from-pink-400 to-orange-400 rounded-full" />
                        ))}
                      </div>
                      <div className="absolute bottom-2 left-2 right-2 bg-white/90 dark:bg-gray-900/90 rounded px-2 py-1">
                        <p className="text-xs font-medium text-gray-900 dark:text-white">Swatch</p>
                        <p className="text-[10px] text-gray-500">600×800</p>
                      </div>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Click to download • PNG format • High quality
                  </p>
                </div>

                {/* Copy Colors */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Copy className="w-5 h-5 text-accent" />
                    <h3 className="font-semibold text-lg">Copy All Colors</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { format: 'hex' as const, label: 'Hex Codes', icon: '#', desc: '#FF0000, #00FF00' },
                      { format: 'rgb' as const, label: 'RGB Values', icon: 'RGB', desc: 'rgb(255, 0, 0)' },
                      { format: 'css' as const, label: 'CSS Variables', icon: 'CSS', desc: '--color-base: #...' },
                      { format: 'json' as const, label: 'JSON', icon: '{}', desc: 'Structured data' },
                      { format: 'tailwind' as const, label: 'Tailwind', icon: 'TW', desc: 'Config format' },
                      { format: 'text' as const, label: 'Shareable', icon: '📋', desc: 'Plain text' },
                    ].map((option) => (
                      <button
                        key={option.format}
                        onClick={() => handleCopyColors(option.format)}
                        className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-accent hover:bg-accent/5 transition-all text-left group"
                      >
                        <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center text-accent font-mono text-xs flex-shrink-0">
                          {option.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                            {option.label}
                            {copiedFormat === option.format && (
                              <Check className="w-3 h-3 text-green-600" />
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {option.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Palette className="w-5 h-5 text-accent" />
                    <h3 className="font-semibold text-lg">Preview & Share</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handlePreview('horizontal')}
                      disabled={isGenerating}
                      className="flex-1"
                    >
                      Preview Horizontal
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handlePreview('grid')}
                      disabled={isGenerating}
                      className="flex-1"
                    >
                      Preview Grid
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handlePreview('swatch')}
                      disabled={isGenerating}
                      className="flex-1"
                    >
                      Preview Swatch
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>All exports are generated locally in your browser</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Preview Modal */}
        {showPreview && previewURL && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <h3 className="font-semibold text-lg">Palette Preview</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadImage(previewFormat)}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-900/50">
                <img
                  src={previewURL}
                  alt="Palette preview"
                  className="w-full h-auto rounded-lg shadow-lg"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* React-based toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="status"
            aria-live="polite"
            className={`fixed bottom-4 right-4 z-[60] px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-white ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
