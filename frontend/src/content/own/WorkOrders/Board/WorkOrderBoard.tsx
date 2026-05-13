import {
  Box,
  CircularProgress,
  Paper,
  alpha,
  Typography,
  styled,
  useTheme
} from '@mui/material';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'src/store';
import WorkOrderCard from './WorkOrderCard';
import {
  checkInWorkOrder,
  checkOutWorkOrder,
  departWorkOrder
} from '../../../../slices/workOrder';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { getCoordinates } from '../../../../utils/geolocation';
import { getErrorMessage } from '../../../../utils/api';
import useAuth from '../../../../hooks/useAuth';
import { PermissionEntity } from '../../../../models/owns/role';
import WorkOrder from '../../../../models/owns/workOrder';

const statusOrder = ['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE'];

function getStatusColors(status: string, theme: any) {
  switch (status) {
    case 'OPEN':
      return {
        headerBg: theme.colors.info.lighter,
        headerText: theme.colors.info.main,
        border: theme.colors.info.main
      };
    case 'EN_ROUTE':
      return {
        headerBg: theme.colors.warning.lighter,
        headerText: theme.colors.warning.main,
        border: theme.colors.warning.main
      };
    case 'IN_PROGRESS':
      return {
        headerBg: theme.colors.primary.lighter,
        headerText: theme.colors.primary.main,
        border: theme.colors.primary.main
      };
    case 'ON_HOLD':
      return {
        headerBg: theme.colors.warning.lighter,
        headerText: theme.colors.warning.dark,
        border: theme.colors.warning.dark
      };
    case 'COMPLETE':
      return {
        headerBg: theme.colors.success.lighter,
        headerText: theme.colors.success.main,
        border: theme.colors.success.main
      };
    default:
      return {
        headerBg: theme.colors.secondary.lighter,
        headerText: theme.colors.secondary.main,
        border: theme.colors.secondary.main
      };
  }
}

const BoardContainer = styled(Box)(
  ({ theme }) => `
    display: flex;
    gap: ${theme.spacing(2)};
    overflow-x: auto;
    padding: ${theme.spacing(2)} 0 ${theme.spacing(2.5)};
    min-height: 400px;
  `
);

const ColumnPaper = styled(Paper)(
  ({ theme }) => `
    min-width: 280px;
    max-width: 280px;
    display: flex;
    flex-direction: column;
    max-height: 70vh;
    border: 1px solid ${alpha(theme.colors.alpha.black[100], 0.08)};
    box-shadow: none;
    overflow: hidden;
  `
);

const ColumnHeader = styled(Box)(
  ({ theme }) => `
    padding: ${theme.spacing(1.5)};
    border-radius: ${theme.general.borderRadius} ${theme.general.borderRadius} 0 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `
);

const CardList = styled(Box)(
  ({ theme }) => `
    padding: ${theme.spacing(1.25)};
    overflow-y: auto;
    flex: 1;
    background: ${theme.palette.background.default};
  `
);

interface WorkOrderBoardProps {
  handleOpenDetails: (id: number) => void;
}

type QuickFieldAction = 'depart' | 'check-in' | 'check-out';

export default function WorkOrderBoard({ handleOpenDetails }: WorkOrderBoardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { hasEditPermission } = useAuth();
  const { workOrders, loadingGet } = useSelector((state) => state.workOrders);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleQuickAction = async (
    workOrder: WorkOrder,
    action: QuickFieldAction
  ) => {
    const actionKey = `${workOrder.id}-${action}`;
    setLoadingAction(actionKey);
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
            checkInAddress: null
          })
        );
      }

      if (action === 'check-out') {
        await dispatch(
          checkOutWorkOrder(workOrder.id, {
            checkOutLat: latitude ?? null,
            checkOutLng: longitude ?? null,
            checkOutAddress: null
          })
        );
      }

      showSnackBar(t('field_execution_updated'), 'success');
    } catch (error) {
      showSnackBar(getErrorMessage(error), 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const grouped = statusOrder.reduce<Record<string, typeof workOrders.content>>(
    (acc, status) => {
      acc[status] = workOrders.content.filter((wo) => wo.status === status);
      return acc;
    },
    {}
  );

  return (
    <BoardContainer>
      {loadingGet ? (
        <Box display="flex" justifyContent="center" alignItems="center" width="100%">
          <CircularProgress />
        </Box>
      ) : (
        statusOrder.map((status) => {
          const colors = getStatusColors(status, theme);
          const items = grouped[status] || [];
          return (
            <ColumnPaper key={status} elevation={1}>
              <ColumnHeader sx={{ backgroundColor: colors.headerBg, borderBottom: `2px solid ${colors.border}` }}>
                <Typography variant="subtitle2" fontWeight={700} color={colors.headerText}>
                  {t(status)}
                </Typography>
                <Box
                  sx={{
                    minWidth: 28,
                    height: 24,
                    px: 1,
                    borderRadius: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.paper',
                    color: colors.headerText,
                    fontWeight: 700
                  }}
                >
                  {items.length}
                </Box>
              </ColumnHeader>
              <CardList>
                {items.length === 0 ? (
                  <Box
                    sx={{
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1,
                      py: 4,
                      px: 1,
                      bgcolor: 'background.paper'
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
                      {t('no_results')}
                    </Typography>
                  </Box>
                ) : (
                  items.map((wo) => (
                    <WorkOrderCard
                      key={wo.id}
                      workOrder={wo}
                      onClick={handleOpenDetails}
                      onQuickAction={handleQuickAction}
                      loadingAction={loadingAction}
                      canRunActions={hasEditPermission(
                        PermissionEntity.WORK_ORDERS,
                        wo
                      )}
                    />
                  ))
                )}
              </CardList>
            </ColumnPaper>
          );
        })
      )}
    </BoardContainer>
  );
}
