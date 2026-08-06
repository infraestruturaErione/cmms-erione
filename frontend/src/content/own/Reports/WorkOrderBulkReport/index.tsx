import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useContext, useEffect, useState } from 'react';
import CloudDownloadTwoToneIcon from '@mui/icons-material/CloudDownloadTwoTone';
import PictureAsPdfTwoToneIcon from '@mui/icons-material/PictureAsPdfTwoTone';
import { TitleContext } from '../../../../contexts/TitleContext';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { useDispatch, useSelector } from '../../../../store';
import { getCustomersMini } from '../../../../slices/customer';
import {
  getBulkPDFReport,
  getBulkPDFReportHistory,
  downloadBulkPDFReportFromHistory
} from '../../../../slices/workOrder';
import { GeneratedReport } from '../../../../models/owns/generatedReport';
import { WorkOrderOperationalReportPeriodField } from '../../../../models/owns/workOrderOperationalReport';
import { getErrorMessage } from '../../../../utils/api';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import AnalyticsLayout from '../../Analytics/AnalyticsLayout';

const periodFieldOptions: WorkOrderOperationalReportPeriodField[] = [
  'CREATED_AT',
  'COMPLETED_ON',
  'CHECK_IN_AT'
];

type BulkFilters = {
  cnpj: string;
  customerId: string;
  periodField: WorkOrderOperationalReportPeriodField;
  start: string;
  end: string;
};

const defaultBulkFilters: BulkFilters = {
  cnpj: '',
  customerId: '',
  periodField: 'COMPLETED_ON',
  start: '',
  end: ''
};

function toIsoStart(value: string): string {
  return value ? `${value}T00:00:00.000Z` : null;
}

function toIsoEnd(value: string): string {
  return value ? `${value}T23:59:59.999Z` : null;
}

function WorkOrderBulkReport() {
  const { t }: { t: any } = useTranslation();
  const dispatch = useDispatch();
  const { setTitle } = useContext(TitleContext);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { getFormattedDate } = useContext(CompanySettingsContext);
  const { customersMini } = useSelector((state) => state.customers);

  const [filters, setFilters] = useState<BulkFilters>(defaultBulkFilters);
  const [generating, setGenerating] = useState<boolean>(false);
  const [history, setHistory] = useState<GeneratedReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Selecionar qualquer cliente do dropdown sempre funciona - nao existe
  // bloqueio por falta de cidade. O backend decide sozinho: se o cliente
  // escolhido tem Customer.city preenchido, agrupa todos os clientes daquela
  // cidade; se nao tem, usa so o cliente escolhido.

  useEffect(() => {
    setTitle(t('bulk_report_history'));
    dispatch(getCustomersMini());
    loadHistory();
  }, []);

  const loadHistory = () => {
    setLoadingHistory(true);
    dispatch(getBulkPDFReportHistory())
      .then((rows: GeneratedReport[]) => setHistory(rows))
      .catch((err) => showSnackBar(getErrorMessage(err), 'error'))
      .finally(() => setLoadingHistory(false));
  };

  const handleGenerate = () => {
    if (!filters.customerId) return;
    if (!filters.start || !filters.end) {
      showSnackBar(t('bulk_report_period_required'), 'error');
      return;
    }
    setGenerating(true);
    dispatch(
      getBulkPDFReport({
        customerId: Number(filters.customerId),
        cnpj: filters.cnpj.trim() || undefined,
        periodField: filters.periodField,
        start: toIsoStart(filters.start),
        end: toIsoEnd(filters.end)
      })
    )
      .then((url: string) => {
        window.open(url);
        loadHistory();
      })
      .catch((err) => showSnackBar(getErrorMessage(err), 'error'))
      .finally(() => setGenerating(false));
  };

  const handleDownload = (id: number) => {
    setDownloadingId(id);
    dispatch(downloadBulkPDFReportFromHistory(id))
      .then((url: string) => window.open(url))
      .catch((err) => showSnackBar(getErrorMessage(err), 'error'))
      .finally(() => setDownloadingId(null));
  };

  const statusLabel = (report: GeneratedReport) => {
    if (!report.available) return t('bulk_report_status_expired');
    if (report.status === 'DONE') return t('bulk_report_status_done');
    if (report.status === 'PROCESSING') return t('bulk_report_status_processing');
    if (report.status === 'FAILED') return t('bulk_report_status_failed');
    return t('bulk_report_status_queued');
  };

  const statusColor = (report: GeneratedReport): 'success' | 'warning' | 'error' | 'default' => {
    if (!report.available) return 'default';
    if (report.status === 'DONE') return 'success';
    if (report.status === 'FAILED') return 'error';
    return 'warning';
  };

  return (
    <AnalyticsLayout>
      <Helmet>
        <title>{t('bulk_report_history')}</title>
      </Helmet>
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h3">{t('bulk_report_history')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('bulk_report_history_subtitle')}
            </Typography>
          </Box>

          <Card variant="outlined" sx={{ boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="h5">{t('bulk_report_by_city_title')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('bulk_report_by_city_helper')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label={t('cnpj')}
                    placeholder={t('cnpj_placeholder')}
                    value={filters.cnpj}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, cnpj: event.target.value }))
                    }
                    helperText={t('cnpj_optional_helper')}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={t('customer')}
                    value={filters.customerId}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, customerId: event.target.value }))
                    }
                  >
                    <MenuItem value="">{t('select')}</MenuItem>
                    {customersMini.map((customer) => (
                      <MenuItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={t('period_field')}
                    value={filters.periodField}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        periodField: event.target.value as WorkOrderOperationalReportPeriodField
                      }))
                    }
                  >
                    {periodFieldOptions.map((periodField) => (
                      <MenuItem key={periodField} value={periodField}>
                        {t(periodField)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    required
                    fullWidth
                    size="small"
                    type="date"
                    label={t('start_date')}
                    value={filters.start}
                    error={!filters.start}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, start: event.target.value }))
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    required
                    fullWidth
                    size="small"
                    type="date"
                    label={t('end_date')}
                    value={filters.end}
                    error={!filters.end}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, end: event.target.value }))
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Stack direction="row" justifyContent="flex-end">
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={
                        generating ? <CircularProgress size={18} /> : <PictureAsPdfTwoToneIcon />
                      }
                      onClick={handleGenerate}
                      disabled={generating || !filters.customerId || !filters.start || !filters.end}
                    >
                      {t('generate_bulk_report')}
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Alert severity="info" icon={<CloudDownloadTwoToneIcon fontSize="inherit" />}>
            <AlertTitle>{t('bulk_report_download_center_title')}</AlertTitle>
            {t('bulk_report_download_center_info')}
          </Alert>

          <Card variant="outlined" sx={{ boxShadow: 'none' }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('bulk_report_column_request')}</TableCell>
                    <TableCell>{t('bulk_report_column_description')}</TableCell>
                    <TableCell>{t('bulk_report_column_requested_at')}</TableCell>
                    <TableCell>{t('bulk_report_column_status')}</TableCell>
                    <TableCell align="right">{t('bulk_report_column_download')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((report) => (
                    <TableRow key={report.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {t('bulk_report_history')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('bulk_report_requested_by', {
                            name: report.requestedByName || '--'
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell>{report.description}</TableCell>
                      <TableCell>{getFormattedDate(report.requestedAt)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={statusColor(report)}
                          label={statusLabel(report)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          disabled={!report.available || downloadingId === report.id}
                          startIcon={
                            downloadingId === report.id ? (
                              <CircularProgress size={16} />
                            ) : (
                              <CloudDownloadTwoToneIcon fontSize="small" />
                            )
                          }
                          onClick={() => handleDownload(report.id)}
                        >
                          {t('download')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loadingHistory && !history.length && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 3, textAlign: 'center' }}
                        >
                          {t('bulk_report_history_empty')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Stack>
      </Box>
    </AnalyticsLayout>
  );
}

export default WorkOrderBulkReport;
