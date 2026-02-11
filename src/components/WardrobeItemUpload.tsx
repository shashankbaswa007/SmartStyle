'use client';

import { useState, useRef, useEffect } from 'react';
import { auth, storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { Upload, Camera, X, Loader2, Info, Shield, Shirt } from 'lucide-react';
import Image from 'next/image';
import { addWardrobeItem } from '@/lib/wardrobeService';
import { generateOptimizedImages, type OptimizedImages } from '@/lib/image-optimization';
import { extractColorsFromDescription } from '@/lib/color-name-extraction';

interface WardrobeItemUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemAdded?: () => void;
}

const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
const OCCASIONS = ['casual', 'formal', 'party', 'business', 'sports'] as const;

export function WardrobeItemUpload({ open, onOpenChange, onItemAdded }: WardrobeItemUploadProps) {
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractingColors, setExtractingColors] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete'>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestionsApplied, setSuggestionsApplied] = useState(false);
  const [showSuggestionBadge, setShowSuggestionBadge] = useState(false);
  const [backgroundProcessing, setBackgroundProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTaskRef = useRef<any>(null);
  const submissionIdRef = useRef(0);
  const backgroundProcessingRef = useRef<string | null>(null);

  // Form state
  const [itemType, setItemType] = useState<string>('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');

  // Detect camera availability and cleanup on unmount
  useEffect(() => {
    let mounted = true;

    const checkCameraAvailability = async () => {
      try {
        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (mounted) setCameraAvailable(false);
          return;
        }
        
        // Check if camera permission is available (without requesting)
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(device => device.kind === 'videoinput');
        if (mounted) setCameraAvailable(hasCamera);
      } catch (error) {
        // If we can't check, assume camera might be available
        if (mounted) setCameraAvailable(true);
      }
    };
    
    checkCameraAvailability();

    return () => {
      mounted = false;
      // Cancel any ongoing upload on unmount
      if (uploadTaskRef.current) {
        try {
          uploadTaskRef.current.cancel();
        } catch (e) {
          // Ignore cancel errors
        }
        uploadTaskRef.current = null;
      }
    };
  }, []);

  // Automatically compress images to fit under 800KB (client-side, instant!)
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }

          // Calculate dimensions to maintain aspect ratio
          // Target max dimension of 1200px for good quality while staying under 800KB
          const MAX_DIMENSION = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_DIMENSION) {
            height = (height * MAX_DIMENSION) / width;
            width = MAX_DIMENSION;
          } else if (height > MAX_DIMENSION) {
            width = (width * MAX_DIMENSION) / height;
            height = MAX_DIMENSION;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Try different quality levels to get under 800KB
          const tryCompress = (quality: number) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Compression failed'));
                  return;
                }

                const sizeKB = blob.size / 1024;
                console.log(`🖼️ Compressed to ${sizeKB.toFixed(0)}KB at quality ${quality}`);

                if (blob.size < 800 * 1024 || quality <= 0.5) {
                  // Success! Convert blob back to File
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                } else {
                  // Try lower quality
                  tryCompress(quality - 0.1);
                }
              },
              'image/jpeg',
              quality
            );
          };

          // Start with high quality (0.85) and reduce if needed
          tryCompress(0.85);
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid File',
        description: 'Please select a valid image file (JPEG, PNG, WebP, or HEIC).',
      });
      return;
    }

    const originalSizeKB = (file.size / 1024).toFixed(0);
    console.log(`📸 Original image: ${originalSizeKB}KB`);

    // Show compressing toast if image is large
    let compressionToast: any = null;
    if (file.size > 800 * 1024) {
      compressionToast = toast({
        title: 'Optimizing image...',
        description: `Compressing ${originalSizeKB}KB image to fit storage limits`,
        duration: 10000,
      });
    }

    try {
      // Automatically compress if needed
      let processedFile = file;
      if (file.size > 800 * 1024) {
        processedFile = await compressImage(file);
        const newSizeKB = (processedFile.size / 1024).toFixed(0);
        console.log(`✅ Compressed: ${originalSizeKB}KB → ${newSizeKB}KB`);
        
        // Update toast with success
        if (compressionToast) {
          compressionToast.dismiss();
          toast({
            title: 'Image optimized! ✨',
            description: `Reduced from ${originalSizeKB}KB to ${newSizeKB}KB`,
            duration: 2000,
          });
        }
      }

      setImageFile(processedFile);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(processedFile);
      
    } catch (error) {
      console.error('Image compression failed:', error);
      if (compressionToast) compressionToast.dismiss();
      
      toast({
        variant: 'destructive',
        title: 'Compression Failed',
        description: 'Could not optimize image. Please try a different photo or reduce its size manually.',
      });
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleImageSelect(file);
    }
  };

  const handleCameraCapture = () => {
    // Trigger file input with camera capture
    if (fileInputRef.current) {
      // Remove any existing capture attribute first
      fileInputRef.current.removeAttribute('capture');
      // Set capture for rear camera on mobile devices
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
      // Remove capture attribute after click so file upload still works normally
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.removeAttribute('capture');
        }
      }, 100);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleSeason = (season: string) => {
    setSelectedSeasons(prev =>
      prev.includes(season)
        ? prev.filter(s => s !== season)
        : [...prev, season]
    );
  };

  const toggleOccasion = (occasion: string) => {
    setSelectedOccasions(prev =>
      prev.includes(occasion)
        ? prev.filter(o => o !== occasion)
        : [...prev, occasion]
    );
  };

  // Smart suggestions based on image analysis
  const generateSmartSuggestions = async (file: File) => {
    try {
      // Only apply suggestions once
      if (suggestionsApplied) return;

      // Create temporary URL for quick analysis
      const tempUrl = URL.createObjectURL(file);
      
      // Extract colors to help with suggestions
      const colorData = await extractColorsFromUrl(tempUrl).catch(() => null);
      URL.revokeObjectURL(tempUrl);

      const fileName = file.name.toLowerCase();
      const suggestions: any = {};

      // Suggest item type based on filename patterns (extended)
      if (!itemType) {
        const patterns = {
          top: ['shirt', 'tshirt', 't-shirt', 'blouse', 'top', 'tee', 'polo', 'tank', 'cami'],
          bottom: ['pant', 'jean', 'trouser', 'short', 'skirt', 'legging', 'jogger'],
          dress: ['dress', 'gown', 'frock', 'maxi', 'midi'],
          shoes: ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'flat', 'loafer', 'oxford'],
          outerwear: ['jacket', 'coat', 'sweater', 'cardigan', 'hoodie', 'blazer', 'vest'],
          accessory: ['bag', 'purse', 'belt', 'scarf', 'hat', 'cap', 'watch', 'jewelry']
        };

        for (const [type, keywords] of Object.entries(patterns)) {
          if (keywords.some(keyword => fileName.includes(keyword))) {
            suggestions.itemType = type;
            break;
          }
        }
      }

      // Suggest seasons based on colors
      if (selectedSeasons.length === 0 && colorData) {
        const colors = colorData.dominantColors || [];
        const hasWarmColors = colors.some((c: string) => 
          c.toLowerCase().includes('red') || c.toLowerCase().includes('orange') || c.toLowerCase().includes('yellow')
        );
        const hasCoolColors = colors.some((c: string) => 
          c.toLowerCase().includes('blue') || c.toLowerCase().includes('green') || c.toLowerCase().includes('cyan')
        );
        const hasDarkColors = colors.some((c: string) => 
          c.toLowerCase().includes('black') || c.toLowerCase().includes('gray') || c.toLowerCase().includes('navy')
        );
        const hasBrightColors = colors.some((c: string) => 
          !c.toLowerCase().includes('black') && !c.toLowerCase().includes('gray') && !c.toLowerCase().includes('white')
        );

        const suggestedSeasons: string[] = [];
        
        if (hasWarmColors || hasBrightColors) {
          suggestedSeasons.push('spring', 'summer');
        }
        if (hasCoolColors || hasDarkColors) {
          suggestedSeasons.push('fall', 'winter');
        }
        
        // If all colors are neutral, suggest all seasons
        if (suggestedSeasons.length === 0) {
          suggestedSeasons.push('spring', 'summer', 'fall', 'winter');
        }

        suggestions.seasons = suggestedSeasons;
      }

      // Suggest occasions based on item type and colors
      if (selectedOccasions.length === 0) {
        const suggestedOccasions: string[] = [];
        const currentType = suggestions.itemType || itemType;

        if (currentType === 'outerwear' || currentType === 'dress') {
          suggestedOccasions.push('formal', 'business');
        }
        if (currentType === 'top' || currentType === 'bottom') {
          suggestedOccasions.push('casual', 'business');
        }
        if (currentType === 'shoes') {
          suggestedOccasions.push('casual', 'formal');
        }
        if (currentType === 'accessory') {
          suggestedOccasions.push('party', 'formal');
        }

        // Always add casual as a fallback
        if (suggestedOccasions.length === 0) {
          suggestedOccasions.push('casual');
        }

        suggestions.occasions = suggestedOccasions;
      }

      // Suggest category based on item type and filename
      if (!category) {
        const currentType = suggestions.itemType || itemType;
        let suggestedCategory = '';

        if (currentType === 'top') {
          if (fileName.includes('tshirt') || fileName.includes('t-shirt')) {
            suggestedCategory = 'T-Shirt';
          } else if (fileName.includes('shirt')) {
            suggestedCategory = 'Shirt';
          } else if (fileName.includes('blouse')) {
            suggestedCategory = 'Blouse';
          } else if (fileName.includes('sweater') || fileName.includes('jumper')) {
            suggestedCategory = 'Sweater';
          }
        } else if (currentType === 'bottom') {
          if (fileName.includes('jean')) {
            suggestedCategory = 'Jeans';
          } else if (fileName.includes('short')) {
            suggestedCategory = 'Shorts';
          } else if (fileName.includes('pant') || fileName.includes('trouser')) {
            suggestedCategory = 'Pants';
          }
        } else if (currentType === 'shoes') {
          if (fileName.includes('sneaker')) {
            suggestedCategory = 'Sneakers';
          } else if (fileName.includes('boot')) {
            suggestedCategory = 'Boots';
          } else if (fileName.includes('sandal')) {
            suggestedCategory = 'Sandals';
          }
        } else if (currentType === 'outerwear') {
          if (fileName.includes('jacket')) {
            suggestedCategory = 'Jacket';
          } else if (fileName.includes('coat')) {
            suggestedCategory = 'Coat';
          } else if (fileName.includes('hoodie')) {
            suggestedCategory = 'Hoodie';
          }
        }

        if (suggestedCategory) {
          suggestions.category = suggestedCategory;
        }
      }

      // Apply suggestions if we have any
      if (Object.keys(suggestions).length > 0) {
        if (suggestions.itemType) setItemType(suggestions.itemType);
        if (suggestions.category) setCategory(suggestions.category);
        if (suggestions.seasons) setSelectedSeasons(suggestions.seasons);
        if (suggestions.occasions) setSelectedOccasions(suggestions.occasions);
        
        setSuggestionsApplied(true);
        setShowSuggestionBadge(true);
        
        // Hide badge after 3 seconds
        setTimeout(() => setShowSuggestionBadge(false), 3000);

        // Build specific message about what was suggested
        const suggestedFields = [];
        if (suggestions.itemType) suggestedFields.push('type');
        if (suggestions.category) suggestedFields.push('category');
        if (suggestions.seasons) suggestedFields.push('seasons');
        if (suggestions.occasions) suggestedFields.push('occasions');

        toast({
          title: 'Smart suggestions applied ✨',
          description: `Pre-filled ${suggestedFields.join(', ')} based on your image. Feel free to adjust!`,
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      // Silently fail - suggestions are optional
    }
  };

  // Trigger suggestions when image is selected
  useEffect(() => {
    if (imageFile && !suggestionsApplied) {
      generateSmartSuggestions(imageFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile]);

  // Process colors in background after item is saved
  const processColorsInBackground = async (itemId: string, imageUrl: string, userId: string) => {
    try {
      console.log('🎨 Starting background color extraction for item:', itemId);
      backgroundProcessingRef.current = itemId;
      
      const extractedColors = await extractColorsFromUrl(imageUrl);
      const dominantColors = extractedColors.dominantColors;

      // Update the item with extracted colors
      const { db } = await import('@/lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      const itemRef = doc(db, 'users', userId, 'wardrobeItems', itemId);
      
      await updateDoc(itemRef, {
        dominantColors,
        colorsProcessed: true,
        lastUpdated: Date.now(),
      });

      console.log('✅ Background color extraction completed for item:', itemId);
      backgroundProcessingRef.current = null;
    } catch (error) {
      console.error('❌ Background color extraction failed:', error);
      // Silently fail - item is already saved with default colors
      backgroundProcessingRef.current = null;
    }
  };

  const resetForm = () => {
    // Cancel ongoing upload if any
    if (uploadTaskRef.current) {
      try {
        uploadTaskRef.current.cancel();
      } catch (e) {
        // Ignore cancel errors
      }
      uploadTaskRef.current = null;
    }

    setImageFile(null);
    setImagePreview(null);
    setItemType('');
    setDescription('');
    setCategory('');
    setBrand('');
    setSelectedSeasons([]);
    setSelectedOccasions([]);
    setNotes('');
    setPurchaseDate('');
    setUploadProgress(0);
    setUploadStatus('idle');
    setRetryCount(0);
    setUploadError(null);
    setLoading(false);
    setExtractingColors(false);
    setIsSubmitting(false);
    setSuggestionsApplied(false);
    setShowSuggestionBadge(false);
    setBackgroundProcessing(false);
    submissionIdRef.current++; // Invalidate any in-flight submissions
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleModalOpenChange = (newOpen: boolean) => {
    if (!newOpen && isSubmitting) {
      // Warn user if they try to close during submission
      toast({
        title: 'Upload in progress',
        description: 'Please wait for the upload to complete.',
        variant: 'default',
      });
      return;
    }
    
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Convert image to base64 data URI and generate optimized versions
  // (no Firebase Storage billing required - 100% FREE!)
  const uploadImageToStorage = async (file: File, userId: string): Promise<OptimizedImages> => {
    return new Promise((resolve, reject) => {
      // Check file size - Firestore documents have a 1MB limit per field
      // Total document size limit is 1MB, so we'll keep all images under that combined
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB original (will be compressed)
      if (file.size > MAX_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        reject(new Error(`Image too large (${sizeMB}MB). Please use an image under 5MB.`));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const originalDataUri = reader.result as string;
          setUploadProgress(30);
          
          // Generate optimized images at multiple resolutions
          console.log('🖼️ Generating optimized images...');
          const optimizedImages = await generateOptimizedImages(originalDataUri);
          
          // Calculate total size
          const totalSizeKB = Math.round(
            (optimizedImages.thumbnail.length + 
             optimizedImages.medium.length + 
             optimizedImages.full.length) / 1024
          );
          
          console.log(`✅ Optimized images generated (${totalSizeKB}KB total) - stored in Firestore (no storage costs!)`);
          
          // Simulate progress for better UX
          setUploadProgress(50);
          setTimeout(() => {
            setUploadProgress(100);
            setUploadStatus('processing');
            resolve(optimizedImages);
          }, 200);
        } catch (error) {
          console.error('❌ Image optimization error:', error);
          reject(new Error('Failed to optimize image. Please try again.'));
        }
      };
      
      reader.onerror = () => {
        console.error('❌ FileReader error:', reader.error);
        reject(new Error('Failed to read image file. Please try again.'));
      };
      
      // Start reading the file as base64
      setUploadStatus('uploading');
      setUploadProgress(0);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 Wardrobe upload: Form submitted');

    // Prevent duplicate submissions
    if (isSubmitting) {
      console.warn('⚠️ Upload already in progress');
      toast({
        title: 'Upload in progress',
        description: 'Please wait for the current upload to complete.',
      });
      return;
    }

    const user = auth.currentUser;
    console.log('👤 Current user:', user ? user.uid : 'NOT AUTHENTICATED');
    if (!user) {
      console.error('❌ User not authenticated');
      toast({
        variant: 'destructive',
        title: 'Authentication Required',
        description: 'Please sign in to add items to your wardrobe.',
      });
      return;
    }

    // Validate required fields
    if (!imageFile || !itemType || !description) {
      const missing = [];
      if (!imageFile) missing.push('image');
      if (!itemType) missing.push('item type');
      if (!description) missing.push('description');
      
      console.error('❌ Missing required fields:', missing);
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: `Please provide: ${missing.join(', ')}`,
      });
      return;
    }
    
    console.log('✅ Validation passed, starting upload...', {
      hasImage: !!imageFile,
      itemType,
      description: description.substring(0, 30),
      userId: user.uid
    });

    const submissionId = submissionIdRef.current;
    const MAX_RETRIES = 3;
    let uploadUrl: string | null = null;

    try {
      setIsSubmitting(true);
      setLoading(true);
      setUploadStatus('uploading');
      setUploadError(null);

      // Check if submission was cancelled
      if (submissionId !== submissionIdRef.current) {
        return;
      }

      // Step 1: Generate optimized images (thumbnail, medium, full)
      console.log('🖼️ Generating optimized images (free storage in Firestore)...');
      let uploadAttempt = 0;
      let optimizedImages: OptimizedImages | null = null;
      
      while (uploadAttempt < MAX_RETRIES && !optimizedImages) {
        // Check if submission was cancelled
        if (submissionId !== submissionIdRef.current) {
          console.log('🚫 Upload cancelled');
          return;
        }

        try {
          console.log(`🖼️ Optimization attempt ${uploadAttempt + 1}/${MAX_RETRIES}...`);
          optimizedImages = await uploadImageToStorage(imageFile, user.uid);
          console.log('✅ Optimized images generated:', {
            thumbnail: `${Math.round(optimizedImages.thumbnail.length / 1024)}KB`,
            medium: `${Math.round(optimizedImages.medium.length / 1024)}KB`,
            full: `${Math.round(optimizedImages.full.length / 1024)}KB`
          });
        } catch (uploadError) {
          uploadAttempt++;
          setRetryCount(uploadAttempt);
          console.error(`❌ Optimization attempt ${uploadAttempt} failed:`, uploadError);
          
          if (uploadAttempt >= MAX_RETRIES) {
            const errorMsg = uploadError instanceof Error 
              ? uploadError.message 
              : `Upload failed after ${MAX_RETRIES} attempts`;
            setUploadError(errorMsg);
            console.error('❌ All optimization attempts failed:', errorMsg);
            throw new Error(errorMsg);
          }
          
          console.warn(`⏳ Retrying optimization in ${uploadAttempt}s...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempt)); // Exponential backoff
        }
      }

      if (!optimizedImages) {
        console.error('❌ Optimization failed: No images returned');
        throw new Error('Failed to optimize images');
      }
      
      // Use full-size image for display
      uploadUrl = optimizedImages.full;

      // Check cancellation after upload
      if (submissionId !== submissionIdRef.current) {
        return;
      }

      // Step 2: Extract colors from description text
      console.log('🎨 Extracting colors from description...');
      const extractedColors = extractColorsFromDescription(description);
      console.log('✅ Colors extracted from description:', extractedColors);

      // Step 3: Save with extracted colors
      setUploadStatus('processing');
      console.log('💾 Preparing to save to Firestore...');
      
      const itemData = {
        images: optimizedImages, // Store all three sizes
        imageUrl: optimizedImages.full, // Legacy compatibility
        itemType: itemType as any,
        description: description.trim(),
        category: category.trim() || undefined,
        brand: brand.trim() || undefined,
        dominantColors: extractedColors,
        season: selectedSeasons.length > 0 ? selectedSeasons as any : undefined,
        occasions: selectedOccasions.length > 0 ? selectedOccasions as any : undefined,
        purchaseDate: purchaseDate || undefined,
        notes: notes.trim() || undefined,
        addedDate: Date.now(),
        wornCount: 0,
        isActive: true,
        colorsProcessed: true,
      };
      
      console.log('📦 Item data prepared:', {
        hasOptimizedImages: !!itemData.images,
        thumbnail: `${Math.round(optimizedImages.thumbnail.length / 1024)}KB`,
        medium: `${Math.round(optimizedImages.medium.length / 1024)}KB`,
        full: `${Math.round(optimizedImages.full.length / 1024)}KB`,
        itemType: itemData.itemType,
        description: itemData.description.substring(0, 30),
        hasSeasons: !!itemData.season,
        hasOccasions: !!itemData.occasions
      });

      // Step 4: Add to Firestore with retry
      console.log('💾 Saving to Firestore...');
      let saveAttempt = 0;
      let saveResult = null;
      
      while (saveAttempt < MAX_RETRIES && !saveResult?.success) {
        try {
          console.log(`💾 Save attempt ${saveAttempt + 1}/${MAX_RETRIES}...`);
          saveResult = await addWardrobeItem(user.uid, itemData);
          
          if (!saveResult.success) {
            console.error('❌ Save failed:', saveResult.message);
            throw new Error(saveResult.message);
          }
          
          console.log('✅ Item saved successfully, ID:', saveResult.itemId);
        } catch (saveError) {
          saveAttempt++;
          console.error(`❌ Save attempt ${saveAttempt} failed:`, saveError);
          
          if (saveAttempt >= MAX_RETRIES) {
            console.error('❌ All save attempts failed');
            throw new Error('Failed to save item after multiple attempts');
          }
          
          console.warn(`⏳ Retrying save in ${saveAttempt}s...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * saveAttempt));
        }
      }

      // Check cancellation after save
      if (submissionId !== submissionIdRef.current) {
        return;
      }

      setUploadStatus('complete');
      
      // Colors already extracted during upload - no background processing needed
      
      toast({
        title: 'Item Added! 🎉',
        description: 'Your item is saved (100% free - no storage costs!)',
        duration: 2000,
      });

      resetForm();
      onOpenChange(false);
      onItemAdded?.();
      
    } catch (error) {
      console.error('Error adding wardrobe item:', error);
      
      setUploadStatus('idle');
      const errorMessage = error instanceof Error ? error.message : 'Failed to add item to wardrobe. Please try again.';
      setUploadError(errorMessage);
      
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: errorMessage,
      });
      
      // Don't reset form on error - preserve user's input for retry
    } finally {
      setLoading(false);
      setExtractingColors(false);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleModalOpenChange}>
      <TooltipProvider delayDuration={200}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-teal-900 flex items-center gap-2">
            Add Wardrobe Item
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-teal-600 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">Upload clear photos on a solid background for best color detection</p>
              </TooltipContent>
            </Tooltip>
          </DialogTitle>
          <DialogDescription>
            Upload a photo and add details about your clothing item.
          </DialogDescription>
          <div className="flex items-start gap-2 text-xs text-teal-800 bg-teal-50/80 rounded-lg px-3 py-2 border border-teal-200 mt-2">
            <Shield className="h-4 w-4 flex-shrink-0 mt-0.5 text-teal-600" />
            <div>
              <div className="font-semibold mb-0.5">Your Privacy is Protected</div>
              <div className="text-teal-700">Images are stored securely with your account. Only you can access them. AI color detection happens automatically to help categorize your items.</div>
            </div>
          </div>
          {imageFile && suggestionsApplied && (
            <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2">
              <Info className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-purple-800">
                Smart suggestions have been applied based on your image. You can edit any field to customize.
              </p>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 mt-2 sm:mt-4">
          {/* Image Upload Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Item Photo *</Label>
              {!imagePreview && (
                <span className="text-xs text-teal-600 font-medium">Auto-optimized • No size limits!</span>
              )}
            </div>
            {!imagePreview ? (
              <div className="border-2 border-dashed border-teal-300 rounded-lg p-4 sm:p-8 text-center space-y-4">
                <div className="flex flex-col items-center gap-3 sm:gap-4">
                  <Upload className="h-10 w-10 sm:h-12 sm:w-12 text-teal-400" aria-hidden="true" />
                  <p className="text-sm sm:text-base text-gray-600 font-medium">
                    Add your clothing photo
                  </p>
                  
                  {/* Mobile-first: Camera as primary action on mobile, side-by-side on desktop */}
                  <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 w-full max-w-md">
                    {/* Camera button - Primary on mobile (first), larger touch target */}
                    {cameraAvailable ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="default"
                            onClick={handleCameraCapture}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white h-auto py-5 sm:py-4 px-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2 shadow-lg hover:shadow-xl transition-all touch-manipulation active:scale-95"
                            aria-label="Take a photo with your camera"
                          >
                            <Camera className="h-8 w-8 sm:h-6 sm:w-6" aria-hidden="true" />
                            <div className="text-center sm:text-left">
                              <div className="font-semibold text-base sm:text-sm">Take Photo</div>
                              <div className="text-xs opacity-90 sm:hidden">Best for mobile</div>
                            </div>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">Open camera to capture your item</p>
                          <p className="text-xs opacity-80 mt-1">Quick and easy on mobile</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                    
                    {/* File upload button - Secondary on mobile */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant={cameraAvailable ? "outline" : "default"}
                          onClick={() => fileInputRef.current?.click()}
                          className={cameraAvailable 
                            ? "border-2 border-teal-300 text-teal-700 hover:bg-teal-50 h-auto py-5 sm:py-4 px-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2 touch-manipulation active:scale-95"
                            : "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white h-auto py-5 sm:py-4 px-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2 shadow-lg hover:shadow-xl transition-all touch-manipulation active:scale-95"}
                          aria-label="Choose a file from your device"
                        >
                          <Upload className="h-8 w-8 sm:h-6 sm:w-6" aria-hidden="true" />
                          <div className="text-center sm:text-left">
                            <div className="font-semibold text-base sm:text-sm">Choose File</div>
                            <div className="text-xs opacity-75 sm:hidden">From gallery</div>
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm">Select an existing photo</p>
                        <p className="text-xs opacity-80 mt-1">From your gallery or files</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    {/* Show camera unavailable message only on desktop */}
                    {!cameraAvailable && (
                      <div className="hidden sm:block text-xs text-gray-500 col-span-2 text-center mt-2">
                        <Camera className="h-4 w-4 inline mr-1" aria-hidden="true" />
                        Camera not available on this device
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                    onChange={handleFileInputChange}
                    className="hidden"
                    aria-label="File input for image upload"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative w-full h-64 rounded-lg overflow-hidden border-2 border-teal-200">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveImage}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                  {!suggestionsApplied && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => imageFile && generateSmartSuggestions(imageFile)}
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      ✨ Get Suggestions
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Item Type */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="itemType">Item Type *</Label>
              {showSuggestionBadge && itemType && (
                <Badge className="bg-purple-100 text-purple-700 text-xs animate-pulse">
                  ✨ Suggested
                </Badge>
              )}
            </div>
            <Select value={itemType} onValueChange={setItemType} required>
              <SelectTrigger id="itemType" className="border-teal-300" aria-required="true" aria-label="Select item type">
                <SelectValue placeholder="Select item type..." />
              </SelectTrigger>
              <SelectContent role="listbox">
                <SelectItem value="top">👕 Top</SelectItem>
                <SelectItem value="bottom">👖 Bottom</SelectItem>
                <SelectItem value="dress">👗 Dress</SelectItem>
                <SelectItem value="shoes">👟 Shoes</SelectItem>
                <SelectItem value="accessory">👜 Accessory</SelectItem>
                <SelectItem value="outerwear">🧥 Outerwear</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <p className="text-xs text-muted-foreground">
              💡 <strong>Include the color</strong> in your description (e.g., "Red cotton dress", "Navy blue jeans", "White sneakers")
            </p>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Red cotton summer dress"
              className="border-teal-300"
              required
            />
          </div>

          {/* Category & Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="category">Category</Label>
                {showSuggestionBadge && category && (
                  <Badge className="bg-purple-100 text-purple-700 text-xs animate-pulse">
                    ✨ Suggested
                  </Badge>
                )}
              </div>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., T-shirt, Jeans"
                className="border-teal-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Nike, Zara"
                className="border-teal-300"
              />
            </div>
          </div>

          {/* Seasons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Seasons</Label>
              {showSuggestionBadge && selectedSeasons.length > 0 && (
                <Badge className="bg-purple-100 text-purple-700 text-xs animate-pulse">
                  ✨ Suggested
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {SEASONS.map((season) => (
                <div key={season} className="flex items-center space-x-2">
                  <Checkbox
                    id={`season-${season}`}
                    checked={selectedSeasons.includes(season)}
                    onCheckedChange={() => toggleSeason(season)}
                    className="border-teal-300"
                  />
                  <Label htmlFor={`season-${season}`} className="capitalize cursor-pointer">
                    {season}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Occasions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Occasions</Label>
              {showSuggestionBadge && selectedOccasions.length > 0 && (
                <Badge className="bg-purple-100 text-purple-700 text-xs animate-pulse">
                  ✨ Suggested
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {OCCASIONS.map((occasion) => (
                <div key={occasion} className="flex items-center space-x-2">
                  <Checkbox
                    id={`occasion-${occasion}`}
                    checked={selectedOccasions.includes(occasion)}
                    onCheckedChange={() => toggleOccasion(occasion)}
                    className="border-teal-300"
                  />
                  <Label htmlFor={`occasion-${occasion}`} className="capitalize cursor-pointer">
                    {occasion}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Purchase Date */}
          <div className="space-y-2">
            <Label htmlFor="purchaseDate">Purchase Date (Optional)</Label>
            <Input
              id="purchaseDate"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="border-teal-300"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this item..."
              rows={3}
              className="border-teal-300"
            />
          </div>

          {/* Upload Progress */}
          {uploadStatus !== 'idle' && uploadStatus !== 'complete' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>
                  {uploadStatus === 'uploading' && `Uploading... ${retryCount > 0 ? `(Retry ${retryCount})` : ''}`}
                  {uploadStatus === 'processing' && 'Saving item...'}
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Error Display */}
          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <svg className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Upload Failed</p>
                <p className="text-sm text-red-700 mt-1">{uploadError}</p>
                <p className="text-xs text-red-600 mt-2">Your changes have been preserved. You can try again.</p>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="submit"
                  disabled={loading || !imageFile || !itemType || !description}
                  className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white disabled:opacity-50"
                  aria-label="Add item to wardrobe"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {uploadStatus === 'uploading' && 'Uploading...'}
                      {uploadStatus === 'processing' && 'Saving...'}
                      {uploadStatus === 'idle' && 'Saving...'}
                    </>
                  ) : (
                    'Add to Wardrobe'
                  )}
                </Button>
              </TooltipTrigger>
              {(!imageFile || !itemType || !description) && (
                <TooltipContent>
                  <p>Please complete required fields: photo, type, and description</p>
                </TooltipContent>
              )}
            </Tooltip>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (uploadTaskRef.current) {
                  uploadTaskRef.current.cancel();
                }
                onOpenChange(false);
              }}
              disabled={loading && uploadStatus === 'processing'}
              className="border-teal-300"
              aria-label="Cancel and close dialog"
            >
              {loading && uploadStatus === 'uploading' ? 'Cancel Upload' : 'Cancel'}
            </Button>
          </div>
        </form>
      </DialogContent>
      </TooltipProvider>
    </Dialog>
  );
}

// Extract colors from an image URL using canvas analysis
async function extractColorsFromUrl(imageUrl: string): Promise<{ dominantColors: string[] }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }

        // Use smaller canvas for faster analysis
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Sample pixels from the image
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // Count color frequencies (simplified to basic color categories)
        const colorCounts: Record<string, number> = {};
        
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          
          // Skip transparent pixels
          if (a < 128) continue;
          
          // Categorize into basic colors
          const color = categorizeColor(r, g, b);
          colorCounts[color] = (colorCounts[color] || 0) + 1;
        }
        
        // Sort by frequency and get top colors
        const sortedColors = Object.entries(colorCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([color]) => color);
        
        resolve({ dominantColors: sortedColors.length > 0 ? sortedColors : ['neutral'] });
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
}

// Helper function to categorize RGB values into color names
function categorizeColor(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  // Check for grayscale
  if (diff < 30) {
    if (max < 60) return 'black';
    if (max < 160) return 'gray';
    return 'white';
  }
  
  // Determine dominant color
  if (r > g && r > b) {
    if (g > b * 1.5) return 'orange';
    if (b > g * 1.2) return 'purple';
    return 'red';
  }
  
  if (g > r && g > b) {
    if (r > b * 1.2) return 'yellow';
    if (b > r * 0.8) return 'cyan';
    return 'green';
  }
  
  if (b > r && b > g) {
    if (r > g * 1.2) return 'purple';
    if (g > r * 0.8) return 'cyan';
    return 'blue';
  }
  
  return 'neutral';
}

