import {
  Box,
  CircularProgress,
  Paper,
  Typography,
  styled,
  useTheme
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'src/store';
import WorkOrderCard from './WorkOrderCard';

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
    padding: ${theme.spacing(2)} 0;
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
    padding: ${theme.spacing(1)};
    overflow-y: auto;
    flex: 1;
  `
);

interface WorkOrderBoardProps {
  handleOpenDetails: (id: number) => void;
}

export default function WorkOrderBoard({ handleOpenDetails }: WorkOrderBoardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { workOrders, loadingGet } = useSelector((state) => state.workOrders);

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
                <Typography variant="caption" fontWeight={600} color={colors.headerText}>
                  {items.length}
                </Typography>
              </ColumnHeader>
              <CardList>
                {items.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" display="block" textAlign="center" py={4}>
                    {t('no_results')}
                  </Typography>
                ) : (
                  items.map((wo) => (
                    <WorkOrderCard key={wo.id} workOrder={wo} onClick={handleOpenDetails} />
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
