import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Icon,
  Text,
  TouchableRipple
} from 'react-native-paper';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';

const colors = ERIONE_MOBILE_IDENTITY.colors;

export function ErioneScreen({
  children,
  style
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function ErioneCard({
  children,
  style
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ErioneStatusBadge({
  label,
  color,
  subtle = false
}: {
  label: string;
  color: string;
  subtle?: boolean;
}) {
  return (
    <View
      style={[
        styles.badge,
        { borderColor: color, backgroundColor: subtle ? '#FFFFFF' : color }
      ]}
    >
      <Text
        variant="labelSmall"
        style={[styles.badgeText, { color: subtle ? color : '#FFFFFF' }]}
      >
        {label}
      </Text>
    </View>
  );
}

export function ErioneSectionHeader({
  title,
  subtitle
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        {title}
      </Text>
      {!!subtitle && (
        <Text variant="bodySmall" style={styles.sectionSubtitle}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

export function ErionePrimaryButton({
  children,
  icon,
  loading,
  disabled,
  onPress,
  style,
  testID,
  contrast = false,
  wrapLabel = false
}: {
  children: ReactNode;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  contrast?: boolean;
  wrapLabel?: boolean;
}) {
  if (!wrapLabel)
    return (
      <Button
        testID={testID}
        mode="contained"
        icon={icon}
        loading={loading}
        disabled={disabled}
        onPress={onPress}
        buttonColor={contrast ? '#FFFFFF' : colors.primary}
        textColor={contrast ? colors.primary : '#FFFFFF'}
        style={[styles.primaryButton, style]}
        contentStyle={{ minHeight: 54 }}
        labelStyle={{ fontSize: 16, fontWeight: '800' }}
      >
        {children}
      </Button>
    );
  return (
    <TouchableRipple
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{
        disabled: !!disabled || !!loading,
        busy: !!loading
      }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.primaryButton,
        {
          backgroundColor: contrast ? '#FFFFFF' : colors.primary,
          opacity: disabled ? 0.55 : 1
        },
        style
      ]}
    >
      <View style={styles.primaryButtonContent}>
        {loading ? (
          <ActivityIndicator
            size={20}
            color={contrast ? colors.primary : '#FFFFFF'}
          />
        ) : (
          !!icon && (
            <Icon
              source={icon}
              size={20}
              color={contrast ? colors.primary : '#FFFFFF'}
            />
          )
        )}
        <Text
          style={[
            styles.primaryButtonLabel,
            { color: contrast ? colors.primary : '#FFFFFF' }
          ]}
        >
          {children}
        </Text>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(42, 72, 153, 0.12)',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 4
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeText: {
    fontWeight: '700'
  },
  sectionHeader: {
    marginBottom: 12
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
    letterSpacing: 0
  },
  sectionSubtitle: {
    color: colors.muted,
    marginTop: 2
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden'
  },
  primaryButtonContent: {
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
    lineHeight: 23,
    textAlign: 'center'
  }
});
