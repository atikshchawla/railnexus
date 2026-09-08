"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  if (totalItems <= pageSize) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-border-default text-[12px] text-text-secondary">
      <span>
        Showing {start}–{end} of {totalItems} items
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-surface-sunken disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`
              min-w-[44px] min-h-[44px] flex items-center justify-center border border-border-default rounded text-[13px]
              ${
                page === currentPage
                  ? "bg-brand text-white font-medium border-brand"
                  : "text-text-primary hover:bg-surface-sunken"
              }
            `}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-surface-sunken disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
