import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import * as Yup from 'yup';
import { AuthStackScreenProps } from '../../types';
import { Formik } from 'formik';
import { useTranslation } from 'react-i18next';
import useAuth from '../../hooks/useAuth';
import { useContext, useEffect, useState } from 'react';
import { HelperText, Text, TextInput } from 'react-native-paper';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import { useDispatch, useSelector } from '../../store';
import { getInstanceConfig } from '../../slices/instanceConfig';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';
import { getErrorMessage } from '../../utils/api';
import { ErionePrimaryButton } from '../../components/erione/ErioneUI';

const colors = ERIONE_MOBILE_IDENTITY.colors;

export default function LoginScreen({
  navigation
}: AuthStackScreenProps<'Login'>) {
  const { t } = useTranslation();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { login } = useAuth();
  const shouldShowRegistration = Platform.OS !== 'ios';
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const { ldapEnabled } = useSelector((state) => state.instanceConfig);

  useEffect(() => {
    dispatch(getInstanceConfig());
  }, []);

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={styles.topColorBlock} />
        <View style={styles.brandPanel} />
        <View style={styles.accentRail} />
        <View style={styles.bottomColorBlock} />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandHeader}>
            <Image
              style={styles.logo}
              resizeMode="contain"
              source={require('../../assets/images/erione-logo.png')}
            />
            <Text style={styles.brandKicker}>Erione CMMS</Text>
            <Text style={styles.welcome}>Bem-vindo de volta</Text>
            <Text style={styles.subtitle}>
              Acesse o Erione CMMS para continuar
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
              password: Yup.string().max(255).required(t('required_password'))
            })}
            onSubmit={async (
              values,
              { setStatus, setSubmitting }
            ): Promise<void> => {
              setSubmitting(true);
              return login(values.email, values.password, ldapEnabled)
                .catch((err) => {
                  if (err instanceof TypeError) {
                    showSnackBar(
                      'Servidor inacessivel. Verifique a conexao com a API.',
                      'error'
                    );
                  } else {
                    showSnackBar(
                      getErrorMessage(
                        err,
                        'Credenciais invalidas. Confira e-mail e senha.'
                      ),
                      'error'
                    );
                  }
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
              values
            }) => (
              <View style={styles.card}>
                <TextInput
                  error={Boolean(touched.email && errors.email)}
                  label={ldapEnabled ? t('id') : t('email')}
                  placeholder={ldapEnabled ? 'usuario' : 'email'}
                  onBlur={handleBlur('email')}
                  onChangeText={handleChange('email')}
                  value={values.email}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                  autoCapitalize="none"
                  keyboardType={ldapEnabled ? 'default' : 'email-address'}
                  left={
                    <TextInput.Icon
                      icon="email-outline"
                      color={colors.primary}
                    />
                  }
                />
                {Boolean(touched.email && errors.email) && (
                  <HelperText type="error" style={styles.helperText}>
                    {errors.email?.toString()}
                  </HelperText>
                )}

                <TextInput
                  error={Boolean(touched.password && errors.password)}
                  label={t('password')}
                  placeholder="••••••"
                  onBlur={handleBlur('password')}
                  onChangeText={handleChange('password')}
                  value={values.password}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                  left={
                    <TextInput.Icon icon="lock-outline" color={colors.primary} />
                  }
                  right={
                    <TextInput.Icon
                      onPress={() => setShowPassword(!showPassword)}
                      icon={showPassword ? 'eye-off' : 'eye'}
                    />
                  }
                />
                {Boolean(touched.password && errors.password) && (
                  <HelperText type="error" style={styles.helperText}>
                    {errors.password?.toString()}
                  </HelperText>
                )}

                <ErionePrimaryButton
                  icon="login"
                  onPress={() => handleSubmit()}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  style={styles.loginButton}
                >
                  {isSubmitting ? 'Entrando...' : 'Entrar'}
                </ErionePrimaryButton>

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
              </View>
            )}
          </Formik>
          <Text style={styles.footer}>© 2026 Erione</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#F2FAF8'
  },
  topColorBlock: {
    position: 'absolute',
    top: -128,
    left: -42,
    right: -42,
    height: 390,
    backgroundColor: colors.primaryDark,
    transform: [{ rotate: '-5deg' }]
  },
  brandPanel: {
    position: 'absolute',
    top: 68,
    left: -90,
    width: 230,
    height: 420,
    backgroundColor: colors.primary,
    opacity: 0.2,
    transform: [{ rotate: '18deg' }]
  },
  accentRail: {
    position: 'absolute',
    top: 122,
    right: -48,
    width: 118,
    height: 420,
    backgroundColor: colors.accent,
    opacity: 0.16,
    transform: [{ rotate: '-14deg' }]
  },
  bottomColorBlock: {
    position: 'absolute',
    left: -35,
    right: -35,
    bottom: -150,
    height: 260,
    backgroundColor: colors.primarySoft,
    transform: [{ rotate: '4deg' }]
  },
  flex: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 42,
    paddingHorizontal: 24
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24
  },
  logo: {
    width: 82,
    height: 82,
    marginBottom: 10
  },
  brandKicker: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 6
  },
  welcome: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0
  },
  subtitle: {
    fontSize: 14,
    color: '#DDF7EC',
    textAlign: 'center',
    marginTop: 6
  },
  card: {
    alignSelf: 'stretch',
    ...(Platform.OS === 'web'
      ? { maxWidth: 420, alignSelf: 'center' as any }
      : {}),
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#DDE7E7',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 6
  },
  input: {
    marginBottom: 4,
    backgroundColor: colors.surface
  },
  inputOutline: {
    borderRadius: 12
  },
  helperText: {
    marginBottom: 4
  },
  loginButton: {
    marginTop: 20
  },
  registerPressable: {
    alignSelf: 'center',
    marginTop: 16
  },
  registerPressed: {
    opacity: 0.6
  },
  registerText: {
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'underline'
  },
  footer: {
    marginTop: 32,
    fontSize: 12,
    color: colors.muted
  }
});
