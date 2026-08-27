import { alpha, Box, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Paginacao numerada (estilo referencia visual de /app/locations) - alternativa
// generica/sem dominio ao TablePagination padrao do CustomDatagrid2 (setas +
// linhas-por-pagina). Server-side: so' chama onPageChange com o novo
// pageIndex (0-based) - quem decide como buscar os dados e' de quem usa isso.
// Extraido pra ficar reutilizavel entre telas (Locations, Clientes, ...) sem
// duplicar o algoritmo de paginas/reticencias nem os estilos.

// Sempre ancora primeira/ultima pagina e mantem ~5 paginas proximas visiveis
// (siblingCount=1), com "..." quando ha muitas paginas.
const getPaginationPageItems = (
  currentPage: number,
  totalPages: number,
  siblingCount = 1
): (number | 'ellipsis')[] => {
  if (totalPages <= 0) return [];
  const totalNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const leftSibling = Math.max(currentPage - siblingCount, 1);
  const rightSibling = Math.min(currentPage + siblingCount, totalPages);
  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < totalPages - 1;

  if (!showLeftDots && showRightDots) {
    const leftItemCount = 3 + siblingCount * 2;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, 'ellipsis', totalPages];
  }
  if (showLeftDots && !showRightDots) {
    const rightItemCount = 3 + siblingCount * 2;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + i + 1
    );
    return [1, 'ellipsis', ...rightRange];
  }
  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, i) => leftSibling + i
  );
  return [1, 'ellipsis', ...middleRange, 'ellipsis', totalPages];
};

interface NumberedPaginationProps {
  // 0-based, igual ao PaginationState do tanstack/CustomDatagrid2.
  pageIndex: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (pageIndex: number) => void;
}

function NumberedPagination({
  pageIndex,
  pageSize,
  totalRows,
  onPageChange
}: NumberedPaginationProps) {
  const { t }: { t: any } = useTranslation();
  const totalPages = pageSize > 0 ? Math.ceil(totalRows / pageSize) : 0;
  const currentPageDisplay = pageIndex + 1;
  const showingFrom = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const showingTo = Math.min((pageIndex + 1) * pageSize, totalRows);
  const handlePageClick = (page1Based: number) => onPageChange(page1Based - 1);

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {t(
          'numbered_pagination_showing',
          'Mostrando {{from}} até {{to}} de {{total}} registros',
          { from: showingFrom, to: showingTo, total: totalRows }
        )}
      </Typography>
      {totalPages > 1 && (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={pageIndex === 0}
            onClick={() => handlePageClick(currentPageDisplay - 1)}
            sx={{ minWidth: 0, height: 32, px: 1.5, borderRadius: 5 }}
          >
            {t('previous', 'Anterior')}
          </Button>
          {getPaginationPageItems(currentPageDisplay, totalPages).map(
            (item, idx) =>
              item === 'ellipsis' ? (
                <Typography
                  key={`ellipsis-${idx}`}
                  variant="body2"
                  color="text.secondary"
                  sx={{ px: 0.5 }}
                >
                  …
                </Typography>
              ) : (
                <Button
                  key={item}
                  size="small"
                  variant={item === currentPageDisplay ? 'contained' : 'text'}
                  color="primary"
                  onClick={() => handlePageClick(item)}
                  sx={{
                    minWidth: 32,
                    width: 32,
                    height: 32,
                    px: 0,
                    borderRadius: '50%',
                    fontWeight: item === currentPageDisplay ? 700 : 500,
                    transition:
                      'background-color 120ms ease, color 120ms ease',
                    ...(item !== currentPageDisplay && {
                      color: 'text.secondary',
                      '&:hover': {
                        backgroundColor: (theme) =>
                          alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main'
                      }
                    })
                  }}
                >
                  {item}
                </Button>
              )
          )}
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={pageIndex >= totalPages - 1}
            onClick={() => handlePageClick(currentPageDisplay + 1)}
            sx={{ minWidth: 0, height: 32, px: 1.5, borderRadius: 5 }}
          >
            {t('next', 'Próximo')}
          </Button>
        </Stack>
      )}
    </Box>
  );
}

export default NumberedPagination;
