import * as Yup from 'yup';
import type { FC } from 'react';
import { useContext, useState } from 'react';
import { Formik } from 'formik';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';

import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  alpha
} from '@mui/material';
import useAuth from 'src/hooks/useAuth';
import useRefMounted from 'src/hooks/useRefMounted';
import { useTranslation } from 'react-i18next';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  apiUrl,
  isSSOEnabled,
  ldapEnabled,
  oauth2Provider
} from '../../../../config';
import { ERIONE_VISUAL_IDENTITY } from '../../../../config/erioneVisualIdentity';

const LoginJWT: FC = () => {
  const { login } = useAuth();
  const isMountedRef = useRefMounted();
  const { t }: { t: any } = useTranslation();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState<boolean>(false);

  return (
    <Formik
      initialValues={{
        email: searchParams.get('email') ?? '',
        password: '',
        submit: null
      }}
      validationSchema={Yup.object().shape({
        email: ldapEnabled
          ? Yup.string().required().required('ID is required')
          : Yup.string()
              .email(t('invalid_email'))
              .max(255)
              .required(t('required_email')),
        password: Yup.string().max(255).required(t('required_password'))
      })}
      onSubmit={async (
        values,
        { setErrors, setStatus, setSubmitting }
      ): Promise<void> => {
        setSubmitting(true);
        return login(values.email, values.password, ldapEnabled)
          .catch((err) => {
            showSnackBar(t('wrong_credentials'), 'error');
            setStatus({ success: false });
          })
          .finally(() => {
            if (isMountedRef.current) {
              setSubmitting(false);
            }
          });
      }}
    >
      {({
        errors,
        handleBlur,
        handleChange,
        handleSubmit,
        isSubmitting,
        touched,
        values
      }): JSX.Element => (
        <form noValidate onSubmit={handleSubmit}>
          <TextField
            error={Boolean(touched.email && errors.email)}
            fullWidth
            autoFocus
            helperText={touched.email && errors.email}
            label={ldapEnabled ? t('id') : t('email')}
            name="email"
            onBlur={handleBlur}
            onChange={handleChange}
            type={ldapEnabled ? 'text' : 'email'}
            value={values.email}
            variant="outlined"
            sx={loginFieldSx}
          />
          <TextField
            error={Boolean(touched.password && errors.password)}
            fullWidth
            sx={{ ...loginFieldSx, mt: 2.5 }}
            helperText={touched.password && errors.password}
            label={t('password')}
            name="password"
            onBlur={handleBlur}
            onChange={handleChange}
            type={showPassword ? 'text' : 'password'}
            value={values.password}
            variant="outlined"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)}>
                    <VisibilityIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          <Box
            alignItems="center"
            display="flex"
            flexWrap="wrap"
            gap={1.5}
            justifyContent="flex-end"
            mt={1.5}
          >
            <Link
              component={RouterLink}
              to="/account/recover-password"
              sx={loginLinkSx}
            >
              <b>{t('lost_password')}</b>
            </Link>
            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                width: '100%',
                justifyContent: 'center',
                mt: 2.5
              }}
            >
              <Link component={RouterLink} to="/privacy-policy" sx={legalLinkSx}>
                {t('privacy_policy')}
              </Link>
              <Link component={RouterLink} to="/terms-of-use" sx={legalLinkSx}>
                {t('terms_of_service')}
              </Link>
            </Box>
          </Box>

          <Button
            sx={{
              mt: 3.5,
              minHeight: 56,
              borderRadius: '14px',
              fontSize: 16,
              background: `linear-gradient(90deg, #19C8FF 0%, ${ERIONE_VISUAL_IDENTITY.primary} 52%, #B84DFF 100%)`,
              boxShadow: `0 16px 34px ${alpha('#19C8FF', 0.24)}`,
              '&:hover': {
                background: `linear-gradient(90deg, #16B8EA 0%, ${ERIONE_VISUAL_IDENTITY.primary} 52%, #A23DED 100%)`,
                boxShadow: `0 18px 42px ${alpha('#19C8FF', 0.32)}`
              }
            }}
            color="primary"
            startIcon={isSubmitting ? <CircularProgress size="1rem" /> : null}
            disabled={isSubmitting}
            type="submit"
            fullWidth
            size="large"
            variant="contained"
          >
            {t('login')}
          </Button>
          {isSSOEnabled && !ldapEnabled && (
            <Box>
              <Box display="flex" alignItems="center" my={3}>
                <Divider sx={{ flexGrow: 1 }} />
                <Box px={2} color="text.secondary">
                  {t('or')}
                </Box>
                <Divider sx={{ flexGrow: 1 }} />
              </Box>

              <Button
                onClick={() => {
                  window.location.href = `${apiUrl}oauth2/authorize/${oauth2Provider.toLowerCase()}`;
                }}
                fullWidth
                size="large"
                variant="outlined"
              >
                {t('continue_with_sso')}
              </Button>
            </Box>
          )}
        </form>
      )}
    </Formik>
  );
};

const loginFieldSx = {
  '& .MuiInputLabel-root': {
    color: alpha('#D9E7EF', 0.86)
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#19C8FF'
  },
  '& .MuiOutlinedInput-root': {
    color: '#FFFFFF',
    borderRadius: '14px',
    backgroundColor: alpha('#061826', 0.48),
    '& fieldset': {
      borderColor: alpha('#A9C8FF', 0.24)
    },
    '&:hover fieldset': {
      borderColor: alpha('#19C8FF', 0.72)
    },
    '&.Mui-focused fieldset': {
      borderColor: '#19C8FF',
      boxShadow: `0 0 0 3px ${alpha('#19C8FF', 0.14)}`
    }
  },
  '& .MuiFormHelperText-root': {
    color: '#FFB3B3',
    marginLeft: 0
  },
  '& input:-webkit-autofill': {
    WebkitBoxShadow: `0 0 0 100px ${alpha('#061826', 0.92)} inset`,
    WebkitTextFillColor: '#FFFFFF'
  }
};

const loginLinkSx = {
  color: '#19C8FF',
  fontWeight: 700,
  textDecorationColor: alpha('#19C8FF', 0.52),
  '&:hover': {
    color: '#72E3FF'
  }
};

const legalLinkSx = {
  color: alpha('#D9E7EF', 0.78),
  fontSize: 13,
  '&:hover': {
    color: '#19C8FF'
  }
};

export default LoginJWT;
