import * as Yup from 'yup';
import { ERIONE_HIDDEN_MODULES } from '../../../../config/erioneModules';
import {
  getCustomFieldsIFields,
  getCustomFieldsRequiredShape,
  IField
} from '../../type';
import { CustomField, CustomFieldEntityType } from '../../../../models/owns/customField';

export interface GetLocationFormFieldsParams {
  t: (key: string, fallback?: string) => string;
  apiKey: string | undefined;
  customFields: CustomField[];
}

// Formulario de Endereco (create/edit, ver LocationFormDialog) - Localizacao
// Pai/Trabalhadores/Equipes saem deste formulario (reforma do modal).
// Location.name/address/customId/backend continuam intocados, so' esses 3
// campos saem da UI e do payload (ver LocationFormDialog sobre como o
// values omite essas chaves no modo edit).
export function getLocationFormFields({
  t,
  apiKey,
  customFields
}: GetLocationFormFieldsParams): Array<IField> {
  return [
    {
      name: 'customers',
      multiple: true,
      type: 'select',
      type2: 'customer',
      label: t('customers'),
      placeholder: 'Select customers'
    },
    // Semantica visual apenas - Location.name continua sendo o campo gravado
    // (backend/DB seguem exigindo @NotNull). O usuario nunca ve "nome do
    // local"; ve "Identificação", que e' como ele reconhece o ponto de
    // atendimento (ex.: "Mercado Municipal").
    {
      name: 'name',
      type: 'text',
      label: t('location_identification_label', 'Identificação'),
      placeholder: t(
        'location_identification_placeholder',
        'Ex.: Mercado Municipal, Pronto Socorro, CAC'
      ),
      helperText: t(
        'location_identification_helper',
        'Como esse endereço é reconhecido no dia a dia.'
      ),
      required: true
    },
    {
      name: 'address',
      type: 'text',
      label: t('address'),
      placeholder: '13th St, New York'
    },
    // Referencia Operacional (ID/PC) - opcional, presentation-only. Nunca
    // concatenada em name/address (fica em campos proprios) - a composicao
    // visual (tabela, preview de OS) e' feita so' na hora de exibir, via
    // utils/locationDisplay.ts. "Tipo" e "Codigo" precisam vir juntos ou
    // ficar ambos vazios (validado abaixo em getLocationFormShape e de novo
    // no backend, que nao confia so' nesta validacao).
    {
      name: 'referenceType',
      type: 'select',
      label: t('location_reference_type_label', 'Tipo'),
      placeholder: t('location_reference_type_placeholder', 'ID ou PC'),
      items: [
        { label: 'ID', value: 'ID' },
        { label: 'PC', value: 'PC' }
      ],
      midWidth: true
    },
    {
      name: 'referenceCode',
      type: 'text',
      label: t('location_reference_code_label', 'Código'),
      placeholder: '15540',
      helperText: t(
        'location_reference_code_helper',
        'Opcional - referência que o cliente já conhece (ex.: número da câmera ou do ponto de coleta).'
      ),
      midWidth: true
    },
    // Erione nao usa Fornecedores/Vendors na operacao atual -
    // ERIONE_HIDDEN_MODULES.vendors ja e' o padrao usado em toda a app pra
    // ocultar o modulo sem tocar backend/entidade/relacionamentos.
    ...(!ERIONE_HIDDEN_MODULES.vendors
      ? ([
          {
            name: 'vendors',
            multiple: true,
            type: 'select',
            type2: 'vendor',
            label: t('vendors'),
            placeholder: 'Select vendors'
          }
        ] as IField[])
      : []),
    // Secao secundaria - Coordenadas (opcional, so' latitude/longitude com
    // placeholders curtos; sem paragrafo explicativo grande).
    {
      name: 'manualCoordinatesTitle',
      type: 'titleGroupField',
      label: t('coordinates', 'Coordenadas')
    },
    {
      name: 'latitude',
      type: 'number',
      label: t('latitude'),
      placeholder: '-22.962065',
      midWidth: true
    },
    {
      name: 'longitude',
      type: 'number',
      label: t('longitude'),
      placeholder: '-45.552194',
      midWidth: true
    },
    ...(apiKey
      ? ([
          {
            name: 'mapSwitch',
            type: 'checkbox',
            label: t('put_location_in_map'),
            relatedFields: [
              { field: 'mapTitle', value: false, hide: true },
              { field: 'coordinates', value: false, hide: true }
            ]
          },
          {
            name: 'mapTitle',
            type: 'titleGroupField',
            label: t('map_coordinates')
          },
          {
            name: 'coordinates',
            type: 'coordinates',
            label: t('map_coordinates')
          }
        ] as IField[])
      : []),
    // Secao secundaria - Anexos. "Foto do endereco" e "Anexos" ficam
    // separados (Location.image e' um unico arquivo/capa, Location.files e'
    // uma lista - payloads diferentes, nao dá pra unificar sem mudar o
    // contrato).
    {
      name: 'image',
      type: 'file',
      fileType: 'image',
      fileVariant: 'light',
      fileHideDescription: true,
      fileCtaText: t('locations_add_photo_button', 'Adicionar foto'),
      label: t('locations_photo_label', 'Foto do endereço')
    },
    {
      name: 'files',
      type: 'file',
      multiple: true,
      fileType: 'file',
      fileVariant: 'light',
      fileHideDescription: true,
      fileCtaText: t('locations_add_files_button', 'Adicionar arquivos'),
      label: t('locations_attachments_label', 'Anexos')
    },
    ...getCustomFieldsIFields(customFields, CustomFieldEntityType.LOCATION)
  ];
}

export function getLocationFormShape(
  t: (key: string, fallback?: string) => string,
  customFields: CustomField[]
) {
  return {
    name: Yup.string().required(t('required_location_name')),
    // Referencia Operacional (ID/PC) - as unicas combinacoes validas sao
    // ambos preenchidos ou ambos vazios (mesma invariante do backend, que
    // tambem valida - nunca confiar so' no frontend). referenceType aqui e'
    // o objeto {label,value} do CustomSelect (ver locationColumns.tsx/
    // LocationFormDialog.tsx sobre a conversao pra string no payload).
    referenceType: Yup.mixed()
      .nullable()
      .when('referenceCode', (code: string, schema: any) =>
        code && code.trim().length > 0
          ? schema.required(
              t('location_reference_type_required', 'Selecione o tipo (ID ou PC)')
            )
          : schema
      ),
    referenceCode: Yup.string()
      .nullable()
      .max(64, t('location_reference_code_max', 'Máximo de 64 caracteres'))
      .when('referenceType', (type: { value?: string } | null, schema: any) =>
        type?.value
          ? schema.required(
              t('location_reference_code_required', 'Informe o código da referência')
            )
          : schema
      ),
    latitude: Yup.number()
      .nullable()
      .transform((value, originalValue) =>
        originalValue === '' || originalValue === null ? null : value
      )
      .min(-90, t('invalid_latitude'))
      .max(90, t('invalid_latitude')),
    longitude: Yup.number()
      .nullable()
      .transform((value, originalValue) =>
        originalValue === '' || originalValue === null ? null : value
      )
      .min(-180, t('invalid_longitude'))
      .max(180, t('invalid_longitude')),
    ...getCustomFieldsRequiredShape(customFields, CustomFieldEntityType.LOCATION, t)
  };
}
