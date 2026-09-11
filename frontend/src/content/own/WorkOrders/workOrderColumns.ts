export const PRIMARY_WORK_ORDER_COLUMNS = [
  'customId', 'status', 'title', 'priority', 'assignedTo', 'location', 'category'
];

export const DEFAULT_WORK_ORDER_COLUMN_VISIBILITY: Record<string, boolean> = {
  locationAddress: false,
  description: false,
  asset: false,
  dueDate: false,
  daysSinceCreated: false,
  files: false,
  requestedBy: false,
  completedOn: false,
  updatedAt: false,
  createdAt: false
};

export const getWorkOrderColumnVisibility = (): Record<string, boolean> => {
  try {
    const saved = JSON.parse(localStorage.getItem('workOrderTableState') || 'null');
    // An empty saved object means all columns visible: it is a valid preference.
    if (saved?.columnVisibility && typeof saved.columnVisibility === 'object' &&
        !Array.isArray(saved.columnVisibility)) return saved.columnVisibility;
    // Older saved layouts may carry only ordering/sizing. Keep their columns.
    if (saved?.columnOrder?.length || Object.keys(saved?.columnSizing || {}).length) return {};
  } catch {
    // Missing/unreadable preferences use the compact layout, without a migration.
  }
  return { ...DEFAULT_WORK_ORDER_COLUMN_VISIBILITY };
};
