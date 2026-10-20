import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { ErionePrimaryButton } from '../../../components/erione/ErioneUI';
import { FIELD_UI } from '../../../components/erione/FieldWorkOrderUI';
import FieldEntrance from '../../../components/erione/FieldEntrance';

export default function GuidedActionBar({
  title,
  helper,
  actionKey,
  loading,
  disabled,
  onPress,
  onRetry,
  readOnly = false
}: {
  title: string;
  helper?: string;
  actionKey: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onRetry?: () => void;
  readOnly?: boolean;
}) {
  return (
    <View testID="guided-action-bar" style={s.bar}>
      <FieldEntrance key={actionKey}>
        <Text style={s.kicker}>
          {readOnly ? 'ACOMPANHAMENTO' : 'PRÓXIMA AÇÃO'}
        </Text>
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
        {!!helper && <Text style={s.helper}>{helper}</Text>}
        {!!onPress && (
          <ErionePrimaryButton
            wrapLabel
            loading={loading}
            disabled={disabled}
            onPress={onPress}
            style={s.action}
          >
            {title}
          </ErionePrimaryButton>
        )}
        {!!onRetry && (
          <Button onPress={onRetry} contentStyle={{ minHeight: 48 }}>
            Tentar novamente
          </Button>
        )}
      </FieldEntrance>
    </View>
  );
}
const s = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: FIELD_UI.border,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12
  },
  kicker: {
    color: '#536888',
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.3
  },
  title: {
    color: FIELD_UI.navy,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800'
  },
  helper: { color: '#536888', fontSize: 12, lineHeight: 18, marginTop: 3 },
  action: { marginTop: 9, minHeight: 52 }
});
