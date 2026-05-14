import { Link as RouterLink } from 'react-router-dom';
import {
  alpha,
  Box,
  Card,
  Container,
  Link,
  Chip,
  Stack,
  styled,
  Typography,
  useTheme
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import JWTLogin from '../LoginJWT';

import { useTranslation } from 'react-i18next';
import Logo from 'src/components/LogoSign';
import { ldapEnabled } from '../../../../../config';
import { useBrand } from '../../../../../hooks/useBrand';
import { ERIONE_VISUAL_IDENTITY } from '../../../../../config/erioneVisualIdentity';

const Content = styled(Box)(
  () => `
    display: flex;
    flex: 1;
    width: 100%;
`
);

function LoginCover() {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const { name: brandName } = useBrand();

  return (
    <>
      <Helmet>
        <title>{t('Login')}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Content
        sx={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: '100vh',
          background: `
            linear-gradient(140deg, transparent 0 54%, rgba(7, 31, 40, 0.42) 54% 62%, transparent 62%),
            linear-gradient(28deg, transparent 0 48%, rgba(11, 47, 58, 0.44) 48% 58%, transparent 58%),
            linear-gradient(18deg, transparent 0 58%, rgba(15, 118, 110, 0.34) 58% 68%, transparent 68%),
            radial-gradient(circle at 8% 12%, ${alpha(
              ERIONE_VISUAL_IDENTITY.accent,
              0.26
            )} 0%, transparent 28%),
            radial-gradient(circle at 88% 18%, ${alpha(
              ERIONE_VISUAL_IDENTITY.primary,
              0.34
            )} 0%, transparent 30%),
            linear-gradient(180deg, rgba(7, 31, 40, 0.48) 0%, transparent 30%),
            linear-gradient(180deg, #6f8fa8 0%, #bfd7d9 38%, #527482 67%, #071f28 100%)
          `,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            opacity: 0.52,
            backgroundImage: `linear-gradient(${alpha(
              theme.colors.alpha.trueWhite[100],
              0.16
            )} 1px, transparent 1px), linear-gradient(90deg, ${alpha(
              theme.colors.alpha.trueWhite[100],
              0.12
            )} 1px, transparent 1px)`,
            backgroundSize: '86px 86px',
            maskImage:
              'linear-gradient(180deg, transparent 0%, black 24%, transparent 76%)'
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '42%',
            background: `
              linear-gradient(180deg, transparent 0%, ${alpha(
                ERIONE_VISUAL_IDENTITY.primaryDarker,
                0.82
              )} 100%),
              radial-gradient(ellipse at 22% 100%, ${alpha(
                ERIONE_VISUAL_IDENTITY.primaryDark,
                0.78
              )} 0%, transparent 54%),
              radial-gradient(ellipse at 72% 100%, ${alpha(
                ERIONE_VISUAL_IDENTITY.primary,
                0.62
              )} 0%, transparent 58%)
            `,
            clipPath: {
              xs: 'polygon(0 28%, 12% 18%, 28% 34%, 42% 15%, 58% 31%, 73% 20%, 88% 36%, 100% 22%, 100% 100%, 0 100%)',
              md: 'polygon(0 36%, 10% 20%, 22% 38%, 36% 16%, 52% 34%, 67% 19%, 82% 39%, 100% 24%, 100% 100%, 0 100%)'
            }
          }
        }}
      >
        <Container
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: { xs: 3, md: 6 }
          }}
          maxWidth="lg"
        >
          <Card
            sx={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              maxWidth: 980,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '0.95fr 1fr' },
              overflow: 'hidden',
              border: `1px solid ${alpha(
                ERIONE_VISUAL_IDENTITY.primary,
                0.14
              )}`,
              boxShadow: `0 24px 60px ${alpha(
                ERIONE_VISUAL_IDENTITY.primaryDark,
                0.28
              )}`,
              backgroundColor: alpha(theme.colors.alpha.white[100], 0.16),
              backdropFilter: 'blur(26px) saturate(135%)',
              borderColor: alpha(theme.colors.alpha.trueWhite[100], 0.52)
            }}
          >
            <Box
              sx={{
                p: { xs: 3, md: 5 },
                background: ERIONE_VISUAL_IDENTITY.loginGradient,
                backdropFilter: 'blur(10px)',
                color: 'white',
                borderRight: {
                  xs: 0,
                  md: `1px solid ${alpha(theme.colors.alpha.black[100], 0.08)}`
                }
              }}
            >
              <Logo white />
              <Typography variant="h2" sx={{ mt: 3, mb: 1 }}>
                {brandName}
              </Typography>
              <Chip
                label={t('field_operations')}
                size="small"
                sx={{
                  mb: 2,
                  color: ERIONE_VISUAL_IDENTITY.accentSoft,
                  borderColor: alpha(theme.colors.alpha.trueWhite[100], 0.28),
                  bgcolor: alpha(theme.colors.alpha.trueWhite[100], 0.08)
                }}
                variant="outlined"
              />
              <Typography
                variant="h4"
                color={alpha(theme.colors.alpha.trueWhite[100], 0.82)}
                fontWeight="normal"
              >
                {t('erione_login_tagline')}
              </Typography>
              <Stack spacing={1.25} sx={{ mt: 4 }}>
                <Typography
                  variant="body2"
                  color={alpha(theme.colors.alpha.trueWhite[100], 0.74)}
                >
                  {t('erione_login_bullet_work_orders')}
                </Typography>
                <Typography
                  variant="body2"
                  color={alpha(theme.colors.alpha.trueWhite[100], 0.74)}
                >
                  {t('erione_login_bullet_field')}
                </Typography>
                <Typography
                  variant="body2"
                  color={alpha(theme.colors.alpha.trueWhite[100], 0.74)}
                >
                  {t('erione_login_bullet_reports')}
                </Typography>
              </Stack>
            </Box>
            <Box
              sx={{
                p: { xs: 3, md: 5 },
                backgroundColor: alpha(theme.colors.alpha.white[100], 0.42),
                backdropFilter: 'blur(28px) saturate(145%)',
                boxShadow: `inset 0 1px 0 ${alpha(
                  theme.colors.alpha.trueWhite[100],
                  0.44
                )}`,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: alpha(theme.colors.alpha.white[100], 0.78),
                  backdropFilter: 'blur(8px)'
                }
              }}
            >
              <Box textAlign="left">
                <Typography variant="h2" sx={{ mb: 1 }}>
                  {t('login')}
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  fontWeight="normal"
                  sx={{
                    mb: 3
                  }}
                >
                  {t('login_description')}
                </Typography>
              </Box>
              <JWTLogin />
              {!ldapEnabled && (
                <Box mt={4}>
                  <Typography
                    component="span"
                    variant="subtitle2"
                    color="text.primary"
                    fontWeight="bold"
                  >
                    {t('no_account_yet')}
                  </Typography>{' '}
                  <Box display={{ xs: 'block', md: 'inline-block' }}>
                    <Link component={RouterLink} to="/account/register">
                      <b>{t('signup_here')}</b>
                    </Link>
                  </Box>
                </Box>
              )}
            </Box>
          </Card>
        </Container>
      </Content>
    </>
  );
}

export default LoginCover;
