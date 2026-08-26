import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { AppThunk } from 'src/store';
import Location, {
  LocationMiniDTO,
  LocationRow
} from '../models/owns/location';
import api, { authHeader } from '../utils/api';
import { revertAll } from 'src/utils/redux';
import { Page, Pageable, pageableToQueryParams } from '../models/owns/page';
import {
  createCancellableRequest,
  isAbortError
} from 'src/utils/cancellableRequest';

interface LocationState {
  locations: Location[];
  locationsHierarchy: LocationRow[];
  // Total real de locais raiz da empresa (nivel 0 da hierarquia) - vem do
  // backend agora que GET locations/children/0 pagina de verdade (antes
  // trazia tudo de uma vez, sem total separado - ver LocationController).
  // Usado pelo contador e pela paginacao de /app/locations quando nao ha
  // busca/filtro ativo (modo hierarquico).
  locationsHierarchyRootTotal: number;
  locationsMini: LocationMiniDTO[];
  loadingGet: boolean;
}

const initialState: LocationState = {
  locations: [],
  locationsHierarchy: [],
  locationsHierarchyRootTotal: 0,
  locationsMini: [],
  loadingGet: false
};

const slice = createSlice({
  name: 'locations',
  initialState,
  extraReducers: (builder) => builder.addCase(revertAll, () => initialState),
  reducers: {
    getLocations(
      state: LocationState,
      action: PayloadAction<{ locations: Location[] }>
    ) {
      const { locations } = action.payload;
      state.locations = locations;
    },
    getLocationsMini(
      state: LocationState,
      action: PayloadAction<{ locations: LocationMiniDTO[] }>
    ) {
      const { locations } = action.payload;
      state.locationsMini = locations;
    },
    addLocation(
      state: LocationState,
      action: PayloadAction<{ location: Location }>
    ) {
      const { location } = action.payload;
      state.locations = [...state.locations, location];
    },
    editLocation(
      state: LocationState,
      action: PayloadAction<{ location: Location }>
    ) {
      const { location } = action.payload;
      const locationIndex = state.locations.findIndex(
        (loc) => loc.id === location.id
      );
      if (locationIndex === -1) {
        state.locations = [...state.locations, location];
      } else {
        state.locations[locationIndex] = location;
      }
    },
    deleteLocation(
      state: LocationState,
      action: PayloadAction<{ id: number }>
    ) {
      const { id } = action.payload;
      const locationIndex = state.locations.findIndex(
        (location) => location.id === id
      );
      state.locations.splice(locationIndex, 1);
    },
    getLocationChildren(
      state: LocationState,
      action: PayloadAction<{
        locations: LocationRow[];
        id: number;
        rootTotal?: number;
      }>
    ) {
      const { locations, id, rootTotal } = action.payload;
      if (id === 0 && rootTotal !== undefined) {
        state.locationsHierarchyRootTotal = rootTotal;
      }
      const parent = state.locationsHierarchy.findIndex(
        (location) => location.id === id
      );
      if (parent !== -1)
        state.locationsHierarchy[parent].childrenFetched = true;

      state.locationsHierarchy = locations.reduce((acc, location) => {
        //check if location already exists in state
        const locationInState = state.locationsHierarchy.findIndex(
          (location1) => location1.id === location.id
        );
        //not found
        if (locationInState === -1) return [...acc, location];
        //found
        acc[locationInState] = location;
        return acc;
      }, state.locationsHierarchy);
    },
    setLoadingGet(
      state: LocationState,
      action: PayloadAction<{ loading: boolean }>
    ) {
      const { loading } = action.payload;
      state.loadingGet = loading;
    },
    resetHierarchy(state: LocationState, action: PayloadAction<{}>) {
      state.locationsHierarchy = [];
    }
  }
});

export const reducer = slice.reducer;

export const getLocations = (): AppThunk => async (dispatch) => {
  const { signal } = createCancellableRequest('locations');
  try {
    const locations = await api.get<Location[]>('locations', { signal });
    dispatch(slice.actions.getLocations({ locations }));
  } catch (error) {
    if (isAbortError(error)) return;
    throw error;
  }
};
export const getLocationsMini =
  (customerId?: number, requireCustomer?: boolean): AppThunk =>
  async (dispatch) => {
    const { signal } = createCancellableRequest('locations/mini');
    try {
      dispatch(slice.actions.setLoadingGet({ loading: true }));
      const params = new URLSearchParams();
      if (customerId) params.set('customerId', String(customerId));
      // Faz o servidor devolver lista vazia (em vez da consulta global) caso o
      // customerId nao chegue. Usado no fluxo Cliente -> Localizacao -> Ativo.
      if (requireCustomer) params.set('requireCustomer', 'true');
      const queryString = params.toString();
      const locations = await api.get<LocationMiniDTO[]>(
        `locations/mini${queryString ? `?${queryString}` : ''}`,
        {
          signal
        }
      );

      dispatch(slice.actions.getLocationsMini({ locations }));
    } catch (error) {
      if (isAbortError(error)) return;
      throw error;
    } finally {
      dispatch(slice.actions.setLoadingGet({ loading: false }));
    }
  };
export const getPublicLocationsMini =
  (portalUUID: string): AppThunk =>
  async (dispatch) => {
    try {
      dispatch(slice.actions.setLoadingGet({ loading: true }));
      const locations = await api.get<LocationMiniDTO[]>(
        `locations/public/mini/${portalUUID}`,
        { headers: authHeader(true) }
      );
      dispatch(slice.actions.getLocationsMini({ locations }));
    } finally {
      dispatch(slice.actions.setLoadingGet({ loading: false }));
    }
  };
export const addLocation =
  (location): AppThunk =>
  async (dispatch) => {
    const locationResponse = await api.post<Location>('locations', location);
    dispatch(slice.actions.addLocation({ location: locationResponse }));
    return locationResponse;
  };
export const editLocation =
  (id: number, location): AppThunk =>
  async (dispatch) => {
    const locationResponse = await api.patch<Location>(
      `locations/${id}`,
      location
    );
    dispatch(slice.actions.editLocation({ location: locationResponse }));
  };
export const getSingleLocation =
  (id: number): AppThunk =>
  async (dispatch) => {
    const locationResponse = await api.get<Location>(`locations/${id}`);
    dispatch(slice.actions.editLocation({ location: locationResponse }));
  };
export const deleteLocation =
  (id: number): AppThunk =>
  async (dispatch) => {
    const locationResponse = await api.deletes<{ success: boolean }>(
      `locations/${id}`
    );
    const { success } = locationResponse;
    if (success) {
      dispatch(slice.actions.deleteLocation({ id }));
    }
  };

export const getLocationChildren =
  (id: number, parents: number[], pageable: Pageable): AppThunk =>
  async (dispatch) => {
    dispatch(slice.actions.setLoadingGet({ loading: true }));
    // GET locations/children/{id} agora retorna Page<Location> (antes era
    // um array simples sem paginacao real - ver LocationController), pra
    // que o nivel raiz (id=0) possa paginar de verdade no banco em vez de
    // trazer todos os locais raiz da empresa numa unica resposta.
    const response = await api.get<Page<Location>>(
      `locations/children/${id}?${pageableToQueryParams(pageable)}`
    );
    const locations = response.content ?? [];
    dispatch(
      slice.actions.getLocationChildren({
        id,
        locations: locations.map((location) => {
          return { ...location, hierarchy: [...parents, location.id] };
        }),
        rootTotal: id === 0 ? response.totalElements : undefined
      })
    );
    dispatch(slice.actions.setLoadingGet({ loading: false }));
  };

export const resetLocationsHierarchy =
  (pageable: Pageable, callApi: boolean): AppThunk =>
  async (dispatch) => {
    dispatch(slice.actions.resetHierarchy({}));
    if (callApi) {
      dispatch(getLocationChildren(0, [], pageable));
    }
  };

export default slice;
