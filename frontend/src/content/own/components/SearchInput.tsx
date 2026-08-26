import { InputAdornment, TextField } from '@mui/material';
import SearchTwoToneIcon from '@mui/icons-material/SearchTwoTone';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

interface OwnProps {
  onChange: (event) => void;
  // Todos opcionais, retrocompativel - sem eles o campo continua
  // nao-controlado, largura padrao (auto) e placeholder padrao (t('search')),
  // igual sempre foi nos outros 12 usos deste componente. So
  // Locations/index.tsx passa os tres, pra poder limpar visualmente o campo
  // via "Limpar filtros" (setSearchQuery('')), ocupar a largura do
  // container flex, e customizar o placeholder pro contexto de Location.
  value?: string;
  placeholder?: string;
  fullWidth?: boolean;
  // Opcional - omitido preserva o tamanho padrao (medium) usado nos outros
  // usos deste componente. Locations/index.tsx passa "small" para alinhar a
  // altura com o Select de filtro de Cliente ao lado.
  size?: 'small' | 'medium';
}

export default function SearchInput({
  onChange,
  value,
  placeholder,
  fullWidth,
  size
}: OwnProps) {
  const { t }: { t: any } = useTranslation();
  return (
    <TextField
      fullWidth={fullWidth}
      size={size}
      sx={{
        m: 0
      }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchTwoToneIcon color="primary" />
          </InputAdornment>
        )
      }}
      placeholder={placeholder ?? t('search')}
      variant="outlined"
      onChange={onChange}
      {...(value !== undefined ? { value } : {})}
    />
  );
}
