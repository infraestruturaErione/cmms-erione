import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useDispatch, useSelector } from '../../store';
import * as React from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { CompanySettingsContext } from '../../contexts/CompanySettingsContext';
import useAuth from '../../hooks/useAuth';
import { PermissionEntity } from '../../models/role';
import { getMoreWorkOrders, getWorkOrders } from '../../slices/workOrder';
import { FilterField, SearchCriteria } from '../../models/page';
import { Avatar, Button, Icon, IconButton, Text } from 'react-native-paper';
import {
  FIELD_UI,
  FieldHero,
  FieldNotice,
  FieldSectionTitle
} from '../../components/erione/FieldWorkOrderUI';
import FieldOrderCard from './components/FieldOrderCard';
import {
  getWorkOrderListView,
  selectWorkOrderListView
} from './workOrderListViews';
import { useTranslation } from 'react-i18next';
import WorkOrder, {
  WORK_ORDER_STATUSES,
  WorkOrderStatus
} from '../../models/workOrder';
import { getPriorityColor, getStatusColor } from '../../utils/overall';
import { RootTabScreenProps } from '../../types';
import _ from 'lodash';
import EnumFilter from './EnumFilter';
import { dayDiff } from '../../utils/dates';
import QuickFilter from './QuickFilter';
import { useAppTheme } from '../../custom-theme';
import { getUserInitials } from '../../utils/displayers';
import { UserMiniDTO } from '../../models/user';
import { ErioneCard, ErioneScreen } from '../../components/erione/ErioneUI';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';
import { getNextActionKey, isPastDue } from '../../utils/workOrderFieldUx';
import { useFocusEffect } from '@react-navigation/native';
import { getWorkOrderCompanionLabel } from '../../utils/workOrderExecution';
import {
  firstWorkOrderPage,
  sameWorkOrderQuery
} from '../../utils/workOrderRefresh';
import WorkOrderSearchBar from './components/WorkOrderSearchBar';
import usePageRequestGate from '../../hooks/usePageRequestGate';
import {
  applyWorkOrderSearch,
  getWorkOrderSearchText
} from './workOrderSearch';

const colors = ERIONE_MOBILE_IDENTITY.colors;
const DEFAULT_ACTIVE_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  'OPEN',
  'EN_ROUTE',
  'IN_PROGRESS',
  'ON_HOLD'
];

export default function WorkOrdersScreen(
  props: RootTabScreenProps<'WorkOrders'>
) {
  const { user } = useAuth();
  const session = useSelector((state) => state.tasks?.session);
  return (
    <WorkOrdersContent
      key={`${user.id}:${user.companyId}:${session}`}
      {...props}
    />
  );
}

function WorkOrdersContent({
  navigation,
  route
}: RootTabScreenProps<'WorkOrders'>) {
  const { t } = useTranslation();
  const {
    workOrders,
    loadingList,
    loadingMore,
    listRequestSilent,
    currentPageNum,
    lastPage,
    errorGet,
    errorMore,
    activeCriteria,
    requestedCriteria
  } = useSelector((state) => state.workOrders);
  const theme = useAppTheme();
  const localCache = useSelector((state) => state.localWorkOrderCache);
  const detailsById = useSelector((state) => state.workOrders.workOrderInfos);
  const fullOrdersById = new Map(workOrders.content.map((wo) => [wo.id, wo]));
  const allRows = (localCache.pageIds ?? workOrders.content.map((wo) => wo.id))
    .map((id) => ({
      id,
      summary: localCache.summaries[id],
      workOrder: fullOrdersById.get(id) ?? detailsById[id]?.workOrder
    }))
    .filter((row) => row.summary || row.workOrder);
  const dispatch = useDispatch();
  const requestPage = usePageRequestGate();
  const { getFormattedDate } = useContext(CompanySettingsContext);
  const { user, hasViewOtherPermission } = useAuth();
  const defaultFilterFields: FilterField[] = [
    {
      field: 'priority',
      operation: 'in',
      values: ['NONE', 'LOW', 'MEDIUM', 'HIGH'],
      value: '',
      enumName: 'PRIORITY'
    },
    {
      field: 'status',
      operation: 'in',
      values: [...DEFAULT_ACTIVE_WORK_ORDER_STATUSES],
      value: '',
      enumName: 'STATUS'
    },
    {
      field: 'archived',
      operation: 'eq',
      value: false
    }
  ];
  const getCriteriaFromFilterFields = (filterFields: FilterField[]) => {
    const initialCriteria: SearchCriteria = {
      filterFields: defaultFilterFields,
      pageSize: 10,
      pageNum: 0,
      direction: 'DESC'
    };
    let newFilterFields = [...initialCriteria.filterFields];
    filterFields.forEach(
      (filterField) =>
        (newFilterFields = newFilterFields.filter(
          (ff) => ff.field != filterField.field
        ))
    );
    const merged = [...newFilterFields, ...filterFields];
    return {
      ...initialCriteria,
      filterFields:
        getWorkOrderListView(merged) === 'active'
          ? selectWorkOrderListView(merged, 'active')
          : merged
    };
  };
  const getDefaultFilterFields = (): FilterField[] => {
    const fields: FilterField[] = [];
    if (hasViewOtherPermission(PermissionEntity.WORK_ORDERS)) {
      fields.push({
        field: 'assignedToUser',
        operation: 'eq',
        value: user.id
      });
    }
    return fields;
  };
  const [criteria, setCriteria] = useState<SearchCriteria>(() =>
    getCriteriaFromFilterFields(
      route.params?.filterFields?.length
        ? route.params.filterFields
        : getDefaultFilterFields()
    )
  );
  const [selectedView, setSelectedView] = useState<'active' | 'history'>(() =>
    getWorkOrderListView(criteria.filterFields) === 'active'
      ? 'active'
      : 'history'
  );
  const query = firstWorkOrderPage(criteria);
  const rows = sameWorkOrderQuery(activeCriteria, query) ? allRows : [];
  const loadingGet = (!!loadingList || !!loadingMore) && !listRequestSilent;
  const listError = sameWorkOrderQuery(requestedCriteria, query)
    ? errorGet
    : null;

  useFocusEffect(
    useCallback(() => {
      dispatch(getWorkOrders(firstWorkOrderPage(criteria)));
    }, [criteria, dispatch])
  );

  useEffect(() => {
    const filterFields = route.params?.filterFields ?? [];
    if (filterFields.length) {
      const next = getCriteriaFromFilterFields(filterFields);
      setSelectedView(
        getWorkOrderListView(next.filterFields) === 'active'
          ? 'active'
          : 'history'
      );
      setCriteria((previous) => (_.isEqual(previous, next) ? previous : next));
    }
  }, [route.params?.filterFields]);

  const onRefresh = () => {
    dispatch(getWorkOrders(firstWorkOrderPage(criteria)));
  };
  const onFilterChange = (newFilters: FilterField[]) => {
    setCriteria((previous) => ({
      ...previous,
      filterFields:
        selectedView === 'active'
          ? selectWorkOrderListView(newFilters, 'active')
          : newFilters,
      pageNum: 0
    }));
  };

  const onSearchSubmit = (text: string) => {
    setCriteria((previous) => applyWorkOrderSearch(previous, text));
  };

  const renderAssignees = (workOrder: WorkOrder) => {
    const allUsers: UserMiniDTO[] = [];
    const userIds = new Set();

    if (workOrder.primaryUser) {
      allUsers.push(workOrder.primaryUser);
      userIds.add(workOrder.primaryUser.id);
    }

    if (workOrder.assignedTo?.length) {
      workOrder.assignedTo.forEach((assignedUser) => {
        if (!userIds.has(assignedUser.id)) {
          allUsers.push(assignedUser);
          userIds.add(assignedUser.id);
        }
      });
    }

    if (!allUsers.length) return null;

    return (
      <View style={styles.assigneeContainer}>
        {allUsers.slice(0, 3).map((assignedUser, index) => (
          <View
            key={assignedUser.id}
            style={{ marginLeft: index > 0 ? -8 : 0 }}
          >
            {assignedUser.image ? (
              <Avatar.Image
                source={{ uri: assignedUser.image.url }}
                size={26}
              />
            ) : (
              <Avatar.Text size={26} label={getUserInitials(assignedUser)} />
            )}
          </View>
        ))}
        {allUsers.length > 3 && (
          <Text variant="bodySmall" style={styles.assigneeMore}>
            +{allUsers.length - 3}
          </Text>
        )}
      </View>
    );
  };

  const listView = getWorkOrderListView(criteria.filterFields);
  const history = selectedView === 'history';
  const resetFilterFields = selectWorkOrderListView(
    [
      ...defaultFilterFields,
      ...criteria.filterFields.filter(
        (filter) => filter.field === 'assignedToUser'
      )
    ],
    selectedView
  );
  const filtersChanged = !_.isEqual(criteria.filterFields, resetFilterFields);
  const resultCount = sameWorkOrderQuery(activeCriteria, query)
    ? workOrders.totalElements ?? rows.length
    : 0;
  const loadMore = (retry = false) =>
    requestPage(
      !!rows.length &&
        !loadingList &&
        !loadingMore &&
        (retry || !errorMore) &&
        !lastPage &&
        sameWorkOrderQuery(activeCriteria, query),
      () => dispatch(getMoreWorkOrders(criteria, currentPageNum + 1))
    );

  return (
    <ErioneScreen style={{ backgroundColor: FIELD_UI.canvas }}>
      <FlatList
        testID="work-order-virtual-list"
        data={rows}
        keyExtractor={(row) => String(row.id)}
        initialNumToRender={5}
        maxToRenderPerBatch={6}
        windowSize={7}
        onEndReached={() => loadMore()}
        onEndReachedThreshold={0.35}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={!!loadingList && !listRequestSilent}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        scrollEventThrottle={400}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <FieldHero
              eyebrow="ERIONE · CAMPO"
              title={history ? 'Histórico de OS' : 'Ordens de serviço'}
              helper={
                history
                  ? 'Consulte e filtre os atendimentos e seus registros.'
                  : 'O destino, o serviço e a próxima ação. Tudo em um só lugar.'
              }
              count={resultCount}
              countLabel="resultados"
            />
            <View style={styles.viewSwitch} accessibilityRole="tablist">
              {(
                [
                  {
                    value: 'active',
                    label: 'Ativas',
                    icon: 'clipboard-text-outline'
                  },
                  { value: 'history', label: 'Histórico', icon: 'history' }
                ] as const
              ).map((item) => (
                <TouchableOpacity
                  key={item.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: selectedView === item.value }}
                  onPress={() => {
                    setSelectedView(item.value);
                    setCriteria((previous) => ({
                      ...previous,
                      pageNum: 0,
                      filterFields: selectWorkOrderListView(
                        previous.filterFields,
                        item.value
                      )
                    }));
                  }}
                  style={[
                    styles.viewTab,
                    selectedView === item.value && styles.viewTabSelected
                  ]}
                >
                  <Icon
                    source={item.icon}
                    size={20}
                    color={
                      selectedView === item.value
                        ? colors.primary
                        : colors.muted
                    }
                  />
                  <Text
                    style={[
                      styles.viewTabText,
                      selectedView === item.value && styles.viewTabTextSelected
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <WorkOrderSearchBar
              appliedQuery={getWorkOrderSearchText(criteria)}
              onSubmit={onSearchSubmit}
            />
            <ScrollView
              horizontal
              style={styles.filters}
              contentContainerStyle={styles.filtersContent}
              showsHorizontalScrollIndicator={false}
            >
              <IconButton
                icon={!filtersChanged ? 'filter-outline' : 'filter-check'}
                iconColor={!filtersChanged ? colors.primary : '#FFFFFF'}
                style={{
                  backgroundColor: !filtersChanged
                    ? colors.primarySoft
                    : theme.colors.primary
                }}
                onPress={() =>
                  navigation.navigate('WorkOrderFilters', {
                    filterFields: criteria.filterFields,
                    onFilterChange
                  })
                }
              />
              {hasViewOtherPermission(PermissionEntity.WORK_ORDERS) && (
                <QuickFilter
                  filterFields={criteria.filterFields}
                  activeFilterField={{
                    field: 'assignedToUser',
                    operation: 'eq',
                    value: user.id
                  }}
                  onChange={onFilterChange}
                />
              )}
              {history && (
                <>
                  <EnumFilter
                    filterFields={criteria.filterFields}
                    onChange={onFilterChange}
                    completeOptions={['NONE', 'LOW', 'MEDIUM', 'HIGH']}
                    initialOptions={['NONE', 'LOW', 'MEDIUM', 'HIGH']}
                    fieldName="priority"
                    icon="signal"
                  />
                  <EnumFilter
                    filterFields={criteria.filterFields}
                    onChange={onFilterChange}
                    completeOptions={[...WORK_ORDER_STATUSES]}
                    initialOptions={['COMPLETE']}
                    fieldName="status"
                    icon="circle-double"
                    restoreInitialOnEmpty
                  />
                </>
              )}
              {filtersChanged && (
                <IconButton
                  icon="close"
                  iconColor={theme.colors.error}
                  style={{ backgroundColor: '#FEE2E2' }}
                  onPress={() => onFilterChange(resetFilterFields)}
                />
              )}
            </ScrollView>
            <View style={styles.resultHeading}>
              <Text accessibilityRole="header" style={styles.resultTitle}>
                {listView === 'history'
                  ? 'Atendimentos concluídos'
                  : history
                  ? 'Resultado dos filtros'
                  : 'Sua lista de atendimentos'}
              </Text>
              <Text style={styles.resultHint}>{rows.length} carregadas</Text>
            </View>
            {listError && (
              <View style={{ marginBottom: 14 }}>
                <FieldNotice
                  icon="wifi-alert"
                  title="Não foi possível atualizar"
                  message={
                    rows.length
                      ? 'Os dados anteriores continuam aqui. Confira a conexão e tente novamente.'
                      : listError
                  }
                  warning
                />
                <Button
                  mode="text"
                  onPress={onRefresh}
                  contentStyle={{ minHeight: 44 }}
                >
                  Tentar novamente
                </Button>
              </View>
            )}
          </>
        }
        renderItem={({ item: { id, summary, workOrder } }) => {
          if (summary)
            return (
              <FieldOrderCard
                key={id}
                summary
                customId={summary.customId}
                title={summary.title}
                status={t('COMPLETE')}
                statusColor={getStatusColor('COMPLETE', theme)}
                customer={summary.customerNames}
                location={summary.locationName}
                createdAt={getFormattedDate(summary.createdAt)}
                completedAt={
                  summary.completedOn
                    ? getFormattedDate(summary.completedOn)
                    : undefined
                }
                action="Consultar detalhes online"
                onPress={() => navigation.push('WODetails', { id })}
              />
            );
          const companionLabel = getWorkOrderCompanionLabel(workOrder, user.id);
          const dueSoon =
            !!workOrder.dueDate &&
            (dayDiff(new Date(workOrder.dueDate), new Date()) <= 2 ||
              isPastDue(workOrder)) &&
            workOrder.status !== 'COMPLETE';
          return (
            <FieldOrderCard
              key={id}
              customId={workOrder.customId}
              title={workOrder.title}
              status={t(workOrder.status)}
              statusColor={getStatusColor(workOrder.status, theme)}
              customer={workOrder.customers?.[0]?.name}
              location={workOrder.location?.name}
              address={workOrder.location?.address}
              asset={workOrder.asset?.name}
              createdAt={getFormattedDate(workOrder.createdAt)}
              completedAt={
                workOrder.status === 'COMPLETE' && workOrder.completedOn
                  ? getFormattedDate(workOrder.completedOn)
                  : undefined
              }
              dueAt={
                workOrder.dueDate
                  ? getFormattedDate(workOrder.dueDate)
                  : undefined
              }
              dueSoon={dueSoon}
              priority={
                workOrder.priority && workOrder.priority !== 'NONE'
                  ? t(workOrder.priority)
                  : undefined
              }
              priorityColor={getPriorityColor(workOrder.priority, theme)}
              assignees={renderAssignees(workOrder)}
              companion={!!companionLabel}
              action={companionLabel || t(getNextActionKey(workOrder))}
              onPress={() =>
                navigation.push('WODetails', {
                  id: workOrder.id,
                  workOrderProp: workOrder
                })
              }
            />
          );
        }}
        ListFooterComponent={
          <>
            {!rows.length && !loadingGet && !listError && (
              <ErioneCard style={styles.emptyCard}>
                <FieldSectionTitle
                  icon="clipboard-search-outline"
                  title={t('no_element_match_criteria')}
                  helper="Revise a busca ou os filtros acima para encontrar a OS."
                />
              </ErioneCard>
            )}
            {!!errorMore && sameWorkOrderQuery(activeCriteria, query) && (
              <ErioneCard style={styles.emptyCard}>
                <FieldNotice
                  icon="wifi-alert"
                  title="A próxima página não carregou"
                  message={errorMore}
                  warning
                />
                <Button
                  mode="outlined"
                  onPress={() => loadMore(true)}
                  contentStyle={{ minHeight: 48 }}
                  style={{ marginTop: 12 }}
                >
                  Tentar carregar mais
                </Button>
              </ErioneCard>
            )}
            {loadingGet && (
              <View style={styles.bottomLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </>
        }
      />
    </ErioneScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center'
  },
  viewSwitch: {
    flexDirection: 'row',
    padding: 4,
    backgroundColor: '#E6ECF5',
    borderRadius: 16,
    marginVertical: 16,
    gap: 4
  },
  viewTab: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  viewTabSelected: { backgroundColor: '#FFFFFF' },
  viewTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
    flexShrink: 1
  },
  viewTabTextSelected: { color: colors.primary },
  filters: { marginTop: 10, marginBottom: 8 },
  filtersContent: { alignItems: 'center', gap: 2, paddingVertical: 2 },
  resultHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 8,
    marginBottom: 14
  },
  resultTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  resultHint: { color: colors.muted, fontSize: 12 },
  assigneeContainer: { flexDirection: 'row', alignItems: 'center' },
  assigneeMore: { marginLeft: 8, color: colors.muted },
  emptyCard: {
    padding: 18,
    borderRadius: 18,
    borderColor: FIELD_UI.border,
    elevation: 0,
    shadowOpacity: 0,
    marginBottom: 14
  },
  bottomLoader: { alignItems: 'center', paddingVertical: 20 }
});
