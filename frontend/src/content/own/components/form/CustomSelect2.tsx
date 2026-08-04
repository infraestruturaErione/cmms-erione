import {
  Alert,
  Autocomplete,
  Box,
  Card,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  ListItemIcon,
  TextField,
  Typography
} from '@mui/material';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import { FormikProps, useFormikContext } from 'formik';
import { useContext, useEffect, useState } from 'react';
import { getLocationsMini } from 'src/slices/location';
import { IField, IHash } from '../../type';
import SelectAssetModal from './SelectAssetModal';
import SelectForm from './SelectForm';
import SelectParts from './SelectParts';
import { useDispatch, useSelector } from '../../../../store';
import SearchIcon from '@mui/icons-material/Search';
import AddCircleTwoToneIcon from '@mui/icons-material/AddCircleTwoTone';
import SelectTasksModal from './SelectTasks';
import { getCustomersMini } from '../../../../slices/customer';
import { getVendorsMini } from '../../../../slices/vendor';
import { getUsersMini } from '../../../../slices/user';
import { getAssetsMini } from '../../../../slices/asset';
import { getTeamsMini } from '../../../../slices/team';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import { getPriorityLabel } from '../../../../utils/formatters';
import { addCategory, getCategories } from '../../../../slices/category';
import { getRoles } from '../../../../slices/role';
import { getCurrencies } from '../../../../slices/currency';
import { useTranslation } from 'react-i18next';
import SelectLocationModal from './SelectLocationModal';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../../../hooks/useAuth';
import { LocationMiniDTO } from '../../../../models/owns/location';
import { AssetMiniDTO } from '../../../../models/owns/asset';
import { PermissionEntity } from '../../../../models/owns/role';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { getLocationUrl } from '../../../../utils/urlPaths';

interface OptionType {
  label: string;
  value: string | number;
  __createOption__?: boolean;
}

interface CreateOptionType extends OptionType {
  __entityType__?: 'location' | 'asset';
  __returnField__?: string;
}

interface InviteUserOptionType extends OptionType {
  __inviteOption__?: boolean;
  __email__?: string;
}

interface CreateCategoryOptionType extends OptionType {
  __createCategoryOption__?: boolean;
  __categoryName__?: string;
}

export const CustomSelect = ({
  field,
  handleChange
}: {
  field: IField;
  handleChange: (formik: FormikProps<IHash<any>>, field: string, e) => void;
}) => {
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const { t } = useTranslation();
  const formik = useFormikContext();
  const [openTask, setOpenTask] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    hasCreatePermission,
    user: { companySettingsId }
  } = useAuth();
  const location = useLocation();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { customersMini } = useSelector((state) => state.customers);
  const { vendorsMini } = useSelector((state) => state.vendors);
  const { locationsMini, locationsHierarchy } = useSelector(
    (state) => state.locations
  );
  const { categories } = useSelector((state) => state.categories);
  const { usersMini } = useSelector((state) => state.users);
  const { assetsMini } = useSelector((state) => state.assets);
  const { teamsMini } = useSelector((state) => state.teams);
  const { roles } = useSelector((state) => state.roles);
  const { currencies } = useSelector((state) => state.currencies);

  const fetchCustomers = async () => {
    dispatch(getCustomersMini());
  };

  const fetchVendors = async () => {
    dispatch(getVendorsMini());
  };
  const fetchUsers = async () => {
    dispatch(getUsersMini());
  };
  const fetchLocations = async () => {
    const customerId = getRelatedCustomerId();
    if (field.scopedByCustomer && !customerId) return;
    dispatch(getLocationsMini(customerId, field.scopedByCustomer));
  };
  const fetchRoles = async () => {
    dispatch(getRoles());
  };

  const fetchCategories = async (category: string) => {
    dispatch(getCategories(category));
  };
  const fetchAssets = async (
    locationId?: number | null,
    customerId?: number
  ) => {
    if (field.scopedByCustomer && !customerId) return;
    dispatch(getAssetsMini(locationId, customerId, field.scopedByCustomer));
  };
  const fetchTeams = async () => {
    dispatch(getTeamsMini());
  };
  const fetchCurrencies = async () => {
    if (!currencies.length) dispatch(getCurrencies());
  };

  const getRelatedCustomerId = (): number | undefined => {
    const configuredCustomerField = field.relatedFields?.find(
      (relatedField) => relatedField.field === 'customers'
    )?.field;
    const values = formik.values as IHash<any>;
    const customersValue = configuredCustomerField
      ? values[configuredCustomerField]
      : values.customers;
    const firstCustomer = Array.isArray(customersValue)
      ? customersValue[0]
      : customersValue;
    return firstCustomer?.value ? Number(firstCustomer.value) : undefined;
  };

  // Handle inline category creation
  const handleCreateCategory = async (categoryName: string) => {
    if (!categoryName.trim() || !field.category) return;

    setCreatingCategory(true);
    try {
      const newCategory = await dispatch(
        addCategory(
          { name: categoryName, companySettings: { id: companySettingsId } },
          field.category
        )
      );

      // Set the newly created category in the form
      handleChange(formik, field.name, {
        label: newCategory.name,
        value: newCategory.id
      });
    } catch (error) {
      console.error(error);
      showSnackBar(t('category_create_failure'), 'error');
    } finally {
      setCreatingCategory(false);
    }
  };

  // Handle returned entity from inline creation
  useEffect(() => {
    // Check for query params from returned entity (?location=123 or ?asset=123)
    const searchParams = new URLSearchParams(window.location.search);
    const locationId = searchParams.get('location');
    const assetId = searchParams.get('asset');
    const returnField = searchParams.get('returnField');

    if (returnField && returnField === field.name) {
      const entityId = locationId || assetId;
      const entityType = locationId ? 'location' : 'asset';

      if (entityId) {
        // Get the entity from the mini lists
        const entityList: (LocationMiniDTO | AssetMiniDTO)[] =
          entityType === 'location' ? locationsMini : assetsMini;
        const entity = entityList.find((e) => e.id === Number(entityId));

        if (entity) {
          handleChange(formik, field.name, {
            label: entity.name,
            value: entity.id
          });
        }

        // Clear the query params
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('location');
        newParams.delete('asset');
        newParams.delete('returnField');
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}?${newParams.toString()}`
        );
      }
    }
  }, [location.search]);

  let options = field.items;
  let loading = field.loading;
  let onOpen = field.onPress;
  let fieldValue = formik.values[field.name];
  const excluded = field.excluded;

  switch (field.type2) {
    case 'customer':
      options = customersMini.map((customer) => {
        return {
          label: customer.name,
          value: customer.id
        };
      });
      onOpen = fetchCustomers;
      break;
    case 'vendor':
      options = vendorsMini.map((vendor) => {
        return {
          label: vendor.companyName,
          value: vendor.id
        };
      });
      onOpen = fetchVendors;
      break;
    case 'user':
      const userOptions = usersMini.map((user) => {
        return {
          label: `${user.firstName} ${user.lastName}`,
          value: user.id
        };
      });
      onOpen = fetchUsers;

      return (
        <>
          <Autocomplete
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth={field.fullWidth || true}
                variant="outlined"
                required={field.required}
                label={field.label}
                placeholder={field.placeholder}
                error={!!formik.errors[field.name] || field.error}
                helperText={
                  typeof formik.errors[field.name] === 'string'
                    ? (formik.errors[field.name] as string)
                    : ''
                }
                InputProps={{
                  ...params.InputProps,
                  endAdornment: hasCreatePermission(
                    PermissionEntity.PEOPLE_AND_TEAMS
                  ) && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/app/people-teams/people?invite=true');
                        }}
                      >
                        <AddCircleTwoToneIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            )}
            fullWidth={field.fullWidth || true}
            disabled={formik.isSubmitting}
            onOpen={onOpen}
            key={field.name}
            freeSolo
            filterOptions={(options, params) => {
              const filtered = options.filter((option) => {
                const inputValue = params.inputValue.toLowerCase();
                const optionLabel = option.label.toLowerCase();
                return optionLabel.includes(inputValue);
              });

              const { inputValue } = params;

              // Always add invite option at the top
              if (hasCreatePermission(PermissionEntity.PEOPLE_AND_TEAMS)) {
                const inviteOption: InviteUserOptionType = {
                  label: inputValue
                    ? `${t('invite')} "${inputValue}"`
                    : t('invite_users'),
                  value: inputValue || 'invite',
                  __inviteOption__: true,
                  __email__: inputValue
                };

                filtered.unshift(inviteOption);
              }
              return filtered;
            }}
            //@ts-ignore
            getOptionLabel={(option) =>
              typeof option === 'string' ? option : option.label
            }
            isOptionEqualToValue={(option, value) =>
              //@ts-ignore
              option.value == value?.value
            }
            multiple={field.multiple}
            value={field.multiple ? fieldValue ?? [] : fieldValue ?? null}
            options={userOptions}
            renderOption={(props, option) => {
              const isInviteOption = (option as InviteUserOptionType)
                .__inviteOption__;
              // @ts-ignore
              const { key, ...restProps } = props;
              return (
                <Box
                  key={option.value ?? key}
                  component="li"
                  {...restProps}
                  sx={{
                    color: isInviteOption ? 'primary.main' : 'inherit',
                    fontWeight: isInviteOption ? 600 : 400
                  }}
                >
                  {isInviteOption && (
                    <ListItemIcon sx={{ color: 'primary.main', minWidth: 36 }}>
                      <AddCircleTwoToneIcon fontSize="small" />
                    </ListItemIcon>
                  )}
                  <Typography
                    variant="body2"
                    sx={{ color: isInviteOption ? 'primary.main' : 'inherit' }}
                  >
                    {(option as OptionType).label}
                  </Typography>
                </Box>
              );
            }}
            onChange={(event, newValue) => {
              if (
                newValue &&
                (newValue as InviteUserOptionType).__inviteOption__
              ) {
                const email = (newValue as InviteUserOptionType).__email__;
                // Navigate to invite page with email if provided
                if (email) {
                  navigate(
                    `/app/people-teams/people?invite=true&email=${encodeURIComponent(
                      email
                    )}`
                  );
                } else {
                  navigate('/app/people-teams/people?invite=true');
                }
              } else {
                handleChange(formik, field.name, newValue);
              }
            }}
          />
        </>
      );
    case 'team':
      options = teamsMini.map((team) => {
        return {
          label: team.name,
          value: team.id
        };
      });
      onOpen = fetchTeams;
      break;
    case 'currency':
      options = currencies.map((currency) => {
        return {
          label: currency.name,
          value: currency.id
        };
      });
      onOpen = fetchCurrencies;
      break;
    case 'location':
    case 'parentLocation':
      const customerId = getRelatedCustomerId();
      // Sem cliente definido nao existe informacao suficiente para determinar as
      // localizacoes validas: a lista fica vazia em vez de cair na consulta global.
      const locationScopeMissing = field.scopedByCustomer && !customerId;
      const selectedLocationId =
        !field.multiple &&
        fieldValue &&
        typeof fieldValue === 'object' &&
        'value' in fieldValue
          ? Number(fieldValue.value)
          : null;
      const locationOptions = locationScopeMissing
        ? []
        : locationsMini
            .filter((location) => location.id !== excluded)
            .map((location) => {
              return {
                label: location.name,
                value: location.id
              };
            });
      onOpen = locationScopeMissing ? () => {} : fetchLocations;

      return (
        <>
          <Autocomplete
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth={field.fullWidth || true}
                variant="outlined"
                required={field.required}
                label={field.label}
                placeholder={field.placeholder}
                error={!!formik.errors[field.name] || field.error}
                helperText={
                  typeof formik.errors[field.name] === 'string'
                    ? (formik.errors[field.name] as string)
                    : locationScopeMissing
                    ? t('select_customer_first')
                    : ''
                }
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        disabled={locationScopeMissing}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocationModalOpen(true);
                        }}
                      >
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            )}
            fullWidth={field.fullWidth || true}
            disabled={formik.isSubmitting || locationScopeMissing}
            onOpen={onOpen}
            key={field.name}
            freeSolo
            filterOptions={(options, params) => {
              const filtered = options.filter((option) => {
                const inputValue = params.inputValue.toLowerCase();
                const optionLabel = option.label.toLowerCase();
                return optionLabel.includes(inputValue);
              });

              const { inputValue } = params;
              const isExisting = options.some((option) =>
                option.label.toLowerCase().includes(inputValue.toLowerCase())
              );

              if (
                inputValue !== '' &&
                !isExisting &&
                hasCreatePermission(PermissionEntity.LOCATIONS)
              ) {
                filtered.unshift({
                  label: `${t('create')} "${inputValue}"`,
                  value: inputValue,
                  __createOption__: true,
                  __entityType__: 'location',
                  __returnField__: field.name
                } as CreateOptionType);
              }

              return filtered;
            }}
            //@ts-ignore
            getOptionLabel={(option) =>
              typeof option === 'string' ? option : option.label
            }
            isOptionEqualToValue={(option, value) =>
              //@ts-ignore
              option.value == value?.value
            }
            multiple={field.multiple}
            value={field.multiple ? fieldValue ?? [] : fieldValue ?? null}
            options={locationOptions}
            renderOption={(props, option) => {
              const isCreateOption = (option as CreateOptionType)
                .__createOption__;
              // @ts-ignore
              const { key, ...restProps } = props;
              return (
                <Box
                  key={option.value ?? key}
                  component="li"
                  {...restProps}
                  sx={{
                    color: isCreateOption ? 'primary.main' : 'inherit',
                    fontWeight: isCreateOption ? 600 : 400
                  }}
                >
                  {isCreateOption && (
                    <ListItemIcon sx={{ color: 'primary.main', minWidth: 36 }}>
                      <AddCircleTwoToneIcon fontSize="small" />
                    </ListItemIcon>
                  )}
                  <Typography
                    variant="body2"
                    sx={{ color: isCreateOption ? 'primary.main' : 'inherit' }}
                  >
                    {(option as OptionType).label}
                  </Typography>
                </Box>
              );
            }}
            onChange={(event, newValue) => {
              if (newValue && (newValue as CreateOptionType).__createOption__) {
                const createOption = newValue as CreateOptionType;
                // Navigate to create page with return info in state
                navigate(
                  `/app/locations?new=true&name=${encodeURIComponent(
                    createOption.value as string
                  )}`,
                  {
                    state: {
                      returnPath: window.location.pathname,
                      returnField: createOption.__returnField__
                    }
                  }
                );
              } else {
                formik.setFieldValue('asset', null);
                handleChange(formik, field.name, newValue);
              }
            }}
          />
          <SelectLocationModal
            open={locationModalOpen && !locationScopeMissing}
            onClose={() => setLocationModalOpen(false)}
            customerId={customerId}
            requireCustomer={field.scopedByCustomer}
            excludedLocationIds={[excluded]}
            maxSelections={field.multiple ? 10 : 1}
            onSelect={(selectedLocations) => {
              handleChange(
                formik,
                field.name,
                field.multiple
                  ? selectedLocations.map((location) => ({
                      label: location.name,
                      value: location.id
                    }))
                  : selectedLocations.length
                  ? {
                      label: selectedLocations[0].name,
                      value: selectedLocations[0].id
                    }
                  : null
              );
              formik.setFieldValue('asset', null);
              setLocationModalOpen(false);
            }}
            initialSelectedLocations={locationsMini.filter((location) =>
              (field.multiple
                ? fieldValue ?? []
                : fieldValue
                ? [fieldValue]
                : []
              ).some((a) => Number(a.value) === location.id)
            )}
          />
          {field.name === 'location' && selectedLocationId ? (
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <Link
                href={getLocationUrl(selectedLocationId)}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}
              >
                {t('see_details')}
                <OpenInNewTwoToneIcon fontSize="inherit" />
              </Link>
            </Box>
          ) : null}
        </>
      );
    case 'asset': {
      const locationId = field.relatedFields?.length
        ? formik.values[field.relatedFields[0].field]?.value ?? null
        : null;
      const customerId = getRelatedCustomerId();
      // Mesma regra da localizacao: sem cliente, nada e carregado. A localizacao,
      // quando presente, apenas estreita ainda mais a lista.
      const assetScopeMissing = field.scopedByCustomer && !customerId;
      const assetOptions = assetScopeMissing
        ? []
        : assetsMini
            .filter((asset) => asset.id !== excluded)
            .map((asset) => {
              return {
                label: asset.name,
                value: asset.id
              };
            });
      onOpen = assetScopeMissing
        ? () => {}
        : () => fetchAssets(locationId || null, customerId);

      return (
        <>
          <Autocomplete
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth={field.fullWidth || true}
                variant="outlined"
                required={field.required}
                label={field.label}
                placeholder={field.placeholder}
                error={!!formik.errors[field.name] || field.error}
                helperText={
                  typeof formik.errors[field.name] === 'string'
                    ? (formik.errors[field.name] as string)
                    : assetScopeMissing
                    ? t('select_customer_first')
                    : ''
                }
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        disabled={assetScopeMissing}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssetModalOpen(true);
                        }}
                      >
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            )}
            fullWidth={field.fullWidth || true}
            disabled={formik.isSubmitting || assetScopeMissing}
            onOpen={onOpen}
            key={field.name}
            freeSolo
            filterOptions={(options, params) => {
              const filtered = options.filter((option) => {
                const inputValue = params.inputValue.toLowerCase();
                const optionLabel = option.label.toLowerCase();
                return optionLabel.includes(inputValue);
              });

              const { inputValue } = params;
              const isExisting = options.some((option) =>
                option.label.toLowerCase().includes(inputValue.toLowerCase())
              );

              if (
                inputValue !== '' &&
                !isExisting &&
                hasCreatePermission(PermissionEntity.ASSETS)
              ) {
                filtered.unshift({
                  label: `${t('create')} "${inputValue}"`,
                  value: inputValue,
                  __createOption__: true,
                  __entityType__: 'asset',
                  __returnField__: field.name
                } as CreateOptionType);
              }

              return filtered;
            }}
            //@ts-ignore
            getOptionLabel={(option) =>
              typeof option === 'string' ? option : option.label
            }
            isOptionEqualToValue={(option, value) =>
              //@ts-ignore
              option.value == value?.value
            }
            multiple={field.multiple}
            value={field.multiple ? fieldValue ?? [] : fieldValue ?? null}
            options={assetOptions}
            renderOption={(props, option) => {
              const isCreateOption = (option as CreateOptionType)
                .__createOption__;
              // @ts-ignore
              const { key, ...restProps } = props;
              return (
                <Box
                  key={option.value ?? key}
                  component="li"
                  {...restProps}
                  sx={{
                    color: isCreateOption ? 'primary.main' : 'inherit',
                    fontWeight: isCreateOption ? 600 : 400
                  }}
                >
                  {isCreateOption && (
                    <ListItemIcon sx={{ color: 'primary.main', minWidth: 36 }}>
                      <AddCircleTwoToneIcon fontSize="small" />
                    </ListItemIcon>
                  )}
                  <Typography
                    variant="body2"
                    sx={{ color: isCreateOption ? 'primary.main' : 'inherit' }}
                  >
                    {(option as OptionType).label}
                  </Typography>
                </Box>
              );
            }}
            onChange={(event, newValue) => {
              if (newValue && (newValue as CreateOptionType).__createOption__) {
                const createOption = newValue as CreateOptionType;
                // Navigate to create page with return info in state
                navigate(
                  `/app/assets?new=true&name=${encodeURIComponent(
                    createOption.value as string
                  )}`,
                  {
                    state: {
                      returnPath: window.location.pathname,
                      returnField: createOption.__returnField__
                    }
                  }
                );
              } else {
                handleChange(formik, field.name, newValue);
              }
            }}
          />
          <SelectAssetModal
            open={assetModalOpen && !assetScopeMissing}
            onClose={() => setAssetModalOpen(false)}
            excludedAssetIds={[excluded]}
            customerId={customerId}
            requireCustomer={field.scopedByCustomer}
            locationId={locationId}
            maxSelections={field.multiple ? 10 : 1}
            onSelect={(selectedAssets) => {
              handleChange(
                formik,
                field.name,
                field.multiple
                  ? selectedAssets.map((asset) => ({
                      label: asset.name,
                      value: asset.id
                    }))
                  : selectedAssets.length
                  ? {
                      label: selectedAssets[0].name,
                      value: selectedAssets[0].id
                    }
                  : null
              );
              setAssetModalOpen(false);
            }}
            initialSelectedAssets={assetsMini.filter((asset) =>
              (field.multiple
                ? fieldValue ?? []
                : fieldValue
                ? [fieldValue]
                : []
              ).some((a) => Number(a.value) === asset.id)
            )}
          />
        </>
      );
    }
    case 'role':
      options = roles.map((role) => {
        return {
          label: role.name,
          value: role.id
        };
      });
      onOpen = fetchRoles;
      break;
    case 'category':
      const categoryOptions =
        categories[field.category]?.map((category) => {
          return {
            label: category.name,
            value: category.id
          };
        }) ?? [];
      const selectedCategoryDefaultChecklist = categories[field.category]?.find(
        (category) => category.id === Number(fieldValue?.value)
      )?.defaultChecklist;
      onOpen = () => fetchCategories(field.category);

      return (
        <>
          <Autocomplete
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth={field.fullWidth || true}
                variant="outlined"
                required={field.required}
                label={field.label}
                placeholder={field.placeholder}
                error={!!formik.errors[field.name] || field.error}
                helperText={
                  typeof formik.errors[field.name] === 'string'
                    ? (formik.errors[field.name] as string)
                    : ''
                }
                InputProps={{
                  ...params.InputProps,
                  endAdornment: hasCreatePermission(
                    PermissionEntity.CATEGORIES
                  ) && (
                    <InputAdornment position="end">
                      {creatingCategory ? (
                        <CircularProgress size="1rem" />
                      ) : (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            const inputValue = params.inputProps.value;
                            if (inputValue) {
                              handleCreateCategory(inputValue as string);
                            }
                          }}
                          disabled={!params.inputProps.value}
                        >
                          <AddCircleTwoToneIcon />
                        </IconButton>
                      )}
                    </InputAdornment>
                  )
                }}
              />
            )}
            fullWidth={field.fullWidth || true}
            disabled={formik.isSubmitting || creatingCategory}
            onOpen={onOpen}
            key={field.name}
            freeSolo
            filterOptions={(options, params) => {
              const filtered = options.filter((option) => {
                const inputValue = params.inputValue.toLowerCase();
                const optionLabel = option.label.toLowerCase();
                return optionLabel.includes(inputValue);
              });

              const { inputValue } = params;

              // Add create category option when typing
              if (
                inputValue !== '' &&
                hasCreatePermission(PermissionEntity.ASSETS)
              ) {
                filtered.unshift({
                  label: `${t('create')} "${inputValue}"`,
                  value: inputValue,
                  __createCategoryOption__: true,
                  __categoryName__: inputValue
                } as CreateCategoryOptionType);
              }

              return filtered;
            }}
            //@ts-ignore
            getOptionLabel={(option) =>
              typeof option === 'string' ? option : option.label
            }
            isOptionEqualToValue={(option, value) =>
              //@ts-ignore
              option.value == value?.value
            }
            multiple={field.multiple}
            value={field.multiple ? fieldValue ?? [] : fieldValue ?? null}
            options={categoryOptions}
            renderOption={(props, option) => {
              const isCreateOption = (option as CreateCategoryOptionType)
                .__createCategoryOption__;
              //@ts-ignore
              const { key, ...restProps } = props;

              return (
                <Box
                  key={option.value ?? key}
                  component="li"
                  {...restProps}
                  sx={{
                    color: isCreateOption ? 'primary.main' : 'inherit',
                    fontWeight: isCreateOption ? 600 : 400
                  }}
                >
                  {isCreateOption && (
                    <ListItemIcon sx={{ color: 'primary.main', minWidth: 36 }}>
                      <AddCircleTwoToneIcon fontSize="small" />
                    </ListItemIcon>
                  )}
                  <Typography
                    variant="body2"
                    sx={{ color: isCreateOption ? 'primary.main' : 'inherit' }}
                  >
                    {(option as OptionType).label}
                  </Typography>
                </Box>
              );
            }}
            onChange={async (event, newValue) => {
              if (
                newValue &&
                (newValue as CreateCategoryOptionType).__createCategoryOption__
              ) {
                const categoryName = (newValue as CreateCategoryOptionType)
                  .__categoryName__;
                if (categoryName) {
                  await handleCreateCategory(categoryName);
                }
              } else {
                handleChange(formik, field.name, newValue);
              }
            }}
          />
          {field.category === 'work-order-categories' &&
            selectedCategoryDefaultChecklist && (
              <Alert severity="info" sx={{ mt: 1.5, alignItems: 'center' }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {t('default_checklist_applied', {
                    name: selectedCategoryDefaultChecklist.name
                  })}
                </Typography>
                <Typography variant="body2">
                  {t('default_checklist_applied_helper')}
                </Typography>
              </Alert>
            )}
        </>
      );
    case 'priority':
      options = ['NONE', 'LOW', 'MEDIUM', 'HIGH'].map((value) => {
        return {
          label: getPriorityLabel(value, t),
          value
        };
      });
      break;
    case 'part':
      return (
        <>
          <Box display="flex" flexDirection="column">
            {fieldValue?.length
              ? fieldValue.map(({ label, value }) => (
                  <Link
                    sx={{ mb: 1 }}
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`/app/inventory/parts/${value}`}
                    key={value}
                    variant="h4"
                  >
                    {label}
                  </Link>
                ))
              : null}
          </Box>
          <SelectParts
            selected={
              fieldValue?.map(({ label, value }) => Number(value)) ?? []
            }
            onChange={(newParts) => {
              handleChange(
                formik,
                field.name,
                newParts.map((part) => {
                  return { label: part.name, value: part.id };
                })
              );
            }}
          />
        </>
      );
    case 'task':
      const selectedCategoryId = Number(
        ((formik.values as IHash<any>).category as OptionType | undefined)
          ?.value
      );
      const defaultChecklist = categories['work-order-categories']?.find(
        (category) => category.id === selectedCategoryId
      )?.defaultChecklist;
      const additionalItemsCount = Array.isArray(fieldValue)
        ? fieldValue.length
        : 0;

      return (
        <>
          <SelectTasksModal
            open={openTask}
            onClose={() => setOpenTask(false)}
            selected={fieldValue ?? []}
            excludedChecklistId={defaultChecklist?.id}
            onSelect={(tasks) => {
              handleChange(formik, field.name, tasks);
              return Promise.resolve();
            }}
          />
          {defaultChecklist && (
            <Alert severity="info" sx={{ mb: 1.5, alignItems: 'center' }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {t('default_checklist_applied', {
                  name: defaultChecklist.name
                })}
              </Typography>
              <Typography variant="body2">
                {t('default_checklist_applied_helper')}
              </Typography>
            </Alert>
          )}
          <Card onClick={() => setOpenTask(true)} sx={{ cursor: 'pointer' }}>
            <Box
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <AssignmentTwoToneIcon />
              <Box>
                <Typography variant="h4" color="primary">
                  {defaultChecklist
                    ? t('additional_checklist_items', {
                        count: additionalItemsCount
                      })
                    : `${additionalItemsCount} ${t('tasks')}`}
                </Typography>
                <Typography variant="subtitle1">
                  {t(
                    defaultChecklist
                      ? 'additional_checklist_items_helper'
                      : 'assign_tasks_description'
                  )}
                </Typography>
              </Box>
              <IconButton>
                {fieldValue?.length ? (
                  <EditTwoToneIcon color="primary" />
                ) : (
                  <AddCircleTwoToneIcon color="primary" />
                )}
              </IconButton>
            </Box>
          </Card>
        </>
      );
    default:
      break;
  }
  return (
    <SelectForm
      options={options}
      value={fieldValue}
      label={field.label}
      onChange={(e, values) => {
        if (field.type2 === 'customer') {
          formik.setFieldValue('location', null);
          formik.setFieldValue('asset', null);
        }
        handleChange(formik, field.name, values);
      }}
      disabled={formik.isSubmitting}
      loading={loading}
      required={field?.required}
      error={!!formik.errors[field.name] || field.error}
      errorMessage={formik.errors[field.name]}
      helperText={field.helperText}
      onOpen={onOpen}
      placeholder={field.placeholder}
      multiple={field.multiple}
      fullWidth={field.fullWidth}
      key={field.name}
    />
  );
};
