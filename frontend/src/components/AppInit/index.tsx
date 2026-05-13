import { Box, Typography } from '@mui/material';

import Logo from 'src/components/LogoSign';
import { useBrand } from '../../hooks/useBrand';
import { useTranslation } from 'react-i18next';

function AppInit() {
  const { name: brandName } = useBrand();
  const { t }: { t: any } = useTranslation();

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        right: 0,
        width: '100%',
        height: '100%'
      }}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Box textAlign="center">
        <Logo />
        <Typography fontSize={13} fontWeight={700} sx={{ mt: 1 }}>
          {brandName}
        </Typography>
        <Typography fontSize={12} color="text.secondary">
          {t('preparing_operation')}
        </Typography>
      </Box>
    </Box>
  );
}

export default AppInit;
