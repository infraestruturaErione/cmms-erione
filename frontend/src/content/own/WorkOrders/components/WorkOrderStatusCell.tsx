import { alpha, Box, useTheme } from '@mui/material';

type Props = {
  status: string;
  t: (key: string) => string;
};

// Chip suave (fundo claro + texto na mesma cor) em vez de bolinha + texto solto:
// le mais rapido numa lista densa e mantem o mesmo vocabulario visual dos chips
// de prioridade. Usado tambem no preview do calendario.
const getStatusColor = (status: string, theme: any): string => {
  switch (status) {
    case 'IN_PROGRESS':
    case 'EN_ROUTE':
      return theme.colors.success.main;
    case 'ON_HOLD':
      return theme.colors.warning.main;
    case 'COMPLETE':
      return theme.colors.info.main;
    default:
      return theme.colors.primary.main;
  }
};

export default function WorkOrderStatusCell({ status, t }: Props) {
  const theme = useTheme();
  const color = getStatusColor(status, theme);

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        borderRadius: 5,
        bgcolor: alpha(color, 0.12),
        color,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.2,
        whiteSpace: 'nowrap'
      }}
    >
      <Box
        component="span"
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: color,
          flexShrink: 0
        }}
      />
      {t(status)}
    </Box>
  );
}
