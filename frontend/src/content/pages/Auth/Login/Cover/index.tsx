import {
  alpha,
  Box,
  Stack,
  styled,
  Typography,
  useTheme
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import JWTLogin from '../LoginJWT';

import { useTranslation } from 'react-i18next';
import { ERIONE_VISUAL_IDENTITY } from '../../../../../config/erioneVisualIdentity';

const Content = styled(Box)(
  () => `
    display: flex;
    flex: 1;
    width: 100%;
`
);

const fieldSignals = [
  { label: 'camera', left: '19%', top: '22%', delay: '0s' },
  { label: 'wifi', left: '46%', top: '27%', delay: '0.45s' },
  { label: 'cloud', left: '80%', top: '19%', delay: '0.9s' },
  { label: 'ai', left: '81%', top: '39%', delay: '1.35s' },
  { label: 'edge', left: '63%', top: '67%', delay: '1.8s' }
];

function LoginCover() {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();

  return (
    <>
      <Helmet>
        <title>{t('Login')}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Content
        component="main"
        sx={{
          minHeight: '100vh',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '46% 54%' },
          overflow: 'hidden',
          color: '#FFFFFF',
          backgroundColor: '#061826'
        }}
      >
        <Box
          component="section"
          sx={{
            position: 'relative',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 3, sm: 5, md: 7, xl: 10 },
            py: { xs: 4, md: 6 },
            background: `
              radial-gradient(circle at 12% 18%, ${alpha('#19C8FF', 0.13)} 0%, transparent 28%),
              radial-gradient(circle at 84% 86%, ${alpha(ERIONE_VISUAL_IDENTITY.primary, 0.24)} 0%, transparent 34%),
              linear-gradient(180deg, #061826 0%, #03111F 100%)
            `,
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: { xs: 0.3, lg: 0.18 },
              backgroundImage: `
                linear-gradient(${alpha('#19C8FF', 0.14)} 1px, transparent 1px),
                linear-gradient(90deg, ${alpha('#19C8FF', 0.1)} 1px, transparent 1px)
              `,
              backgroundSize: '96px 96px',
              maskImage:
                'radial-gradient(circle at center, black 0%, transparent 76%)'
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: { xs: 0, lg: 24 },
              transform: 'translateX(100%)',
              zIndex: 2,
              background: `linear-gradient(90deg, ${alpha('#03111F', 0.32)}, transparent)`
            }
          }}
        >
          <Stack
            spacing={{ xs: 3.5, md: 5 }}
            sx={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              maxWidth: 430
            }}
          >
            <Box>
              <Box
                component="img"
                src="/favicon.png"
                alt="Erione"
                sx={{
                  display: 'block',
                  width: { xs: 74, md: 92 },
                  height: 'auto',
                  filter: `drop-shadow(0 14px 30px ${alpha('#000000', 0.32)})`
                }}
              />
            </Box>

            <Box>
              <Typography
                component="h1"
                sx={{
                  fontSize: {
                    xs: 'clamp(36px, 12vw, 50px)',
                    md: 'clamp(48px, 4vw, 60px)'
                  },
                  lineHeight: 1.05,
                  fontWeight: 900,
                  textShadow: `0 18px 44px ${alpha('#000000', 0.5)}`
                }}
              >
                Faça seu login
                <Box component="span" sx={{ color: '#19C8FF' }}>
                  .
                </Box>
              </Typography>
              <Typography
                sx={{
                  color: alpha('#D9E7EF', 0.78),
                  fontSize: { xs: 14, md: 15 },
                  lineHeight: 1.65,
                  mt: 2
                }}
              >
                Acesse o Erione CMMS para continuar a operação de campo.
              </Typography>
            </Box>

            <JWTLogin />
          </Stack>
        </Box>

        <Box
          component="section"
          aria-label="Operação conectada Erione"
          sx={{
            position: 'relative',
            display: { xs: 'none', lg: 'block' },
            minHeight: '100vh',
            overflow: 'hidden',
            backgroundColor: ERIONE_VISUAL_IDENTITY.primaryDarker,
            backgroundImage: `
              linear-gradient(90deg, ${alpha('#020A14', 0.06)} 0%, ${alpha('#020A14', 0.34)} 100%),
              url('/static/images/erione-login-background.png')
            `,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: `
                radial-gradient(circle at 50% 34%, transparent 0%, ${alpha('#020A14', 0.2)} 72%),
                linear-gradient(180deg, ${alpha('#020A14', 0.08)} 0%, ${alpha('#020A14', 0.36)} 100%)
              `
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              boxShadow: `inset 32px 0 72px ${alpha('#020A14', 0.32)}`
            }
          }}
        >
          <Box
            component="svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              width: '100%',
              height: '100%',
              opacity: 0.9,
              '& .signal-path': {
                fill: 'none',
                stroke: '#19C8FF',
                strokeWidth: 0.28,
                strokeLinecap: 'round',
                strokeDasharray: '1.3 2.2',
                filter: 'drop-shadow(0 0 3px rgba(25, 200, 255, 0.85))',
                animation: 'erioneSignalFlow 4s linear infinite'
              },
              '& .signal-path.secondary': {
                stroke: '#9EEBFF',
                opacity: 0.72,
                animationDuration: '5.4s'
              },
              '@keyframes erioneSignalFlow': {
                '0%': { strokeDashoffset: 18 },
                '100%': { strokeDashoffset: 0 }
              }
            }}
          >
            <path
              className="signal-path"
              d="M19 22 C29 18 36 26 46 27 C58 28 67 18 80 19"
            />
            <path
              className="signal-path secondary"
              d="M46 27 C56 30 63 38 81 39"
            />
            <path
              className="signal-path"
              d="M19 22 C32 38 43 55 63 67"
              style={{ animationDelay: '0.55s' }}
            />
            <path
              className="signal-path secondary"
              d="M63 67 C70 57 76 48 81 39"
              style={{ animationDelay: '1.05s' }}
            />
          </Box>

          {fieldSignals.map((signal) => (
            <Box
              key={signal.label}
              sx={{
                position: 'absolute',
                zIndex: 3,
                left: signal.left,
                top: signal.top,
                width: 14,
                height: 14,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                backgroundColor: '#19C8FF',
                boxShadow: `0 0 16px ${alpha('#19C8FF', 0.88)}`,
                animation: 'erioneSignalPulse 2.8s ease-in-out infinite',
                animationDelay: signal.delay,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: -18,
                  borderRadius: '50%',
                  border: `1px solid ${alpha('#19C8FF', 0.36)}`
                },
                '@keyframes erioneSignalPulse': {
                  '0%, 100%': {
                    opacity: 0.68,
                    transform: 'translate(-50%, -50%) scale(0.72)'
                  },
                  '50%': {
                    opacity: 1,
                    transform: 'translate(-50%, -50%) scale(1.05)'
                  }
                }
              }}
            />
          ))}
        </Box>
      </Content>
    </>
  );
}

export default LoginCover;
