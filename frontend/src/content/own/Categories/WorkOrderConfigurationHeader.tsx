import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import SettingsSuggestTwoToneIcon from '@mui/icons-material/SettingsSuggestTwoTone';
import { alpha, Box, Tab, Tabs, Typography } from '@mui/material';

interface WorkOrderConfigurationHeaderProps {
  action?: ReactNode;
}

export default function WorkOrderConfigurationHeader({
  action
}: WorkOrderConfigurationHeaderProps) {
  const { t }: { t: any } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const currentTab = location.pathname.startsWith('/app/checklists')
    ? 'checklists'
    : 'types';

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 2.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 46,
              height: 46,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              borderRadius: 2,
              color: 'primary.main',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1)
            }}
          >
            <SettingsSuggestTwoToneIcon />
          </Box>
          <Box>
            <Typography variant="h3">{t('wo_types_configuration')}</Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.25 }}
            >
              {t('wo_types_configuration_helper')}
            </Typography>
          </Box>
        </Box>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderBottom: (theme) => `1px solid ${theme.colors.alpha.black[10]}`
        }}
      >
        <Tabs
          value={currentTab}
          onChange={(_event, value) =>
            navigate(value === 'types' ? '/app/categories' : '/app/checklists')
          }
          sx={{
            minHeight: 44,
            '&& .MuiTabs-indicator': {
              height: 3,
              minHeight: 3,
              bottom: 0,
              border: 0,
              borderRadius: '3px 3px 0 0',
              boxShadow: 'none',
              bgcolor: 'primary.main'
            },
            '&& .MuiTab-root': {
              minHeight: 44,
              height: 44,
              minWidth: 0,
              px: { xs: 1.5, sm: 3 },
              mr: 0.5,
              borderRadius: 0,
              bgcolor: 'transparent',
              color: 'text.secondary',
              fontWeight: 500,
              textTransform: 'none',
              '&.Mui-selected, &.Mui-selected:hover': {
                bgcolor: 'transparent !important',
                color: 'primary.main !important',
                fontWeight: 700
              },
              '&:hover': { bgcolor: 'transparent' }
            }
          }}
        >
          <Tab value="types" label={t('work_order_types')} />
          <Tab value="checklists" label={t('questionnaires')} />
        </Tabs>
      </Box>
    </Box>
  );
}
