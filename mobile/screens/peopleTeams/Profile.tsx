import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as React from 'react';
import { Fragment, useContext, useState } from 'react';
import { RootStackScreenProps } from '../../types';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Dialog,
  HelperText,
  Portal,
  Text,
  TextInput
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Formik } from 'formik';
import useAuth from '../../hooks/useAuth';
import { getUserInitials } from '../../utils/displayers';
import * as Yup from 'yup';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import * as ImagePicker from 'expo-image-picker';
import { CompanySettingsContext } from '../../contexts/CompanySettingsContext';
import { OwnUser } from '../../models/user';
import { formatImages } from '../../utils/overall';
import { useAppTheme } from '../../custom-theme';
import { IconWithLabel } from '../../components/IconWithLabel';

export default function UserProfile(_props: RootStackScreenProps<'UserProfile'>) {
  const {
    user,
    updatePassword,
    patchUser
  } = useAuth();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [changingPicture, setChangingPicture] = useState<boolean>(false);
  const [openChangePassword, setOpenChangePassword] = useState<boolean>();
  const { uploadFiles } = useContext(CompanySettingsContext);
  const onPictureChange = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status === 'granted') {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 1
      });

      if (!result.canceled) {
        setChangingPicture(true);
        uploadFiles([], formatImages(result), true)
          .then((files) =>
            patchUser({ image: { id: files[0].id } } as Partial<OwnUser>)
          )
          .finally(() => setChangingPicture(false));
      }
    }
  };

  const renderChangePassword = () => {
    return (
      <Portal theme={theme}>
        <Dialog
          visible={openChangePassword}
          onDismiss={() => setOpenChangePassword(false)}
          style={{ backgroundColor: 'white', borderRadius: 5 }}
        >
          <Dialog.Title>{t('change_password')}</Dialog.Title>
          <Formik
            initialValues={{
              oldPassword: '',
              newPassword: '',
              confirmPassword: ''
            }}
            validationSchema={Yup.object().shape({
              oldPassword: Yup.string()
                .required(t('required_old_password'))
                .min(8, t('invalid_password')),
              newPassword: Yup.string()
                .required(t('required_new_password'))
                .min(8, t('invalid_password')),
              confirmPassword: Yup.string().oneOf(
                [Yup.ref('newPassword'), null],
                t('passwords_must_match')
              )
            })}
            onSubmit={async (
              _values,
              { resetForm, setErrors, setStatus, setSubmitting }
            ) => {
              setSubmitting(true);
              return updatePassword(_values)
                .then(() => {
                  setOpenChangePassword(false);
                  showSnackBar(t('password_change_success'), 'success');
                })
                .catch((err) => showSnackBar(t('wrong_password'), 'error'))
                .finally(() => setSubmitting(false));
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
              <Fragment>
                <Dialog.Content>
                  <TextInput
                    error={Boolean(touched.oldPassword && errors.oldPassword)}
                    label={t('current_password')}
                    onBlur={handleBlur('oldPassword')}
                    onChangeText={handleChange('oldPassword')}
                    value={values.oldPassword}
                    secureTextEntry={true}
                    mode="outlined"
                  />
                  {Boolean(touched.oldPassword && errors.oldPassword) && (
                    <HelperText type="error">
                      {errors.oldPassword?.toString()}
                    </HelperText>
                  )}
                  <TextInput
                    error={Boolean(touched.newPassword && errors.newPassword)}
                    label={t('new_password')}
                    onBlur={handleBlur('newPassword')}
                    onChangeText={handleChange('newPassword')}
                    value={values.newPassword}
                    secureTextEntry={true}
                    mode="outlined"
                  />
                  {Boolean(touched.newPassword && errors.newPassword) && (
                    <HelperText type="error">
                      {errors.newPassword?.toString()}
                    </HelperText>
                  )}
                  <TextInput
                    error={Boolean(
                      touched.confirmPassword && errors.confirmPassword
                    )}
                    label={t('confirm_password')}
                    onBlur={handleBlur('confirmPassword')}
                    onChangeText={handleChange('confirmPassword')}
                    value={values.confirmPassword}
                    secureTextEntry={true}
                    mode="outlined"
                  />
                  {Boolean(
                    touched.confirmPassword && errors.confirmPassword
                  ) && (
                    <HelperText type="error">
                      {errors.confirmPassword?.toString()}
                    </HelperText>
                  )}
                </Dialog.Content>
                <Dialog.Actions>
                  <Button onPress={() => setOpenChangePassword(false)}>
                    {t('cancel')}
                  </Button>
                  <Button
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    onPress={() => handleSubmit()}
                  >
                    {t('change_password')}
                  </Button>
                </Dialog.Actions>
              </Fragment>
            )}
          </Formik>
        </Dialog>
      </Portal>
    );
  };

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: theme.colors.background
      }}
    >
      {renderChangePassword()}
      <View
        style={{
          alignItems: 'center',
          paddingVertical: 30,
          backgroundColor: 'white'
        }}
      >
        {changingPicture ? (
          <ActivityIndicator size="large" />
        ) : (
          <TouchableOpacity onPress={onPictureChange}>
            {user.image ? (
              <Avatar.Image size={100} source={{ uri: user.image.url }} />
            ) : (
              <Avatar.Text
                size={100}
                label={getUserInitials(user)}
                style={{ backgroundColor: theme.colors.background }}
              />
            )}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: theme.colors.primary,
                borderRadius: 20,
                padding: 4,
                borderWidth: 2,
                borderColor: 'white'
              }}
            >
              <Avatar.Icon
                size={20}
                icon="camera"
                color="white"
                style={{ backgroundColor: 'transparent' }}
              />
            </View>
          </TouchableOpacity>
        )}
        <Text
          variant="headlineSmall"
          style={{ marginTop: 15, fontWeight: 'bold' }}
        >
          {`${user.firstName} ${user.lastName}`}
        </Text>
        <Text variant="bodyLarge" style={{ color: theme.colors.grey }}>
          {user.jobTitle}
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {t('informations')}
        </Text>
        <View style={styles.sectionContent}>
          {user.email && (
            <IconWithLabel
              label={user.email}
              icon="email-outline"
              color={theme.colors.grey}
            />
          )}
          {user.phone && (
            <IconWithLabel
              label={user.phone}
              icon="phone-outline"
              color={theme.colors.grey}
            />
          )}
          {user.role && (
            <IconWithLabel
              label={user.role.name}
              icon="shield-account-outline"
              color={theme.colors.grey}
            />
          )}
        </View>
      </View>

      <View style={{ padding: 20 }}>
        <Button
          mode={'outlined'}
          onPress={() => setOpenChangePassword(true)}
        >
          {t('change_password')}
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: {},
  sectionTitle: {
    marginHorizontal: 20,
    marginVertical: 8,
    color: '#666',
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: 'bold'
  },
  sectionContent: {
    backgroundColor: 'white',
    padding: 20,
    gap: 10
  },
});
