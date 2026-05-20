import { Image, Platform, ScrollView, StyleSheet, View } from 'react-native';
import * as Yup from 'yup';
import { AuthStackScreenProps } from '../../types';
import { Formik } from 'formik';
import { useTranslation } from 'react-i18next';
import useAuth from '../../hooks/useAuth';
import { useContext, useEffect, useState } from 'react';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import * as React from 'react';
import { Asset } from 'expo-asset';
import { useAppTheme } from '../../custom-theme';
import { getApiUrl } from '../../config';
import api, { authHeader } from '../../utils/api';
import { useDispatch, useSelector } from '../../store';
import { getInstanceConfig } from '../../slices/instanceConfig';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';

export default function LoginScreen({
  navigation
}: AuthStackScreenProps<'Login'>) {
  const { t } = useTranslation();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { login } = useAuth();
  const theme = useAppTheme();
  const shouldShowRegistration = Platform.OS !== 'ios';
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const toggleShowPassword = () => setShowPassword((value) => !value);
  const dispatch = useDispatch();
  const { ldapEnabled } = useSelector((state) => state.instanceConfig);

  useEffect(() => {
    dispatch(getInstanceConfig());
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.backgroundLayer}>
        <View style={[styles.orb, styles.orbTop]} />
        <View style={[styles.orb, styles.orbBottom]} />
        <View style={styles.gridLineOne} />
        <View style={styles.gridLineTwo} />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandHeader}>
          <Image
            style={styles.logo}
            resizeMode="contain"
            source={require('../../assets/images/erione-logo.png')}
          />
          <Text style={styles.brandTitle}>{ERIONE_MOBILE_IDENTITY.appName}</Text>
          <Text style={styles.brandSubtitle}>
            {t('erione_mobile_login_subtitle')}
          </Text>
        </View>
        <Formik
          initialValues={{
            email: '',
            password: '',
            submit: null
          }}
          validationSchema={Yup.object().shape({
            email: ldapEnabled
              ? Yup.string().required(t('id_required'))
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
                setSubmitting(false);
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
            values,
            setFieldValue
          }) => (
            <View style={styles.loginCard}>
              <TextInput
                error={Boolean(touched.email && errors.email)}
                label={ldapEnabled ? t('id') : t('email')}
                onBlur={handleBlur('email')}
                onChangeText={handleChange('email')}
                value={values.email}
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
                autoCapitalize="none"
                keyboardType={ldapEnabled ? 'default' : 'email-address'}
              />
              {Boolean(touched.email && errors.email) && (
                <HelperText type="error">{errors.email?.toString()}</HelperText>
              )}
              <TextInput
                error={Boolean(touched.password && errors.password)}
                label={t('password')}
                onBlur={handleBlur('password')}
                onChangeText={handleChange('password')}
                value={values.password}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                right={
                  <TextInput.Icon onPress={toggleShowPassword} icon="eye" />
                }
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
              />
              {Boolean(touched.password && errors.password) && (
                <HelperText type="error">
                  {errors.password?.toString()}
                </HelperText>
              )}
              <Button
                color={theme.colors.primary}
                onPress={() => handleSubmit()}
                loading={isSubmitting}
                style={styles.loginButton}
                contentStyle={styles.loginButtonContent}
                disabled={isSubmitting}
                mode="contained"
              >
                {t('login')}
              </Button>
              {shouldShowRegistration && !ldapEnabled && (
                <>
                  <Text style={{ marginVertical: 20 }}>
                    {t('no_account_yet')}
                  </Text>
                  <Button
                    mode={'outlined'}
                    onPress={() => navigation.navigate('Register')}
                    style={{
                      // @ts-ignore
                      color: theme.colors.primary
                    }}
                  >
                    {t('register_here')}
                  </Button>
                </>
              )}

              <Button
                mode={'text'}
                onPress={() => navigation.navigate('CustomServer')}
                style={{
                  marginTop: 14
                }}
              >
                {t('custom_server')}
              </Button>
            </View>
          )}
        </Formik>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ERIONE_MOBILE_IDENTITY.colors.background
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: ERIONE_MOBILE_IDENTITY.colors.background
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.78
  },
  orbTop: {
    width: 340,
    height: 340,
    top: -130,
    right: -140,
    backgroundColor: ERIONE_MOBILE_IDENTITY.colors.accentSoft
  },
  orbBottom: {
    width: 420,
    height: 420,
    bottom: -190,
    left: -190,
    backgroundColor: ERIONE_MOBILE_IDENTITY.colors.primarySoft
  },
  gridLineOne: {
    position: 'absolute',
    top: 130,
    left: -30,
    width: '120%',
    height: 1,
    backgroundColor: 'rgba(11, 78, 162, 0.09)',
    transform: [{ rotate: '-12deg' }]
  },
  gridLineTwo: {
    position: 'absolute',
    bottom: 170,
    left: -40,
    width: '130%',
    height: 1,
    backgroundColor: 'rgba(20, 167, 224, 0.12)',
    transform: [{ rotate: '16deg' }]
  },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    paddingVertical: 42
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 18
  },
  logo: {
    width: 118,
    height: 118,
    marginBottom: 10
  },
  brandTitle: {
    color: ERIONE_MOBILE_IDENTITY.colors.text,
    fontSize: 26,
    fontWeight: '800'
  },
  brandSubtitle: {
    color: ERIONE_MOBILE_IDENTITY.colors.muted,
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center'
  },
  loginCard: {
    alignSelf: 'stretch',
    marginHorizontal: 18,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderRadius: 28,
    backgroundColor: ERIONE_MOBILE_IDENTITY.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: ERIONE_MOBILE_IDENTITY.colors.border,
    shadowColor: ERIONE_MOBILE_IDENTITY.colors.primaryDark,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 10
  },
  input: {
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)'
  },
  inputOutline: {
    borderColor: 'rgba(11, 78, 162, 0.22)',
    borderRadius: 14
  },
  loginButton: {
    marginTop: 18,
    borderRadius: 16,
    shadowColor: ERIONE_MOBILE_IDENTITY.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4
  },
  loginButtonContent: {
    minHeight: 52
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%'
  },
  scrollView: {
    flex: 1,
    width: '100%'
  },
  checkboxContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center'
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center'
  }
});
