'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { saveColorPalette, type SavedColorPalette } from '@/lib/colorPaletteService';
import { AnimatedToast } from './AnimatedToast';

interface SaveColorPaletteProps {
  baseColor: {
    hex: string;
    rgb: string;
    name: string;
  };
  harmonyType: string;
  matchColors: Array<{
    hex: string;
    rgb: string;
    name?: string;
    label: string;
    fashionContext?: {
      usage: 'primary' | 'secondary' | 'accent';
      ratio: string;
      clothingItems: string[];
      styleNotes: string;
    };
  }>;
  onSaved?: (paletteId: string) => void;
}

export function SaveColorPalette({
  baseColor,
  harmonyType,
  matchColors,
  onSaved,
}: SaveColorPaletteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const [formData, setFormData] = useState({
    name: '',
    occasions: [] as string[],
    seasons: [] as string[],
    notes: '',
    tags: [] as string[],
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const occasionOptions = ['casual', 'formal', 'party', 'business', 'sports', 'date'];
  const seasonOptions = ['spring', 'summer', 'fall', 'winter'];

  const handleSave = async () => {
    if (!user) {
      setToastMessage('Please sign in to save color palettes');
      setToastType('error');
      setShowToast(true);
      return;
    }

    if (!formData.name.trim()) {
      setToastMessage('Please enter a name for this palette');
      setToastType('error');
      setShowToast(true);
      return;
    }

    setIsSaving(true);

    try {
      const result = await saveColorPalette(user.uid, {
        name: formData.name,
        baseColor,
        harmonyType,
        matchColors,
        occasions: formData.occasions,
        seasons: formData.seasons,
        notes: formData.notes,
        tags: formData.tags,
      });

      if (result.success && result.paletteId) {
        setToastMessage('Color palette saved successfully!');
        setToastType('success');
        setShowToast(true);
        setIsOpen(false);
        
        // Reset form
        setFormData({
          name: '',
          occasions: [],
          seasons: [],
          notes: '',
          tags: [],
        });

        if (onSaved) {
          onSaved(result.paletteId);
        }
      } else {
        setToastMessage(result.message);
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      setToastMessage('Failed to save palette');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleOccasion = (occasion: string) => {
    setFormData(prev => ({
      ...prev,
      occasions: prev.occasions.includes(occasion)
        ? prev.occasions.filter(o => o !== occasion)
        : [...prev.occasions, occasion],
    }));
  };

  const toggleSeason = (season: string) => {
    setFormData(prev => ({
      ...prev,
      seasons: prev.seasons.includes(season)
        ? prev.seasons.filter(s => s !== season)
        : [...prev.seasons, season],
    }));
  };

  if (!user) {
    return (
      <button
        onClick={() => {
          setToastMessage('Please sign in to save color palettes');
          setToastType('error');
          setShowToast(true);
        }}
        className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Save Palette
        </span>
      </button>
    );
  }

  return (
    <>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Save Palette
          </span>
        </button>
      ) : (
        <SavePaletteModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          baseColor={baseColor}
          harmonyType={harmonyType}
          matchColors={matchColors}
          formData={formData}
          setFormData={setFormData}
          isSaving={isSaving}
          onSave={handleSave}
          occasionOptions={occasionOptions}
          seasonOptions={seasonOptions}
          toggleOccasion={toggleOccasion}
          toggleSeason={toggleSeason}
        />
      )}

      {showToast && (
        <AnimatedToast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </>
  );
}

// Extracted modal with focus trap and keyboard support
function SavePaletteModal({
  isOpen,
  onClose,
  baseColor,
  harmonyType,
  matchColors,
  formData,
  setFormData,
  isSaving,
  onSave,
  occasionOptions,
  seasonOptions,
  toggleOccasion,
  toggleSeason,
}: {
  isOpen: boolean;
  onClose: () => void;
  baseColor: { hex: string; rgb: string; name: string };
  harmonyType: string;
  matchColors: Array<{ hex: string; name?: string }>;
  formData: { name: string; occasions: string[]; seasons: string[]; notes: string; tags: string[] };
  setFormData: React.Dispatch<React.SetStateAction<typeof formData>>;
  isSaving: boolean;
  onSave: () => void;
  occasionOptions: string[];
  seasonOptions: string[];
  toggleOccasion: (o: string) => void;
  toggleSeason: (s: string) => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    onClose();
    previousFocusRef.current?.focus();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
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
    requestAnimationFrame(() => {
      const nameInput = modalRef.current?.querySelector<HTMLInputElement>('input[type="text"]');
      nameInput?.focus();
    });
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Save color palette"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Save Color Palette</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close save palette dialog"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Color Preview */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div
              className="w-12 h-12 rounded-lg shadow-md"
              style={{ backgroundColor: baseColor.hex }}
            />
            <div className="flex-1">
              <p className="font-medium text-foreground">{baseColor.name}</p>
              <p className="text-sm text-muted-foreground">{harmonyType} harmony</p>
            </div>
            <div className="flex gap-2">
              {matchColors.slice(0, 4).map((color, idx) => (
                <div
                  key={idx}
                  className="w-8 h-8 rounded shadow-sm"
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label htmlFor="palette-name" className="block text-sm font-medium text-foreground mb-2">
              Palette Name *
            </label>
            <input
              id="palette-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev: typeof formData) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Summer Evening Vibes"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
              aria-required="true"
            />
          </div>

          {/* Occasions */}
          <fieldset>
            <legend className="block text-sm font-medium text-foreground mb-2">
              Occasions (Optional)
            </legend>
            <div className="flex flex-wrap gap-2" role="group">
              {occasionOptions.map((occasion) => (
                <button
                  key={occasion}
                  type="button"
                  onClick={() => toggleOccasion(occasion)}
                  aria-pressed={formData.occasions.includes(occasion)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    formData.occasions.includes(occasion)
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {occasion}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Seasons */}
          <fieldset>
            <legend className="block text-sm font-medium text-foreground mb-2">
              Seasons (Optional)
            </legend>
            <div className="flex flex-wrap gap-2" role="group">
              {seasonOptions.map((season) => (
                <button
                  key={season}
                  type="button"
                  onClick={() => toggleSeason(season)}
                  aria-pressed={formData.seasons.includes(season)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    formData.seasons.includes(season)
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {season}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Notes */}
          <div>
            <label htmlFor="palette-notes" className="block text-sm font-medium text-foreground mb-2">
              Notes (Optional)
            </label>
            <textarea
              id="palette-notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev: typeof formData) => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any notes about this color palette..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Palette'}
          </button>
        </div>
      </div>
    </div>
  );
}
