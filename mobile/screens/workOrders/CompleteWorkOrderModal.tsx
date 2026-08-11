import { StyleSheet } from 'react-native';
import * as Yup from 'yup';
import { View } from '../../components/Themed';
import { RootStackScreenProps } from '../../types';
import { useTranslation } from 'react-i18next';
import { useContext } from 'react';
import { IField } from '../../models/form';
import Form from '../../components/form';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import { getWorkOrderCompletionErrorMessage } from '../../utils/workOrderCompletion';

export default function CompleteWorkOrderModal({
  navigation,
  route
}: RootStackScreenProps<'CompleteWorkOrder'>) {
  const { onComplete, fieldsConfig, initialFeedback } = route.params;
  const { t }: { t: any } = useTranslation();
  const { showSnackBar } = useContext(CustomSnackBarContext);

  const getFieldsAndShape = (): [Array<IField>, { [key: string]: any }] => {
    let fields: IField[] = [];
    let shape = {};
    if (fieldsConfig.feedback) {
      fields.push({
        name: 'feedback',
        type: 'text',
        label: t('feedback'),
        placeholder: t('feedback_description'),
        multiple: true
      });
      shape = { feedback: Yup.string() };
    }
    // Campos exigidos pelos snapshots congelados da WorkOrder. A Category
    // atual nao participa da regra de conclusao.
    if (fieldsConfig.signerName) {
      fields.push({
        name: 'signerName',
        type: 'text',
        label: t('signer_name')
      });
      shape = {
        ...shape,
        signerName: Yup.string().required(t('required_field'))
      };
    }
    if (fieldsConfig.signerDocument) {
      fields.push({
        name: 'signerDocument',
        type: 'text',
        label: t('signer_document')
      });
      shape = {
        ...shape,
        signerDocument: Yup.string().required(t('required_field'))
      };
    }
    if (fieldsConfig.mileageTraveled) {
      fields.push({
        name: 'mileageTraveled',
        type: 'number',
        label: t('mileage_traveled'),
        placeholder: t('km')
      });
      shape = {
        ...shape,
        mileageTraveled: Yup.number()
          .min(0, t('mileage_must_be_non_negative'))
          .required(t('required_field'))
      };
    }
    if (fieldsConfig.signature) {
      fields.push({
        name: 'signature',
        type: 'signature',
        label: t('signature')
      });
      shape = {
        ...shape,
        signature: Yup.string().required(t('required_signature'))
      };
    }
    return [fields, shape];
  };
  const initialValues = initialFeedback ? { feedback: initialFeedback } : {};
  return (
    <View style={styles.container}>
      <Form
        fields={getFieldsAndShape()[0]}
        validation={Yup.object().shape(getFieldsAndShape()[1])}
        submitText={t('complete_work_order')}
        values={initialValues}
        navigation={navigation}
        onChange={({ field, e }) => {}}
        onSubmit={async (values) => {
          return onComplete({
            signature: values.signature,
            feedback: values.feedback || undefined,
            signerName: values.signerName,
            signerDocument: values.signerDocument,
            mileageTraveled:
              values.mileageTraveled !== undefined &&
              values.mileageTraveled !== ''
                ? Number(values.mileageTraveled)
                : undefined
          }).catch((err) =>
            showSnackBar(getWorkOrderCompletionErrorMessage(err, t), 'error')
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 'auto'
  }
});
