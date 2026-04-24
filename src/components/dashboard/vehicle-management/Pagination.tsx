'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canPreviousPage: boolean;
  canNextPage: boolean;
  itemCount: number;
}

/**
 * @fileOverview Universal Registry Pagination Control.
 * Standardizes navigation across high-volume data tables.
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  canPreviousPage,
  canNextPage,
  itemCount,
}: PaginationProps) {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex-1 text-[10px] font-black uppercase text-slate-400 tracking-widest">
        Showing <span className="text-slate-900">{itemCount}</span> Active Registry Node{itemCount !== 1 ? 's' : ''}
      </div>
      <div className="flex items-center gap-6">
        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
          Page <span className="text-blue-900">{totalPages > 0 ? currentPage : 0}</span> of <span className="text-slate-900">{totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-slate-200"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canPreviousPage}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-slate-200"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canNextPage}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
