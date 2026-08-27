import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { createColumnHelper } from '@tanstack/react-table';
import { CustomDatagridColumn2 } from '../../components/CustomDatagrid2';
import Location from '../../../../models/owns/location';
import { CustomerMiniDTO } from '../../../../models/owns/customer';
import {
  getLocationDisplayAddress,
  getLocationIdentification,
  getLocationReferenceLabel
} from '../../../../utils/locationDisplay';
import LocationRowActions from '../components/LocationRowActions';

// Traduz o id da coluna (frontend) pro sortField que o backend espera -
// usado por LocationsTable pra resolver o Updater<SortingState> antes de
// repassar pro pai via onSortingChange.
export const LOCATION_SORT_FIELD_MAPPING: Record<string, string> = {
  customId: 'customId',
  name: 'name',
  address: 'address',
  createdAt: 'createdAt'
};

// Distribuicao proporcional (% da tabela, nao px) - ver CustomDatagrid2
// meta.widthPercent.
const CUSTOMERS_WIDTH_PERCENT = 22;
const REFERENCE_WIDTH_PERCENT = 13;
const ADDRESS_WIDTH_PERCENT = 54;
const ACTIONS_WIDTH_PERCENT = 11;

// "Prefeitura de Santa Branca +1" com tooltip listando todos - nunca
// esconder silenciosamente Customers alem do primeiro (cenario real: 1
// Location pode ter 2+ Customers).
function renderCustomersCell(customers: CustomerMiniDTO[] | undefined) {
  if (!customers || customers.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        --
      </Typography>
    );
  }
  const [first, ...rest] = customers;
  // Cliente nao deve ser cortado agressivamente - ate 2 linhas de wrap antes
  // de truncar (line-clamp), em vez de noWrap+ellipsis numa linha so'.
  const nameSx = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    whiteSpace: 'normal',
    wordBreak: 'break-word'
  } as const;
  if (rest.length === 0) {
    return (
      <Typography variant="body2" sx={nameSx}>
        {first.name}
      </Typography>
    );
  }
  return (
    <Tooltip title={customers.map((customer) => customer.name).join(', ')} arrow>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
        <Typography variant="body2" sx={nameSx}>
          {first.name}
        </Typography>
        <Chip
          label={`+${rest.length}`}
          size="small"
          sx={{ height: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}
        />
      </Box>
    </Tooltip>
  );
}

export interface GetLocationColumnsParams {
  t: (key: string, fallback?: string) => string;
  onOpenLocation: (location: Location) => void;
  onCreateWorkOrder: (location: Location) => void;
  onEdit: (location: Location) => void;
  onDelete: (location: Location) => void;
}

export function getLocationColumns({
  t,
  onOpenLocation,
  onCreateWorkOrder,
  onEdit,
  onDelete
}: GetLocationColumnsParams): CustomDatagridColumn2<Location>[] {
  const columnHelper = createColumnHelper<Location>();

  return [
    columnHelper.accessor((row) => row.customers, {
      id: 'customers',
      header: () => t('customer'),
      cell: (info) => renderCustomersCell(info.getValue() as CustomerMiniDTO[]),
      meta: { widthPercent: CUSTOMERS_WIDTH_PERCENT, minWidthPx: 160 }
    }),
    // Referencia Operacional (ID/PC) - so' apresentacao, delega a regra pro
    // helper central (locationDisplay.ts) - nunca if/else de referenceType
    // aqui.
    columnHelper.accessor((row) => getLocationReferenceLabel(row), {
      id: 'reference',
      header: () => t('location_reference_column', 'ID / PC'),
      cell: (info) => {
        const label = info.getValue() as string | null;
        return (
          <Typography variant="body2" color={label ? 'text.primary' : 'text.secondary'}>
            {label || '--'}
          </Typography>
        );
      },
      meta: { widthPercent: REFERENCE_WIDTH_PERCENT, minWidthPx: 90 }
    }),
    columnHelper.accessor('address', {
      id: 'address',
      header: () => t('address'),
      cell: (info) => {
        const currentLocationRow = info.row.original;
        const displayAddress = getLocationDisplayAddress(currentLocationRow);
        const identification = getLocationIdentification(currentLocationRow);
        return (
          <Tooltip title={t('open_location', 'Abrir endereço')}>
            <Box
              sx={{
                cursor: 'pointer',
                width: 'fit-content',
                maxWidth: '100%'
              }}
            >
              <Typography
                variant="body2"
                fontWeight={700}
                noWrap
                sx={{
                  lineHeight: 1.5,
                  transition:
                    'color 120ms ease, text-decoration-color 120ms ease',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px'
                  }
                }}
              >
                {identification || displayAddress || '--'}
              </Typography>
              {!!displayAddress && displayAddress !== identification && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ lineHeight: 1.5, display: 'block', mt: 0.25 }}
                >
                  {displayAddress}
                </Typography>
              )}
            </Box>
          </Tooltip>
        );
      },
      meta: { widthPercent: ADDRESS_WIDTH_PERCENT, minWidthPx: 260 }
    }),
    columnHelper.display({
      id: 'actions',
      header: () => t('actions'),
      cell: ({ row }) => (
        <LocationRowActions
          location={row.original}
          onOpenLocation={onOpenLocation}
          onCreateWorkOrder={onCreateWorkOrder}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ),
      meta: { widthPercent: ACTIONS_WIDTH_PERCENT, minWidthPx: 96 }
    })
  ];
}
