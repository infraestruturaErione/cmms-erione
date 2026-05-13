import { Link as RouterLink } from 'react-router-dom';
import { Box, Card, Container, Link, styled, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import JWTLogin from '../LoginJWT';
import { useTranslation } from 'react-i18next';
import Logo from 'src/components/LogoSign';
import { useBrand } from '../../../../../hooks/useBrand';
import useAuth from '../../../../../hooks/useAuth';

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
                borderColor: 'divider',
                boxShadow: '0 16px 42px rgba(34, 51, 84, 0.12)'
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
