import { useContext } from 'react';
import Scrollbar from 'src/components/Scrollbar';
import { SidebarContext } from 'src/contexts/SidebarContext';

import {
  alpha,
  Box,
  Divider,
  Drawer,
  styled,
  Typography,
  useTheme
} from '@mui/material';
import SidebarMenu from './SidebarMenu';
import SidebarFooter from './SidebarFooter';
import Logo from 'src/components/LogoSign';
import { useBrand } from '../../../hooks/useBrand';
import { useTranslation } from 'react-i18next';
import { ERIONE_VISUAL_IDENTITY } from '../../../config/erioneVisualIdentity';

const SidebarWrapper = styled(Box)(
  ({ theme }) => `
        width: ${theme.sidebar.width};
        min-width: ${theme.sidebar.width};
        color: ${theme.colors.alpha.trueWhite[70]};
        position: relative;
        z-index: 7;
        height: 100%;
        padding-bottom: 61px;
`
);

function Sidebar() {
  const { sidebarToggle, toggleSidebar } = useContext(SidebarContext);
  const closeSidebar = () => toggleSidebar();
  const theme = useTheme();
  const { name: brandName } = useBrand();
  const { t }: { t: any } = useTranslation();

  return (
    <>
      <SidebarWrapper
        sx={{
          display: {
            xs: 'none',
            lg: 'inline-block'
          },
          position: 'fixed',
          left: 0,
          top: 0,
          background: ERIONE_VISUAL_IDENTITY.sidebarGradient,
          boxShadow:
            theme.palette.mode === 'dark'
              ? theme.sidebar.boxShadow
              : `6px 0 24px ${alpha(
                  ERIONE_VISUAL_IDENTITY.primaryDarker,
                  0.18
                )}`
        }}
      >
        <Scrollbar>
          <Box mt={3}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                flexDirection: 'row'
              }}
            >
              <Box textAlign="center">
                <Logo white />
                <Typography
                  sx={{ color: 'white', mt: 0.5, letterSpacing: 0 }}
                  fontSize={13}
                  fontWeight={700}
                >
                  {brandName}
                </Typography>
                <Typography
                  sx={{ color: alpha(theme.colors.alpha.trueWhite[100], 0.62) }}
                  fontSize={11}
                >
                  {t('field_operations')}
                </Typography>
              </Box>
            </Box>
          </Box>
          <Divider
            sx={{
              mt: theme.spacing(1),
              mx: theme.spacing(2),
              background: theme.colors.alpha.trueWhite[10]
            }}
          />
          <SidebarMenu />
        </Scrollbar>
        <Divider
          sx={{
            background: theme.colors.alpha.trueWhite[10]
          }}
        />
        <SidebarFooter />
      </SidebarWrapper>
      <Drawer
        sx={{
          boxShadow: `${theme.sidebar.boxShadow}`
        }}
        anchor={theme.direction === 'rtl' ? 'right' : 'left'}
        open={sidebarToggle}
        onClose={closeSidebar}
        variant="temporary"
        elevation={9}
      >
        <SidebarWrapper
          sx={{
            background: ERIONE_VISUAL_IDENTITY.sidebarGradient
          }}
        >
          <Scrollbar>
            <Box mt={3}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  flexDirection: 'row'
                }}
              >
                <Box textAlign="center">
                  <Logo white />
                  <Typography
                    sx={{ color: 'white', mt: 0.5, letterSpacing: 0 }}
                    fontSize={13}
                    fontWeight={700}
                  >
                    {brandName}
                  </Typography>
                  <Typography
                    sx={{
                      color: alpha(theme.colors.alpha.trueWhite[100], 0.62)
                    }}
                    fontSize={11}
                  >
                    {t('field_operations')}
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Divider
              sx={{
                mt: theme.spacing(1),
                mx: theme.spacing(2),
                background: theme.colors.alpha.trueWhite[10]
              }}
            />
            <SidebarMenu />
          </Scrollbar>
          <SidebarFooter />
        </SidebarWrapper>
      </Drawer>
    </>
  );
}

export default Sidebar;
