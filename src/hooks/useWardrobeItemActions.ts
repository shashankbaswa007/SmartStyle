'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { deleteWardrobeItem, markItemAsWorn, type WardrobeItemData } from '@/lib/wardrobeService';
import { toast } from '@/hooks/use-toast';

interface DeletedWardrobeItem {
  item: WardrobeItemData;
  timestamp: number;
}

interface UseWardrobeItemActionsParams {
  userId: string | null;
  isOnline: boolean;
  wardrobeItems: WardrobeItemData[];
  setWardrobeItems: Dispatch<SetStateAction<WardrobeItemData[]>>;
}

interface UseWardrobeItemActionsResult {
  deletingItemId: string | null;
  lastDeletedItem: DeletedWardrobeItem | null;
  showUndoToast: boolean;
  isUndoing: boolean;
  handleDeleteItem: (itemId: string, description: string) => Promise<void>;
  handleUndoDelete: () => Promise<void>;
  handleMarkAsWorn: (itemId: string, description: string) => Promise<void>;
}

export function useWardrobeItemActions({
  userId,
  isOnline,
  wardrobeItems,
  setWardrobeItems,
}: UseWardrobeItemActionsParams): UseWardrobeItemActionsResult {
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [lastDeletedItem, setLastDeletedItem] = useState<DeletedWardrobeItem | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const markingAsWornRef = useRef<Set<string>>(new Set());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const handleDeleteItem = async (itemId: string, description: string) => {
    if (!userId) return;

    if (!isOnline) {
      toast({
        variant: 'default',
        title: 'No internet connection',
        description: 'Cannot delete items while offline. Please check your connection.',
      });
      return;
    }

    if (deletingItemId || isUndoing) {
      toast({
        variant: 'default',
        title: 'Please wait',
        description: deletingItemId ? 'Another item is being deleted.' : 'Undo operation in progress.',
      });
      return;
    }

    setDeletingItemId(itemId);

    const itemToDelete = wardrobeItems.find((item) => item.id === itemId);
    const previousItems = [...wardrobeItems];
    setWardrobeItems((prev) => prev.filter((item) => item.id !== itemId));

    try {
      const result = await deleteWardrobeItem(userId, itemId);

      if (result.success) {
        if (itemToDelete) {
          setLastDeletedItem({ item: itemToDelete, timestamp: Date.now() });
          setShowUndoToast(true);

          if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
          undoTimerRef.current = setTimeout(() => {
            setShowUndoToast(false);
            setLastDeletedItem(null);
            undoTimerRef.current = null;
          }, 10_000);
        }

        toast({
          title: 'Item removed',
          description: `"${description}" has been removed from your wardrobe.`,
        });
      } else {
        setWardrobeItems(previousItems);
        toast({
          variant: 'destructive',
          title: 'Failed to remove',
          description: result.message,
        });
      }
    } catch {
      setWardrobeItems(previousItems);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to remove item from wardrobe. Please try again.',
      });
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleUndoDelete = async () => {
    if (!lastDeletedItem || !userId || isUndoing || deletingItemId) return;

    const timeSinceDelete = Date.now() - lastDeletedItem.timestamp;
    if (timeSinceDelete > 10_000) {
      toast({
        variant: 'default',
        title: 'Undo window expired',
        description: 'This item can no longer be restored. Please re-add it manually if needed.',
      });
      setShowUndoToast(false);
      setLastDeletedItem(null);
      return;
    }

    if (!isOnline) {
      toast({
        variant: 'default',
        title: 'No internet connection',
        description: 'Cannot restore items while offline. Please check your connection.',
      });
      return;
    }

    if (deletingItemId) {
      toast({
        variant: 'default',
        title: 'Please wait',
        description: 'Delete operation in progress.',
      });
      return;
    }

    const itemToRestore = lastDeletedItem.item;
    setShowUndoToast(false);
    setIsUndoing(true);

    try {
      const itemsRef = collection(db, 'users', userId, 'wardrobeItems');
      const docRef = doc(itemsRef, itemToRestore.id);

      await setDoc(docRef, {
        imageUrl: itemToRestore.imageUrl,
        images: itemToRestore.images || undefined,
        itemType: itemToRestore.itemType,
        category: itemToRestore.category || '',
        brand: itemToRestore.brand || '',
        description: itemToRestore.description,
        dominantColors: itemToRestore.dominantColors || [],
        season: itemToRestore.season || [],
        occasions: itemToRestore.occasions || [],
        purchaseDate: itemToRestore.purchaseDate || '',
        addedDate: itemToRestore.addedDate,
        wornCount: itemToRestore.wornCount || 0,
        lastWornDate: itemToRestore.lastWornDate || null,
        tags: itemToRestore.tags || [],
        notes: itemToRestore.notes || '',
        isActive: true,
      });

      setWardrobeItems((prev) => [...prev, itemToRestore].sort((a, b) => b.addedDate - a.addedDate));
      setLastDeletedItem(null);

      toast({
        title: 'Item Restored',
        description: `"${itemToRestore.description}" has been restored to your wardrobe.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Restore Failed',
        description: 'Could not restore the item. Please try adding it again.',
      });
      setLastDeletedItem(null);
    } finally {
      setIsUndoing(false);
    }
  };

  const handleMarkAsWorn = async (itemId: string, description: string) => {
    if (!userId) return;

    if (!isOnline) {
      toast({
        variant: 'default',
        title: 'No internet connection',
        description: 'Cannot update wear count while offline.',
      });
      return;
    }

    if (markingAsWornRef.current.has(itemId)) {
      return;
    }

    markingAsWornRef.current.add(itemId);
    const previousItems = [...wardrobeItems];

    setWardrobeItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, wornCount: (item.wornCount || 0) + 1, lastWornDate: Date.now() }
          : item
      )
    );

    try {
      const result = await markItemAsWorn(userId, itemId);

      if (result.success) {
        toast({
          title: 'Marked as worn',
          description: `"${description}" wear count updated.`,
        });
      } else {
        setWardrobeItems(previousItems);
        toast({
          variant: 'destructive',
          title: 'Failed to update',
          description: result.message,
        });
      }
    } catch {
      setWardrobeItems(previousItems);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update item. Please try again.',
      });
    } finally {
      markingAsWornRef.current.delete(itemId);
    }
  };

  return {
    deletingItemId,
    lastDeletedItem,
    showUndoToast,
    isUndoing,
    handleDeleteItem,
    handleUndoDelete,
    handleMarkAsWorn,
  };
}
