// shadcn/ui data-table pattern with TanStack Table (MIT).
import React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Button,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "./primitives";
export function DataTable<T>({
  columns,
  data,
  label,
  className = "",
  rowClassName,
  initialPageSize = 10,
  compact = false,
  remote,
}: {
  columns: ColumnDef<T>[];
  data: T[];
  label: string;
  className?: string;
  rowClassName?: (value: T) => string;
  initialPageSize?: number;
  compact?: boolean;
  remote?: { page:number; pageSize:number; total:number; loading?:boolean; onPage:(page:number)=>void; onPageSize:(size:number)=>void; onSort?:(id:string,desc:boolean)=>void };
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting, ...(remote ? {pagination:{pageIndex:remote.page-1,pageSize:remote.pageSize}} : {}) },
    onSortingChange: updater=>{const next=typeof updater==="function"?updater(sorting):updater;setSorting(next);remote?.onSort?.(next[0]?.id??"name",next[0]?.desc??false)},
    manualPagination:!!remote, manualSorting:!!remote,
    rowCount:remote?.total,
    ...(remote?{onPaginationChange:(updater:any)=>{const current={pageIndex:remote.page-1,pageSize:remote.pageSize};const next=typeof updater==="function"?updater(current):updater;if(next.pageSize!==current.pageSize)remote.onPageSize(next.pageSize);else remote.onPage(next.pageIndex+1);}}:{}),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: initialPageSize } },
    autoResetPageIndex: !remote,
  });
  return (
    <div className={"nfc-data-table " + className} data-compact={compact}>
      <Table aria-label={label} aria-busy={remote?.loading}>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead
                  key={header.id}
                  aria-sort={
                    header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : undefined
                  }
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <Button
                      variant="ghost"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      <span aria-hidden>
                        {header.column.getIsSorted() === "asc"
                          ? "↑"
                          : header.column.getIsSorted() === "desc"
                            ? "↓"
                            : "↕"}
                      </span>
                    </Button>
                  ) : (
                    flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={rowClassName?.(row.original)}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    data-column={cell.column.id}
                    data-label={
                      typeof cell.column.columnDef.header === "string"
                        ? cell.column.columnDef.header
                        : undefined
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length}>
                <div className="nfc-empty">
                  <strong>{remote?.loading ? "Üyeler yükleniyor…" : "Sonuç bulunamadı"}</strong>
                  <p>{remote?.loading ? "Güncel sonuçlar getiriliyor." : "Arama veya filtreleri değiştirerek tekrar dene."}</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <footer className="nfc-table-footer">
        <span>
          {(remote?.total ?? data.length)
            ? table.getState().pagination.pageIndex *
                table.getState().pagination.pageSize +
              1
            : 0}
          –
          {Math.min(
            remote?.total ?? data.length,
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
          )}{" "}
          / {remote?.total ?? data.length} kayıt · Sayfa{" "}
          {table.getState().pagination.pageIndex + 1} /{" "}
          {Math.max(1, table.getPageCount())}
        </span>
        <div>
          {!compact && (
            <label className="nfc-page-size">
              Satır
              <select
                aria-label={label + " sayfa boyutu"}
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
              >
                {[5, 10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button
            variant="outline"
            onClick={() => table.previousPage()}
            disabled={remote?.loading || !table.getCanPreviousPage()}
            aria-label="Önceki sayfa"
          >
            Önceki
          </Button>
          <Button
            variant="outline"
            onClick={() => table.nextPage()}
            disabled={remote?.loading || !table.getCanNextPage()}
            aria-label="Sonraki sayfa"
          >
            Sonraki
          </Button>
        </div>
      </footer>
    </div>
  );
}
