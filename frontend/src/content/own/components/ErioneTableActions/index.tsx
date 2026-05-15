import { ReactNode } from 'react';
import { IconButton, Stack, Tooltip } from '@mui/material';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';

export interface ActionItem {
  icon: ReactNode;
  tooltip: string;
  onClick: () => void;
  color?: 'primary' | 'error' | 'inherit' | 'default' | 'warning';
  disabled?: boolean;
}

interface ErioneTableActionsProps {
  actions: ActionItem[];
}

const ACTION_SX = {
  padding: 0.5,
  '&:hover': { backgroundColor: 'transparent', opacity: 0.8 }
};

const ErioneTableActions = ({ actions }: ErioneTableActionsProps) => (
  <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={0.3}>
    {actions.map((action, idx) => (
      <Tooltip key={idx} title={action.tooltip} arrow>
        <span>
          <IconButton
            size="small"
            onClick={action.onClick}
            color={action.color ?? 'primary'}
            disabled={action.disabled}
            sx={ACTION_SX}
            aria-label={action.tooltip}
          >
            {action.icon}
          </IconButton>
        </span>
      </Tooltip>
    ))}
  </Stack>
);

export const editAction = (
  onClick: () => void,
  tooltip = 'Editar',
  disabled?: boolean
): ActionItem => ({
  icon: <EditTwoToneIcon sx={{ fontSize: 18 }} />,
  tooltip,
  onClick,
  color: 'primary',
  disabled
});

export const viewAction = (
  onClick: () => void,
  tooltip: string,
  disabled?: boolean
): ActionItem => ({
  icon: <OpenInNewTwoToneIcon sx={{ fontSize: 18 }} />,
  tooltip,
  onClick,
  color: 'primary',
  disabled
});

export const createWorkOrderAction = (
  onClick: () => void,
  tooltip = 'Criar OS',
  disabled?: boolean
): ActionItem => ({
  icon: <AssignmentTwoToneIcon sx={{ fontSize: 18 }} />,
  tooltip,
  onClick,
  color: 'primary',
  disabled
});

export const addAction = (
  onClick: () => void,
  tooltip: string,
  disabled?: boolean
): ActionItem => ({
  icon: <AddTwoToneIcon sx={{ fontSize: 18 }} />,
  tooltip,
  onClick,
  color: 'primary',
  disabled
});

export const deleteAction = (
  onClick: () => void,
  tooltip = 'Excluir',
  disabled?: boolean
): ActionItem => ({
  icon: <DeleteTwoToneIcon sx={{ fontSize: 18 }} />,
  tooltip,
  onClick,
  color: 'error',
  disabled
});

export default ErioneTableActions;
