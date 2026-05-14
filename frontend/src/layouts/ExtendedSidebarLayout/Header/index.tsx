import { useContext } from 'react';

import {
  alpha,
  Box,
  Divider,
  IconButton,
  lighten,
  Stack,
  styled,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import MenuTwoToneIcon from '@mui/icons-material/MenuTwoTone';
import { SidebarContext } from 'src/contexts/SidebarContext';
import ArrowBackTwoToneIcon from '@mui/icons-material/ArrowBackTwoTone';
import CloseTwoToneIcon from '@mui/icons-material/CloseTwoTone';

import HeaderButtons from './Buttons';
import HeaderUserbox from './Userbox';
import ErioneTopNav from './ErioneTopNav';
import { useTranslation } from 'react-i18next';
import { TitleContext } from '../../../contexts/TitleContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ERIONE_VISUAL_IDENTITY } from '../../../config/erioneVisualIdentity';
import { useBrand } from '../../../hooks/useBrand';

const HeaderWrapper = styled(Box)(
  ({ theme }) => `
        height: ${theme.header.height};
        color: ${theme.header.textColor};
        padding: ${theme.spacing(0, 2)};
        right: 0;
        z-index: 6;
        background: ${ERIONE_VISUAL_IDENTITY.sidebarGradient};
        backdrop-filter: blur(16px);
        border-bottom: 1px solid ${alpha(theme.colors.alpha.trueWhite[100], 0.16)};
        position: fixed;
        justify-content: space-between;
        width: 100%;
        left: 0;
`
);

function Header() {
  const { sidebarToggle, toggleSidebar } = useContext(SidebarContext);
  const { title } = useContext(TitleContext);
  const theme = useTheme();
  const { t }: { t: any } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { logo, name: brandName } = useBrand();

  return (
    <HeaderWrapper
      display="flex"
      alignItems="center"
      sx={{
        boxShadow:
          theme.palette.mode === 'dark'
            ? `0 1px 0 ${alpha(
                lighten(theme.colors.primary.main, 0.7),
                0.15
              )}, 0px 2px 8px -3px rgba(0, 0, 0, 0.16)`
            : `0 1px 0 ${alpha(
                theme.colors.alpha.trueWhite[100],
                0.12
              )}, 0 16px 38px -26px ${alpha(
                ERIONE_VISUAL_IDENTITY.primaryDarker,
                0.62
              )}`
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} minWidth={0}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            display: { xs: 'none', lg: 'flex' },
            pr: 1,
            minWidth: 180
          }}
        >
          <Box
            component="img"
            src={logo.white || logo.dark || '/static/images/logo/logo.png'}
            alt={brandName}
            sx={{
              width: 34,
              height: 34,
              objectFit: 'contain',
              filter: `drop-shadow(0 5px 10px ${alpha(
                ERIONE_VISUAL_IDENTITY.primary,
                0.16
              )})`
            }}
          />
          <Box minWidth={0}>
            <Typography variant="h5" noWrap fontWeight={800}>
              {brandName}
            </Typography>
            <Typography
              variant="caption"
              noWrap
              sx={{
                display: 'block',
                color: alpha(theme.colors.alpha.trueWhite[100], 0.72),
                lineHeight: 1.1
              }}
            >
              {t('field_operations')}
            </Typography>
          </Box>
        </Stack>
        <Divider
          orientation="vertical"
          flexItem
          sx={{
            display: { xs: 'none', lg: 'block' },
            borderColor: alpha(theme.colors.alpha.trueWhite[100], 0.14)
          }}
        />
        <IconButton
          color="primary"
          onClick={() => navigate(-1)}
          disabled={location.key === 'default'}
          sx={{
            border: `1px solid ${alpha(
              theme.colors.alpha.trueWhite[100],
              0.2
            )}`,
            color: alpha(theme.colors.alpha.trueWhite[100], 0.86),
            '&.Mui-disabled': {
              color: alpha(theme.colors.alpha.trueWhite[100], 0.28)
            },
            '&:hover': {
              bgcolor: alpha(theme.colors.alpha.trueWhite[100], 0.08)
            }
          }}
        >
          <ArrowBackTwoToneIcon fontSize="small" />
        </IconButton>
        <Typography
          variant="h3"
          noWrap
          sx={{
            maxWidth: { xs: 220, lg: 320 },
            color: theme.colors.alpha.trueWhite[100]
          }}
        >
          {title}
        </Typography>
      </Stack>
      <ErioneTopNav />
      <Box display="flex" alignItems="center">
        <HeaderButtons />
        <HeaderUserbox />
        <Box
          component="span"
          sx={{
            ml: 2,
            display: { lg: 'none', xs: 'inline-block' }
          }}
        >
          <Tooltip arrow title={t('toggle_menu')}>
            <IconButton color="primary" onClick={toggleSidebar}>
              {!sidebarToggle ? (
                <MenuTwoToneIcon fontSize="small" />
              ) : (
                <CloseTwoToneIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </HeaderWrapper>
  );
}

export default Header;
