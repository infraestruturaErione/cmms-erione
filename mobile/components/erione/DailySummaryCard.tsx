import { Image, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';
import { FIELD_UI } from './FieldWorkOrderUI';

const colors = ERIONE_MOBILE_IDENTITY.colors;
const logo = require('../../assets/images/erione-logo.png');

export interface DailySummaryMetric {
  key: string;
  label: string;
  value: number;
}

export default function DailySummaryCard({
  title,
  metrics
}: {
  title: string;
  metrics: DailySummaryMetric[];
}) {
  return (
    <View style={s.card} testID="daily-summary-card">
      <View
        pointerEvents="none"
        aria-hidden
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
        testID="daily-summary-artwork"
      >
        <View style={s.blueRibbon} />
        <View style={s.redRibbon} />
        <Image
          source={logo}
          resizeMode="contain"
          tintColor="#FFFFFF"
          accessible={false}
          style={s.watermark}
        />
      </View>
      <View style={s.brand}>
        <View style={s.logoPlate}>
          <Image
            source={logo}
            resizeMode="contain"
            style={s.logo}
            accessible={false}
          />
        </View>
        <Text style={s.brandName}>ERIONE CMMS</Text>
        <View style={s.brandRule} />
      </View>
      <Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>
      <Text style={s.helper}>
        Organize as OS e siga para o próximo atendimento.
      </Text>
      <View style={s.metrics}>
        {metrics.map((metric) => (
          <View style={s.metric} key={metric.key}>
            <Text style={s.value}>{metric.value}</Text>
            <Text style={s.label}>{metric.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: FIELD_UI.navy,
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.primary
  },
  blueRibbon: {
    position: 'absolute',
    right: -64,
    top: -100,
    width: 184,
    height: 480,
    backgroundColor: colors.primary,
    opacity: 0.28,
    transform: [{ rotate: '28deg' }]
  },
  redRibbon: {
    position: 'absolute',
    right: 19,
    top: -80,
    width: 3,
    height: 240,
    backgroundColor: colors.accent,
    opacity: 0.7,
    transform: [{ rotate: '28deg' }]
  },
  watermark: {
    position: 'absolute',
    width: 244,
    height: 244,
    top: -37,
    right: -72,
    opacity: 0.055
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16
  },
  logoPlate: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logo: { width: 24, height: 24 },
  brandName: {
    color: '#D7E2F7',
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1.4,
    fontWeight: '800',
    flexShrink: 1
  },
  brandRule: { height: 2, width: 22, backgroundColor: colors.accent },
  title: {
    color: colors.surface,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '800'
  },
  helper: { color: '#D7E2F7', fontSize: 13, lineHeight: 20, marginTop: 7 },
  metrics: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#3B5179',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  metric: { flexGrow: 1, flexBasis: 72, minWidth: 72, paddingRight: 3 },
  value: {
    color: colors.surface,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '800'
  },
  label: { color: '#D7E2F7', fontSize: 12, lineHeight: 18, marginTop: 3 }
});
