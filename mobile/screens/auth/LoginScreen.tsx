import { StatusBar } from 'expo-status-bar';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import * as Yup from 'yup';
import { Formik } from 'formik';
import { useTranslation } from 'react-i18next';
import useAuth from '../../hooks/useAuth';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from '../../store';
import { getInstanceConfig } from '../../slices/instanceConfig';
import { AuthStackScreenProps } from '../../types';
import { getErrorMessage } from '../../utils/api';
import { legalLinks } from '../../config';

export default function LoginScreen({
  navigation
}: AuthStackScreenProps<'Login'>) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { height, width } = useWindowDimensions();
  const compact = height < 760;
  const desktop = Platform.OS === 'web' && width >= 720;
  const shouldShowRegistration = false;
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const { ldapEnabled } = useSelector((state) => state.instanceConfig);

  useEffect(() => {
    dispatch(getInstanceConfig());
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <View style={styles.backgroundLayer}>
          <View style={styles.pinkGlow} />
          <View style={styles.blueGlow} />
          <View style={styles.lineOne} />
          <View style={styles.lineTwo} />
        </View>

        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            compact && styles.scrollContentCompact,
            desktop && styles.scrollContentDesktop
          ]}
        >
          <View
            style={[styles.deviceFrame, desktop && styles.deviceFrameDesktop]}
          >
            <View style={[styles.content, compact && styles.contentCompact]}>
              <View
                style={[styles.logoWrapper, compact && styles.logoCompact]}
              >
                <Image
                  source={require('../../assets/images/erione-logo.png')}
                  style={[styles.logo, compact && styles.logoImageCompact]}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.headline}>
                <Text style={[styles.title, compact && styles.titleCompact]}>
                  Bem-vindo{'\n'}
                  <Text style={styles.titleAccent}>de volta.</Text>
                </Text>

                <Text
                  style={[styles.subtitle, compact && styles.subtitleCompact]}
                >
                  Acesse o Erione CMMS para continuar.
                </Text>
              </View>
            </View>

            <Formik
              initialValues={{ email: '', password: '', submit: null }}
              validationSchema={Yup.object().shape({
                email: ldapEnabled
                  ? Yup.string().required(t('id_required'))
                  : Yup.string()
                      .email(t('invalid_email'))
                      .max(255)
                      .required(t('required_email')),
                password: Yup.string()
                  .max(255)
                  .required(t('required_password'))
              })}
              onSubmit={async (values, { setSubmitting }) => {
                setLoginError(null);
                setSubmitting(true);
                try {
                  await login(values.email, values.password, ldapEnabled);
                } catch (err) {
                  if (err instanceof TypeError) {
                    setLoginError(
                      'Servidor inacessível. Verifique a conexão com a API.'
                    );
                  } else {
                    setLoginError(
                      getErrorMessage(
                        err,
                        'Credenciais inválidas. Confira e-mail e senha.'
                      )
                    );
                  }
                } finally {
                  setSubmitting(false);
                }
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
              }) => (
                <View
                  style={[
                    styles.loginCard,
                    compact && styles.loginCardCompact,
                    desktop && styles.loginCardDesktop
                  ]}
                >
                  <View style={styles.field}>
                    <Text style={styles.label}>
                      {ldapEnabled ? t('id') : t('email')}
                    </Text>
                    <View
                      style={[
                        styles.inputWrap,
                        Boolean(touched.email && errors.email) &&
                          styles.inputWrapError
                      ]}
                    >
                      <Text style={styles.inputIcon}>@</Text>
                      <TextInput
                        placeholder={ldapEnabled ? 'usuario' : 'email'}
                        placeholderTextColor="rgba(255,255,255,0.42)"
                        selectionColor="#ef3b63"
                        style={styles.input}
                        onBlur={handleBlur('email')}
                        onChangeText={handleChange('email')}
                        value={values.email}
                        autoCapitalize="none"
                        keyboardType={
                          ldapEnabled ? 'default' : 'email-address'
                        }
                        textContentType="emailAddress"
                      />
                    </View>
                    {Boolean(touched.email && errors.email) && (
                      <Text style={styles.fieldError}>
                        {errors.email?.toString()}
                      </Text>
                    )}
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>{t('password')}</Text>
                    <View
                      style={[
                        styles.inputWrap,
                        Boolean(touched.password && errors.password) &&
                          styles.inputWrapError
                      ]}
                    >
                      <Text style={styles.inputIcon}>*</Text>
                      <TextInput
                        placeholder="******"
                        placeholderTextColor="rgba(255,255,255,0.42)"
                        selectionColor="#ef3b63"
                        style={styles.input}
                        onBlur={handleBlur('password')}
                        onChangeText={handleChange('password')}
                        value={values.password}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        textContentType="password"
                      />
                      <Pressable
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.showToggle}
                      >
                        <Text style={styles.showToggleText}>
                          {t(showPassword ? 'show_password' : 'hide_password')}
                        </Text>
                      </Pressable>
                    </View>
                    {Boolean(touched.password && errors.password) && (
                      <Text style={styles.fieldError}>
                        {errors.password?.toString()}
                      </Text>
                    )}
                  </View>

                  {loginError ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{loginError}</Text>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={() => handleSubmit()}
                    disabled={isSubmitting}
                    style={({ pressed }) => [
                      styles.submit,
                      compact && styles.submitCompact,
                      pressed && styles.submitPressed,
                      isSubmitting && styles.submitDisabled
                    ]}
                  >
                    <Text style={styles.submitText}>
                      {isSubmitting ? 'Entrando...' : 'Entrar'}
                    </Text>
                  </Pressable>

                  <View style={styles.legalNotice}>
                    <Text style={styles.legalText}>
                      Ao entrar, você concorda com os{' '}
                      <Text
                        style={styles.legalLink}
                        onPress={() => Linking.openURL(legalLinks.termsOfUse)}
                      >
                        Termos de Uso
                      </Text>{' '}
                      e a{' '}
                      <Text
                        style={styles.legalLink}
                        onPress={() =>
                          Linking.openURL(legalLinks.privacyPolicy)
                        }
                      >
                        Política de Privacidade
                      </Text>
                      .
                    </Text>
                  </View>

                  {shouldShowRegistration && !ldapEnabled && (
                    <Pressable
                      onPress={() => navigation.navigate('Register')}
                      style={({ pressed }) => [
                        styles.registerPressable,
                        pressed && styles.registerPressed
                      ]}
                    >
                      <Text style={styles.registerText}>
                        {t('no_account_yet')}
                      </Text>
                    </Pressable>
                  )}

                  <Text style={styles.footerNote}>
                    Copyright © 2026 Erione
                  </Text>
                </View>
              )}
            </Formik>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07090e'
  },
  keyboard: {
    backgroundColor: '#07090e',
    flex: 1
  },
  scroll: {
    backgroundColor: '#07090e',
    flex: 1
  },
  scrollContent: {
    alignItems: 'center',
    backgroundColor: '#07090e',
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: 28
  },
  scrollContentCompact: {
    paddingTop: 16
  },
  scrollContentDesktop: {
    justifyContent: 'center',
    paddingBottom: 28,
    paddingHorizontal: 20
  },
  deviceFrame: {
    justifyContent: 'flex-end',
    width: '100%'
  },
  deviceFrameDesktop: {
    maxWidth: 430,
    minHeight: 720
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#07090e'
  },
  pinkGlow: {
    backgroundColor: 'rgba(239,59,99,0.18)',
    borderRadius: 140,
    height: 230,
    left: -68,
    position: 'absolute',
    top: 28,
    width: 230
  },
  blueGlow: {
    backgroundColor: 'rgba(45,85,163,0.22)',
    borderRadius: 155,
    height: 270,
    position: 'absolute',
    right: -104,
    top: 124,
    width: 270
  },
  lineOne: {
    backgroundColor: 'rgba(239,59,99,0.15)',
    height: 2,
    left: -34,
    position: 'absolute',
    top: 188,
    transform: [{ rotate: '-32deg' }],
    width: 210
  },
  lineTwo: {
    backgroundColor: 'rgba(45,85,163,0.22)',
    height: 2,
    position: 'absolute',
    right: -38,
    top: 384,
    transform: [{ rotate: '-32deg' }],
    width: 220
  },
  content: {
    paddingHorizontal: 28
  },
  contentCompact: {
    paddingHorizontal: 24
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 12
  },
  logoCompact: {
    marginBottom: 6
  },
  logo: {
    height: 100,
    width: 165
  },
  logoImageCompact: {
    height: 76,
    width: 132
  },
  headline: {
    marginTop: 2
  },
  title: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 48
  },
  titleCompact: {
    fontSize: 40,
    lineHeight: 40
  },
  titleAccent: {
    color: '#ef3b63'
  },
  subtitle: {
    color: '#9ba0aa',
    fontSize: 18,
    lineHeight: 26,
    marginTop: 18,
    maxWidth: 312
  },
  subtitleCompact: {
    fontSize: 16,
    lineHeight: 23,
    marginTop: 12
  },
  loginCard: {
    backgroundColor: 'rgba(19,20,24,0.98)',
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderTopWidth: 1,
    gap: 20,
    marginTop: 46,
    paddingBottom: 32,
    paddingHorizontal: 28,
    paddingTop: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.36,
    shadowRadius: 42,
    width: '100%'
  },
  loginCardCompact: {
    gap: 16,
    marginTop: 26,
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 24
  },
  loginCardDesktop: {
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1
  },
  field: {
    gap: 10
  },
  label: {
    color: '#b7bbc5',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 16
  },
  inputWrapError: {
    borderColor: 'rgba(248,113,113,0.5)'
  },
  inputIcon: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 21,
    marginRight: 14,
    width: 22
  },
  input: {
    color: '#ffffff',
    flex: 1,
    fontSize: 16,
    minHeight: 56,
    paddingVertical: 0
  },
  showToggle: {
    paddingLeft: 8
  },
  showToggleText: {
    color: '#ef3b63',
    fontSize: 11,
    fontWeight: '900'
  },
  fieldError: {
    color: '#fca5a5',
    fontSize: 12,
    marginTop: -4
  },
  errorBox: {
    backgroundColor: 'rgba(127,29,29,0.25)',
    borderColor: 'rgba(248,113,113,0.35)',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 18
  },
  submit: {
    alignItems: 'center',
    backgroundColor: '#ef3b63',
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 62,
    shadowColor: '#ef3b63',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.26,
    shadowRadius: 28
  },
  submitCompact: {
    minHeight: 56
  },
  submitPressed: {
    opacity: 0.9
  },
  submitDisabled: {
    opacity: 0.55
  },
  submitText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900'
  },
  registerPressable: {
    alignSelf: 'center'
  },
  registerPressed: {
    opacity: 0.6
  },
  registerText: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 13,
    textDecorationLine: 'underline'
  },
  legalNotice: {
    alignItems: 'center',
    marginTop: -4,
    paddingHorizontal: 8
  },
  legalText: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center'
  },
  legalLink: {
    color: '#ef3b63',
    fontWeight: '900',
    textDecorationLine: 'underline'
  },
  footerNote: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center'
  }
});
