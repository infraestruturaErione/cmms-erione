import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import useAuth from '../../hooks/useAuth';
import { authenticatedIdentity } from '../../utils/authenticatedIdentity';
import { FIELD_UI, FieldMeta } from './FieldWorkOrderUI';

export default function AuthenticatedUserIdentity() {
  const { user } = useAuth();
  const identity = authenticatedIdentity(user);
  return (
    <View style={styles.card} testID="authenticated-user-identity">
      <Text style={styles.label}>CONTA CONECTADA</Text>
      <Text style={styles.name}>{identity.name}</Text>
      <FieldMeta icon="phone-outline">{identity.phone}</FieldMeta>
      {!!user?.jobTitle?.trim() && (
        <Text style={styles.helper}>{user.jobTitle.trim()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: FIELD_UI.blueWash,
    gap: 8,
    width: '100%'
  },
  label: {
    color: FIELD_UI.navy,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1
  },
  name: {
    color: FIELD_UI.navy,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
    flexShrink: 1
  },
  helper: { color: '#64748B', lineHeight: 20 }
});
