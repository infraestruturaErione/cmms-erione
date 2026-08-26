import { getLocationWorkOrderUrl } from './locationWorkOrderCreation';

// Stage 3 (Location Show) reutiliza esta mesma funcao da Stage 2 (lista de
// Locations) - regra unica de URL de criacao de OS a partir de um Location,
// nunca duplicada entre as duas telas.
describe('getLocationWorkOrderUrl', () => {
  it('includes customer when provided (1 Customer or explicit choice)', () => {
    expect(getLocationWorkOrderUrl(9, 2)).toBe(
      '/app/work-orders?customer=2&location=9&new=true'
    );
  });

  it('omits customer when not provided (Location with 0 Customers)', () => {
    expect(getLocationWorkOrderUrl(9)).toBe(
      '/app/work-orders?location=9&new=true'
    );
  });
});
