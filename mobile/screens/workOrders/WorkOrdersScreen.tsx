import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useDispatch, useSelector } from '../../store';
import * as React from 'react';
import { Fragment, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CompanySettingsContext } from '../../contexts/CompanySettingsContext';
import useAuth from '../../hooks/useAuth';
import { PermissionEntity } from '../../models/role';
import { getMoreWorkOrders, getWorkOrders } from '../../slices/workOrder';
import { FilterField, SearchCriteria } from '../../models/page';
import { Avatar, IconButton, Searchbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import WorkOrder, {
  WORK_ORDER_STATUSES,
  WorkOrderStatus
} from '../../models/workOrder';
import {
  getPriorityColor,
  getStatusColor,
  isCloseToBottom,
  onSearchQueryChange
} from '../../utils/overall';
import { RootTabScreenProps } from '../../types';
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect';
import _ from 'lodash';
import EnumFilter from './EnumFilter';
import { dayDiff } from '../../utils/dates';
import { IconWithLabel } from '../../components/IconWithLabel';
import QuickFilter from './QuickFilter';
import { useAppTheme } from '../../custom-theme';
import { getUserInitials } from '../../utils/displayers';
import { UserMiniDTO } from '../../models/user';
import {
  ErioneCard,
  ErioneScreen,
  ErioneStatusBadge
} from '../../components/erione/ErioneUI';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';
import {
  getNextActionKey,
  isPastDue,
  isPendingCompletion,
  isWorkOrderInField
} from '../../utils/workOrderFieldUx';
import { useFocusEffect } from '@react-navigation/native';

const colors = ERIONE_MOBILE_IDENTITY.colors;
const DEFAULT_ACTIVE_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  'OPEN',
  'EN_ROUTE',
  'IN_PROGRESS',
  'ON_HOLD'
];

export default function WorkOrdersScreen({
  navigation,
  route
}: RootTabScreenProps<'WorkOrders'>) {
  const { t } = useTranslation();
  const [startedSearch, setStartedSearch] = useState<boolean>(false);
  const { workOrders, loadingGet, currentPageNum, lastPage, errorGet } = useSelector(
    (state) => state.workOrders
  );
  const theme = useAppTheme();
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const fromHomeInit = useRef<boolean>(false);
  const loadingMoreRef = useRef<boolean>(false);
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
    return {
      ...initialCriteria,
      filterFields: [...newFilterFields, ...filterFields]
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
  const [criteria, setCriteria] = useState<SearchCriteria>(
    getCriteriaFromFilterFields(getDefaultFilterFields())
  );
  useEffect(() => {
    if (route.params?.fromHome && !fromHomeInit.current) {
      fromHomeInit.current = true;
      return;
    }
    dispatch(
      getWorkOrders({
        ...criteria,
        pageSize: 10,
        pageNum: 0,
        direction: 'DESC'
      })
    );
    fromHomeInit.current = true;
  }, [criteria]);

  useFocusEffect(
    useCallback(() => {
      if (!fromHomeInit.current) return;

      dispatch(
        getWorkOrders({
          ...criteria,
          pageSize: 10,
          pageNum: 0,
          direction: 'DESC'
        })
      );
    }, [criteria, dispatch])
  );

  useEffect(() => {
    const filterFields = route.params?.filterFields ?? [];
    if (filterFields.length)
      setCriteria(getCriteriaFromFilterFields(filterFields));
  }, [route]);

  const onRefresh = () => {
    const currentFilters = criteria.filterFields.filter(
      (ff) => ff.field !== 'assignedToUser'
    );
    setCriteria(
      getCriteriaFromFilterFields([
        ...getDefaultFilterFields(),
        ...currentFilters
      ])
    );
  };
  const onFilterChange = (newFilters: FilterField[]) => {
    setCriteria({ ...criteria, filterFields: newFilters, pageNum: 0 });
  };

  const onQueryChange = (query) => {
    onSearchQueryChange<WorkOrder>(
      query,
      criteria,
      setCriteria,
      setSearchQuery,
      ['title', 'description', 'feedback', 'customId']
    );
  };
  useDebouncedEffect(
    () => {
      if (startedSearch) onQueryChange(searchQuery);
    },
    [searchQuery],
    1000
  );

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
              <Avatar.Image source={{ uri: assignedUser.image.url }} size={26} />
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

  return (
    <ErioneScreen>
      <Fragment>
        <View style={styles.pageHeader}>
          <View style={{ flex: 1 }}>
            <Text variant="labelMedium" style={styles.pageKicker}>
              Erione CMMS
            </Text>
            <Text variant="headlineSmall" style={styles.pageTitle}>
              {t('work_orders')}
            </Text>
            <Text variant="bodySmall" style={styles.pageSubtitle}>
              {t('my_shift_helper')}
            </Text>
          </View>
          <View style={styles.countPill}>
            <Text variant="titleMedium" style={styles.countValue}>
              {workOrders.totalElements ?? workOrders.content.length}
            </Text>
            <Text variant="labelSmall" style={styles.countLabel}>
              OS
            </Text>
          </View>
        </View>
        <View style={styles.searchWrap}>
          <Searchbar
            placeholder={t('search')}
            onFocus={() => setStartedSearch(true)}
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.search}
            inputStyle={styles.searchInput}
          />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
          onScroll={({ nativeEvent }) => {
            if (isCloseToBottom(nativeEvent)) {
              if (!loadingGet && !lastPage && !loadingMoreRef.current) {
                loadingMoreRef.current = true;
                dispatch(getMoreWorkOrders(criteria, currentPageNum + 1))
                  .finally(() => { loadingMoreRef.current = false; });
              }
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={loadingGet}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
            />
          }
          scrollEventThrottle={400}
        >
          <ScrollView
            horizontal
            style={styles.filters}
            contentContainerStyle={styles.filtersContent}
            showsHorizontalScrollIndicator={false}
          >
            <IconButton
              icon={
                _.isEqual(criteria.filterFields, defaultFilterFields)
                  ? 'filter-outline'
                  : 'filter-check'
              }
              iconColor={
                _.isEqual(criteria.filterFields, defaultFilterFields)
                  ? colors.primary
                  : '#FFFFFF'
              }
              style={{
                  backgroundColor: _.isEqual(
                  criteria.filterFields,
                  defaultFilterFields
                )
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
              initialOptions={[...DEFAULT_ACTIVE_WORK_ORDER_STATUSES]}
              fieldName="status"
              icon="circle-double"
              restoreInitialOnEmpty
            />
            {!_.isEqual(criteria.filterFields, defaultFilterFields) && (
              <IconButton
                icon="close"
                iconColor={theme.colors.error}
                style={{ backgroundColor: '#FEE2E2' }}
                onPress={() => onFilterChange(defaultFilterFields)}
              />
            )}
          </ScrollView>
          {errorGet ? (
            <ErioneCard style={styles.emptyCard}>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                {errorGet}
              </Text>
              <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
                <Text style={styles.retryText}>Tentar novamente</Text>
              </TouchableOpacity>
            </ErioneCard>
          ) : !!workOrders.content.length ? (
            workOrders.content.map((workOrder) => {
              const statusColor = getStatusColor(workOrder.status, theme);
              const inField = isWorkOrderInField(workOrder);
              const pendingCompletion = isPendingCompletion(workOrder);
              const dueSoon =
                workOrder.dueDate &&
                (dayDiff(new Date(workOrder.dueDate), new Date()) <= 2 ||
                  isPastDue(workOrder)) &&
                workOrder.status !== 'COMPLETE';

              return (
                <TouchableOpacity
                  onPress={() =>
                    navigation.push('WODetails', {
                      id: workOrder.id,
                      workOrderProp: workOrder
                    })
                  }
                  key={workOrder.id}
                  activeOpacity={0.82}
                >
                  <ErioneCard
                    style={[
                      styles.card,
                      inField && styles.activeCard,
                      pendingCompletion && styles.pendingCompletionCard
                    ]}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={styles.titleGroup}>
                        <Text variant="bodySmall" style={styles.customId}>
                          #{workOrder.customId}
                        </Text>
                        <Text
                          variant="titleMedium"
                          style={styles.cardTitle}
                          numberOfLines={2}
                        >
                          {workOrder.title}
                        </Text>
                      </View>
                      <ErioneStatusBadge
                        label={t(workOrder.status)}
                        color={statusColor}
                        subtle
                      />
                    </View>

                    <View
                      style={[
                        styles.nextActionStrip,
                        pendingCompletion && styles.nextActionStripWarning,
                        inField && styles.nextActionStripActive
                      ]}
                    >
                      <View style={styles.nextActionIcon}>
                        <IconButton
                          icon={
                            pendingCompletion
                              ? 'check-circle-outline'
                              : inField
                              ? 'map-marker-check-outline'
                              : 'arrow-right-circle-outline'
                          }
                          size={22}
                          iconColor={
                            pendingCompletion
                              ? theme.colors.error
                              : inField
                              ? colors.primary
                              : colors.muted
                          }
                          style={{ margin: 0 }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="labelSmall" style={styles.nextActionLabel}>
                          {t('next_action')}
                        </Text>
                        <Text variant="bodyMedium" style={styles.nextActionText}>
                          {t(getNextActionKey(workOrder))}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.infoGrid}>
                      {!!workOrder.customers?.length && (
                        <IconWithLabel
                          label={workOrder.customers[0].name}
                          icon="domain"
                          color={colors.muted}
                        />
                      )}
                      {workOrder.location && (
                        <IconWithLabel
                          label={workOrder.location.name}
                          icon="map-marker-outline"
                          color={colors.muted}
                        />
                      )}
                      {workOrder.location?.address && (
                        <IconWithLabel
                          label={workOrder.location.address}
                          icon="map-marker-radius-outline"
                          color={colors.muted}
                        />
                      )}
                      {workOrder.asset && (
                        <IconWithLabel
                          label={workOrder.asset.name}
                          icon="package-variant-closed"
                          color={colors.muted}
                        />
                      )}
                    </View>

                    <View style={styles.cardFooter}>
                      <View style={styles.footerMeta}>
                        {workOrder.priority &&
                          workOrder.priority !== 'NONE' && (
                            <ErioneStatusBadge
                              label={t(workOrder.priority)}
                              color={getPriorityColor(
                                workOrder.priority,
                                theme
                              )}
                              subtle
                            />
                          )}
                        {workOrder.dueDate && (
                          <IconWithLabel
                            color={dueSoon ? theme.colors.error : colors.muted}
                            label={getFormattedDate(workOrder.dueDate)}
                            icon="clock-alert-outline"
                          />
                        )}
                      </View>
                      {renderAssignees(workOrder)}
                    </View>
                  </ErioneCard>
                </TouchableOpacity>
              );
            })
          ) : loadingGet ? null : (
            <ErioneCard style={styles.emptyCard}>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                {t('no_element_match_criteria')}
              </Text>
            </ErioneCard>
          )}
          {loadingGet && !!workOrders.content.length && (
            <View style={styles.bottomLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </ScrollView>
      </Fragment>
    </ErioneScreen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4
  },
  pageKicker: {
    color: colors.primary,
    fontWeight: '800'
  },
  pageTitle: {
    color: colors.text,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 2
  },
  pageSubtitle: {
    color: colors.muted,
    marginTop: 2
  },
  countPill: {
    minWidth: 58,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#CAD6FF'
  },
  countValue: {
    color: colors.primary,
    fontWeight: '900'
  },
  countLabel: {
    color: colors.muted,
    fontWeight: '800'
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8
  },
  search: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDE7E7',
    elevation: 0
  },
  searchInput: {
    fontSize: 15
  },
  scrollView: {
    width: '100%',
    height: '100%'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110
  },
  filters: {
    marginBottom: 12
  },
  filtersContent: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2
  },
  card: {
    marginBottom: 12,
    padding: 14
  },
  activeCard: {
    borderColor: colors.primary,
    backgroundColor: '#F6F8FF'
  },
  pendingCompletionCard: {
    borderColor: '#D97706',
    backgroundColor: '#FFFBEB'
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  orderIcon: {
    backgroundColor: colors.primarySoft
  },
  titleGroup: {
    flex: 1
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '900',
    letterSpacing: 0
  },
  customId: {
    color: colors.primary,
    fontWeight: '800',
    marginBottom: 2
  },
  nextActionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F6F9FA',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  nextActionStripActive: {
    backgroundColor: colors.primarySoft,
    borderColor: '#CAD6FF'
  },
  nextActionStripWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D'
  },
  nextActionIcon: {
    borderRadius: 999,
    backgroundColor: '#FFFFFF'
  },
  nextActionLabel: {
    color: colors.muted,
    fontWeight: '700'
  },
  nextActionText: {
    color: colors.text,
    fontWeight: '900',
    marginTop: 1
  },
  infoGrid: {
    gap: 8,
    marginTop: 14
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    gap: 12
  },
  footerMeta: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8
  },
  assigneeContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  assigneeMore: {
    marginLeft: 8,
    color: colors.muted
  },
  emptyCard: {
    marginTop: 10
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: 12
  },
  bottomLoader: {
    alignItems: 'center',
    paddingVertical: 16
  },
  retryButton: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15
  }
});
