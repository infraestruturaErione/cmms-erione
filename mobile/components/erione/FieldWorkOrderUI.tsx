import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';

const c = ERIONE_MOBILE_IDENTITY.colors;
export const FIELD_UI = {
  navy: '#142C5B',
  border: '#DCE4EF',
  canvas: '#F3F6FA',
  blueWash: '#EFF4FF',
  green: '#176348',
  greenWash: '#EDF7F1',
  amber: '#8A510B',
  amberWash: '#FFF6E8'
};

export function FieldHero({
  eyebrow,
  title,
  helper,
  count,
  countLabel,
  children
}: {
  eyebrow: string;
  title: string;
  helper?: string;
  count?: string | number;
  countLabel?: string;
  children?: ReactNode;
}) {
  return (
    <View style={s.hero} testID="field-screen-heading">
      <View pointerEvents="none" style={s.orbit} />
      <View style={s.heroRow}>
        <View style={s.grow}>
          <Text style={s.eyebrow}>{eyebrow}</Text>
          <Text accessibilityRole="header" style={s.heroTitle}>
            {title}
          </Text>
          {!!helper && <Text style={s.heroHelper}>{helper}</Text>}
        </View>
        {count !== undefined && (
          <View style={s.count}>
            <Text style={s.countValue}>{count}</Text>
            <Text style={s.countLabel}>{countLabel}</Text>
          </View>
        )}
      </View>
      {!!children && <View style={s.heroFooter}>{children}</View>}
    </View>
  );
}

export function FieldSectionTitle({
  icon,
  title,
  helper,
  status
}: {
  icon: string;
  title: string;
  helper?: string;
  status?: string;
}) {
  return (
    <View>
      <View style={s.sectionHeading}>
        <View style={s.sectionIcon}>
          <Icon source={icon} size={21} color={c.primary} />
        </View>
        <View style={s.grow}>
          <Text accessibilityRole="header" style={s.sectionTitle}>
            {title}
          </Text>
          {!!helper && <Text style={s.sectionHelper}>{helper}</Text>}
        </View>
      </View>
      {!!status && (
        <View style={s.sectionStatus} testID="field-section-status">
          <Text style={s.sectionStatusText}>{status}</Text>
        </View>
      )}
    </View>
  );
}

export function FieldMeta({
  icon,
  children,
  prominent = false
}: {
  icon: string;
  children: ReactNode;
  prominent?: boolean;
}) {
  return (
    <View style={s.metaRow}>
      <View style={s.metaIcon}>
        <Icon source={icon} size={18} color={c.muted} />
      </View>
      <Text style={[s.metaText, prominent && s.metaProminent]}>{children}</Text>
    </View>
  );
}

export function FieldNotice({
  icon,
  title,
  message,
  warning = false
}: {
  icon: string;
  title: string;
  message: string;
  warning?: boolean;
}) {
  return (
    <View style={[s.notice, warning && s.noticeWarning]}>
      <Icon
        source={icon}
        size={21}
        color={warning ? FIELD_UI.amber : c.primary}
      />
      <View style={s.grow}>
        <Text style={s.noticeTitle}>{title}</Text>
        <Text style={s.noticeMessage}>{message}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  hero: {
    backgroundColor: FIELD_UI.navy,
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden'
  },
  orbit: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -90,
    top: -85,
    borderWidth: 28,
    borderColor: 'rgba(125,159,237,0.12)'
  },
  heroRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  eyebrow: {
    color: '#BACCF0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    lineHeight: 17
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 33,
    marginTop: 7
  },
  heroHelper: { color: '#D7E2F7', fontSize: 13, lineHeight: 20, marginTop: 8 },
  count: { minWidth: 53, maxWidth: '32%', alignItems: 'center', paddingTop: 5 },
  countValue: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '800',
    lineHeight: 37
  },
  countLabel: {
    color: '#C4D3F2',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center'
  },
  heroFooter: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#3B5179',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8
  },
  sectionHeading: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
    marginBottom: 16
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: FIELD_UI.blueWash,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionStatus: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: 10,
    backgroundColor: FIELD_UI.blueWash,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16
  },
  sectionStatusText: { color: c.primary, fontWeight: '700', lineHeight: 20 },
  sectionTitle: {
    color: c.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800'
  },
  sectionHelper: { color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  metaIcon: { paddingTop: 1 },
  metaText: {
    color: c.muted,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
    minWidth: 0
  },
  metaProminent: {
    color: c.text,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 22
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: FIELD_UI.blueWash,
    borderWidth: 1,
    borderColor: '#D8E3FB'
  },
  noticeWarning: {
    backgroundColor: FIELD_UI.amberWash,
    borderColor: '#EFD7AE'
  },
  noticeTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20
  },
  noticeMessage: { color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 3 }
});
