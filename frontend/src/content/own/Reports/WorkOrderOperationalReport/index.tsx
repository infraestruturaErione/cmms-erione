import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { ChangeEvent, useContext, useEffect, useMemo, useState } from 'react';
import { createColumnHelper, PaginationState } from '@tanstack/react-table';
import SearchTwoToneIcon from '@mui/icons-material/SearchTwoTone';
import RestartAltTwoToneIcon from '@mui/icons-material/RestartAltTwoTone';
import { TitleContext } from '../../../../contexts/TitleContext';
import { useDispatch, useSelector } from '../../../../store';
import { getCustomersMini } from '../../../../slices/customer';
import { getLocationsMini } from '../../../../slices/location';
import { getAssetsMini } from '../../../../slices/asset';
import { getUsersMini } from '../../../../slices/user';
import { FilterField, SearchCriteria } from '../../../../models/owns/page';
import {
  WorkOrderOperationalReportPeriodField,
  WorkOrderOperationalReportRow,
  WorkOrderOperationalReportSummary
} from '../../../../models/owns/workOrderOperationalReport';
import { getWorkOrderOperationalReport } from '../../../../slices/workOrderOperationalReport';
import CustomDatagrid2, {
  CustomDatagridColumn2
} from '../../components/CustomDatagrid2';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import AnalyticsLayout from '../../Analytics/AnalyticsLayout';

type FilterState = {
  customerId: string;
  locationId: string;
  assetId: string;
  status: string;
  primaryUserId: string;
  start: string;
  end: string;
  periodField: WorkOrderOperationalReportPeriodField;
};

const defaultFilters: FilterState = {
  customerId: '',
  locationId: '',
  assetId: '',
  status: '',
  primaryUserId: '',
  start: '',
  end: '',
  periodField: 'CREATED_AT'
};

const statusOptions = ['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE'];

const periodFieldOptions: WorkOrderOperationalReportPeriodField[] = [
  'CREATED_AT',
  'COMPLETED_ON',
  'CHECK_IN_AT'
];

function toIsoStart(value: string): string {
  return value ? `${value}T00:00:00.000Z` : null;
}

function toIsoEnd(value: string): string {
  return value ? `${value}T23:59:59.999Z` : null;
}

function formatDuration(seconds: number): string {
  if (seconds === null || seconds === undefined) return '--';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function SummaryCard({
  label,
  value,
  muted,
  accent = 'primary'
}: {
  label: string;
  value: number;
  muted?: boolean;
  accent?: 'primary' | 'success' | 'warning' | 'info' | 'secondary';
}) {
  return (
    <Card
      variant="outlined"
      sx={(theme) => ({
        height: '100%',
        boxShadow: 'none',
        borderColor: alpha(theme.colors[accent].main, 0.22),
        bgcolor: alpha(theme.colors[accent].main, 0.04)
      })}
    >
      <CardContent sx={{ py: 2 }}>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h3" color={muted ? 'text.secondary' : 'text.primary'}>
          {value ?? 0}
        </Typography>
      </CardContent>
    </Card>
  );
}

function WorkOrderOperationalReport() {
  const { t }: { t: any } = useTranslation();
  const dispatch = useDispatch();
  const { setTitle } = useContext(TitleContext);
  const { getFormattedDate } = useContext(CompanySettingsContext);
  const { customersMini } = useSelector((state) => state.customers);
  const { locationsMini } = useSelector((state) => state.locations);
  const { assetsMini } = useSelector((state) => state.assets);
  const { usersMini } = useSelector((state) => state.users);
  const { report, loading, error } = useSelector(
    (state) => state.workOrderOperationalReport
  );
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10
  });

  useEffect(() => {
    setTitle(t('operational_work_order_report'));
  }, []);

  useEffect(() => {
    dispatch(getCustomersMini());
    dispatch(getLocationsMini());
    dispatch(getAssetsMini());
    dispatch(getUsersMini());
  }, []);

  const buildCriteria = (
    currentFilters: FilterState,
    currentPagination: PaginationState
  ): SearchCriteria => {
    const filterFields: FilterField[] = [];

    if (currentFilters.customerId) {
      filterFields.push({
        field: 'customers',
        operation: 'inm',
        joinType: 'LEFT',
        value: '',
        values: [Number(currentFilters.customerId)]
      });
    }
    if (currentFilters.locationId) {
      filterFields.push({
        field: 'location',
        operation: 'in',
        value: '',
        values: [Number(currentFilters.locationId)]
      });
    }
    if (currentFilters.assetId) {
      filterFields.push({
        field: 'asset',
        operation: 'in',
        value: '',
        values: [Number(currentFilters.assetId)]
      });
    }
    if (currentFilters.status) {
      filterFields.push({
        field: 'status',
        operation: 'in',
        enumName: 'STATUS',
        value: '',
        values: [currentFilters.status]
      });
    }
    if (currentFilters.primaryUserId) {
      filterFields.push({
        field: 'primaryUser',
        operation: 'in',
        value: '',
        values: [Number(currentFilters.primaryUserId)]
      });
    }

    return {
      filterFields,
      pageNum: currentPagination.pageIndex,
      pageSize: currentPagination.pageSize,
      sortField: 'createdAt',
      direction: 'DESC'
    };
  };

  const loadReport = (
    currentFilters: FilterState = filters,
    currentPagination: PaginationState = pagination
  ) => {
    dispatch(
      getWorkOrderOperationalReport({
        periodField: currentFilters.periodField,
        start: toIsoStart(currentFilters.start),
        end: toIsoEnd(currentFilters.end),
        searchCriteria: buildCriteria(currentFilters, currentPagination)
      })
    );
  };

  useEffect(() => {
    loadReport(defaultFilters, pagination);
  }, []);

  const handleFilterChange =
    (field: keyof FilterState) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      setFilters((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleApply = () => {
    const nextPagination = { ...pagination, pageIndex: 0 };
    setPagination(nextPagination);
    loadReport(filters, nextPagination);
  };

  const handleClear = () => {
    const nextPagination = { pageIndex: 0, pageSize: pagination.pageSize };
    setFilters(defaultFilters);
    setPagination(nextPagination);
    loadReport(defaultFilters, nextPagination);
  };

  const handlePaginationChange = (nextPagination: PaginationState) => {
    setPagination(nextPagination);
    loadReport(filters, nextPagination);
  };

  const summary: WorkOrderOperationalReportSummary = report.summary;
  const columnHelper = createColumnHelper<WorkOrderOperationalReportRow>();
  const statusColor = (status: string) => {
    if (status === 'COMPLETE') return 'success';
    if (status === 'EN_ROUTE' || status === 'ON_HOLD') return 'warning';
    if (status === 'IN_PROGRESS') return 'primary';
    return 'info';
  };
  const columns = useMemo<CustomDatagridColumn2<WorkOrderOperationalReportRow>[]>(
    () => [
      columnHelper.accessor('customId', {
        header: t('code'),
        size: 120
      }),
      columnHelper.accessor('title', {
        header: t('title'),
        size: 240
      }),
      columnHelper.accessor('customerNames', {
        header: t('customer'),
        size: 180,
        cell: (info) => info.getValue()?.join(', ') || '--'
      }),
      columnHelper.accessor('locationName', {
        header: t('location'),
        size: 180,
        cell: (info) => info.getValue() || '--'
      }),
      columnHelper.accessor('assetName', {
        header: t('camera_equipment'),
        size: 180,
        cell: (info) => info.getValue() || '--'
      }),
      columnHelper.accessor('technicianName', {
        header: t('primary_worker'),
        size: 180,
        cell: (info) => info.getValue() || '--'
      }),
      columnHelper.accessor('priority', {
        header: t('priority'),
        size: 130,
        cell: (info) => (
          <Chip size="small" variant="outlined" label={t(info.getValue())} />
        )
      }),
      columnHelper.accessor('status', {
        header: t('status'),
        size: 140,
        cell: (info) => (
          <Chip
            size="small"
            color={statusColor(info.getValue()) as any}
            label={t(info.getValue())}
          />
        )
      }),
      columnHelper.accessor('createdAt', {
        header: t('created_at'),
        size: 170,
        cell: (info) => (info.getValue() ? getFormattedDate(info.getValue()) : '--')
      }),
      columnHelper.accessor('completedOn', {
        header: t('completed_on'),
        size: 170,
        cell: (info) => (info.getValue() ? getFormattedDate(info.getValue()) : '--')
      }),
      columnHelper.accessor('checkInAt', {
        header: t('check_in'),
        size: 170,
        cell: (info) => (info.getValue() ? getFormattedDate(info.getValue()) : '--')
      }),
      columnHelper.accessor('checkOutAt', {
        header: t('check_out'),
        size: 170,
        cell: (info) => (info.getValue() ? getFormattedDate(info.getValue()) : '--')
      }),
      columnHelper.accessor('travelDurationSeconds', {
        header: t('travel_duration'),
        size: 150,
        cell: (info) => formatDuration(info.getValue())
      }),
      columnHelper.accessor('siteDurationSeconds', {
        header: t('site_duration'),
        size: 150,
        cell: (info) => formatDuration(info.getValue())
      }),
      columnHelper.accessor('totalFieldDurationSeconds', {
        header: t('total_field_duration'),
        size: 170,
        cell: (info) => formatDuration(info.getValue())
      }),
      columnHelper.accessor('fieldReport', {
        header: t('field_report'),
        size: 260,
        cell: (info) => info.getValue() || '--'
      }),
      columnHelper.accessor('filesCount', {
        header: t('files'),
        size: 100
      }),
      columnHelper.accessor('hasImage', {
        header: t('image'),
        size: 100,
        cell: (info) => (info.getValue() ? t('yes') : t('no'))
      }),
      columnHelper.accessor('hasSignature', {
        header: t('signature'),
        size: 120,
        cell: (info) => (info.getValue() ? t('yes') : t('no'))
      })
    ],
    [t, getFormattedDate]
  );

  return (
    <AnalyticsLayout>
      <Helmet>
        <title>{t('operational_work_order_report')}</title>
      </Helmet>
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h3">{t('operational_work_order_report')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('operational_work_order_report_subtitle')}
            </Typography>
          </Box>

          <Card variant="outlined" sx={{ boxShadow: 'none' }}>
            <CardContent>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 2 }}
              >
                <Box>
                  <Typography variant="h5">{t('report_filters')}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('report_filters_helper')}
                  </Typography>
                </Box>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={t('customer')}
                    value={filters.customerId}
                    onChange={handleFilterChange('customerId')}
                  >
                    <MenuItem value="">{t('ALL')}</MenuItem>
                    {customersMini.map((customer) => (
                      <MenuItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={t('location')}
                    value={filters.locationId}
                    onChange={handleFilterChange('locationId')}
                  >
                    <MenuItem value="">{t('ALL')}</MenuItem>
                    {locationsMini.map((location) => (
                      <MenuItem key={location.id} value={location.id}>
                        {location.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={t('camera_equipment')}
                    value={filters.assetId}
                    onChange={handleFilterChange('assetId')}
                  >
                    <MenuItem value="">{t('ALL')}</MenuItem>
                    {assetsMini.map((asset) => (
                      <MenuItem key={asset.id} value={asset.id}>
                        {asset.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={t('status')}
                    value={filters.status}
                    onChange={handleFilterChange('status')}
                  >
                    <MenuItem value="">{t('ALL')}</MenuItem>
                    {statusOptions.map((status) => (
                      <MenuItem key={status} value={status}>
                        {t(status)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={t('primary_worker')}
                    value={filters.primaryUserId}
                    onChange={handleFilterChange('primaryUserId')}
                  >
                    <MenuItem value="">{t('ALL')}</MenuItem>
                    {usersMini.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={t('period_field')}
                    value={filters.periodField}
                    onChange={handleFilterChange('periodField')}
                  >
                    {periodFieldOptions.map((periodField) => (
                      <MenuItem key={periodField} value={periodField}>
                        {t(periodField)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label={t('start_date')}
                    value={filters.start}
                    onChange={handleFilterChange('start')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label={t('end_date')}
                    value={filters.end}
                    onChange={handleFilterChange('end')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      startIcon={<RestartAltTwoToneIcon />}
                      onClick={handleClear}
                    >
                      {t('clear')}
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<SearchTwoToneIcon />}
                      onClick={handleApply}
                    >
                      {t('apply_filters')}
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {error && <Alert severity="error">{error}</Alert>}

          <Alert severity="info">{t('operational_report_page_summary_note')}</Alert>

          <Grid container spacing={2}>
            <Grid item xs={6} md={2}>
              <SummaryCard label={t('total')} value={summary.total} accent="secondary" />
            </Grid>
            <Grid item xs={6} md={2}>
              <SummaryCard label={t('OPEN')} value={summary.open} accent="info" />
            </Grid>
            <Grid item xs={6} md={2}>
              <SummaryCard label={t('EN_ROUTE')} value={summary.enRoute} accent="warning" />
            </Grid>
            <Grid item xs={6} md={2}>
              <SummaryCard label={t('IN_PROGRESS')} value={summary.inProgress} accent="primary" />
            </Grid>
            <Grid item xs={6} md={2}>
              <SummaryCard label={t('COMPLETE')} value={summary.complete} accent="success" />
            </Grid>
            <Grid item xs={6} md={2}>
              <SummaryCard label={t('with_field_report')} value={summary.withFieldReport} />
            </Grid>
          </Grid>

          <Card
            variant="outlined"
            sx={{
              boxShadow: 'none',
              overflow: 'hidden',
              '& > .MuiPaper-root': {
                height: { xs: 520, md: 600, xl: 680 },
                minHeight: { xs: 520, md: 600 }
              }
            }}
          >
            <CustomDatagrid2
              columns={columns}
              data={report.rows}
              notClickable
              loading={loading}
              pagination={pagination}
              onPaginationChange={handlePaginationChange}
              totalRows={report.page.totalElements}
              getRowId={(row) => row.id.toString()}
              noRowsMessage={t('no_operational_report_rows')}
              enableColumnReordering={false}
            />
          </Card>
        </Stack>
      </Box>
    </AnalyticsLayout>
  );
}

export default WorkOrderOperationalReport;
