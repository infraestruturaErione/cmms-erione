import { ReactNode, useState } from 'react';
import { Box, Chip, Collapse, Stack, alpha, useTheme } from '@mui/material';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';
import ErrorTwoToneIcon from '@mui/icons-material/ErrorTwoTone';

export interface CompactChecklistItem {
  key: string;
  label: string;
  done: boolean;
  // Item nao aplicavel a esta OS (ex: assinatura nao exigida) - renderiza
  // neutro, nem check nem alerta.
  applicable?: boolean;
}

interface CompactChecklistProps {
  items: CompactChecklistItem[];
  // Conteudo completo mostrado ao expandir (reaproveita o componente de
  // detalhe existente em vez de duplicar a logica de calculo aqui).
  details?: ReactNode;
}

// Faixa compacta ✓/⚠ escaneavel rapido - usada tanto no resumo de
// pendencias da Visao Geral quanto no checklist de fechamento de Relato e
// Evidencias. So apresentacao: quem calcula "o que esta pendente" continua
// sendo o caller (getPendingRequirements / getFieldClosureChecklist).
export default function CompactChecklist({ items, details }: CompactChecklistProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;

  return (
    <Box>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ rowGap: 0.75 }}>
        {items.map((item) => {
          const neutral = item.applicable === false;
          return (
            <Chip
              key={item.key}
              size="small"
              onClick={details ? () => setExpanded((prev) => !prev) : undefined}
              icon={
                neutral ? undefined : item.done ? (
                  <CheckCircleTwoToneIcon fontSize="small" />
                ) : (
                  <ErrorTwoToneIcon fontSize="small" />
                )
              }
              label={item.label}
              sx={{
                fontWeight: 600,
                cursor: details ? 'pointer' : 'default',
                bgcolor: neutral
                  ? alpha(theme.palette.text.disabled, 0.08)
                  : item.done
                  ? alpha(theme.palette.success.main, 0.1)
                  : alpha(theme.palette.warning.main, 0.12),
                color: neutral
                  ? 'text.disabled'
                  : item.done
                  ? theme.palette.success.dark ?? theme.palette.success.main
                  : theme.palette.warning.dark ?? theme.palette.warning.main,
                '& .MuiChip-icon': { color: 'inherit' }
              }}
            />
          );
        })}
      </Stack>
      {!!details && (
        <Collapse in={expanded} sx={{ mt: expanded ? 1.5 : 0 }}>
          {details}
        </Collapse>
      )}
    </Box>
  );
}
