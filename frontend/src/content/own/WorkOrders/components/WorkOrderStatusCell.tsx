import { Box, Typography } from '@mui/material';
import CircleTwoToneIcon from '@mui/icons-material/CircleTwoTone';

type Props = {
  status: string;
  t: (key: string) => string;
};

export default function WorkOrderStatusCell({ status, t }: Props) {
  return (
    <Box display="flex" flexDirection="row" alignItems="center">
      <CircleTwoToneIcon
        fontSize="small"
        color={
          status === 'IN_PROGRESS'
            ? 'success'
            : status === 'ON_HOLD'
            ? 'warning'
            : status === 'COMPLETE'
            ? 'info'
            : 'secondary'
        }
      />
      <Typography sx={{ ml: 1 }}>{t(status)}</Typography>
    </Box>
  );
}
