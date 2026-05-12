import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import DirectionsRunTwoToneIcon from '@mui/icons-material/DirectionsRunTwoTone';
import LoginTwoToneIcon from '@mui/icons-material/LoginTwoTone';
import LogoutTwoToneIcon from '@mui/icons-material/LogoutTwoTone';
import SendTwoToneIcon from '@mui/icons-material/SendTwoTone';
import { ReactNode, useContext, useState } from 'react';
import WorkOrder from '../../../../models/owns/workOrder';
import { useDispatch } from '../../../../store';
import {
  checkInWorkOrder,
  checkOutWorkOrder,
  departWorkOrder
} from '../../../../slices/workOrder';
import { createComment } from '../../../../slices/comment';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { getErrorMessage } from '../../../../utils/api';

interface FieldExecutionSectionProps {
  workOrder: WorkOrder;
  canEdit: boolean;
  getFormattedDate: (date: string | Date) => string;
}

type FieldAction = 'depart' | 'check-in' | 'check-out' | 'comment';

const pendingText = 'Pendente';

const getCoordinates = (): Promise<{
  latitude?: number;
  longitude?: number;
}> => {
  if (!navigator.geolocation) return Promise.resolve({});

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude
        }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
};

const formatCoordinate = (value?: number | null): string =>
  typeof value === 'number' ? value.toFixed(6) : '-';

const formatDuration = (start?: string | null, end?: string | null): string => {
  if (!start || !end) return '-';

  const diffInSeconds = Math.max(
    0,
    Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  );
  const hours = Math.floor(diffInSeconds / 3600);
  const minutes = Math.floor((diffInSeconds % 3600) / 60);

  if (hours && minutes) return `${hours}h ${minutes}min`;
  if (hours) return `${hours}h`;
  return `${minutes}min`;
};

const getExecutionStatus = (workOrder: WorkOrder): string => {
  if (workOrder.checkOutAt) return 'Finalizado em campo';
  if (workOrder.checkInAt) return 'No local';
  if (workOrder.departureAt) return 'Em deslocamento';
  return 'Não iniciado';
};

export default function FieldExecutionSection({
  workOrder,
  canEdit,
  getFormattedDate
}: FieldExecutionSectionProps) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [loadingAction, setLoadingAction] = useState<FieldAction | null>(null);
  const [checkInAddress, setCheckInAddress] = useState<string>(
    workOrder.checkInAddress ?? ''
  );
  const [checkOutAddress, setCheckOutAddress] = useState<string>(
    workOrder.checkOutAddress ?? ''
  );
  const [fieldReport, setFieldReport] = useState<string>('');

  const runAction = async (action: FieldAction) => {
    setLoadingAction(action);
    try {
      const { latitude, longitude } = await getCoordinates();

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

      showSnackBar('Execução em campo atualizada', 'success');
    } catch (err) {
      showSnackBar(getErrorMessage(err), 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const submitFieldReport = async () => {
    if (!fieldReport.trim()) return;

    setLoadingAction('comment');
    try {
      await dispatch(
        createComment({
          workOrder: { id: workOrder.id },
          content: `[Relato em campo] ${fieldReport.trim()}`,
          files: []
        })
      );
      setFieldReport('');
      showSnackBar('Relato em campo registrado', 'success');
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
    <Grid item xs={12} sm={6} md={4}>
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600}>
        {value || '-'}
      </Typography>
    </Grid>
  );

  const ActionButton = ({
    action,
    disabled,
    icon,
    label
  }: {
    action: FieldAction;
    disabled: boolean;
    icon: ReactNode;
    label: string;
  }) => (
    <Button
      variant="contained"
      startIcon={
        loadingAction === action ? <CircularProgress size="1rem" /> : icon
      }
      disabled={!canEdit || disabled || !!loadingAction}
      onClick={() => runAction(action)}
    >
      {label}
    </Button>
  );

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h3">Execução em Campo</Typography>
        <Typography variant="body2" color="text.secondary">
          Acompanhe deslocamento, chegada, saída e relato do atendimento.
        </Typography>
      </Box>

      <Box
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`
        }}
      >
        <Grid container spacing={2}>
          <FieldValue
            label="Status da execução"
            value={getExecutionStatus(workOrder)}
          />
          <FieldValue
            label="Duração do deslocamento"
            value={formatDuration(workOrder.departureAt, workOrder.checkInAt)}
          />
          <FieldValue
            label="Duração no local"
            value={formatDuration(workOrder.checkInAt, workOrder.checkOutAt)}
          />
        </Grid>
      </Box>

      <Grid container spacing={2}>
        <FieldValue
          label="Início de deslocamento"
          value={
            workOrder.departureAt
              ? getFormattedDate(workOrder.departureAt)
              : pendingText
          }
        />
        <FieldValue
          label="Latitude saída"
          value={formatCoordinate(workOrder.departureLat)}
        />
        <FieldValue
          label="Longitude saída"
          value={formatCoordinate(workOrder.departureLng)}
        />
        <FieldValue
          label="Check-in"
          value={
            workOrder.checkInAt
              ? getFormattedDate(workOrder.checkInAt)
              : pendingText
          }
        />
        <FieldValue
          label="Latitude check-in"
          value={formatCoordinate(workOrder.checkInLat)}
        />
        <FieldValue
          label="Longitude check-in"
          value={formatCoordinate(workOrder.checkInLng)}
        />
        <FieldValue
          label="Endereço check-in"
          value={workOrder.checkInAddress || '-'}
        />
        <FieldValue
          label="Check-out"
          value={
            workOrder.checkOutAt
              ? getFormattedDate(workOrder.checkOutAt)
              : pendingText
          }
        />
        <FieldValue
          label="Latitude check-out"
          value={formatCoordinate(workOrder.checkOutLat)}
        />
        <FieldValue
          label="Longitude check-out"
          value={formatCoordinate(workOrder.checkOutLng)}
        />
        <FieldValue
          label="Endereço check-out"
          value={workOrder.checkOutAddress || '-'}
        />
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <ActionButton
            action="depart"
            disabled={!!workOrder.departureAt}
            icon={<DirectionsRunTwoToneIcon />}
            label="Iniciar deslocamento"
          />
          <ActionButton
            action="check-in"
            disabled={!!workOrder.checkInAt}
            icon={<LoginTwoToneIcon />}
            label="Check-in"
          />
          <ActionButton
            action="check-out"
            disabled={!workOrder.checkInAt || !!workOrder.checkOutAt}
            icon={<LogoutTwoToneIcon />}
            label="Check-out"
          />
        </Stack>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Endereço do check-in"
              value={checkInAddress}
              disabled={!!workOrder.checkInAt || !canEdit}
              onChange={(event) => setCheckInAddress(event.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Endereço do check-out"
              value={checkOutAddress}
              disabled={!!workOrder.checkOutAt || !canEdit}
              onChange={(event) => setCheckOutAddress(event.target.value)}
            />
          </Grid>
        </Grid>

        <TextField
          fullWidth
          multiline
          minRows={3}
          label="Relato em campo"
          placeholder="Descreva o que foi observado ou executado em campo"
          value={fieldReport}
          disabled={!canEdit}
          onChange={(event) => setFieldReport(event.target.value)}
        />
        <Box display="flex" justifyContent="flex-end">
          <Button
            variant="outlined"
            startIcon={
              loadingAction === 'comment' ? (
                <CircularProgress size="1rem" />
              ) : (
                <SendTwoToneIcon />
              )
            }
            disabled={!canEdit || !fieldReport.trim() || !!loadingAction}
            onClick={submitFieldReport}
          >
            Registrar relato
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
