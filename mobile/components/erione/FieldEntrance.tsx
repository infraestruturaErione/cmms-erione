import { ReactNode, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleProp,
  ViewStyle
} from 'react-native';

// Runs only on mount, not when polling refreshes the screen's data.
export default function FieldEntrance({
  children,
  delay = 0,
  style
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    let started = false;
    let preferenceChanged = false;
    const applyPreference = (reduced: boolean) => {
      if (!mounted) return;
      if (reduced) {
        progress.stopAnimation();
        progress.setValue(1);
      } else if (!started) {
        started = true;
        progress.setValue(0);
        Animated.timing(progress, {
          toValue: 1,
          duration: 300,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
          isInteraction: false
        }).start();
      }
    };
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (reduced) => {
        preferenceChanged = true;
        applyPreference(reduced);
      }
    );
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!preferenceChanged) applyPreference(reduced);
      })
      .catch(() => {
        // Keep content visible if the native preference is unavailable.
      });
    return () => {
      mounted = false;
      subscription.remove();
      progress.stopAnimation();
    };
  }, [delay, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.94, 1]
          }),
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0]
              })
            }
          ]
        }
      ]}
    >
      {children}
    </Animated.View>
  );
}
