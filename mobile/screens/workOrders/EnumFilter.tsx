import {
  Checkbox,
  Dialog,
  IconButton,
  Portal,
  Text,
  useTheme
} from 'react-native-paper';
import { FilterField } from '../../models/page';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import _ from 'lodash';
import {
  getEffectiveEnumValues,
  replaceEnumFilterValues
} from './enumFilterUtils';

interface OwnProps {
  filterFields: FilterField[];
  onChange: (filterFields: FilterField[]) => void;
  completeOptions: string[];
  initialOptions: string[];
  fieldName: string;
  icon: string;
  restoreInitialOnEmpty?: boolean;
}

export default function EnumFilter({
                                     filterFields,
                                     onChange,
                                     completeOptions,
                                     fieldName,
                                     initialOptions,
                                     icon,
                                     restoreInitialOnEmpty = false
                                   }: OwnProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [newFilterFields, setNewFilterFields] =
    useState<FilterField[]>(filterFields);
  const [statuses, setStatuses] = useState<boolean[]>([]);
  //do not trigger change if statuses didn't change
  const [statusesJustOnOpen, setStatusesJustOnOpen] = useState<boolean[]>(null);
  const isSelected = !_.isEqual(
    statuses,
    completeOptions.map((option) => initialOptions.includes(option))
  );
  const switchValue = (index: number) => {
    const nextStatuses = [...statuses];
    nextStatuses[index] = !nextStatuses[index];
    const effectiveValues = getEffectiveEnumValues(
      completeOptions,
      nextStatuses,
      initialOptions,
      restoreInitialOnEmpty
    );
    const effectiveStatuses = completeOptions.map((currentOption) =>
      effectiveValues.includes(currentOption)
    );

    setStatuses(effectiveStatuses);
    setNewFilterFields(
      replaceEnumFilterValues(filterFields, fieldName, effectiveValues)
    );
  };

  useEffect(() => {
    const selectedStatuses = completeOptions.map((option) =>
      filterFields.some(
        (filterField) =>
          filterField.field === fieldName &&
          filterField.values?.includes(option)
      )
    );
    const effectiveValues = getEffectiveEnumValues(
      completeOptions,
      selectedStatuses,
      initialOptions,
      restoreInitialOnEmpty
    );
    setStatuses(
      completeOptions.map((option) => effectiveValues.includes(option))
    );
    setNewFilterFields(
      replaceEnumFilterValues(filterFields, fieldName, effectiveValues)
    );
  }, [filterFields]);

  const renderDialog = () => {
    return (
      <Portal>
        <Dialog
          visible={openDialog}
          onDismiss={() => {
            setOpenDialog(false);
            if (!_.isEqual(statusesJustOnOpen, statuses)) {
              onChange(newFilterFields);
              setStatusesJustOnOpen(null);
            }
          }}
          style={{ backgroundColor: 'white' }}
        >
          <Dialog.Title>{t('select')}</Dialog.Title>
          <Dialog.Content>
            {completeOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={{
                  marginTop: 5,
                  padding: 10,
                  display: 'flex',
                  borderRadius: 5,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}
                onPress={() => switchValue(index)}
              >
                <Checkbox
                  status={statuses[index] ? 'checked' : 'unchecked'}
                  onPress={() => switchValue(index)}
                />
                <Text>{t(option)}</Text>
              </TouchableOpacity>
            ))}
          </Dialog.Content>
        </Dialog>
      </Portal>
    );
  };
  return (
    <TouchableOpacity
      onPress={() => {
        setOpenDialog(true);
        setStatusesJustOnOpen(
          completeOptions.map((option) =>
            filterFields.some(
              (filterField) =>
                filterField.field === fieldName &&
                filterField.values?.includes(option)
            )
          )
        );
      }}
      style={{
        backgroundColor: isSelected ? theme.colors.primary : theme.colors.background,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        paddingLeft: 15,
        margin: 5
      }}
    >
      {renderDialog()}
      <Text
        style={{ color: isSelected ? 'white' : 'black', fontWeight: 'bold' }}
      >
        {t(fieldName)}
      </Text>
      <IconButton
        icon={'chevron-double-down'}
        iconColor={isSelected ? 'white' : 'black'}
        size={15}
      />
    </TouchableOpacity>
  );
}
