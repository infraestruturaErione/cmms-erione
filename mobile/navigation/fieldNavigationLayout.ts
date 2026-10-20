// RootLayout owns the system insets. The tab bar stays in normal layout flow.
export const fieldTabBarStyle = (fontScale: number) => ({
  height: Math.max(70, Math.ceil(38 + 32 * fontScale)),
  marginHorizontal: 16,
  marginBottom: 8,
  paddingTop: 6,
  paddingBottom: 8,
  borderTopWidth: 0,
  borderRadius: 18,
  backgroundColor: '#FFFFFF',
  elevation: 2,
  shadowColor: '#142C5B',
  shadowOpacity: 0.08,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: -2 }
});
