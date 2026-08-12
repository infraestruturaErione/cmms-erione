import { getGuidedWorkOrderAction } from '../../../utils/fieldExecutionRules';

const workOrder = (overrides = {}) => ({
  status: 'OPEN',
  departureAt: null,
  checkInAt: null,
  checkOutAt: null,
  ...overrides
});

const readiness = (missingRequirements = []) => {
  const required = new Set(missingRequirements);
  const state = (key, alwaysRequired = false) => ({
    required: alwaysRequired || required.has(key),
    satisfied: !required.has(key)
  });

  return {
    missingRequirements,
    requirements: {
      CHECK_IN: state('CHECK_IN', true),
      CHECK_OUT: state('CHECK_OUT', true),
      FIELD_REPORT: state('FIELD_REPORT', true),
      PHOTO: state('PHOTO'),
      CHECKLIST: state('CHECKLIST'),
      SIGNATURE: state('SIGNATURE'),
      SIGNER_NAME: state('SIGNER_NAME'),
      SIGNER_DOCUMENT: state('SIGNER_DOCUMENT'),
      MILEAGE: state('MILEAGE')
    }
  };
};

describe('guided mobile Work Order action', () => {
  it('starts with travel without making departure mandatory for completion', () => {
    expect(getGuidedWorkOrderAction({ workOrder: workOrder() }).type).toBe(
      'depart'
    );
  });

  it('prioritizes the required questionnaire after check-in', () => {
    expect(
      getGuidedWorkOrderAction({
        workOrder: workOrder({ checkInAt: '2026-08-11T09:00:00Z' }),
        readiness: readiness(['CHECKLIST', 'FIELD_REPORT'])
      }).type
    ).toBe('questionnaire');
  });

  it('shows field report before optional photo and check-out', () => {
    expect(
      getGuidedWorkOrderAction({
        workOrder: workOrder({ checkInAt: '2026-08-11T09:00:00Z' }),
        readiness: readiness(['FIELD_REPORT'])
      }).type
    ).toBe('field-report');
  });

  it('anticipates signature after the field records are ready', () => {
    expect(
      getGuidedWorkOrderAction({
        workOrder: workOrder({
          checkInAt: '2026-08-11T09:00:00Z',
          checkOutAt: '2026-08-11T10:00:00Z'
        }),
        readiness: readiness(['SIGNATURE'])
      }).type
    ).toBe('closure-details');
  });

  it('offers completion only when readiness has no missing requirement', () => {
    expect(
      getGuidedWorkOrderAction({
        workOrder: workOrder({
          checkInAt: '2026-08-11T09:00:00Z',
          checkOutAt: '2026-08-11T10:00:00Z'
        }),
        readiness: readiness()
      }).type
    ).toBe('complete');
  });

  it('uses read-only action for a completed Work Order', () => {
    expect(
      getGuidedWorkOrderAction({
        workOrder: workOrder({ status: 'COMPLETE' }),
        readiness: readiness()
      }).type
    ).toBe('view');
  });
});
