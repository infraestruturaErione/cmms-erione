import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
  ErioneSectionHeader
} from '../components/erione/ErioneUI';
import { ERIONE_MOBILE_IDENTITY } from '../config/erioneVisualIdentity';
import { FIELD_UI } from '../components/erione/FieldWorkOrderUI';
import DailySummaryCard from '../components/erione/DailySummaryCard';
import FieldEntrance from '../components/erione/FieldEntrance';
import FieldOrderCard from './workOrders/components/FieldOrderCard';
import { getWorkOrderCompanionLabel } from '../utils/workOrderExecution';
import { getPriorityColor, getStatusColor } from '../utils/overall';
import {
  getNextActionKey,
  isPastDue,
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

  const renderWorkOrderCard = (workOrder: WorkOrder) => (
    <FieldOrderCard
      key={workOrder.id}
      customId={workOrder.customId}
      title={workOrder.title}
      status={t(workOrder.status)}
      statusColor={getStatusColor(workOrder.status, theme)}
      customer={workOrder.customers?.[0]?.name}
      location={workOrder.location?.name}
      address={workOrder.location?.address}
      asset={workOrder.asset?.name}
      createdAt={getFormattedDate(workOrder.createdAt)}
      priority={
        workOrder.priority !== 'NONE' ? t(workOrder.priority) : undefined
      }
      priorityColor={getPriorityColor(workOrder.priority, theme)}
      companion={!!getWorkOrderCompanionLabel(workOrder, user.id)}
      action={
        getWorkOrderCompanionLabel(workOrder, user.id) ||
        t(getNextActionKey(workOrder))
      }
      onPress={() => openWorkOrder(workOrder)}
    />
  );

  return (
    <ErioneScreen style={{ backgroundColor: FIELD_UI.canvas }}>
      <ScrollView
        style={{ flex: 1 }}
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
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="headlineSmall" style={styles.title}>
              Seu dia em campo
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
                  notifications.content.filter(
                    (notification) => !notification.seen
                  ).length > 0
                }
              >
                {
                  notifications.content.filter(
                    (notification) => !notification.seen
                  ).length
                }
              </Badge>
            </View>
          </View>
        </View>

        <FieldEntrance style={styles.shiftHeroCard}>
          <DailySummaryCard
            title={t('daily_summary')}
            metrics={[
              {
                key: 'open',
                label: t('open_work_orders'),
                value: sortedWorkOrders.length
              },
              {
                key: 'active',
                label: t('active_service_now'),
                value: activeCount
              },
              {
                key: 'priority',
                label: t('high_priority_or_late'),
                value: highOrLate
              }
            ]}
          />
        </FieldEntrance>
        <View style={styles.connectionRow}>
          <Text style={styles.connectionText}>
            Resumo dos atendimentos carregados.
          </Text>
          <Text style={styles.connectionText}>
            {netInfo.isInternetReachable === false
              ? 'Sem conexão confirmada. Alguns dados podem estar desatualizados.'
              : netInfo.isInternetReachable === true
              ? 'Conexão disponível · confira a confirmação dos envios.'
              : 'Verificando conexão…'}
          </Text>
        </View>

        <FieldEntrance style={styles.sectionBlock} delay={70}>
          <ErioneSectionHeader
            title={t('active_service_now')}
            subtitle={t('active_service_now_helper')}
          />
          {activeWorkOrders.length ? (
            activeWorkOrders
              .slice(0, 3)
              .map((workOrder) => renderWorkOrderCard(workOrder))
          ) : (
            <ErioneCard style={styles.emptyCard}>
              <Text variant="bodyMedium" style={styles.emptyText}>
                {t('no_active_service_now')}
              </Text>
            </ErioneCard>
          )}
        </FieldEntrance>

        <FieldEntrance style={styles.sectionBlock} delay={140}>
          <ErioneSectionHeader
            title={t('upcoming_work_orders')}
            subtitle={t('upcoming_work_orders_helper')}
          />
          {upcomingWorkOrders.length ? (
            upcomingWorkOrders.map((workOrder) =>
              renderWorkOrderCard(workOrder)
            )
          ) : (
            <ErioneCard style={styles.emptyCard}>
              <Text variant="bodyMedium" style={styles.emptyText}>
                {loadingGet
                  ? t('loading_work_orders')
                  : t('no_next_work_order')}
              </Text>
            </ErioneCard>
          )}
          <ErionePrimaryButton
            wrapLabel
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
        </FieldEntrance>
      </ScrollView>
    </ErioneScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12
  },
  shiftHeroCard: {
    marginBottom: 12
  },
  connectionRow: { marginBottom: 12, paddingHorizontal: 4 },
  connectionText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
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
  sectionBlock: {
    marginTop: 8,
    marginBottom: 4
  },
  emptyCard: {
    marginBottom: 12,
    paddingVertical: 16,
    borderRadius: 16,
    borderColor: FIELD_UI.border,
    shadowOpacity: 0,
    elevation: 0
  },
  emptyText: {
    color: colors.muted
  },
  allButton: {
    marginTop: 2,
    marginBottom: 8
  }
});
