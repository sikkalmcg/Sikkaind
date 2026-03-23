'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canPreviousPage: boolean;
  canNextPage: boolean;
  itemCount?: number;
}

export default function Pagination({ currentPage, totalPages, onPageChange, canPreviousPage, canNextPage, itemCount }: PaginationProps) {
  const [jumpPage, setJumpPage] = useState(String(currentPage));

  useEffect(() => {
    setJumpPage(String(currentPage));
  }, [currentPage]);

  const handlePrev = () => {
    onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    onPageChange(currentPage + 1);
  };

  const handleJump = () => {
    const page = parseInt(jumpPage);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
    } else {
      setJumpPage(String(currentPage));
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between py-4 gap-4">
      <div className="flex-1 text-sm text-muted-foreground order-2 sm:order-1">
        {itemCount !== undefined && `${itemCount} record(s) found. `}
        Page {totalPages > 0 ? currentPage : 0} of {totalPages}
      </div>
      
      <div className="flex items-center gap-4 order-1 sm:order-2">
        <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Go to:</span>
            <Input 
                className="h-8 w-12 text-center p-1" 
                value={jumpPage} 
                onChange={(e) => setJumpPage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJump()}
            />
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleJump}>Jump</Button>
        </div>

        <div className="flex items-center space-x-2">
            <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={!canPreviousPage}
            >
            Previous
            </Button>
            <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={!canNextPage}
            >
            Next
            </Button>
        </div>
      </div>
    </div>
  );
}
