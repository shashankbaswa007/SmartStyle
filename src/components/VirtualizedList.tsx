/**
 * Virtualized List Component
 * Renders only visible items for smooth scrolling with 1000+ items
 */
'use client';

import * as React from 'react';
// @ts-ignore - react-window types may not be fully compatible
import { FixedSizeList } from 'react-window';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscanCount?: number;
  className?: string;
  height?: number;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  overscanCount = 3,
  className,
  height = 600,
}: VirtualizedListProps<T>) {
  const listRef = React.useRef<FixedSizeList>(null);

  const Row = React.useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = items[index];
      return (
        <motion.div
          style={style}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {renderItem(item, index)}
        </motion.div>
      );
    },
    [items, renderItem]
  );

  return (
    <div className={cn('w-full', className)}>
      <FixedSizeList
        ref={listRef}
        height={height}
        itemCount={items.length}
        itemSize={itemHeight}
        width="100%"
        overscanCount={overscanCount}
        className="scrollbar-thin"
      >
        {Row}
      </FixedSizeList>
    </div>
  );
}

/**
 * Virtualized Grid Component
 * For grid layouts with many items (outfit cards, image galleries)
 */
interface VirtualizedGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  columns: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  gap?: number;
  className?: string;
  height?: number;
}

export function VirtualizedGrid<T>({
  items,
  itemWidth,
  itemHeight,
  columns,
  renderItem,
  gap = 16,
  className,
  height = 600,
}: VirtualizedGridProps<T>) {
  const rowHeight = itemHeight + gap;
  const itemsPerRow = columns;
  const rowCount = Math.ceil(items.length / itemsPerRow);

  const Row = React.useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const startIndex = index * itemsPerRow;
      const endIndex = Math.min(startIndex + itemsPerRow, items.length);
      const rowItems = items.slice(startIndex, endIndex);

      return (
        <div
          style={{
            ...style,
            display: 'flex',
            gap: `${gap}px`,
            padding: `${gap / 2}px`,
          }}
        >
          {rowItems.map((item, i) => (
            <motion.div
              key={startIndex + i}
              style={{ width: itemWidth }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              {renderItem(item, startIndex + i)}
            </motion.div>
          ))}
        </div>
      );
    },
    [items, itemsPerRow, itemWidth, gap, renderItem]
  );

  return (
    <div className={cn('w-full', className)}>
      <FixedSizeList
        height={height}
        itemCount={rowCount}
        itemSize={rowHeight}
        width="100%"
        overscanCount={2}
      >
        {Row}
      </FixedSizeList>
    </div>
  );
}
