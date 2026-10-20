import { Alert } from 'react-native';
import { UNSTABLE_usePreventRemove as usePreventRemove } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

export default function usePendingEditsExit(
  navigation: NativeStackNavigationProp<RootStackParamList, 'Tasks'>,
  pending: boolean,
  isBusy: () => boolean,
  onLeave: () => void,
  savePending?: () => Promise<boolean>
) {
  const [leaving, setLeaving] = useState(false);
  const alertOpen = useRef(false);
  const action = useRef<any>(undefined);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    navigation.setOptions({ headerBackButtonMenuEnabled: false });
  }, [navigation]);
  const resume = () => {
    if (!mounted.current) return;
    onLeave();
    generation.current++;
    savingRef.current = false;
    setSaving(false);
    setLeaving(true);
  };
  const warn = () => {
    if (!mounted.current || alertOpen.current) return;
    // Once a choice is shown, a late acknowledgement must not navigate behind it.
    generation.current++;
    savingRef.current = false;
    setSaving(false);
    alertOpen.current = true;
    Alert.alert(
      'Respostas ainda sem confirmação',
      isBusy()
        ? 'Há um envio em andamento. Sair não cancela o processamento no servidor. Alterações ainda não enviadas podem se perder.'
        : 'Não foi possível confirmar todas as alterações. O conteúdo continua nesta tela. Se sair sem confirmação, alterações podem se perder.',
      [
        {
          text: 'Continuar editando',
          style: 'cancel',
          onPress: () => {
            if (!mounted.current) return;
            alertOpen.current = false;
            generation.current++;
            savingRef.current = false;
            setSaving(false);
            action.current = undefined;
          }
        },
        {
          text: 'Sair sem confirmação',
          onPress: () => {
            alertOpen.current = false;
            resume();
          }
        }
      ],
      {
        cancelable: false
      }
    );
  };
  usePreventRemove((pending || saving) && !leaving, ({ data }) => {
    if (alertOpen.current || savingRef.current) return;
    action.current = data.action;
    if (!savePending) {
      warn();
      return;
    }
    const request = ++generation.current;
    savingRef.current = true;
    setSaving(true);
    Promise.resolve()
      .then(savePending)
      .then(
        (confirmed) => {
          if (!mounted.current || request !== generation.current) return;
          savingRef.current = false;
          setSaving(false);
          if (confirmed) resume();
          else warn();
        },
        () => {
          if (!mounted.current || request !== generation.current) return;
          savingRef.current = false;
          setSaving(false);
          warn();
        }
      );
  });
  useEffect(() => {
    if (leaving && action.current) {
      const next = action.current;
      action.current = undefined;
      navigation.dispatch(next);
    }
  }, [leaving, navigation]);
  return {
    saving,
    continueEditing: () => {
      if (!mounted.current) return;
      generation.current++;
      savingRef.current = false;
      action.current = undefined;
      setSaving(false);
    },
    leaveWithoutWaiting: warn
  };
}
