import { Card } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SortingState, Updater } from '@tanstack/react-table';
import CustomDatagrid2 from '../../components/CustomDatagrid2';
import NumberedPagination from '../../components/NumberedPagination';
import useTableState from '../../../../hooks/useTableState';
import Location from '../../../../models/owns/location';
import { Pageable, Sort } from '../../../../models/owns/page';
import {
  getLocationColumns,
  LOCATION_SORT_FIELD_MAPPING
} from '../config/locationColumns';

// Precisa ser uma das opcoes de CustomDatagrid2 pageSizeOptions ([10,25,50,100])
// - um valor fora dessa lista (era 40) faz o MUI Select "Linhas por pagina"
// nao achar nenhum item correspondente e renderizar vazio (bug reportado).
export const LOCATIONS_DEFAULT_PAGE_SIZE = 10;

interface LocationsTableProps {
  data: Location[];
  loading: boolean;
  pageable: Pageable;
  sorting: SortingState;
  totalRows: number;
  onPaginationChange: (pagination: {
    pageIndex: number;
    pageSize: number;
  }) => void;
  onSortingChange: (
    newSorting: Updater<SortingState>,
    sortParams: Sort[]
  ) => void;
  onNumberedPageChange: (pageIndex: number) => void;
  onOpenLocation: (location: Location) => void;
  onCreateWorkOrder: (location: Location) => void;
  onEdit: (location: Location) => void;
  onDelete: (location: Location) => void;
}

// Tabela de /app/locations - CustomDatagrid2 + NumberedPagination dentro do
// mesmo Card (sao uma unidade visual so': tabela + rodape de paginacao).
// Configuracao visual (zebra, alturas, sem scroll interno) e' especifica
// desta tela, mantida aqui em vez de "content/own/components" ate existir
// reuso real por outra feature. Colunas puras (sem estado) ficam em
// config/locationColumns.tsx.
function LocationsTable({
  data,
  loading,
  pageable,
  sorting,
  totalRows,
  onPaginationChange,
  onSortingChange,
  onNumberedPageChange,
  onOpenLocation,
  onCreateWorkOrder,
  onEdit,
  onDelete
}: LocationsTableProps) {
  const { t }: { t: any } = useTranslation();

  // Table state for column state persistence (ordem/tamanho/visibilidade/
  // pinagem de colunas) - paginacao/sorting reais continuam vindo de fora
  // (useLocationsSearch), nao deste hook.
  const tableState = useTableState({
    prefix: 'locations',
    fieldMapping: LOCATION_SORT_FIELD_MAPPING,
    initialPagination: {
      pageIndex: 0,
      pageSize: LOCATIONS_DEFAULT_PAGE_SIZE
    }
  });

  const columns = getLocationColumns({
    t,
    onOpenLocation,
    onCreateWorkOrder,
    onEdit,
    onDelete
  });

  const handleSortingChange = (newSorting: Updater<SortingState>) => {
    const resolvedSorting: SortingState =
      typeof newSorting === 'function' ? newSorting(sorting) : newSorting;
    const sortParams: Sort[] =
      resolvedSorting.length > 0
        ? resolvedSorting.map(
            (sort) =>
              `${LOCATION_SORT_FIELD_MAPPING[sort.id] || sort.id},${
                sort.desc ? 'desc' : 'asc'
              }` as Sort
          )
        : [];
    onSortingChange(resolvedSorting, sortParams);
  };

  return (
    <Card
      sx={{
        display: 'flex',
        flexDirection: 'column',
        border: (theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: 1.5,
        boxShadow: 'none'
      }}
    >
      <CustomDatagrid2
        columns={columns}
        data={data}
        loading={loading}
        pagination={{
          pageIndex: pageable.page,
          pageSize: pageable.size
        }}
        onPaginationChange={onPaginationChange}
        totalRows={totalRows}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        columnOrder={tableState.columnOrder}
        onColumnOrderChange={tableState.setColumnOrder}
        columnSizing={tableState.columnSizing}
        onColumnSizingChange={tableState.setColumnSizing}
        columnVisibility={tableState.columnVisibility}
        onColumnVisibilityChange={tableState.setColumnVisibility}
        pinnedColumns={tableState.pinnedColumns}
        onPinnedColumnsChange={tableState.setPinnedColumns}
        noRowsMessage={t('noRows.location.message')}
        noRowsAction={t('noRows.location.action')}
        onRowClick={onOpenLocation}
        headerBackgroundColor="#F7F9FC"
        headerVariant="plain"
        rowCellPaddingY={14}
        headerCellPaddingY={10}
        rowCellPaddingYCompact={11}
        headerCellPaddingYCompact={8}
        compactViewportHeight={820}
        zebraStripe
        hidePagination
        disableInternalScroll
        fluidTableWidth
        enableColumnResizing={false}
      />
      <NumberedPagination
        pageIndex={pageable.page}
        pageSize={pageable.size}
        totalRows={totalRows}
        onPageChange={onNumberedPageChange}
      />
    </Card>
  );
}

export default LocationsTable;
