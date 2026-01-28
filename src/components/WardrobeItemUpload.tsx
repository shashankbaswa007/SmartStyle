'use client';

import { useState, useRef } from 'react';
import { auth } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Upload, Camera, X, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { addWardrobeItem } from '@/lib/wardrobeService';
import { extractColorsFromUrl } from '@/lib/color-extraction';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [itemType, setItemType] = useState<string>('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid File',
        description: 'Please select a valid image file (JPEG, PNG, WebP, or HEIC).',
      });
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: `Image size is ${sizeMB}MB. Please select an image under 5MB.`,
      });
      return;
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
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

  const resetForm = () => {
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Authentication Required',
        description: 'Please sign in to add items to your wardrobe.',
      });
      return;
    }

    // Validate required fields
    if (!imagePreview || !itemType || !description) {
      const missing = [];
      if (!imagePreview) missing.push('image');
      if (!itemType) missing.push('item type');
      if (!description) missing.push('description');
      
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: `Please provide: ${missing.join(', ')}`,
      });
      return;
    }

    try {
      setLoading(true);

      // Extract colors from image
      setExtractingColors(true);
      let dominantColors: string[] = [];
      try {
        const extractedColors = await extractColorsFromUrl(imagePreview);
        dominantColors = extractedColors.dominantColors;
      } catch (colorError) {
        console.error('Color extraction failed:', colorError);
        // Continue without colors - not critical
      }
      setExtractingColors(false);

      // Prepare item data
      const itemData = {
        imageUrl: imagePreview, // In production, upload to Firebase Storage first
        itemType: itemType as any,
        description: description.trim(),
        category: category.trim() || undefined,
        brand: brand.trim() || undefined,
        dominantColors,
        season: selectedSeasons.length > 0 ? selectedSeasons as any : undefined,
        occasions: selectedOccasions.length > 0 ? selectedOccasions as any : undefined,
        purchaseDate: purchaseDate || undefined,
        notes: notes.trim() || undefined,
        addedDate: Date.now(),
        wornCount: 0,
        isActive: true,
      };

      // Add to wardrobe
      const result = await addWardrobeItem(user.uid, itemData);

      if (result.success) {
        toast({
          title: 'Item Added! 🎉',
          description: 'Your wardrobe item has been saved successfully.',
        });

        resetForm();
        onOpenChange(false);
        onItemAdded?.();
      } else {
        throw new Error(result.message || 'Failed to add item');
      }
    } catch (error) {
      console.error('Error adding wardrobe item:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add item to wardrobe',
      });
    } finally {
      setLoading(false);
      setExtractingColors(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-teal-900">
            Add Wardrobe Item
          </DialogTitle>
          <DialogDescription>
            Upload a photo and add details about your clothing item.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Image Upload Section */}
          <div className="space-y-4">
            <Label>Item Photo *</Label>
            {!imagePreview ? (
              <div className="border-2 border-dashed border-teal-300 rounded-lg p-8 text-center space-y-4">
                <div className="flex flex-col items-center gap-4">
                  <Upload className="h-12 w-12 text-teal-400" />
                  <p className="text-sm text-gray-600">
                    Upload a photo of your clothing item
                  </p>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-teal-300"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCameraCapture}
                      className="border-teal-300"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Take Photo
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="relative w-full h-64 rounded-lg overflow-hidden border-2 border-teal-200">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Item Type */}
          <div className="space-y-2">
            <Label htmlFor="itemType">Item Type *</Label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger id="itemType" className="border-teal-300">
                <SelectValue placeholder="Select item type..." />
              </SelectTrigger>
              <SelectContent>
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
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Blue cotton t-shirt"
              className="border-teal-300"
              required
            />
          </div>

          {/* Category & Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
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
            <Label>Seasons</Label>
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
            <Label>Occasions</Label>
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

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading || extractingColors}
              className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {extractingColors ? 'Analyzing Colors...' : 'Adding Item...'}
                </>
              ) : (
                'Add to Wardrobe'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-teal-300"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
