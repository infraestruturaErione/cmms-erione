import { Box, Grid, Switch, SxProps, Theme, Typography } from '@mui/material';
import { Field } from 'formik';
import { ChangeEvent } from 'react';

interface CustomSwitchProps {
  title: string;
  description: string;
  name: string;
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  checked: boolean;
  sx?: SxProps<Theme>;
  titleSx?: SxProps<Theme>;
  // Opcional, retrocompativel (default false preserva o <Grid item> como
  // raiz, igual sempre foi). Quando true, renderiza um <Box> no lugar: usado
  // so quando o CHAMADOR ja envolve o CustomSwitch em outro <Grid item> (ex.:
  // form/index.tsx) - um <Grid item> aninhado direto dentro de outro <Grid
  // item> (sem <Grid container> entre eles) herda as CSS vars de spacing do
  // container ancestral e duplica o padding/gutter, o que so vira visualmente
  // quebrado quando o campo passa a ser midWidth (par a par) - ver
  // AddWorkOrderTabbedModal "Requer assinatura".
  disableGridItem?: boolean;
}
export default function CustomSwitch(props: CustomSwitchProps) {
  const {
    name,
    title,
    description,
    handleChange,
    checked,
    sx,
    titleSx,
    disableGridItem
  } = props;
  const content = (
    <Box display="flex" flexDirection="row" alignItems="center">
      <Field onChange={handleChange} checked={checked} as={Switch} name={name} />
      <Box display="flex" flexDirection="column">
        <Typography
          variant="h6"
          fontWeight="bold"
          sx={{ mb: description ? 0.5 : 0, ...titleSx }}
        >
          {title}
        </Typography>
        {description && (
          <Typography variant="h6" fontStyle="italic">
            {description}
          </Typography>
        )}
      </Box>
    </Box>
  );

  // Dois retornos explicitos (em vez de um componente-raiz dinamico) - o TS
  // nao consegue unificar as assinaturas de props de Box e Grid quando a
  // escolha do componente e' feita em runtime (TS2604).
  if (disableGridItem) {
    return <Box sx={{ mb: 2, ...sx }}>{content}</Box>;
  }
  return (
    <Grid item xs={12} sx={{ mb: 2, ...sx }}>
      {content}
    </Grid>
  );
}
