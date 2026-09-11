import { ReactNode } from 'react';
import { alpha, Box, Card, Stack, Typography } from '@mui/material';

// Presentation only: queries, permissions and table state belong to each page.
export function RegistryHeader({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  if (!action) return null;
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={1}
      sx={{
        minHeight: 40,
        pb: 0.25,
        borderBottom: 1,
        borderColor: (theme) => alpha(theme.palette.primary.main, 0.16),
        '& .MuiTab-root:hover': { bgcolor: 'action.hover' },
        '& .MuiTab-root.Mui-focusVisible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2
        },
        '& .MuiTab-root.Mui-selected': { boxShadow: 'none' }
      }}
    >
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'flex-end',
          '& .MuiButton-root': {
            minHeight: 32,
            boxShadow: 'none',
            borderRadius: 1
          }
        }}
      >
        {action}
      </Box>
    </Stack>
  );
}

export function RegistryQueryBar({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        minHeight: 50,
        px: { xs: 0, sm: 1.25 },
        py: 0.75,
        border: 1,
        borderColor: (theme) => alpha(theme.palette.primary.main, 0.12),
        borderRadius: 1.5,
        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.045),
        minWidth: 0,
        '& .MuiButton-root': {
          minHeight: 34,
          boxShadow: 'none',
          borderRadius: 1
        },
        '& .MuiButton-containedPrimary': {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          transition: 'background-color 120ms ease, box-shadow 120ms ease',
          '&:hover, &[aria-expanded="true"]': {
            bgcolor: 'primary.dark',
            boxShadow: (theme) =>
              `0 1px 3px ${alpha(theme.palette.primary.dark, 0.18)}`
          },
          '&:active': {
            bgcolor: 'primary.dark',
            boxShadow: (theme) =>
              `inset 0 1px 2px ${alpha(theme.palette.text.primary, 0.18)}`
          },
          '&.Mui-focusVisible': {
            outline: '2px solid',
            outlineColor: 'primary.dark',
            outlineOffset: 2
          },
          '&.Mui-disabled': {
            bgcolor: 'action.disabledBackground',
            color: 'action.disabled',
            boxShadow: 'none'
          }
        },
        '& .MuiButtonGroup-root': {
          boxShadow: 'none',
          '& .MuiButtonGroup-grouped:not(:last-of-type)': {
            borderRightColor: (theme) =>
              alpha(theme.palette.primary.contrastText, 0.3)
          }
        },
        '& .MuiOutlinedInput-root': {
          bgcolor: 'background.paper',
          borderRadius: 1,
          minHeight: 36,
          color: 'text.primary',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: (theme) => alpha(theme.palette.text.primary, 0.23)
          },
          '& input::placeholder': { color: 'text.secondary', opacity: 1 },
          '& .MuiInputAdornment-positionStart': { color: 'primary.main' },
          '& .MuiSelect-iconOpen': { color: 'primary.main' },
          transition: 'border-color 120ms ease, box-shadow 120ms ease',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.45)
          },
          '&.Mui-focused': {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main'
            },
            boxShadow: (theme) =>
              `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}`
          }
        },
        '& .MuiIconButton-root.Mui-focusVisible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .MuiButton-root, & .MuiOutlinedInput-root': { transition: 'none' }
        }
      }}
    >
      {children}
    </Box>
  );
}

export function RegistryResults({
  count,
  label,
  loading,
  children
}: {
  count: number;
  label: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      alignItems="center"
      gap={1}
      sx={{ minWidth: 0, flexShrink: 0 }}
    >
      <Typography variant="body2" color="text.secondary" aria-live="polite">
        <Box
          component="span"
          sx={{
            fontWeight: 800,
            color: 'primary.dark',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {loading ? '…' : count}
        </Box>{' '}
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

export function RegistryTableSurface({
  children,
  loading
}: {
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <Card
      aria-busy={Boolean(loading)}
      sx={{
        position: 'relative',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        border: 1,
        borderColor: (theme) => alpha(theme.palette.primary.main, 0.18),
        bgcolor: 'background.paper',
        borderRadius: 1.5,
        boxShadow: 'none',
        overflow: 'hidden',
        '& thead th': {
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap'
        },
        '&& thead th': {
          color: 'text.primary',
          backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.075),
          borderBottomColor: (theme) => alpha(theme.palette.primary.main, 0.13)
        },
        '& tbody td': {
          borderBottomColor: (theme) => alpha(theme.palette.primary.main, 0.09),
          verticalAlign: 'middle',
          py: 1.25
        },
        '&& tbody tr:nth-of-type(even)': {
          backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.035)
        },
        '& tbody tr:hover': {
          backgroundColor: (theme) =>
            `${alpha(theme.palette.primary.main, 0.075)} !important`
        },
        '&& tbody tr:focus-within': {
          backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.075)
        },
        '& tbody > div': {
          marginTop: '0 !important',
          width: '100% !important',
          maxWidth: '100% !important',
          py: 4,
          visibility: loading ? 'hidden' : 'visible'
        },
        '& .MuiIconButton-root': {
          width: 30,
          height: 30,
          color: 'text.secondary',
          borderRadius: 1
        },
        '& .MuiIconButton-root:hover': {
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
          color: 'primary.main'
        },
        '& .MuiIconButton-root.Mui-focusVisible': {
          color: 'primary.dark',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 1
        },
        '& [data-registry-actions] .MuiIconButton-root': {
          boxShadow: (theme) =>
            `inset 0 0 0 1px ${alpha(theme.palette.text.primary, 0.1)}`,
          transition:
            'color 120ms ease, background-color 120ms ease, box-shadow 120ms ease',
          '&:hover, &.Mui-focusVisible': {
            color: 'primary.dark',
            boxShadow: (theme) =>
              `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.28)}`
          },
          '&:active': {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16)
          },
          '&[aria-haspopup="menu"]': { boxShadow: 'none' },
          '&.Mui-disabled': {
            color: 'action.disabled',
            bgcolor: 'transparent',
            boxShadow: 'none'
          }
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& [data-registry-actions] .MuiIconButton-root': {
            transition: 'none'
          }
        }
      }}
    >
      {children}
    </Card>
  );
}
