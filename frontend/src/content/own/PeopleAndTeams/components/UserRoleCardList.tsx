import { Box, CircularProgress, Radio, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from '../../../../store';
import { getRoles } from '../../../../slices/role';
import { Role, RoleCode } from '../../../../models/owns/role';

interface Props {
  onChange: (id: number) => void;
}

function UserRoleCardList({ onChange }: Props) {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { roles, loadingGet } = useSelector((state) => state.roles);
  const [selectedItem, setSelectedItem] = useState<number>();
  const defaultRoles: Partial<
    Record<RoleCode, { name: string; description: string }>
  > = {
    ADMIN: {
      name: 'ADMIN_name',
      description: 'ADMIN_description'
    },
    LIMITED_ADMIN: {
      name: 'LIMITED_ADMIN_name',
      description: 'LIMITED_ADMIN_description'
    },
    TECHNICIAN: {
      name: 'TECHNICIAN_name',
      description: 'TECHNICIAN_description'
    },
    LIMITED_TECHNICIAN: {
      name: 'LIMITED_TECHNICIAN_name',
      description: 'LIMITED_TECHNICIAN_description'
    },
    VIEW_ONLY: {
      name: 'VIEW_ONLY_name',
      description: 'VIEW_ONLY_description'
    },
    REQUESTER: {
      name: 'REQUESTER_name',
      description: 'REQUESTER_description'
    }
  };
  useEffect(() => {
    dispatch(getRoles());
  }, []);
  const isSelected = (value) => selectedItem === value;

  const handleChange = (value: number) => {
    if (!isSelected(value)) {
      setSelectedItem(value);
      onChange(value);
    }
  };

  const getOrderedRoles = (): Role[] => {
    if (roles.length) {
      const defaultRolesOnly: Role[] = Object.keys(defaultRoles).map((code) => {
        return roles.find((role) => role.code === code);
      });
      const customRoles = roles.filter((role) => role.code === 'USER_CREATED');
      return [...defaultRolesOnly, ...customRoles];
    } else return [];
  };

  if (loadingGet) {
    return (
      <Stack
        direction="row"
        width="100%"
        alignItems="center"
        height={80}
        justifyContent="center"
      >
        <CircularProgress size={22} />
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        columnGap: 2,
        rowGap: 0.25
      }}
    >
      {getOrderedRoles().map((role) => {
        const selected = isSelected(role.id);
        const roleName =
          role.code === 'USER_CREATED'
            ? role.name
            : t(defaultRoles[role.code].name);
        const roleDescription =
          role.code === 'USER_CREATED'
            ? role.description
            : t(defaultRoles[role.code].description);
        return (
          <Box
            key={role.id}
            onClick={() => handleChange(role.id)}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 0.75,
              px: 0.75,
              py: 0.5,
              borderRadius: 1,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: selected
                ? alpha(theme.colors.primary.main, 0.5)
                : 'transparent',
              backgroundColor: selected
                ? alpha(theme.colors.primary.main, 0.06)
                : 'transparent'
            }}
          >
            <Radio
              checked={selected}
              onChange={() => handleChange(role.id)}
              name="radio-buttons"
              color="primary"
              size="small"
              sx={{ p: 0, mt: '1px' }}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {roleName}
              </Typography>
              <Tooltip title={roleDescription} arrow placement="bottom-start">
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.35,
                    textTransform: 'none'
                  }}
                >
                  {roleDescription}
                </Typography>
              </Tooltip>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default UserRoleCardList;
