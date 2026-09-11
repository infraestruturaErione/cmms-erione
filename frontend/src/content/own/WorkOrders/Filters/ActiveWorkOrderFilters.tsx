import { Box, Button, Chip, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSelector } from '../../../../store';
import { FilterField } from '../../../../models/owns/page';
import { isDefaultFilter } from './filterSummary';

interface Props {
  filters: FilterField[];
  defaults: FilterField[];
  onRemove: (index: number) => void;
  onReset: () => void;
}

export default function ActiveWorkOrderFilters({ filters, defaults, onRemove, onReset }: Props) {
  const { t }: { t: any } = useTranslation();
  const customers = useSelector((state) => state.customers.customersMini);
  const locations = useSelector((state) => state.locations.locationsMini);
  const assets = useSelector((state) => state.assets.assetsMini);
  const teams = useSelector((state) => state.teams.teamsMini);
  const users = useSelector((state) => state.users.usersMini);
  const categories = useSelector((state) => state.categories.categories['work-order-categories']);
  const active = filters.map((filter, index) => ({ filter, index }))
    .filter(({ filter }) => !isDefaultFilter(filter, defaults));
  if (!active.length) return null;
  const labels: Record<string, string> = {
    title: 'search', customers: 'customer', primaryUser: 'primary_worker',
    assignedTo: 'additional_workers', createdBy: 'created_by',
    completedBy: 'completed_by', createdAt: 'created_at', updatedAt: 'updated_at',
    completedOn: 'completed_on', parentPreventiveMaintenance: 'type'
  };
  const records: Record<string, any[]> = {
    customers, location: locations, asset: assets, team: teams, category: categories,
    primaryUser: users, assignedTo: users, createdBy: users, completedBy: users
  };
  const describe = (filter: FilterField) => {
    if (filter.field === 'archived') return t('archived_work_orders');
    const values = filter.values ?? [filter.value];
    let detail = values.map((value) => {
      if (filter.enumName === 'STATUS' || filter.enumName === 'PRIORITY') return t(String(value));
      const record = records[filter.field]?.find((item) => String(item.id) === String(value));
      return record?.name || (record ? [record.firstName, record.lastName].filter(Boolean).join(' ') : String(value));
    }).join(', ');
    if (filter.field === 'parentPreventiveMaintenance') {
      detail = t(filter.operation === 'nu' ? 'REACTIVE' : 'REPEATING');
    }
    if (filter.operation === 'ge') detail = `≥ ${detail}`;
    if (filter.operation === 'le') detail = `≤ ${detail}`;
    if (filter.values?.length === 0) detail = t('wo_filter_none', 'Nenhum selecionado');
    return `${t(labels[filter.field] ?? filter.field)}: ${detail}`;
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
        {t('wo_active_filters', 'Filtros ativos')}
      </Typography>
      {active.map(({ filter, index }) => {
        const label = describe(filter);
        return (
          <Tooltip key={`${filter.field}-${index}`} title={label}>
            <Chip
              size="small"
              label={label}
              onDelete={() => onRemove(index)}
              sx={{ maxWidth: { xs: '100%', sm: 300 }, borderRadius: 1, bgcolor: 'action.hover', fontWeight: 500 }}
            />
          </Tooltip>
        );
      })}
      {active.length > 0 && (
        <Button size="small" onClick={onReset} sx={{ ml: { sm: 'auto' }, textTransform: 'none', flexShrink: 0 }}>
          {t('wo_reset_filters', 'Restaurar filtros')}
        </Button>
      )}
    </Box>
  );
}
