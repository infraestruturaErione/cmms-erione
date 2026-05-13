import {
  Box,
  styled,
  Tooltip,
  tooltipClasses,
  TooltipProps,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { customLogoPaths, homeUrl } from '../../config';
import { useEffect, useState } from 'react';
import { useBrand } from '../../hooks/useBrand';
import { getLocalizedHomeUrl } from '../../utils/urlPaths';

const LogoWrapper = styled('a')(
  ({ theme }) => `
        color: ${theme.palette.text.primary};
        display: flex;
        text-decoration: none;
        align-items: center;
        width: auto;
        margin: 0 auto;
        font-weight: ${theme.typography.fontWeightBold};
`
);

const LogoSignWrapper = styled(Box)(
  () => `
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
`
);

const TooltipWrapper = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.colors.alpha.trueWhite[100],
    color: theme.palette.getContrastText(theme.colors.alpha.trueWhite[100]),
    fontSize: theme.typography.pxToRem(12),
    fontWeight: 'bold',
    borderRadius: theme.general.borderRadiusSm,
    boxShadow:
      '0 .2rem .8rem rgba(7,9,25,.18), 0 .08rem .15rem rgba(7,9,25,.15)'
  },
  [`& .${tooltipClasses.arrow}`]: {
    color: theme.colors.alpha.trueWhite[100]
  }
}));
interface OwnProps {
  white?: boolean;
}

function Logo({ white }: OwnProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const size = 56;
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { logo, name: brandName } = useBrand();

  return (
    <TooltipWrapper title={brandName} arrow>
      <LogoWrapper href={getLocalizedHomeUrl('', i18n.language)}>
        <LogoSignWrapper>
          <img
            src={white ? logo.white : logo.dark}
            width={`${size * (mobile ? 0.72 : 1)}px`}
            height={`${size * (mobile ? 0.72 : 1)}px`}
            alt={'logo'}
            style={{ objectFit: 'contain', display: 'block' }}
          />
        </LogoSignWrapper>
      </LogoWrapper>
    </TooltipWrapper>
  );
}

export default Logo;
