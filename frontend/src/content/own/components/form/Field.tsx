import { InputAdornment, TextField } from '@mui/material';
import { IField } from '../../type';
import { useTranslation } from 'react-i18next';

interface PropsType extends IField {
  onChange: (event: any) => void;
  onBlur?: (event: any) => any;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  value: any | '';
  placeholder?: string;
  error?: any;
  isDisabled?: boolean;
  //   fieldStyle?: any;
  errorMessage?: any;
  fullWidth?: boolean;
  //   helperText?: string;
  variant?: 'outlined' | 'filled' | 'standard';
  required?: boolean;
}

export default (props: PropsType) => {
  const { t }: { t: any } = useTranslation();

  return (
    <TextField
      error={props.error}
      fullWidth={props.fullWidth || true}
      helperText={t(props.error ? props.errorMessage : props.helperText)}
      label={t(`${props.label}`)}
      placeholder={props.placeholder ?? props.label}
      name={props.name}
      onBlur={props.onBlur}
      type={props.type}
      onChange={props.onChange}
      onKeyDown={props.onKeyDown}
      value={props.value ?? ''}
      variant={'outlined'}
      disabled={props.isDisabled}
      required={props.required || false}
      multiline={props.multiple}
      // MUI usa react-textarea-autosize por baixo - "rows" sozinho nao
      // limita a altura real (ela e' recalculada via minRows/maxRows).
      // Quando props.rows e' passado explicitamente (so pelo
      // AddWorkOrderTabbedModal ate agora), usamos minRows/maxRows iguais
      // pra fixar a altura de fato. Sem props.rows, comportamento
      // EXATAMENTE igual ao anterior (rows=4, sem min/maxRows).
      {...(props.multiple && props.rows
        ? { minRows: props.rows, maxRows: props.rows }
        : { rows: props.multiple ? 4 : undefined })}
      InputProps={
        props.icon && {
          startAdornment: (
            <InputAdornment position="start">{props.icon}</InputAdornment>
          )
        }
      }
      inputProps={{
        min: '0'
      }}
    />
  );
};
