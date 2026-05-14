import { Link as RouterLink } from 'react-router-dom';
import {
  alpha,
  Box,
  Card,
  Container,
  Link,
  styled,
  Typography
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import JWTLogin from '../LoginJWT';
import { useTranslation } from 'react-i18next';
import Logo from 'src/components/LogoSign';
import { useBrand } from '../../../../../hooks/useBrand';
import useAuth from '../../../../../hooks/useAuth';
import { ERIONE_VISUAL_IDENTITY } from '../../../../../config/erioneVisualIdentity';

const BottomWrapper = styled(Box)(
  ({ theme }) => `
    padding: ${theme.spacing(3)};
    display: flex;
    align-items: center;
    justify-content: center;
`
);

const MainContent = styled(Box)(
  () => `
    height: 100%;
    display: flex;
    flex: 1;
    flex-direction: column;
    background:
      linear-gradient(145deg, transparent 0 54%, rgba(7, 31, 40, 0.42) 54% 62%, transparent 62%),
      linear-gradient(28deg, transparent 0 48%, rgba(11, 47, 58, 0.44) 48% 58%, transparent 58%),
      radial-gradient(circle at 12% 18%, rgba(34, 197, 94, 0.32), transparent 30%),
      radial-gradient(circle at 86% 12%, rgba(15, 118, 110, 0.34), transparent 32%),
      linear-gradient(180deg, #6f8fa8 0%, #bfd7d9 38%, #527482 67%, #071f28 100%);
`
);

const TopWrapper = styled(Box)(
  () => `
  display: flex;
  width: 100%;
  flex: 1;
  padding: 20px;
`
);

function LoginBasic() {
  const { t }: { t: any } = useTranslation();
  const { name: brandName } = useBrand();
  const { method } = useAuth() as any;

  return (
    <>
      <Helmet>
        <title>{t('Login')}</title>
      </Helmet>
      <MainContent>
        <TopWrapper>
          <Container maxWidth="sm">
            <Card
              sx={{
                mt: 3,
                px: 4,
                pt: 5,
                pb: 3,
                border: '1px solid',
                borderColor: alpha('#ffffff', 0.42),
                backgroundColor: alpha('#ffffff', 0.42),
                backdropFilter: 'blur(28px) saturate(145%)',
                boxShadow: `0 18px 46px ${alpha(
                  ERIONE_VISUAL_IDENTITY.primaryDark,
                  0.26
                )}, inset 0 1px 0 ${alpha('#ffffff', 0.44)}`,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: alpha('#ffffff', 0.78),
                  backdropFilter: 'blur(8px)'
                }
              }}
            >
              <Box textAlign="center">
                <Logo />
                <Typography variant="h3" sx={{ mt: 2, mb: 0.5 }}>
                  {brandName}
                </Typography>
                <Typography
                  variant="h2"
                  sx={{
                    mb: 1
                  }}
                >
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
              {method === 'JWT' && <JWTLogin />}
              <Box my={4}>
                <Typography
                  component="span"
                  variant="subtitle2"
                  color="text.primary"
                  fontWeight="bold"
                >
                  {t('no_account_yet')}
                </Typography>{' '}
                <Link component={RouterLink} to="/account/register-basic">
                  <b>{t('signup_here')}</b>
                </Link>
              </Box>
            </Card>
            <BottomWrapper>
              <Typography variant="body2" color="text.secondary">
                {t('erione_login_tagline')}
              </Typography>
            </BottomWrapper>
          </Container>
        </TopWrapper>
      </MainContent>
    </>
  );
}

export default LoginBasic;
