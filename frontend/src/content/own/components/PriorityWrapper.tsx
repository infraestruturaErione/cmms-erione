import { alpha, Box, styled, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getPriorityLabel } from '../../../utils/formatters';

const LabelWrapper = styled(Box)(
  ({ theme }) => `
    font-size: ${theme.typography.pxToRem(11)};
    font-weight: 700;
    text-transform: uppercase;
    border-radius: 20px;
    padding: ${theme.spacing(0.5, 1.25)};
    line-height: 1.2;
    width: fit-content;
    white-space: nowrap;
  `
);
export default function PriorityWrapper(props: {
  priority: string | null;
  withSuffix?: boolean;
}) {
  const { priority, withSuffix } = props;
  const { t }: { t: any } = useTranslation();
  if (!priority) return null;
  return priority === 'NONE' ? (
    <Typography>{getPriorityLabel(priority, t)}</Typography>
  ) : (
    <LabelWrapper
      sx={(theme) => {
        // Chip suave: fundo claro + texto na cor forte da mesma familia. Antes era
        // fundo solido com texto calculado por contraste, que pesava muito na lista.
        const color =
          priority === 'LOW'
            ? theme.colors.info.main
            : priority === 'HIGH'
            ? theme.colors.error.main
            : theme.colors.warning.main;
        return {
          backgroundColor: alpha(color, 0.14),
          color
        };
      }}
    >
      {t(priority)} {withSuffix ? t('priority') : null}
    </LabelWrapper>
  );
}
