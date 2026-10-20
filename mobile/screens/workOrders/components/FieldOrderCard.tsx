import { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { ErioneStatusBadge } from '../../../components/erione/ErioneUI';
import {
  FIELD_UI,
  FieldMeta
} from '../../../components/erione/FieldWorkOrderUI';
import { ERIONE_MOBILE_IDENTITY } from '../../../config/erioneVisualIdentity';

const c = ERIONE_MOBILE_IDENTITY.colors;
export interface FieldOrderCardProps {
  customId: string;
  title: string;
  status: string;
  statusColor: string;
  customer?: string;
  location?: string;
  address?: string;
  asset?: string;
  createdAt: string;
  completedAt?: string;
  dueAt?: string;
  priority?: string;
  priorityColor?: string;
  dueSoon?: boolean;
  action: string;
  companion?: boolean;
  summary?: boolean;
  assignees?: ReactNode;
  onPress: () => void;
}

// Presentation only: navigation, filtering and execution permissions stay with the screen.
export default function FieldOrderCard(p: FieldOrderCardProps) {
  return (
    <TouchableOpacity
      onPress={p.onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`OS ${p.customId}. ${p.title}. ${p.status}. ${p.action}`}
      style={s.card}
      testID={p.summary ? 'work-order-summary-card' : 'work-order-card'}
    >
      <View style={[s.rail, { backgroundColor: p.statusColor }]} />
      <View style={s.content}>
        <View style={s.top}>
          <Text style={s.code}>#{p.customId}</Text>
          <ErioneStatusBadge label={p.status} color={p.statusColor} subtle />
        </View>
        <Text style={s.title}>{p.title}</Text>
        <View style={s.destination}>
          {!!p.location && (
            <FieldMeta icon="map-marker-outline" prominent>
              {p.location}
            </FieldMeta>
          )}
          {!!p.customer && (
            <FieldMeta icon="office-building-outline">{p.customer}</FieldMeta>
          )}
          {!!p.address && (
            <FieldMeta icon="map-marker-radius-outline">{p.address}</FieldMeta>
          )}
          {!!p.asset && (
            <FieldMeta icon="package-variant-closed">{p.asset}</FieldMeta>
          )}
        </View>
        <View style={s.metadata}>
          <Text style={s.date}>Aberta em {p.createdAt}</Text>
          {!!p.completedAt && (
            <Text style={s.date}>Concluída em {p.completedAt}</Text>
          )}
          {!!p.dueAt && (
            <Text style={[s.date, p.dueSoon && s.overdue]}>
              Prazo: {p.dueAt}
            </Text>
          )}
          <View style={s.bottomMeta}>
            {!!p.priority && (
              <ErioneStatusBadge
                label={p.priority}
                color={p.priorityColor ?? c.primary}
                subtle
              />
            )}
            {p.assignees}
          </View>
        </View>
        <View style={[s.action, p.summary && s.summaryAction]}>
          <Icon
            source={
              p.summary
                ? 'cloud-download-outline'
                : p.companion
                ? 'eye-outline'
                : 'arrow-right-circle-outline'
            }
            size={22}
            color={c.primary}
          />
          <View style={s.grow}>
            <Text style={s.actionLabel}>
              {p.summary
                ? 'RESUMO NESTE APARELHO'
                : p.companion
                ? 'SOMENTE LEITURA'
                : 'PRÓXIMA AÇÃO'}
            </Text>
            <Text style={s.actionTitle}>{p.action}</Text>
            {p.summary && (
              <Text style={s.actionHelper}>
                Detalhes removidos deste aparelho. Consulte novamente pela
                internet.
              </Text>
            )}
            {p.companion && (
              <Text style={s.actionHelper}>
                Acompanhe o atendimento. A execução está disponível somente para
                o operador.
              </Text>
            )}
          </View>
          <Icon source="chevron-right" size={21} color={c.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: FIELD_UI.border,
    borderRadius: 20,
    marginBottom: 14,
    overflow: 'hidden'
  },
  rail: {
    position: 'absolute',
    left: 0,
    top: 20,
    bottom: 20,
    width: 3,
    borderRadius: 2
  },
  content: { padding: 18 },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  code: {
    color: c.primary,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.7
  },
  title: {
    color: c.text,
    fontWeight: '800',
    fontSize: 19,
    lineHeight: 26,
    marginTop: 11
  },
  destination: { marginTop: 16, gap: 7 },
  metadata: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EBEFF5',
    gap: 4
  },
  date: { color: c.muted, fontSize: 12, lineHeight: 18 },
  overdue: { color: '#9B4C09', fontWeight: '700' },
  bottomMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4
  },
  action: {
    backgroundColor: FIELD_UI.blueWash,
    borderRadius: 13,
    marginTop: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center'
  },
  summaryAction: { backgroundColor: '#F3F6FA' },
  grow: { flex: 1, minWidth: 0 },
  actionLabel: {
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.6,
    color: c.muted,
    fontWeight: '800'
  },
  actionTitle: {
    color: c.primary,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 21,
    marginTop: 2
  },
  actionHelper: { color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }
});
