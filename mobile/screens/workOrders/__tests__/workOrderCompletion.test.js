import {
  getWorkOrderCompletionErrorMessage,
  getWorkOrderCompletionReadiness
} from '../../../utils/workOrderCompletion';

const report = (content = 'Relato textual válido', files = []) => ({
  content: `[Relato em campo] ${content}`,
  files
});

const file = (type) => ({
  id: 1,
  name: 'evidence',
  url: 'file://evidence',
  type
});

const task = (taskType, value) => ({
  value,
  taskBase: { taskType }
});

const field = (fieldName, fieldType = 'REQUIRED') => ({
  id: 1,
  fieldName,
  fieldType
});

const makeWorkOrder = (overrides = {}) => ({
  checkInAt: '2026-08-11T10:00:00Z',
  checkOutAt: '2026-08-11T11:00:00Z',
  signature: 'signature',
  signerName: 'Signer',
  signerDocument: '123',
  mileageTraveled: 10,
  requiredSignature: false,
  requireSignerName: false,
  requireSignerDocument: false,
  requirePhotos: false,
  requireFieldReport: false,
  requireMileage: false,
  requireChecklistCompletion: false,
  category: null,
  ...overrides
});

const readiness = ({
  workOrder = makeWorkOrder(),
  comments = [report()],
  tasks = [],
  fieldConfigurations = []
} = {}) =>
  getWorkOrderCompletionReadiness({
    workOrder,
    comments,
    tasks,
    fieldConfigurations
  });

describe('mobile work order completion contract', () => {
  it('always requires a field report when the WorkOrder has no Category', () => {
    expect(readiness({ comments: [] }).missingRequirements).toContain(
      'FIELD_REPORT'
    );
  });

  it('always requires a field report when requireFieldReport is false', () => {
    const result = readiness({
      workOrder: makeWorkOrder({ requireFieldReport: false }),
      comments: []
    });
    expect(result.requirements.FIELD_REPORT.required).toBe(true);
    expect(result.missingRequirements).toContain('FIELD_REPORT');
  });

  it('does not accept an automatic photo placeholder as FIELD_REPORT', () => {
    expect(
      readiness({ comments: [report('Evidencia fotografica registrada.')] })
        .requirements.FIELD_REPORT.satisfied
    ).toBe(false);
  });

  it('accepts a real textual field report', () => {
    expect(readiness().requirements.FIELD_REPORT.satisfied).toBe(true);
  });

  it('does not require PHOTO when snapshot and global config are optional', () => {
    expect(readiness().requirements.PHOTO.required).toBe(false);
  });

  it('requires PHOTO from the WorkOrder snapshot', () => {
    expect(
      readiness({ workOrder: makeWorkOrder({ requirePhotos: true }) })
        .missingRequirements
    ).toContain('PHOTO');
  });

  it('requires PHOTO from global completeFiles REQUIRED', () => {
    expect(
      readiness({ fieldConfigurations: [field('completeFiles')] })
        .missingRequirements
    ).toContain('PHOTO');
  });

  it('does not accept File OTHER as PHOTO', () => {
    expect(
      readiness({
        workOrder: makeWorkOrder({ requirePhotos: true }),
        comments: [report('Relato', [file('OTHER')])]
      }).missingRequirements
    ).toContain('PHOTO');
  });

  it('accepts IMAGE attached to a field comment as PHOTO', () => {
    expect(
      readiness({
        workOrder: makeWorkOrder({ requirePhotos: true }),
        comments: [report('Relato', [file('IMAGE')])]
      }).missingRequirements
    ).not.toContain('PHOTO');
  });

  it('requires CHECKLIST from the WorkOrder snapshot', () => {
    expect(
      readiness({
        workOrder: makeWorkOrder({ requireChecklistCompletion: true }),
        tasks: [task('TEXT', '')]
      }).missingRequirements
    ).toContain('CHECKLIST');
  });

  it('requires CHECKLIST from global completeTasks REQUIRED', () => {
    expect(
      readiness({
        fieldConfigurations: [field('completeTasks')],
        tasks: [task('SUBTASK', 'OPEN')]
      }).missingRequirements
    ).toContain('CHECKLIST');
  });

  it('does not block an empty required checklist', () => {
    expect(
      readiness({
        workOrder: makeWorkOrder({ requireChecklistCompletion: true }),
        tasks: []
      }).missingRequirements
    ).not.toContain('CHECKLIST');
  });

  it('does not require signer name or document without requiredSignature', () => {
    const result = readiness({
      workOrder: makeWorkOrder({
        requiredSignature: false,
        requireSignerName: true,
        requireSignerDocument: true,
        signerName: undefined,
        signerDocument: undefined
      })
    });
    expect(result.requirements.SIGNER_NAME.required).toBe(false);
    expect(result.requirements.SIGNER_DOCUMENT.required).toBe(false);
  });

  it('requires signature when requiredSignature is true', () => {
    expect(
      readiness({
        workOrder: makeWorkOrder({ requiredSignature: true, signature: '' })
      }).missingRequirements
    ).toContain('SIGNATURE');
  });

  it('requires signer name and document only under required signature', () => {
    const result = readiness({
      workOrder: makeWorkOrder({
        requiredSignature: true,
        requireSignerName: true,
        requireSignerDocument: true,
        signerName: ' ',
        signerDocument: ''
      })
    });
    expect(result.missingRequirements).toEqual(
      expect.arrayContaining(['SIGNER_NAME', 'SIGNER_DOCUMENT'])
    );
  });

  it.each([
    [null, true],
    [0, false],
    [-1, true]
  ])('validates required mileage value %s', (mileageTraveled, missing) => {
    const result = readiness({
      workOrder: makeWorkOrder({ requireMileage: true, mileageTraveled })
    });
    expect(result.missingRequirements.includes('MILEAGE')).toBe(missing);
  });

  it('uses WorkOrder snapshots when the live Category changes', () => {
    const result = readiness({
      workOrder: makeWorkOrder({
        category: {
          requireSignature: true,
          requireSignerName: true,
          requireSignerDocument: true,
          requireMileage: true,
          requirePhotos: true,
          requireChecklistCompletion: true
        }
      })
    });
    expect(result.missingRequirements).toEqual([]);
  });

  it('formats 409 missingRequirements into a useful Portuguese message', () => {
    const translations = {
      completion_requirement_field_report: 'Relato em campo',
      completion_requirement_photo: 'Evidência fotográfica',
      work_order_completion_missing_requirements:
        'Não foi possível concluir. Falta: {{requirements}}.'
    };
    const t = (key, options) =>
      (translations[key] ?? key).replace(
        '{{requirements}}',
        options?.requirements ?? ''
      );
    const error = new Error(
      JSON.stringify({
        success: false,
        message: 'Work order does not meet completion requirements',
        missingRequirements: ['FIELD_REPORT', 'PHOTO']
      })
    );

    expect(getWorkOrderCompletionErrorMessage(error, t)).toBe(
      'Não foi possível concluir. Falta: Relato em campo, Evidência fotográfica.'
    );
  });

  it('does not treat completeTime, completeParts or completeCost as blockers', () => {
    const result = readiness({
      fieldConfigurations: [
        field('completeTime'),
        field('completeParts'),
        field('completeCost')
      ]
    });
    expect(result.missingRequirements).toEqual([]);
  });

  it('always requires check-in and check-out without requiring departure', () => {
    const result = readiness({
      workOrder: makeWorkOrder({
        checkInAt: null,
        checkOutAt: null,
        departureAt: null
      })
    });
    expect(result.missingRequirements).toEqual(
      expect.arrayContaining(['CHECK_IN', 'CHECK_OUT'])
    );
    expect(result.requirements).not.toHaveProperty('DEPARTURE');
  });
});
