'use client';
import { Button } from '@/components/ui/button';

interface ReportPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canPreviousPage: boolean;
  canNextPage: boolean;
  itemCount: number;
}

export default function ReportPagination({ currentPage, totalPages, onPageChange, canPreviousPage, canNextPage, itemCount }: ReportPaginationProps) {
  const handlePrev = () => onPageChange(currentPage - 1);
  const handleNext = () => onPageChange(currentPage + 1);

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex-1 text-sm text-muted-foreground">
        {itemCount} record(s) found. Page {totalPages > 0 ? currentPage : 0} of {totalPages}
      </div>
      <div className="space-x-2">
        <Button variant="outline" size="sm" onClick={handlePrev} disabled={!canPreviousPage}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={handleNext} disabled={!canNextPage}>
          Next
        </Button>
      </div>
    </div>
  );
}
