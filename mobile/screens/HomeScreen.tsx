import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Badge, IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useContext, useEffect, useMemo } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { RootTabScreenProps } from '../types';
import useAuth from '../hooks/useAuth';
import { PermissionEntity } from '../models/role';
import { SearchCriteria } from '../models/page';
import WorkOrder from '../models/workOrder';
import { getNotifications } from '../slices/notification';
import { getWorkOrders } from '../slices/workOrder';
import { useDispatch, useSelector } from '../store';
import { CustomSnackBarContext } from '../contexts/CustomSnackBarContext';
import { CompanySettingsContext } from '../contexts/CompanySettingsContext';
import {
  ErioneCard,
  ErionePrimaryButton,
  ErioneScreen,
  ErioneSectionHeader,
  ErioneStatusBadge
} from '../components/erione/ErioneUI';
import { IconWithLabel } from '../components/IconWithLabel';
import { ERIONE_MOBILE_IDENTITY } from '../config/erioneVisualIdentity';
import { getStatusColor } from '../utils/overall';
import {
  getNextActionKey,
  isPastDue,
  isPendingCompletion,
  isSelectableHomeWorkOrder,
  isWorkOrderInField,
  sortWorkOrdersForField
} from '../utils/workOrderFieldUx';

const colors = ERIONE_MOBILE_IDENTITY.colors;

export default function HomeScreen({ navigation }: RootTabScreenProps<'Home'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const netInfo = useNetInfo();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { getFormattedDate } = useContext(CompanySettingsContext);
  const {
    fetchUserSettings,
    hasViewPermission,
    hasViewOtherPermission,
    user
  } = useAuth();
  const { notifications } = useSelector((state) => state.notifications);
  const { workOrders, loadingGet } = useSelector((state) => state.workOrders);

  const notificationsCriteria: SearchCriteria = {
    filterFields: [],
    pageSize: 15,
    pageNum: 0,
    direction: 'DESC'
  };

  const getShiftCriteria = (): SearchCriteria => {
    const filterFields: SearchCriteria['filterFields'] = [
      {
        field: 'status',
        operation: 'in',
        value: '',
        values: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'],
        enumName: 'STATUS'
      },
      {
        field: 'archived',
        operation: 'eq',
        value: false
      }
    ];

    if (!hasViewOtherPermission(PermissionEntity.WORK_ORDERS)) {
      filterFields.push({
        field: 'assignedToUser',
        operation: 'eq',
        value: user.id
      });
    }

    return {
      filterFields,
      pageSize: 30,
      pageNum: 0,
      direction: 'DESC'
    };
  };

  const loadHome = () => {
    dispatch(getNotifications(notificationsCriteria));
    dispatch(getWorkOrders(getShiftCriteria())).catch(() =>
      showSnackBar(t('work_orders_load_error'), 'error')
    );
  };

  useEffect(() => {
    fetchUserSettings();
    loadHome();
  }, []);

  const sortedWorkOrders = useMemo(
    () => sortWorkOrdersForField(workOrders.content),
    [workOrders.content]
  );

  const activeWorkOrder = sortedWorkOrders.find(isWorkOrderInField);
  const nextWorkOrder = sortedWorkOrders.find(
    (workOrder) =>
      isSelectableHomeWorkOrder(workOrder) && workOrder.id !== activeWorkOrder?.id
  );
  const pendingCheckIn = sortedWorkOrders.filter(
    (wo) => wo.departureAt && !wo.checkInAt && wo.status !== 'COMPLETE'
  ).length;
  const pendingCheckOut = sortedWorkOrders.filter(
    (wo) => wo.checkInAt && !wo.checkOutAt && wo.status !== 'COMPLETE'
  ).length;
  const pendingConclusion = sortedWorkOrders.filter(isPendingCompletion).length;
  const highOrLate = sortedWorkOrders.filter(
    (wo) => wo.priority === 'HIGH' || isPastDue(wo)
  ).length;

  const openWorkOrder = (workOrder?: WorkOrder) => {
    if (!workOrder) return;
    navigation.navigate('WODetails', {
      id: workOrder.id,
      workOrderProp: workOrder
    });
  };

  const WorkOrderSummaryCard = ({
    title,
    workOrder,
    emptyText
  }: {
    title: string;
    workOrder?: WorkOrder;
    emptyText: string;
  }) => (
    <ErioneCard style={styles.sectionCard}>
      <ErioneSectionHeader title={title} />
      {workOrder ? (
        <TouchableOpacity activeOpacity={0.86} onPress={() => openWorkOrder(workOrder)}>
          <View style={styles.orderHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="labelMedium" style={styles.orderCode}>
                #{workOrder.customId}
              </Text>
              <Text variant="titleMedium" style={styles.orderTitle} numberOfLines={2}>
                {workOrder.title}
              </Text>
            </View>
            <ErioneStatusBadge
              label={t(workOrder.status)}
              color={getStatusColor(workOrder.status, theme)}
              subtle
            />
          </View>
          <View style={styles.orderMeta}>
            {!!workOrder.customers?.length && (
              <IconWithLabel
                icon="domain"
                label={workOrder.customers[0].name}
                color={colors.muted}
              />
            )}
            {workOrder.location && (
              <IconWithLabel
                icon="map-marker-outline"
                label={workOrder.location.name}
                color={colors.muted}
              />
            )}
            {workOrder.location?.address && (
              <IconWithLabel
                icon="map-marker-radius-outline"
                label={workOrder.location.address}
                color={colors.muted}
              />
            )}
            {workOrder.asset && (
              <IconWithLabel
                icon="package-variant-closed"
                label={workOrder.asset.name}
                color={colors.muted}
              />
            )}
          </View>
          <View style={styles.actionRow}>
            <Text variant="labelMedium" style={styles.nextActionLabel}>
              {t('next_action')}
            </Text>
            <ErioneStatusBadge
              label={t(getNextActionKey(workOrder))}
              color={isPendingCompletion(workOrder) ? theme.colors.error : colors.primary}
              subtle={!isPendingCompletion(workOrder)}
            />
          </View>
          <ErionePrimaryButton
            icon="arrow-right-circle"
            onPress={() => openWorkOrder(workOrder)}
            style={styles.continueButton}
          >
            {t('continue_service')}
          </ErionePrimaryButton>
        </TouchableOpacity>
      ) : (
        <Text variant="bodyMedium" style={styles.emptyText}>
          {emptyText}
        </Text>
      )}
    </ErioneCard>
  );

  return (
    <ErioneScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loadingGet}
            colors={[theme.colors.primary]}
            onRefresh={loadHome}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text variant="labelMedium" style={styles.kicker}>
              Erione CMMS
            </Text>
            <Text variant="headlineSmall" style={styles.title}>
              {t('my_shift')}
            </Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              {netInfo.isInternetReachable === false
                ? t('offline_shift_helper')
                : t('my_shift_helper')}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {hasViewPermission(PermissionEntity.ASSETS) && (
              <IconButton
                icon="magnify-scan"
                style={styles.iconButton}
                iconColor={colors.primary}
                onPress={() => {
                  if (netInfo.isInternetReachable) navigation.navigate('ScanAsset');
                  else showSnackBar(t('no_internet_connection'), 'error');
                }}
              />
            )}
            <View style={styles.notificationBox}>
              <IconButton
                icon="bell-outline"
                iconColor={colors.primary}
                onPress={() => navigation.navigate('Notifications')}
              />
              <Badge
                style={styles.badge}
                visible={
                  notifications.content.filter((notification) => !notification.seen)
                    .length > 0
                }
              >
                {
                  notifications.content.filter((notification) => !notification.seen)
                    .length
                }
              </Badge>
            </View>
          </View>
        </View>

        <WorkOrderSummaryCard
          title={t('active_service_now')}
          workOrder={activeWorkOrder}
          emptyText={t('no_active_service_now')}
        />

        <WorkOrderSummaryCard
          title={t('next_work_order')}
          workOrder={nextWorkOrder}
          emptyText={loadingGet ? t('loading_work_orders') : t('no_next_work_order')}
        />

        <ErioneCard style={styles.sectionCard}>
          <ErioneSectionHeader
            title={t('pending_items')}
            subtitle={t('pending_items_shift_helper')}
          />
          <View style={styles.pendingGrid}>
            <PendingItem label={t('pending_check_in')} value={pendingCheckIn} />
            <PendingItem label={t('pending_check_out')} value={pendingCheckOut} />
            <PendingItem label={t('pending_completion')} value={pendingConclusion} />
            <PendingItem label={t('high_priority_or_late')} value={highOrLate} />
          </View>
        </ErioneCard>

        <ErionePrimaryButton
          icon="clipboard-text-outline"
          onPress={() =>
            navigation.navigate('WorkOrders', {
              filterFields: [],
              fromHome: true
            })
          }
          style={styles.allButton}
        >
          {t('view_all_work_orders')}
        </ErionePrimaryButton>
      </ScrollView>
    </ErioneScreen>
  );
}

function PendingItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.pendingItem}>
      <Text variant="headlineSmall" style={styles.pendingValue}>
        {value}
      </Text>
      <Text variant="bodySmall" style={styles.pendingLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 110
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12
  },
  kicker: {
    color: colors.primary,
    fontWeight: '800'
  },
  title: {
    color: colors.text,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 2
  },
  subtitle: {
    color: colors.muted,
    marginTop: 3,
    maxWidth: 245
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconButton: {
    backgroundColor: '#E7F3F1'
  },
  notificationBox: {
    position: 'relative',
    backgroundColor: '#E7F3F1',
    borderRadius: 999
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0
  },
  sectionCard: {
    marginBottom: 12
  },
  orderHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start'
  },
  orderCode: {
    color: colors.primary,
    fontWeight: '800'
  },
  orderTitle: {
    color: colors.text,
    fontWeight: '800',
    marginTop: 2
  },
  orderMeta: {
    gap: 7,
    marginTop: 12
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    gap: 10
  },
  nextActionLabel: {
    color: colors.muted,
    fontWeight: '700'
  },
  continueButton: {
    marginTop: 12
  },
  emptyText: {
    color: colors.muted
  },
  pendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  pendingItem: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F6F9FA'
  },
  pendingValue: {
    color: colors.primary,
    fontWeight: '800'
  },
  pendingLabel: {
    color: colors.muted,
    marginTop: 2
  },
  allButton: {
    marginTop: 2
  }
});
