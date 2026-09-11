import * as React from 'react';
import { ReactNode } from 'react';
import { enumerate } from '../../../../utils/displayers';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  Button,
  Checkbox,
  FormControlLabel,
  Menu,
  MenuItem
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { FilterField } from '../../../../models/owns/page';
import { pushOrRemove } from '../../../../utils/overall';

interface OwnProps {
  filterFields: FilterField[];
  onChange: (filterFields: FilterField[]) => void;
  completeOptions: string[];
  fieldName: string;
  icon: ReactNode;
  enumName?: 'STATUS' | 'PRIORITY' | 'JS_DATE';
  compact?: boolean;
}
function EnumFilter({
  filterFields,
  onChange,
  completeOptions,
  fieldName,
  icon,
  enumName,
  compact = false
}: OwnProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const { t }: { t: any } = useTranslation();

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleCloseMenu = () => {
    setAnchorEl(null);
  };
  const selectedValues =
    filterFields.find(({ field }) => field === fieldName)?.values ?? [];

  return (
    <>
      <Button
        id={`wo-filter-${fieldName}`}
        aria-haspopup="menu"
        aria-expanded={openMenu}
        aria-controls={openMenu ? `wo-filter-menu-${fieldName}` : undefined}
        onClick={handleOpenMenu}
        sx={{
          minWidth: 0,
          whiteSpace: 'nowrap',
          ...(compact ? { height: 40, textTransform: 'none' } : {})
        }}
        size={compact ? 'small' : 'medium'}
        variant={'outlined'}
        startIcon={icon}
        endIcon={compact ? <KeyboardArrowDownIcon /> : undefined}
      >
        {compact
          ? `${t(fieldName)}: ${
              completeOptions.every((option) => selectedValues.includes(option))
                ? t('ALL')
                : selectedValues.length === 1
                ? t(selectedValues[0])
                : selectedValues.length
            }`
          : enumerate(selectedValues.map((priority) => t(priority)))}
      </Button>
      <Menu
        id={`wo-filter-menu-${fieldName}`}
        anchorEl={anchorEl}
        open={openMenu}
        onClose={handleCloseMenu}
        MenuListProps={{
          'aria-labelledby': `wo-filter-${fieldName}`
        }}
      >
        {completeOptions.map((option, index) => {
          const isChecked = filterFields.some(
            (filterField) =>
              filterField.field === fieldName &&
              filterField.values.includes(option)
          );
          const handleChange = () => {
            const newFilterFields = [...filterFields];
            const filterFieldIndex = newFilterFields.findIndex(
              (filterField) => filterField.field === fieldName
            );
            if (filterFieldIndex === -1) {
              newFilterFields.push({
                field: fieldName,
                operation: 'in',
                value: '',
                values: [option],
                ...(enumName ? { enumName } : {})
              });
            } else {
              newFilterFields[filterFieldIndex] = {
                ...newFilterFields[filterFieldIndex],
                ...(enumName ? { enumName } : {}),
                values: pushOrRemove(
                  newFilterFields[filterFieldIndex].values,
                  !isChecked,
                  option
                )
              };
            }
            onChange(newFilterFields);
          };
          return (
            <MenuItem key={index} onClick={handleChange}>
              <FormControlLabel
                control={<Checkbox checked={isChecked} />}
                label={t(option)}
                onClick={(e) => e.preventDefault()}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
export default EnumFilter;
