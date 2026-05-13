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
          minHeight: '100vh',
          background: `linear-gradient(180deg, ${ERIONE_VISUAL_IDENTITY.surface} 0%, ${theme.palette.background.default} 58%)`
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
                0.16
              )}`
            }}
          >
            <Box
              sx={{
                p: { xs: 3, md: 5 },
                background: ERIONE_VISUAL_IDENTITY.loginGradient,
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
            <Box sx={{ p: { xs: 3, md: 5 } }}>
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
