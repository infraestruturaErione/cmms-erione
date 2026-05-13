import {
  alpha,
  Button,
  Card,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  styled
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import WorkOrder from 'src/models/owns/workOrder';
import PriorityWrapper from '../../components/PriorityWrapper';
import BusinessTwoToneIcon from '@mui/icons-material/BusinessTwoTone';
import LocationOnTwoToneIcon from '@mui/icons-material/LocationOnTwoTone';
import VideocamTwoToneIcon from '@mui/icons-material/VideocamTwoTone';
import PersonTwoToneIcon from '@mui/icons-material/PersonTwoTone';
import ScheduleTwoToneIcon from '@mui/icons-material/ScheduleTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import DirectionsRunTwoToneIcon from '@mui/icons-material/DirectionsRunTwoTone';
import LoginTwoToneIcon from '@mui/icons-material/LoginTwoTone';
import LogoutTwoToneIcon from '@mui/icons-material/LogoutTwoTone';

const CardWrapper = styled(Card)(
  ({ theme }) => `
    padding: ${theme.spacing(1.5)};
    margin-bottom: ${theme.spacing(1.25)};
    cursor: pointer;
    border: 1px solid ${alpha(theme.colors.alpha.black[100], 0.08)};
    box-shadow: none;
    transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
    &:hover {
      border-color: ${alpha(theme.colors.primary.main, 0.35)};
      box-shadow: ${theme.shadows[4]};
      transform: translateY(-1px);
    }
  `
);

const MetaRow = styled(Box)(
  ({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.75)};
    margin-top: ${theme.spacing(0.65)};
    color: ${theme.palette.text.secondary};

    svg {
      font-size: 16px;
      flex: 0 0 auto;
    }
  `
);

const MetaText = styled(Typography)`
  min-width: 0;
`;

interface WorkOrderCardProps {
  workOrder: WorkOrder;
  onClick: (id: number) => void;
  onQuickAction: (
    workOrder: WorkOrder,
    action: 'depart' | 'check-in' | 'check-out'
  ) => void;
  loadingAction?: string | null;
  canRunActions?: boolean;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

const finalStatuses = ['COMPLETE', 'CLOSED', 'CANCELLED'];

export default function WorkOrderCard({
  workOrder,
  onClick,
  onQuickAction,
  loadingAction,
  canRunActions = false
}: WorkOrderCardProps) {
  const { t } = useTranslation();
  const isFinalStatus = finalStatuses.includes(workOrder.status);
  const actionLoadingPrefix = `${workOrder.id}-`;
  const isLoadingThisCard = loadingAction?.startsWith(actionLoadingPrefix);

  const isOverdue =
    !!workOrder.dueDate &&
    new Date(workOrder.dueDate) < new Date() &&
    workOrder.status !== 'COMPLETE' &&
    workOrder.status !== 'ON_HOLD';

  const getNextAction = ():
    | { action: 'depart' | 'check-in' | 'check-out'; label: string; icon: JSX.Element }
    | null => {
    if (!canRunActions || isFinalStatus) return null;
    if (!workOrder.departureAt) {
      return {
        action: 'depart',
        label: t('start_travel'),
        icon: <DirectionsRunTwoToneIcon fontSize="small" />
      };
    }
    if (!workOrder.checkInAt) {
      return {
        action: 'check-in',
        label: t('make_check_in'),
        icon: <LoginTwoToneIcon fontSize="small" />
      };
    }
    if (!workOrder.checkOutAt) {
      return {
        action: 'check-out',
        label: t('make_check_out'),
        icon: <LogoutTwoToneIcon fontSize="small" />
      };
    }
    return null;
  };

  const nextAction = getNextAction();
  const isFieldFinished = !!workOrder.checkOutAt;

  return (
    <CardWrapper onClick={() => onClick(workOrder.id)}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.75}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {workOrder.customId}
        </Typography>
        <PriorityWrapper priority={workOrder.priority} />
      </Box>
      <Typography variant="body2" fontWeight={700} noWrap title={workOrder.title}>
        {workOrder.title}
      </Typography>
      <Box mt={1}>
        {workOrder.customers?.[0] && (
          <MetaRow>
            <BusinessTwoToneIcon />
            <MetaText variant="caption" noWrap>
              {workOrder.customers[0].name}
            </MetaText>
          </MetaRow>
        )}
        {workOrder.location && (
          <MetaRow>
            <LocationOnTwoToneIcon />
            <MetaText variant="caption" noWrap>
              {workOrder.location.name}
            </MetaText>
          </MetaRow>
        )}
        {workOrder.asset && (
          <MetaRow>
            <VideocamTwoToneIcon />
            <MetaText variant="caption" noWrap>
              {workOrder.asset.name}
            </MetaText>
          </MetaRow>
        )}
        {workOrder.primaryUser && (
          <MetaRow>
            <PersonTwoToneIcon />
            <MetaText variant="caption" noWrap>
              {workOrder.primaryUser.firstName} {workOrder.primaryUser.lastName}
            </MetaText>
          </MetaRow>
        )}
        {workOrder.dueDate && (
          <MetaRow>
            <ScheduleTwoToneIcon />
            <Stack direction="row" spacing={0.75} alignItems="center" minWidth={0}>
              <MetaText
                variant="caption"
                color={isOverdue ? 'error' : 'text.secondary'}
                fontWeight={isOverdue ? 700 : 500}
                noWrap
              >
                {formatDate(workOrder.dueDate)}
              </MetaText>
              {isOverdue && (
                <Chip
                  size="small"
                  color="error"
                  label={t('overdue')}
                  sx={{ height: 20, fontSize: 11 }}
                />
              )}
            </Stack>
          </MetaRow>
        )}
      </Box>
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mt: 1.5 }}
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          size="small"
          variant="text"
          startIcon={<OpenInNewTwoToneIcon fontSize="small" />}
          onClick={() => onClick(workOrder.id)}
          sx={{ minWidth: 0, px: 0.75 }}
        >
          {t('open_work_order')}
        </Button>
        {nextAction ? (
          <Button
            size="small"
            variant="outlined"
            disabled={!!loadingAction}
            startIcon={
              loadingAction === `${workOrder.id}-${nextAction.action}` ? (
                <CircularProgress size="0.875rem" />
              ) : (
                nextAction.icon
              )
            }
            onClick={() => onQuickAction(workOrder, nextAction.action)}
            sx={{ minWidth: 0, px: 0.75 }}
          >
            {nextAction.label}
          </Button>
        ) : (
          isFieldFinished && (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={t('field_finished')}
            />
          )
        )}
        {isLoadingThisCard && !nextAction && <CircularProgress size="1rem" />}
      </Stack>
    </CardWrapper>
  );
}
