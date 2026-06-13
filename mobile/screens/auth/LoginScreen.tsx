import { StatusBar } from 'expo-status-bar';
import {
  Image,
  ImageBackground,
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

const recoverAccessUrl =
  'mailto:suporte@erione.com.br?subject=Recuperar%20acesso%20Erione%20CMMS';

export default function LoginScreen({}: AuthStackScreenProps<'Login'>) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { height, width } = useWindowDimensions();
  const compact = height < 760;
  const desktop = Platform.OS === 'web' && width >= 720;
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const { ldapEnabled } = useSelector((state) => state.instanceConfig);

  useEffect(() => {
    dispatch(getInstanceConfig());
  }, []);

  const openExternalLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <View style={styles.backgroundLayer}>
          <ImageBackground
            source={require('../../assets/images/erione-login-background.png')}
            resizeMode="cover"
            style={styles.backgroundImage}
            imageStyle={styles.backgroundImageAsset}
          >
            <View style={styles.backgroundOverlay} />
            <View style={styles.backgroundVignette} />
          </ImageBackground>
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
            <View style={[styles.hero, compact && styles.heroCompact]}>
              <View style={styles.logoShell}>
                <Image
                  source={require('../../assets/images/erione-logo.png')}
                  style={[styles.logo, compact && styles.logoImageCompact]}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.productLine}>
                Gestao de Ordens de Servico
              </Text>
              <Text style={styles.productSubtitle}>
                Seguranca, TI, IoT e IA para operacao em campo.
              </Text>
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
                      'Servidor inacessivel. Verifique sua conexao e tente novamente.'
                    );
                  } else {
                    setLoginError(
                      getErrorMessage(
                        err,
                        'Credenciais invalidas. Confira e-mail e senha.'
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
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Acesse o CMMS</Text>
                    <Text style={styles.cardSubtitle}>
                      Entre para acompanhar e executar ordens de servico.
                    </Text>
                  </View>

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
                        placeholderTextColor="rgba(223,234,241,0.48)"
                        selectionColor="#E11D48"
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
                        placeholder="Senha"
                        placeholderTextColor="rgba(223,234,241,0.48)"
                        selectionColor="#E11D48"
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
                        hitSlop={8}
                      >
                        <Text style={styles.showToggleText}>
                          {showPassword ? 'Ocultar' : 'Ver'}
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
                      {isSubmitting ? 'Entrando...' : 'Entrar no CMMS'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openExternalLink(recoverAccessUrl)}
                    style={styles.recoverAccess}
                  >
                    <Text style={styles.recoverAccessText}>
                      Esqueci minha senha
                    </Text>
                  </Pressable>

                  <View style={styles.capabilityRow}>
                    <Text style={styles.capabilityText}>Seguranca</Text>
                    <View style={styles.capabilityDot} />
                    <Text style={styles.capabilityText}>TI</Text>
                    <View style={styles.capabilityDot} />
                    <Text style={styles.capabilityText}>IoT</Text>
                    <View style={styles.capabilityDot} />
                    <Text style={styles.capabilityText}>IA</Text>
                  </View>

                  <View style={styles.legalLinks}>
                    <Pressable
                      onPress={() => openExternalLink(legalLinks.privacyPolicy)}
                      style={styles.legalButton}
                    >
                      <Text style={styles.legalLink}>
                        Politica de Privacidade
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => openExternalLink(legalLinks.termsOfUse)}
                      style={styles.legalButton}
                    >
                      <Text style={styles.legalLink}>Termos de Uso</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.footerNote}>© 2026 Erione</Text>
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
    backgroundColor: '#061826'
  },
  keyboard: {
    flex: 1
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28
  },
  scrollContentCompact: {
    justifyContent: 'flex-start',
    paddingVertical: 18
  },
  scrollContentDesktop: {
    paddingVertical: 32
  },
  deviceFrame: {
    justifyContent: 'center',
    width: '100%'
  },
  deviceFrameDesktop: {
    maxWidth: 430,
    minHeight: 720
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#031426',
    overflow: 'hidden'
  },
  backgroundImage: {
    flex: 1
  },
  backgroundImageAsset: {
    opacity: 1
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,14,27,0.18)'
  },
  backgroundVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.10)'
  },
  hero: {
    alignItems: 'center',
    marginBottom: 22,
    paddingHorizontal: 18
  },
  heroCompact: {
    marginBottom: 14
  },
  logoShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  logo: {
    height: 78,
    width: 174
  },
  logoImageCompact: {
    height: 64,
    width: 148
  },
  productLine: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    textAlign: 'center'
  },
  productSubtitle: {
    color: '#A7B6C2',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 310,
    textAlign: 'center'
  },
  loginCard: {
    backgroundColor: 'rgba(5,24,40,0.68)',
    borderColor: 'rgba(169,200,255,0.30)',
    borderRadius: 28,
    borderWidth: 1,
    gap: 18,
    paddingBottom: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.46,
    shadowRadius: 38,
    width: '100%'
  },
  loginCardCompact: {
    gap: 14,
    paddingBottom: 20,
    paddingHorizontal: 18,
    paddingTop: 20
  },
  loginCardDesktop: {
    shadowOpacity: 0.42
  },
  cardHeader: {
    gap: 5
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900'
  },
  cardSubtitle: {
    color: '#A7B6C2',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19
  },
  field: {
    gap: 9
  },
  label: {
    color: '#D9E7EF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(3,18,32,0.62)',
    borderColor: 'rgba(169,200,255,0.24)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 16
  },
  inputWrapError: {
    borderColor: '#FF5C5C'
  },
  inputIcon: {
    color: '#7BA0B7',
    fontSize: 20,
    fontWeight: '900',
    marginRight: 13,
    textAlign: 'center',
    width: 22
  },
  input: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 16,
    minHeight: 56,
    paddingVertical: 0
  },
  showToggle: {
    alignItems: 'center',
    borderColor: 'rgba(120,168,255,0.28)',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 60,
    paddingHorizontal: 10
  },
  showToggleText: {
    color: '#A9C8FF',
    fontSize: 12,
    fontWeight: '900'
  },
  fieldError: {
    color: '#FFB3B3',
    fontSize: 12,
    marginTop: -3
  },
  errorBox: {
    backgroundColor: 'rgba(255,92,92,0.12)',
    borderColor: 'rgba(255,92,92,0.42)',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  errorText: {
    color: '#FFB3B3',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18
  },
  submit: {
    alignItems: 'center',
    backgroundColor: '#E11D48',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 58,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 24
  },
  submitCompact: {
    minHeight: 54
  },
  submitPressed: {
    backgroundColor: '#B91C3B',
    transform: [{ scale: 0.995 }]
  },
  submitDisabled: {
    opacity: 0.58
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900'
  },
  recoverAccess: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36
  },
  recoverAccessText: {
    color: '#D9E7EF',
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline'
  },
  capabilityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center'
  },
  capabilityDot: {
    backgroundColor: '#E11D48',
    borderRadius: 3,
    height: 5,
    width: 5
  },
  capabilityText: {
    color: '#A7B6C2',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  legalLinks: {
    alignItems: 'center',
    gap: 6,
    marginTop: -2
  },
  legalButton: {
    justifyContent: 'center',
    minHeight: 28
  },
  legalLink: {
    color: '#A9C8FF',
    fontSize: 12,
    fontWeight: '900',
    textDecorationLine: 'underline'
  },
  footerNote: {
    color: 'rgba(223,234,241,0.48)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: -2,
    textAlign: 'center'
  }
});
