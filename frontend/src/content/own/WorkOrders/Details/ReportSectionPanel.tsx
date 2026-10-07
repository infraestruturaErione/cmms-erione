import { ReactNode } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';

export default function ReportSectionPanel({
  title,
  count,
  children
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        p: { xs: 1.5, sm: 2 },
        bgcolor: 'background.paper'
      }}
    >
      <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 2 }}>
        <Typography
          component="h3"
          variant="h5"
          sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
        >
          {title}
        </Typography>
        {!!count && <Chip size="small" label={count} sx={{ flexShrink: 0 }} />}
      </Stack>
      {children}
    </Box>
  );
}
