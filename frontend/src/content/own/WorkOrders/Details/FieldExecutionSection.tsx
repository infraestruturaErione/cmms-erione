import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import DirectionsRunTwoToneIcon from '@mui/icons-material/DirectionsRunTwoTone';
import LoginTwoToneIcon from '@mui/icons-material/LoginTwoTone';
import LogoutTwoToneIcon from '@mui/icons-material/LogoutTwoTone';
import { ReactNode, useContext, useEffect, useState } from 'react';
import WorkOrder from '../../../../models/owns/workOrder';
import { useDispatch } from '../../../../store';
import {
  checkInWorkOrder,
  checkOutWorkOrder,
  departWorkOrder
} from '../../../../slices/workOrder';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { getCoordinates } from '../../../../utils/geolocation';
import { getErrorMessage } from '../../../../utils/api';
import FieldExecutionTimeline from './FieldExecutionTimeline';
import { useTranslation } from 'react-i18next';
import {
  formatDistanceLabel,
  formatDurationSeconds,
  getDistanceInMeters,
  getFieldDurations,
  getFieldExecutionSummary,
  RecommendedFieldActionType
} from '../fieldExecutionRules';

interface FieldExecutionSectionProps {
  workOrder: WorkOrder;
  canEdit: boolean;
  getFormattedDate: (date: string | Date) => string;
}

type FieldAction = 'depart' | 'check-in' | 'check-out';

const fieldActionTypes: RecommendedFieldActionType[] = [
  'depart',
  'check-in',
  'check-out'
];

// Aba "Execucao": timeline horizontal no topo, depois status/acao compacta e
// detalhes de deslocamento/check-in/check-out. Relato escrito, assinatura e
// evidencias/fotos ficam na aba "Relato e Evidencias" (FieldReportSection).
export default function FieldExecutionSection({
  workOrder,
  canEdit,
  getFormattedDate
}: FieldExecutionSectionProps) {
  const dispatch = useDispatch();
  const { t }: { t: any } = useTranslation();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [loadingAction, setLoadingAction] = useState<FieldAction | null>(null);
  const [checkInAddress, setCheckInAddress] = useState<string>(
    workOrder.checkInAddress ?? ''
  );
  const [checkOutAddress, setCheckOutAddress] = useState<string>(
    workOrder.checkOutAddress ?? ''
  );
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const runAction = async (action: FieldAction) => {
    setLoadingAction(action);
    try {
      const { latitude, longitude, error: geoError } = await getCoordinates();

      if (geoError) {
        showSnackBar(t(geoError), 'error');
      }

      if (action === 'depart') {
        await dispatch(
          departWorkOrder(workOrder.id, {
            departureLat: latitude ?? null,
            departureLng: longitude ?? null
          })
        );
      }

      if (action === 'check-in') {
        await dispatch(
          checkInWorkOrder(workOrder.id, {
            checkInLat: latitude ?? null,
            checkInLng: longitude ?? null,
            checkInAddress: checkInAddress.trim() || null
          })
        );
      }

      if (action === 'check-out') {
        await dispatch(
          checkOutWorkOrder(workOrder.id, {
            checkOutLat: latitude ?? null,
            checkOutLng: longitude ?? null,
            checkOutAddress: checkOutAddress.trim() || null
          })
        );
      }

      showSnackBar(t('field_execution_updated'), 'success');
    } catch (err) {
      showSnackBar(getErrorMessage(err), 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const FieldValue = ({
    label,
    value
  }: {
    label: string;
    value?: string | number | null;
  }) => (
    <Grid item xs={6} sm={3}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value || '-'}
      </Typography>
    </Grid>
  );

  const summary = getFieldExecutionSummary(workOrder);
  const durations = getFieldDurations(workOrder, now);
  const recommendedAction = summary.recommendedAction;
  const isRunnableFieldAction = fieldActionTypes.includes(
    recommendedAction.type
  );

  const getActionIcon = (action: RecommendedFieldActionType): ReactNode => {
    if (action === 'depart') return <DirectionsRunTwoToneIcon />;
    if (action === 'check-in') return <LoginTwoToneIcon />;
    if (action === 'check-out') return <LogoutTwoToneIcon />;
    return null;
  };

  return (
    <Box>
      <FieldExecutionTimeline
        workOrder={workOrder}
        getFormattedDate={getFormattedDate}
      />

      <Divider sx={{ my: 2 }} />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            size="small"
            color={
              summary.osCompleted || summary.fieldFinished ? 'success' : 'primary'
            }
            variant={summary.osCompleted ? 'filled' : 'outlined'}
            label={
              summary.osCompleted ? t('work_order_completed') : t(summary.statusKey)
            }
          />
          <Typography variant="body2" color="text.secondary">
            {recommendedAction.helperKey
              ? t(recommendedAction.helperKey)
              : t('next_action_open_work_order_helper')}
          </Typography>
        </Stack>
        {isRunnableFieldAction && (
          <Button
            variant="contained"
            size="small"
            startIcon={
              loadingAction === recommendedAction.type ? (
                <CircularProgress size="1rem" />
              ) : (
                getActionIcon(recommendedAction.type)
              )
            }
            disabled={!canEdit || !!loadingAction}
            onClick={() => runAction(recommendedAction.type as FieldAction)}
          >
            {t(recommendedAction.labelKey)}
          </Button>
        )}
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {t('field_execution_details')}
      </Typography>
      <Grid container spacing={1.5}>
        <FieldValue
          label={t('travel_started')}
          value={
            workOrder.departureAt
              ? getFormattedDate(workOrder.departureAt)
              : t('pending_step')
          }
        />
        <FieldValue
          label={t('check_in')}
          value={
            workOrder.checkInAt ? getFormattedDate(workOrder.checkInAt) : t('pending_step')
          }
        />
        <FieldValue
          label={t('check_in_distance')}
          value={formatDistanceLabel(
            getDistanceInMeters(
              workOrder.checkInLat,
              workOrder.checkInLng,
              workOrder.location?.latitude,
              workOrder.location?.longitude
            )
          )}
        />
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            size="small"
            label={t('check_in_address')}
            value={checkInAddress}
            disabled={!!workOrder.checkInAt || !canEdit}
            onChange={(event) => setCheckInAddress(event.target.value)}
          />
        </Grid>

        <FieldValue
          label={t('check_out')}
          value={
            workOrder.checkOutAt ? getFormattedDate(workOrder.checkOutAt) : t('pending_step')
          }
        />
        <FieldValue
          label={t('check_out_distance')}
          value={formatDistanceLabel(
            getDistanceInMeters(
              workOrder.checkOutLat,
              workOrder.checkOutLng,
              workOrder.location?.latitude,
              workOrder.location?.longitude
            )
          )}
        />
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            size="small"
            label={t('check_out_address')}
            value={checkOutAddress}
            disabled={!!workOrder.checkOutAt || !canEdit}
            onChange={(event) => setCheckOutAddress(event.target.value)}
          />
        </Grid>

        <FieldValue
          label={t('travel_duration')}
          value={formatDurationSeconds(
            durations.travel.seconds,
            durations.travel.inProgress,
            t
          )}
        />
        <FieldValue
          label={t('site_duration')}
          value={formatDurationSeconds(
            durations.site.seconds,
            durations.site.inProgress,
            t
          )}
        />
        <FieldValue
          label={t('total_field_duration')}
          value={formatDurationSeconds(
            durations.total.seconds,
            durations.total.inProgress,
            t
          )}
        />

        {workOrder.completedOn && (
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              {t('finalization')}
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {t('field_execution_finalized_line', {
                date: getFormattedDate(workOrder.completedOn),
                user: workOrder.completedBy
                  ? `${workOrder.completedBy.firstName} ${workOrder.completedBy.lastName}`
                  : t('unknown')
              })}
            </Typography>
          </Grid>
        )}

        {workOrder.mileageTraveled != null && (
          <FieldValue
            label={t('mileage_traveled')}
            value={`${workOrder.mileageTraveled} km`}
          />
        )}
      </Grid>
    </Box>
  );
}
