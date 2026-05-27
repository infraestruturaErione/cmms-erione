import { Box, Button, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from '@mui/icons-material';
import SettingsSection from '../../components/SettingsSection';
import { ERIONE_HIDDEN_MODULES } from '../../../../../config/erioneModules';

function MetersSettings() {
  const { t }: { t: any } = useTranslation();
  const navigate = useNavigate();
  if (ERIONE_HIDDEN_MODULES.meters) {
    navigate('/app/settings/features');
    return null;
  }

  return (
    <Grid item xs={12}>
      <Box p={4}>
        <SettingsSection title={t('customize_form')}>
          <Box display="flex" flexDirection="column" gap={2}>
            <Button
              variant="text"
              endIcon={<ChevronRight />}
              onClick={() =>
                navigate('/app/settings/features/meters/custom-fields')
              }
              sx={{
                justifyContent: 'space-between',
                textTransform: 'none'
              }}
            >
              {t('configure_fields')}
            </Button>
          </Box>
        </SettingsSection>
      </Box>
    </Grid>
  );
}

export default MetersSettings;
