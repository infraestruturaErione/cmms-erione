import { ReactNode } from 'react';
import {
  CustomField,
  CustomFieldEntityType,
  CustomFieldValue
} from '../../models/owns/customField';

export interface TableCustomizedDataType {
  id: string | number;
  [propName: string]: any;
}

export interface TableCustomizedColumnType {
  label: string;
  accessor: string;
}

export interface IField {
  label: string;
  type:
    | 'number'
    | 'text'
    | 'checkbox'
    | 'file'
    | 'groupCheckbox'
    | 'select'
    | 'titleGroupField'
    | 'form'
    | 'date'
    | 'switch'
    | 'partQuantity'
    | 'coordinates'
    | 'dateRange'
    | 'signature';
  type2?:
    | 'customer'
    | 'vendor'
    | 'user'
    | 'team'
    | 'part'
    | 'location'
    | 'asset'
    | 'priority'
    | 'task'
    | 'category'
    | 'parentLocation'
    | 'role'
    | 'currency';
  category?:
    | 'purchase-order-categories'
    | 'cost-categories'
    | 'time-categories'
    | 'work-order-categories'
    | 'meter-categories'
    | 'part-categories'
    | 'asset-categories';
  name: string;
  placeholder?: string;
  fileType?: 'file' | 'image';
  // Opcional, retrocompativel - default 'default' preserva exatamente a
  // aparencia atual do FileUpload em todas as telas. So AddWorkOrderTabbedModal
  // opta por 'light' nesta Sprint de redesign visual.
  fileVariant?: 'default' | 'light';
  // Opcional, retrocompativel - omitido preserva a legenda padrao
  // (t('upload')) abaixo da dropzone em todo mundo. So' /app/locations usa
  // true, pra tirar esse texto extra dos campos de Foto/Anexos simplificados.
  fileHideDescription?: boolean;
  // Opcional, retrocompativel - omitido preserva o texto padrao
  // ("Selecionar imagem"/"Arraste arquivos..."). So' /app/locations customiza
  // pra "Adicionar foto"/"Adicionar arquivos".
  fileCtaText?: string;
  helperText?: string;
  fullWidth?: boolean;
  multiple?: boolean;
  midWidth?: boolean;
  // Opcional, retrocompativel - so afeta campos multiline (textarea). Sem
  // isso, comportamento padrao continua rows=4 em todas as telas.
  rows?: number;
  // Opcional, retrocompativel - so afeta campos type:'switch'. Sem isso,
  // CustomSwitch renderiza exatamente como antes (h6 bold + mb:2). So
  // AddWorkOrderTabbedModal opta por essa apresentacao mais compacta pro
  // campo "Requer assinatura".
  compact?: boolean;
  // Presentation-only opt-out used by the Work Order creation modal, which
  // renders the category's default checklist as a read-only field beside the
  // category selector instead of the generic informational alert.
  hideCategoryChecklistAlert?: boolean;
  // Presentation-only opt-out for flows that replace the isolated details
  // link with an inline location/address preview.
  hideLocationDetailsLink?: boolean;
  onPress?: () => void;
  required?: boolean;
  error?: any;
  items?: { label: string; value: string | number; checked?: boolean }[];
  // listCheckbox?: { label: string; value: string; checked?: boolean }[];
  icon?: ReactNode | string;
  // onPressIcon?: () => void;
  checked?: boolean;
  loading?: boolean;
  excluded?: number;
  relatedFields?: { field: string; value?: any; hide?: boolean }[];
  // Quando true, o campo só carrega opções depois que um cliente estiver
  // selecionado. Sem cliente a lista fica vazia e o campo desabilitado, em vez
  // de cair na consulta global. Usado no fluxo Cliente -> Localização -> Ativo.
  scopedByCustomer?: boolean;
  // Campos dependentes que devem ser limpos sempre que este campo mudar.
  clearsOnChange?: string[];
}

export interface IHash<E> {
  [key: string]: E;
}

const getCustomFieldIField = (customField: CustomField): IField => {
  const { label, fieldType, required, options } = customField;
  const iField: IField = {
    label,
    name: `customField_${customField.id}`,
    type: 'text',
    required
  };
  switch (fieldType) {
    case 'SHORT_TEXT':
      iField.type = 'text';
      break;
    case 'LONG_TEXT':
      iField.type = 'text';
      iField.multiple = true;
      break;
    case 'NUMBER':
      iField.type = 'number';
      break;
    case 'SINGLE_CHOICE':
      iField.type = 'select';
      iField.items = options?.map((option) => ({
        label: option,
        value: option
      }));
      break;
    case 'DATE':
      iField.type = 'date';
      break;
    case 'DATE_TIME':
      iField.type = 'date';
      break;
    case 'LINK':
      iField.type = 'text';
      break;
    default:
      iField.type = 'text';
  }
  return iField;
};

import * as Yup from 'yup';
import { TFunction } from 'react-i18next';

interface EntityWithCustomFields {
  customFieldValues?: { customField: CustomField; value: string }[];
}

export const getCustomFieldsValues = <T extends EntityWithCustomFields>(
  entity: T
): { [key: string]: string | { label: string; value: string | number } } => {
  const values: {
    [key: string]: string | { label: string; value: string | number };
  } = {};
  entity?.customFieldValues?.forEach((cf) => {
    values[`customField_${cf.customField.id}`] =
      cf.customField.fieldType === 'SINGLE_CHOICE'
        ? { label: cf.value, value: cf.value }
        : cf.value;
  });
  return values;
};
export const getCustomFieldsRequiredShape = (
  customFields: CustomField[],
  customFieldEntityType: CustomFieldEntityType,
  t: TFunction
): { [key: string]: Yup.StringSchema | Yup.ObjectSchema<any> } => {
  const shape: { [key: string]: Yup.StringSchema | Yup.ObjectSchema<any> } = {};
  customFields
    .filter(({ entityType }) => entityType === customFieldEntityType)
    .forEach((field) => {
      if (field.required) {
        shape[`customField_${field.id}`] =
          field.fieldType === 'SINGLE_CHOICE'
            ? Yup.object().required(t('required_field'))
            : Yup.string().required(t('required_field'));
      }
    });
  return shape;
};

export const getCustomFieldsIFields = (
  customFields: CustomField[],
  entityType: CustomFieldEntityType
) =>
  [...customFields]
    .filter((field) => field.entityType === entityType)
    .sort((a, b) => a.order - b.order)
    .map((field) => getCustomFieldIField(field));

export const getCustomFieldValuesForDetails = (
  customFieldValues: CustomFieldValue[],
  getFormattedDate: (date: string) => string
): { label: string; value: string; isLink?: boolean }[] =>
  [...(customFieldValues ?? [])]
    .sort((a, b) => a.customField.order - b.customField.order)
    .map(({ customField, value }) => ({
      label: customField.label,
      value: customField.fieldType.includes('DATE')
        ? getFormattedDate(value)
        : value,
      isLink: customField.fieldType === 'LINK'
    }));
