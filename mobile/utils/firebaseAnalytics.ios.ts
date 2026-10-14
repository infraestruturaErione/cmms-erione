// iOS intentionally ships without Firebase; Android keeps its existing adapter.
export default function analytics() {
  return {
    logEvent: async (_name: string, _parameters?: Record<string, unknown>) => {}
  };
}
