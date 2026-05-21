import React, { useEffect } from 'react';

export const DEFAULT_PAYOUT_PAGE_SIZE = 7;

export function calcPayoutTotalPages(totalItems, itemsPerPage = DEFAULT_PAYOUT_PAGE_SIZE) {
  if (!totalItems) return 1;
  return Math.max(1, Math.ceil(totalItems / itemsPerPage));
}

export function getVisiblePageNumbers(currentPage, totalPages, maxVisible = 7) {
  if (totalPages <= 0) return [];
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = start + maxVisible - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - maxVisible + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function getPayoutPageSlice(list, currentPage, itemsPerPage = DEFAULT_PAYOUT_PAGE_SIZE) {
  const start = (currentPage - 1) * itemsPerPage;
  return list.slice(start, start + itemsPerPage);
}

export function getPayoutRangeLabel(currentPage, totalItems, itemsPerPage = DEFAULT_PAYOUT_PAGE_SIZE) {
  if (!totalItems) return { start: 0, end: 0 };
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);
  return { start, end };
}

const navBtn =
  'px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const pageBtn = 'min-w-[2.25rem] px-3 py-2 rounded-lg text-sm font-medium transition-colors';

/**
 * Shared payout table pagination: windowed page numbers, prev/next, range label.
 */
export default function PayoutPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = DEFAULT_PAYOUT_PAGE_SIZE,
  onPageChange,
  itemLabel = 'results',
  onClampPage,
  children,
}) {
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const visiblePages = getVisiblePageNumbers(safePage, totalPages);
  const { start, end } = getPayoutRangeLabel(safePage, totalItems, itemsPerPage);
  const navDisabled = totalItems === 0;

  useEffect(() => {
    if (currentPage > totalPages && onClampPage) {
      onClampPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages, onClampPage]);

  const go = (page) => {
    if (navDisabled) return;
    const next = Math.min(Math.max(1, page), totalPages);
    onPageChange?.(next);
  };

  return (
    <div className="grid grid-cols-3 items-center gap-4 px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
      <div className="text-sm text-[#6B8782] justify-self-start min-w-0">
        {totalItems === 0
          ? `Showing 0 of 0 ${itemLabel}`
          : `Showing ${start}–${end} of ${totalItems} ${itemLabel}`}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 justify-self-center">
        <button
          type="button"
          onClick={() => go(safePage - 1)}
          disabled={navDisabled || safePage <= 1}
          className={`${navBtn} ${navDisabled || safePage <= 1 ? 'text-gray-400' : 'text-[#6B8782] hover:bg-[#D0E0DB]'}`}
          aria-label="Previous page"
        >
          ‹
        </button>

        {visiblePages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => go(page)}
            disabled={navDisabled}
            className={`${pageBtn} ${
              safePage === page
                ? 'bg-[#0D8568] text-white'
                : 'text-[#6B8782] hover:bg-[#D0E0DB]'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          onClick={() => go(safePage + 1)}
          disabled={navDisabled || safePage >= totalPages}
          className={`${navBtn} ${
            navDisabled || safePage >= totalPages ? 'text-gray-400' : 'text-[#6B8782] hover:bg-[#D0E0DB]'
          }`}
          aria-label="Next page"
        >
          ›
        </button>
      </div>

      <div className="text-sm justify-self-end min-w-0">{children}</div>
    </div>
  );
}
