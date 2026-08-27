import { useCallback, useEffect, useRef, useState } from 'react';
import { SortingState } from '@tanstack/react-table';
import Location from '../../../../models/owns/location';
import { Page, Pageable, SearchCriteria, Sort } from '../../../../models/owns/page';
import { CustomerMiniDTO } from '../../../../models/owns/customer';
import useAuth from '../../../../hooks/useAuth';
import { PermissionEntity } from '../../../../models/owns/role';
import api from '../../../../utils/api';
import { LOCATIONS_DEFAULT_PAGE_SIZE } from '../components/LocationsTable';

// Busca/listagem de /app/locations - so' estado e' fetch da listagem
// (nenhum JSX aqui). Sempre via POST locations/search (server-side, real
// paginacao) - "Cliente: Todos" + busca vazia significa literalmente todos
// os locais acessiveis (filterFields=[], search=undefined), nao "so' locais
// raiz" como a antiga tela hierarquica assumia. Busca legada por numeros
// dentro de name/address continua funcionando pois quem faz o match e' o
// backend (LocationService.textSearchSpecification), nao este hook.
function useLocationsSearch() {
  const { hasViewPermission } = useAuth();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<CustomerMiniDTO | null>(
    null
  );
  const [pageable, setPageable] = useState<Pageable>({
    page: 0,
    size: LOCATIONS_DEFAULT_PAGE_SIZE
  });
  const [sorting, setSortingState] = useState<SortingState>([]);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Busca DB-side (SearchCriteria.search - name/address/customId/customer.name
  // via EXISTS, ver LocationService.textSearchSpecification) + filtro
  // explicito de Cliente (customers/inm, AND com a busca) - nunca filtro no
  // browser. totalElements sempre vem de response.totalElements, nunca de
  // content.length.
  const fetchSearchResults = useCallback(
    async (
      query: string,
      customerId: number | undefined,
      pageIdx: number,
      pageSz: number
    ) => {
      if (!hasViewPermission(PermissionEntity.LOCATIONS)) return;
      setSearchLoading(true);
      try {
        const criteria: SearchCriteria = {
          filterFields: customerId
            ? [
                {
                  field: 'customers',
                  operation: 'inm',
                  joinType: 'LEFT',
                  value: '',
                  values: [customerId]
                }
              ]
            : [],
          search: query || undefined,
          pageNum: pageIdx,
          pageSize: pageSz,
          sortField: 'name',
          direction: 'ASC'
        };
        const response = await api.post<Page<Location>>(
          'locations/search',
          criteria
        );
        setSearchResults(response.content);
        setSearchTotal(response.totalElements);
      } catch {
        setSearchResults([]);
        setSearchTotal(0);
      }
      setSearchLoading(false);
    },
    [hasViewPermission]
  );

  // Busca/lista sempre via POST locations/search (server-side, real
  // paginacao) - debounce de 250ms pra nao disparar 1 request por tecla.
  useEffect(() => {
    if (!hasViewPermission(PermissionEntity.LOCATIONS)) return;
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      fetchSearchResults(
        searchQuery,
        customerFilter?.id,
        pageable.page,
        pageable.size
      );
    }, 250);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [fetchSearchResults, hasViewPermission, pageable, searchQuery, customerFilter]);

  const handleReset = useCallback(() => {
    fetchSearchResults(
      searchQuery,
      customerFilter?.id,
      pageable.page,
      pageable.size
    );
  }, [fetchSearchResults, searchQuery, customerFilter, pageable]);

  const handleSearchQueryChange = (value: string) => {
    setPageable((prev) => ({ ...prev, page: 0 }));
    setSearchQuery(value);
  };
  const handleSearchClear = () => {
    setSearchQuery('');
    setPageable((prev) => ({ ...prev, page: 0 }));
  };
  const handleCustomerFilterChange = (customer: CustomerMiniDTO | null) => {
    setPageable((prev) => ({ ...prev, page: 0 }));
    setCustomerFilter(customer);
  };
  const handleClearCustomerFilter = () => {
    setCustomerFilter(null);
    setPageable((prev) => ({ ...prev, page: 0 }));
  };
  // "Limpar filtros" so' aparece quando os DOIS filtros estao ativos ao
  // mesmo tempo - com so' um ativo, o "x" individual dele (campo de busca ou
  // Select de cliente) ja resolve, e mostrar os dois seria redundante.
  const hasBothFilters =
    Boolean(searchQuery.trim()) && Boolean(customerFilter);
  const handleClearFilters = () => {
    setSearchQuery('');
    setCustomerFilter(null);
    setPageable((prev) => ({ ...prev, page: 0 }));
  };
  const handlePaginationChange = (newPagination: {
    pageIndex: number;
    pageSize: number;
  }) => {
    setPageable((prev) => ({
      ...prev,
      page: newPagination.pageIndex,
      size: newPagination.pageSize
    }));
  };
  // Paginacao numerada - pageSize fixo (LOCATIONS_DEFAULT_PAGE_SIZE), sem
  // seletor de linhas-por-pagina. Continua 100% server-side: so' muda
  // pageable.page, que ja' dispara fetchSearchResults via o useEffect acima.
  const handleNumberedPageChange = (pageIndex: number) => {
    setPageable((prev) => ({ ...prev, page: pageIndex }));
  };
  const handleSortingChange = (
    resolvedSorting: SortingState,
    sortParams: Sort[]
  ) => {
    setSortingState(resolvedSorting);
    setPageable((prev) => ({
      ...prev,
      sort: sortParams.length > 0 ? [...sortParams] : undefined
    }));
  };

  return {
    searchQuery,
    customerFilter,
    pageable,
    sorting,
    searchResults,
    searchTotal,
    searchLoading,
    hasBothFilters,
    fetchSearchResults,
    handleReset,
    handleSearchQueryChange,
    handleSearchClear,
    handleCustomerFilterChange,
    handleClearCustomerFilter,
    handleClearFilters,
    handlePaginationChange,
    handleNumberedPageChange,
    handleSortingChange
  };
}

export default useLocationsSearch;
