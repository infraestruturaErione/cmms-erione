import { Card, Box, Typography, styled } from '@mui/material';
import { useTranslation } from 'react-i18next';
import WorkOrder from 'src/models/owns/workOrder';
import PriorityWrapper from '../../components/PriorityWrapper';

const CardWrapper = styled(Card)(
  ({ theme }) => `
    padding: ${theme.spacing(1.5)};
    margin-bottom: ${theme.spacing(1)};
    cursor: pointer;
    transition: box-shadow 0.2s ease;
    &:hover {
      box-shadow: ${theme.shadows[4]};
    }
  `
);

const MetaRow = styled(Box)(
  ({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
    margin-top: ${theme.spacing(0.5)};
  `
);

interface WorkOrderCardProps {
  workOrder: WorkOrder;
  onClick: (id: number) => void;
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

export default function WorkOrderCard({ workOrder, onClick }: WorkOrderCardProps) {
  const { t } = useTranslation();

  const isOverdue =
    !!workOrder.dueDate &&
    new Date(workOrder.dueDate) < new Date() &&
    workOrder.status !== 'COMPLETE' &&
    workOrder.status !== 'ON_HOLD';

  return (
    <CardWrapper onClick={() => onClick(workOrder.id)}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {workOrder.customId}
        </Typography>
        <PriorityWrapper priority={workOrder.priority} />
      </Box>
      <Typography variant="body2" fontWeight={600} noWrap>
        {workOrder.title}
      </Typography>
      <Box mt={1}>
        {workOrder.customers?.[0] && (
          <MetaRow>
            <Typography variant="caption" color="text.secondary" noWrap>
              {workOrder.customers[0].name}
            </Typography>
          </MetaRow>
        )}
        {workOrder.location && (
          <MetaRow>
            <Typography variant="caption" color="text.secondary" noWrap>
              {workOrder.location.name}
            </Typography>
          </MetaRow>
        )}
        {workOrder.asset && (
          <MetaRow>
            <Typography variant="caption" color="text.secondary" noWrap>
              {workOrder.asset.name}
            </Typography>
          </MetaRow>
        )}
        {workOrder.primaryUser && (
          <MetaRow>
            <Typography variant="caption" color="text.secondary" noWrap>
              {workOrder.primaryUser.firstName} {workOrder.primaryUser.lastName}
            </Typography>
          </MetaRow>
        )}
        {workOrder.dueDate && (
          <MetaRow>
            <Typography
              variant="caption"
              color={isOverdue ? 'error' : 'text.secondary'}
              fontWeight={isOverdue ? 600 : 400}
              noWrap
            >
              {formatDate(workOrder.dueDate)}
              {isOverdue && ` \u2022 ${t('overdue')}`}
            </Typography>
          </MetaRow>
        )}
      </Box>
    </CardWrapper>
  );
}
