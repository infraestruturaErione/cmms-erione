import { useState } from 'react';
import { IconButton, Menu, MenuItem, Stack, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import MoreVertTwoToneIcon from '@mui/icons-material/MoreVertTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import useAuth from '../../../../hooks/useAuth';
import { PermissionEntity } from '../../../../models/owns/role';
import Location from '../../../../models/owns/location';

interface LocationRowActionsProps {
  location: Location;
  onOpenLocation: (location: Location) => void;
  onCreateWorkOrder: (location: Location) => void;
  onEdit: (location: Location) => void;
  onDelete: (location: Location) => void;
}

// Acoes por linha da tabela de /app/locations - no maximo 2 icones diretos
// (Abrir + Criar OS); Editar/Excluir vao pro menu "..." (kebab), e Excluir
// nunca aparece como icone vermelho direto na linha. Permissoes checadas
// aqui (useAuth), nao no pai - regras de backend continuam intocadas.
function LocationRowActions({
  location,
  onOpenLocation,
  onCreateWorkOrder,
  onEdit,
  onDelete
}: LocationRowActionsProps) {
  const { t }: { t: any } = useTranslation();
  const { hasEditPermission, hasCreatePermission, hasDeletePermission } =
    useAuth();

  // Menu "..." (kebab). Usa anchorPosition (coordenadas de tela capturadas
  // no clique) em vez de anchorEl (referencia ao no do DOM) - anchorEl abria
  // o menu em (0,0)/canto superior esquerdo, pois qualquer re-render entre o
  // clique e o efeito de posicionamento do Popover trocava o IconButton
  // clicado por uma nova instancia do DOM, deixando a referencia antiga
  // desconectada (getBoundingClientRect de um no desconectado retorna tudo
  // zero, que e' exatamente o fallback top:16/left:16 do MUI Popover).
  // Coordenadas de tela nao dependem do no do DOM continuar montado, entao o
  // problema nao se repete.
  const [menuAnchor, setMenuAnchor] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const canEdit = hasEditPermission(PermissionEntity.LOCATIONS, location);
  const canDelete = hasDeletePermission(PermissionEntity.LOCATIONS, location);

  return (
    // stopPropagation UNICO, no ancestral raiz desta celula - nao em cada
    // IconButton/MenuItem individual. O <Menu> do MUI renderiza via Portal
    // (document.body), fora da <tr> no DOM, mas e' filho REACT deste Stack -
    // o React faz bubbling sintetico pela arvore de COMPONENTES, nao pela
    // arvore DOM, entao qualquer clique dentro do Menu (kebab, Editar,
    // Excluir, e tambem o backdrop interno usado pra "clicar fora fecha")
    // ainda passa por aqui antes de chegar no onClick da TableRow
    // (CustomDatagrid2), que abriria os detalhes da Location junto com a
    // acao clicada. Centralizar aqui evita ter que lembrar de repetir
    // stopPropagation em cada novo controle adicionado a esta celula no
    // futuro. O clique so' e' interceptado DEPOIS que o handler do proprio
    // controle (IconButton/MenuItem/backdrop) ja rodou - stopPropagation nao
    // impede a acao em si, so' impede que o clique continue subindo.
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip title={t('view_location', 'Ver local')}>
        <IconButton
          size="small"
          onClick={() => onOpenLocation(location)}
        >
          <OpenInNewTwoToneIcon fontSize="small" color="primary" />
        </IconButton>
      </Tooltip>
      {hasCreatePermission(PermissionEntity.WORK_ORDERS) && (
        <Tooltip title={t('create_wo_for_location', 'Criar OS neste local')}>
          <IconButton
            size="small"
            onClick={() => onCreateWorkOrder(location)}
          >
            <AssignmentTwoToneIcon fontSize="small" color="primary" />
          </IconButton>
        </Tooltip>
      )}
      {(canEdit || canDelete) && (
        <IconButton
          size="small"
          onClick={(e) => {
            // Captura a posicao de tela do botao AGORA (sincrono, antes de
            // qualquer re-render) - ver comentario acima sobre por que
            // anchorEl nao e' confiavel aqui.
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuAnchor({ top: rect.bottom, left: rect.right });
          }}
        >
          <MoreVertTwoToneIcon fontSize="small" />
        </IconButton>
      )}
      <Menu
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorReference="anchorPosition"
        anchorPosition={menuAnchor ?? undefined}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {canEdit && (
          <MenuItem
            onClick={() => {
              onEdit(location);
              setMenuAnchor(null);
            }}
          >
            <EditTwoToneIcon fontSize="small" sx={{ mr: 1 }} color="primary" />
            {t('edit')}
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem
            onClick={() => {
              onDelete(location);
              setMenuAnchor(null);
            }}
          >
            <DeleteTwoToneIcon fontSize="small" sx={{ mr: 1 }} color="error" />
            {t('to_delete')}
          </MenuItem>
        )}
      </Menu>
    </Stack>
  );
}

export default LocationRowActions;
