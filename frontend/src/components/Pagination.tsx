import { Center, Pagination as MantinePagination } from '@mantine/core';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <Center className="pagination-row" mt={24} mb={12}>
      <MantinePagination value={page} total={totalPages} onChange={onPageChange} />
    </Center>
  );
}
