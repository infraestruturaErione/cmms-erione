import { Linking, StyleSheet } from 'react-native';
import { View } from '../components/Themed';
import {
  Avatar,
  Button,
  Dialog,
  IconButton,
  List,
  Portal,
  Text,
  useTheme
} from 'react-native-paper';
import useAuth from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { getUserInitials } from '../utils/displayers';
import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { RootStackScreenProps } from '../types';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { showMessage } from 'react-native-flash-message';
import { CustomSnackBarContext } from '../contexts/CustomSnackBarContext';
import tr from '../i18n/translations/tr';
import { legalLinks } from '../config';

export default function SettingsScreen({
                                         navigation
                                       }: RootStackScreenProps<'Settings'>) {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [versionPressCount, setVersionPressCount] = useState<number>(0);
  const [openLogout, setOpenLogout] = useState<boolean>(false);
  const [openDevInfo, setOpenDevInfo] = useState<boolean>(false);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [devMode, setDevMode] = useState<boolean>(false);
  useEffect(() => {
    if (versionPressCount > 2 && versionPressCount < 6) {
      showSnackBar(`Dev mode in ${6 - versionPressCount}`, 'info');
    } else if (versionPressCount === 6) {
      setOpenDevInfo(true);
      setDevMode(true);
      setVersionPressCount(0);
    }
  }, [versionPressCount]);
  const renderConfirmLogout = () => {
    return (
      <Portal theme={theme}>
        <Dialog visible={openLogout} onDismiss={() => setOpenLogout(false)}>
          <Dialog.Title>{t('confirmation')}</Dialog.Title>
          <Dialog.Content>
            <Text variant='bodyMedium'>{t('confirm_logout')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpenLogout(false)}>{t('cancel')}</Button>
            <Button onPress={logout}>{t('Sign out')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };
  const renderDevInfo = () => {
    return (
      <Portal theme={theme}>
        <Dialog visible={openDevInfo} onDismiss={() => setOpenDevInfo(false)}>
          <Dialog.Title>{t('Dev Info')}</Dialog.Title>
          <Dialog.Content>
            <Text variant='titleMedium'>{t('Build ID')}</Text>
            <Text variant='bodyMedium'>{Updates.updateId}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpenDevInfo(false)}>{t('cancel')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {renderConfirmLogout()}
      {renderDevInfo()}
      <View>
        <List.Item
          style={{ paddingHorizontal: 20 }}
          left={(props) =>
            user.image ? (
              <Avatar.Image source={{ uri: user.image.url }} />
            ) : (
              <Avatar.Text size={50} label={getUserInitials(user)} />
            )
          }
          title={user.email}
          description={t('update_profile')}
          onPress={() => navigation.navigate('UserProfile')}
        />
        <List.Item
          style={{ paddingHorizontal: 20 }}
          left={(props) => (
            <IconButton iconColor={theme.colors.error} icon={'logout'} />
          )}
          title={t('Sign out')}
          titleStyle={{ color: theme.colors.error }}
          onPress={() => setOpenLogout(true)}
        />
        <List.Item
          onPress={() => {
            if (devMode) {
              setOpenDevInfo(true);
            } else {
              setVersionPressCount(state => state + 1);
            }
          }}
          style={{ paddingHorizontal: 20 }}
          left={(props) => <IconButton icon={'information-outline'} />}
          title={t('Version')}
          description={Constants.expoConfig.version}
        />
        <List.Item
          style={{ paddingHorizontal: 20 }}
          left={(props) => <IconButton icon={'file-document-outline'} />}
          title="Termos de Uso"
          description="Condições de uso do Erione CMMS"
          onPress={() => Linking.openURL(legalLinks.termsOfUse)}
        />
        <List.Item
          style={{ paddingHorizontal: 20 }}
          left={(props) => <IconButton icon={'shield-lock-outline'} />}
          title="Política de Privacidade"
          description="Como os dados operacionais são tratados"
          onPress={() => Linking.openURL(legalLinks.privacyPolicy)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%'
  }
});
