import { Box, Skeleton, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import AccessTimeTwoToneIcon from '@mui/icons-material/AccessTimeTwoTone';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../utils/api';
import { Page } from '../../../models/owns/page';
import WorkOrder from '../../../models/owns/workOrder';

interface KpiDefinition {
  key: string;
  labelKey: string;
  icon: ReactNode;
  color: 'primary' | 'warning' | 'success' | 'error';
  filterFields: any[];
}

// Os contadores usam o MESMO endpoint de busca da lista (pageSize 1, so o
// totalElements interessa). Isso garante que o escopo do usuario e respeitado
// automaticamente - um tecnico ve os numeros das OS dele, nao da empresa
// inteira - sem depender de permissao de Analytics nem de endpoint novo.
const buildKpis = (): KpiDefinition[] => [
  {
    key: 'active',
    labelKey: 'active_work_orders',
    icon: <AssignmentTwoToneIcon />,
    color: 'primary',
    filterFields: [
      { field: 'archived', operation: 'eq', value: false },
      {
        field: 'status',
        operation: 'in',
        value: '',
        values: ['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD'],
        enumName: 'STATUS'
      }
    ]
  },
  {
    key: 'inProgress',
    labelKey: 'in_progress_work_orders',
    icon: <AccessTimeTwoToneIcon />,
    color: 'warning',
    filterFields: [
      { field: 'archived', operation: 'eq', value: false },
      {
        field: 'status',
        operation: 'in',
        value: '',
        values: ['EN_ROUTE', 'IN_PROGRESS'],
        enumName: 'STATUS'
      }
    ]
  },
  {
    key: 'complete',
    labelKey: 'completed_work_orders',
    icon: <CheckCircleTwoToneIcon />,
    color: 'success',
    filterFields: [
      { field: 'archived', operation: 'eq', value: false },
      {
        field: 'status',
        operation: 'in',
        value: '',
        values: ['COMPLETE'],
        enumName: 'STATUS'
      }
    ]
  }
];
// Nao existe card "Atrasadas" aqui de proposito: filtrar dueDate via filterFields
// quebra no backend (HibernateException convertendo String -> Timestamp na busca).
// Enquanto o filtro de data nao for suportado nesse endpoint, o card ficaria preso
// num skeleton de carregamento - pior do que nao existir.

export default function WorkOrderKpiCards() {
  const theme = useTheme();
  const { t }: { t: any } = useTranslation();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const kpis = buildKpis();

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      kpis.map((kpi) =>
        api
          .post<Page<WorkOrder>>('work-orders/search', {
            filterFields: kpi.filterFields,
            pageSize: 1,
            pageNum: 0,
            direction: 'DESC'
          })
          .then((page) => page?.totalElements ?? 0)
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      results.forEach((value, index) => {
        if (value !== null) next[kpis[index].key] = value;
      });
      setCounts(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Stack
      direction="row"
      sx={{ mb: 1.5, gap: { xs: 1, md: 2.5 }, alignItems: 'center', flexWrap: 'wrap' }}
    >
      <Typography variant="caption" color="text.secondary">
        {t('wo_general_counts', 'Visão geral · sem os filtros abaixo')}
      </Typography>
      {kpis.map((kpi) => {
        const value = counts?.[kpi.key];
        return (
          <Box
            key={kpi.key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              py: 0.5
            }}
          >
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                color: theme.palette[kpi.color].main,
                '& .MuiSvgIcon-root': { fontSize: 18 }
              }}
            >
              {kpi.icon}
            </Box>
            <Stack direction="row" alignItems="center" spacing={0.75} minWidth={0}>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.2 }}
                noWrap
              >
                {t(kpi.labelKey)}
              </Typography>
              {counts === null ? (
                <Skeleton width={28} height={22} />
              ) : value === undefined ? (
                <Tooltip title={t('load_failure')}>
                  <Typography variant="body2" aria-label={t('load_failure')}>—</Typography>
                </Tooltip>
              ) : (
                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {value}
                </Typography>
              )}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
