import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Badge, IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useCallback, useContext, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useNetInfo } from '@react-native-community/netinfo';
import { RootTabScreenProps } from '../types';
import useAuth from '../hooks/useAuth';
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
import { getPriorityColor, getStatusColor } from '../utils/overall';
import {
  getNextActionKey,
  isPastDue,
  isPendingCompletion,
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
  const { fetchUserSettings, user } = useAuth();
  const { notifications } = useSelector((state) => state.notifications);
  const { workOrders, loadingGet } = useSelector((state) => state.workOrders);

  const notificationsCriteria: SearchCriteria = {
    filterFields: [
      {
        field: 'seen',
        operation: 'eq',
        value: false
      }
    ],
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
        values: ['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD'],
        enumName: 'STATUS'
      },
      {
        field: 'archived',
        operation: 'eq',
        value: false
      }
    ];

    // A Home representa o turno do usuario, independentemente da permissao
    // de consultar OS de colegas na tela de listagem.
    filterFields.push({
      field: 'assignedToUser',
      operation: 'eq',
      value: user.id
    });

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
  }, []);

  // A Home fica montada o tempo todo no tab navigator, entao um useEffect de
  // mount so buscava uma vez por sessao: OS atribuida depois do app aberto so
  // aparecia se o tecnico trocasse de aba e voltasse. Recarregar ao ganhar foco
  // resolve isso (mesmo padrao ja usado em WorkOrdersScreen).
  useFocusEffect(
    useCallback(() => {
      loadHome();
      const refreshInterval = setInterval(loadHome, 30000);
      return () => clearInterval(refreshInterval);
    }, [user.id])
  );

  const sortedWorkOrders = useMemo(
    () => sortWorkOrdersForField(workOrders.content),
    [workOrders.content]
  );

  const activeWorkOrders = sortedWorkOrders.filter(isWorkOrderInField);
  const upcomingWorkOrders = sortedWorkOrders
    .filter((workOrder) => !isWorkOrderInField(workOrder))
    .slice(0, 3);
  const activeCount = sortedWorkOrders.filter(isWorkOrderInField).length;
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
    workOrder
  }: {
    workOrder: WorkOrder;
  }) => (
    <ErioneCard style={styles.sectionCard}>
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
          {workOrder.priority !== 'NONE' && (
            <View style={styles.priorityRow}>
              <ErioneStatusBadge
                label={t('priority_label', { priority: t(workOrder.priority) })}
                color={getPriorityColor(workOrder.priority, theme)}
                subtle
              />
            </View>
          )}
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
            {t(isWorkOrderInField(workOrder) ? 'continue_service' : 'open_work_order')}
          </ErionePrimaryButton>
        </TouchableOpacity>
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
              {t('home')}
            </Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              {netInfo.isInternetReachable === false
                ? t('offline_shift_helper')
                : t('my_shift_helper')}
            </Text>
          </View>
          <View style={styles.headerActions}>
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

        <ErioneCard style={styles.shiftHeroCard}>
          <View style={styles.shiftHeroTop}>
            <View style={{ flex: 1 }}>
              <Text variant="labelMedium" style={styles.shiftHeroKicker}>
                {netInfo.isInternetReachable === false
                  ? t('offline_shift_helper')
                  : t('my_shift_helper')}
              </Text>
              <Text variant="titleLarge" style={styles.shiftHeroTitle}>
                {t('daily_summary')}
              </Text>
            </View>
            <View style={styles.onlinePill}>
              <Text variant="labelSmall" style={styles.onlinePillText}>
                {netInfo.isInternetReachable === false ? 'Offline' : 'Online'}
              </Text>
            </View>
          </View>
          <View style={styles.shiftStatsRow}>
            <ShiftStat label={t('open_work_orders')} value={sortedWorkOrders.length} />
            <ShiftStat label={t('active_service_now')} value={activeCount} />
            <ShiftStat label={t('high_priority_or_late')} value={highOrLate} />
          </View>
        </ErioneCard>

        <View style={styles.sectionBlock}>
          <ErioneSectionHeader
            title={t('active_service_now')}
            subtitle={t('active_service_now_helper')}
          />
          {activeWorkOrders.length ? (
            activeWorkOrders.slice(0, 3).map((workOrder) => (
              <WorkOrderSummaryCard key={workOrder.id} workOrder={workOrder} />
            ))
          ) : (
            <ErioneCard style={styles.emptyCard}>
              <Text variant="bodyMedium" style={styles.emptyText}>
                {t('no_active_service_now')}
              </Text>
            </ErioneCard>
          )}
        </View>

        <View style={styles.sectionBlock}>
          <ErioneSectionHeader
            title={t('upcoming_work_orders')}
            subtitle={t('upcoming_work_orders_helper')}
          />
          {upcomingWorkOrders.length ? (
            upcomingWorkOrders.map((workOrder) => (
              <WorkOrderSummaryCard key={workOrder.id} workOrder={workOrder} />
            ))
          ) : (
            <ErioneCard style={styles.emptyCard}>
              <Text variant="bodyMedium" style={styles.emptyText}>
                {loadingGet ? t('loading_work_orders') : t('no_next_work_order')}
              </Text>
            </ErioneCard>
          )}
          <ErionePrimaryButton
            icon="format-list-bulleted"
            onPress={() =>
              navigation.navigate('WorkOrders', {
                filterFields: getShiftCriteria().filterFields,
                fromHome: true
              })
            }
            style={styles.allButton}
          >
            {t('view_all_work_orders')}
          </ErionePrimaryButton>
        </View>

      </ScrollView>
    </ErioneScreen>
  );
}

function ShiftStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.shiftStat}>
      <Text variant="titleMedium" style={styles.shiftStatValue}>
        {value}
      </Text>
      <Text variant="labelSmall" style={styles.shiftStatLabel} numberOfLines={2}>
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
  shiftHeroCard: {
    marginBottom: 12,
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark
  },
  shiftHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  shiftHeroKicker: {
    color: '#C7D6FF',
    fontWeight: '700'
  },
  shiftHeroTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 4
  },
  onlinePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)'
  },
  onlinePillText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  shiftStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16
  },
  shiftStat: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)'
  },
  shiftStatValue: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  shiftStatLabel: {
    color: '#D7E0FF',
    marginTop: 2
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
  notificationBox: {
    position: 'relative',
    backgroundColor: colors.primarySoft,
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
  sectionBlock: {
    marginTop: 8,
    marginBottom: 4
  },
  emptyCard: {
    marginBottom: 12,
    paddingVertical: 14
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
  priorityRow: {
    marginTop: 10
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
  allButton: {
    marginTop: 2,
    marginBottom: 8
  }
});
