import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ThemeProvider } from '@mui/material/styles';
import ImageViewer from 'react-simple-image-viewer';
import { PureLightTheme } from '../../../../theme/schemes/PureLightTheme';
import { FieldReportHistory, FieldEvidenceGallery } from './FieldRegistroSection';
import FieldReportSection from './FieldReportSection';
import CommentsDisclosure from './CommentsDisclosure';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';

let mockComments = [];
const mockDispatch = jest.fn(() => Promise.resolve());
const mockUpload = jest.fn();
const mockSnack = jest.fn();
const mockOpen = jest.fn();
let mockMounts = 0;
jest.mock('../../../../store', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (select) => select({ comments: { commentsByWorkOrder: { 71: mockComments } } })
}));
jest.mock('../../../../slices/comment', () => ({ createComment: (payload) => payload }));
jest.mock('../../../../utils/api', () => ({ getErrorMessage: () => 'upload_error' }));
jest.mock('../../../../contexts/CompanySettingsContext', () => ({ CompanySettingsContext: require('react').createContext({}) }));
jest.mock('../../../../contexts/CustomSnackBarContext', () => ({ CustomSnackBarContext: require('react').createContext({}) }));
jest.mock('src/i18n/i18n', () => ({ __esModule: true, default: { dir: () => 'ltr' } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, values) => `${key}${values?.count !== undefined ? ` ${values.count}` : ''}${values?.name ? ` ${values.name} ${values.document || ''}` : ''}` })
}));
jest.mock('./CommentsSection', () => ({
  __esModule: true,
  default: ({ commentId }) => {
    const React = require('react');
    const [draft, setDraft] = React.useState('');
    React.useEffect(() => { mockMounts += 1; }, []);
    return <input data-comment-id={commentId} value={draft} onChange={(event) => setDraft(event.target.value)} />;
  }
}));
const report = (count = 0) => ({
  id: 1, content: '[Relato em campo] Texto humano\nSegunda linha',
  user: { firstName: 'Tecnico', lastName: 'Piloto' }, createdAt: '2026-10-07',
  files: Array.from({ length: count }, (_, index) => ({ id: index + 1, name: `foto-${index}.jpg`, url: `/foto-${index}.jpg` }))
});
let container;
const render = (component) => act(() => {
  ReactDOM.render(<ThemeProvider theme={PureLightTheme}>{component}</ThemeProvider>, container);
});
const gallery = (count, comments = [report(count)]) => render(
  <FieldEvidenceGallery comments={comments} onOpenImage={mockOpen} getFormattedDate={(date) => date} />
);
const button = (text) => Array.from(container.querySelectorAll('button')).find((item) => item.textContent.includes(text));
const click = (element) => act(() => Simulate.click(element));
const section = (overrides = {}, canEdit = true) => render(
  <CompanySettingsContext.Provider value={{ uploadFiles: mockUpload }}>
    <CustomSnackBarContext.Provider value={{ showSnackBar: mockSnack }}>
      <FieldReportSection workOrder={{ id: 71, status: 'OPEN', ...overrides }} canEdit={canEdit}
        photosRequiredGlobally={false} onOpenImage={mockOpen} getFormattedDate={(date) => date} />
    </CustomSnackBarContext.Provider>
  </CompanySettingsContext.Provider>
);
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mockComments = [];
  mockMounts = 0;
  jest.clearAllMocks();
  mockDispatch.mockImplementation(() => Promise.resolve());
  mockUpload.mockResolvedValue([{ id: 55 }]);
  URL.createObjectURL = jest.fn((file) => `blob:${file.name}`);
  URL.revokeObjectURL = jest.fn();
});
afterEach(() => {
  act(() => ReactDOM.unmountComponentAtNode(container));
  container.remove();
});

it('keeps the complete long report, author and date, hiding internal and photo-only text', () => {
  const text = 'Durante o atendimento foi identificado um problema.\n' + 'RELATOSEMESPACO'.repeat(100);
  render(<FieldReportHistory comments={[
    { ...report(), content: `[Relato em campo] ${text}` },
    { ...report(), id: 2, content: '[Relato em campo] Photo evidence registered.' },
    { ...report(), id: 3, content: 'Administrativo' }
  ]} getFormattedDate={(date) => date} />);
  expect(container.querySelectorAll('article')).toHaveLength(1);
  expect(container.textContent).toContain(text);
  expect(container.textContent).toContain('Tecnico Piloto');
  expect(container.textContent).toContain('2026-10-07');
  expect(container.textContent).not.toContain('[Relato em campo]');
  expect(container.textContent).not.toContain('Photo evidence');
  expect(container.textContent).not.toContain('Administrativo');
});

it.each([1, 3, 6, 10, 20, 30])('mounts at most six of %i photos and marks each lazy/async', (count) => {
  gallery(count);
  expect(container.querySelectorAll('img')).toHaveLength(Math.min(count, 6));
  container.querySelectorAll('img').forEach((img) => {
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
  });
  expect(!!button('report_show_more_evidence')).toBe(count > 6);
});

it('preserves separate reports in source order, authors, timestamps and multiple paragraphs', () => {
  const firstText = 'Primeiro paragrafo.\n\nSegundo paragrafo.\n' + 'SEMESPACOS'.repeat(150);
  const secondText = 'Validacao complementar.';
  render(<FieldReportHistory comments={[
    { ...report(), content: `[Relato em campo] ${firstText}`, updatedAt: '2026-10-08' },
    { ...report(), id: 2, content: `[Relato em campo] ${secondText}`, user: { firstName: 'Outra', lastName: 'Tecnica' } }
  ]} getFormattedDate={(date) => date} />);
  const articles = Array.from(container.querySelectorAll('article'));
  expect(articles).toHaveLength(2);
  expect(articles[0].textContent).toContain(firstText);
  expect(articles[0].textContent).toContain('Tecnico Piloto');
  expect(articles[0].textContent).toContain('2026-10-08');
  expect(articles[1].textContent).toContain(secondText);
  expect(articles[1].textContent).toContain('Outra Tecnica');
  expect(articles[1].textContent).toContain('2026-10-07');
  articles.forEach((article) => {
    expect(getComputedStyle(article).maxWidth).toBe('92ch');
    const body = article.querySelector('.MuiTypography-body1');
    expect(getComputedStyle(body).whiteSpace).toBe('pre-wrap');
    expect(getComputedStyle(body).overflowWrap).toBe('anywhere');
    expect(getComputedStyle(body).textOverflow).not.toBe('ellipsis');
    expect(getComputedStyle(body).overflow).not.toBe('hidden');
    expect(body.className).not.toContain('noWrap');
  });
});

it('expands six at a time through all 30 images and collapses back to six', () => {
  gallery(30);
  for (const count of [12, 18, 24, 30]) {
    click(button('report_show_more_evidence'));
    expect(container.querySelectorAll('img')).toHaveLength(count);
  }
  expect(button('report_show_more_evidence')).toBeUndefined();
  click(button('report_show_less_evidence'));
  expect(container.querySelectorAll('img')).toHaveLength(6);
});

it('preserves deduplication, order, excludes administrative files and passes ALL originals to the viewer', () => {
  const first = report(10);
  gallery(10, [first, { ...report(), id: 2, files: [first.files[0]] }, { ...report(1), id: 3, content: 'Admin' }]);
  click(container.querySelector('[role="button"]'));
  expect(mockOpen).toHaveBeenCalledWith(first.files.map((file) => file.url), first.files[0].url);
  expect(button('report_show_more_evidence').textContent).toContain('4');
  act(() => Simulate.keyDown(container.querySelector('[role="button"]'), { key: 'Enter' }));
  expect(mockOpen).toHaveBeenCalledTimes(2);
});

it('keeps a failed evidence placeholder and all the other photos without retrying', () => {
  gallery(3);
  act(() => Simulate.error(container.querySelector('img')));
  expect(container.querySelectorAll('img')).toHaveLength(2);
  expect(container.textContent).toContain('report_image_unavailable');
  expect(container.querySelectorAll('[role="button"]')).toHaveLength(3);
  gallery(3);
  expect(container.querySelectorAll('img')).toHaveLength(2);
});

it('handles a missing URL and zero photos gracefully', () => {
  gallery(1, [{ ...report(1), files: [{ id: 1, name: 'missing.jpg', url: '' }] }]);
  expect(container.querySelector('img')).toBeNull();
  expect(container.textContent).toContain('report_image_unavailable');
  gallery(0);
  expect(container.textContent).toContain('field_evidence_empty');
  expect(container.querySelector('button')).toBeNull();
});

it('the installed viewer renders only the current original and navigates to the next', () => {
  const urls = report(30).files.map((file) => file.url);
  render(<ImageViewer src={urls} currentIndex={0} onClose={() => {}} />);
  expect(container.querySelectorAll('img')).toHaveLength(1);
  expect(container.querySelector('img').getAttribute('src')).toBe(urls[0]);
  click(container.querySelector('.react-simple-image-viewer__next'));
  expect(container.querySelectorAll('img')).toHaveLength(1);
  expect(container.querySelector('img').getAttribute('src')).toBe(urls[1]);
});

it('starts administrative comments collapsed, counts only admin and preserves a draft when toggled', () => {
  const comments = [report(), { ...report(), id: 2, content: 'Admin' }];
  render(<CommentsDisclosure workOrderId={71} comments={comments} />);
  expect(container.querySelector('button').getAttribute('aria-expanded')).toBe('false');
  expect(container.querySelector('button').textContent).toContain('comments (1)');
  click(container.querySelector('button'));
  act(() => Simulate.change(container.querySelector('input'), { target: { value: 'Rascunho' } }));
  click(container.querySelector('button'));
  click(container.querySelector('button'));
  expect(container.querySelector('input').value).toBe('Rascunho');
  expect(mockMounts).toBe(1);
});

it('automatically expands for an initial and a subsequent deep-linked ID and forwards it unchanged', () => {
  render(<CommentsDisclosure workOrderId={71} comments={[]} commentId={25} />);
  expect(container.querySelector('button').getAttribute('aria-expanded')).toBe('true');
  expect(container.querySelector('input').dataset.commentId).toBe('25');
  click(container.querySelector('button'));
  render(<CommentsDisclosure workOrderId={71} comments={[]} commentId={26} />);
  expect(container.querySelector('button').getAttribute('aria-expanded')).toBe('true');
  expect(container.querySelector('input').dataset.commentId).toBe('26');
});

it.each([{ status: 'COMPLETE' }, { canEdit: false }])('does not show an unusable report form in readOnly: %o', (state) => {
  section(state, state.canEdit !== false);
  expect(container.querySelector('textarea')).toBeNull();
  expect(button('save_field_report')).toBeUndefined();
  expect(container.textContent).toContain('report_read_only');
});

it('orders report, photographic evidence, signature and retains signature identity and click', () => {
  mockComments = [report(10)];
  section({ signature: '/signature.png', signerName: 'Cliente', signerDocument: '123' });
  expect(Array.from(container.querySelectorAll('section')).map((item) => item.getAttribute('aria-label'))).toEqual([
    'report_technician_title', 'report_photographic_evidence', 'signature'
  ]);
  expect(container.querySelector('textarea').getAttribute('maxlength')).toBe('4000');
  const signature = container.querySelector('img[alt="signature"]');
  expect(signature.getAttribute('src')).toBe('/signature.png');
  expect(getComputedStyle(signature).maxWidth).toBe('320px');
  expect(getComputedStyle(signature).width).toBe('100%');
  expect(getComputedStyle(signature).height).toBe('auto');
  expect(getComputedStyle(signature).objectFit).toBe('contain');
  click(signature);
  expect(mockOpen).toHaveBeenCalledWith(['/signature.png'], '/signature.png');
  expect(container.querySelector('section[aria-label="signature"]').textContent).toContain('Cliente 123');
  expect(container.querySelector('section[aria-label="report_photographic_evidence"]').textContent).toContain('10');
});

it.each([true, false])('keeps required/optional signature state: %s', (requiredSignature) => {
  section({ requiredSignature });
  expect(container.textContent).toContain(requiredSignature ? 'signature_pending' : 'signature_not_required');
});

it('preserves the category signature requirement without a per-order requirement', () => {
  section({ requiredSignature: false, category: { requireSignature: true } });
  expect(container.textContent).toContain('signature_pending');
});

it('saves the exact existing report payload and clears the composer after success', async () => {
  section();
  act(() => Simulate.change(container.querySelector('textarea'), { target: { value: '  Relato novo  ' } }));
  await act(async () => { Simulate.click(button('save_field_report')); await Promise.resolve(); });
  expect(mockDispatch).toHaveBeenCalledWith({ workOrder: { id: 71 }, content: '[Relato em campo] Relato novo', files: [] });
  expect(container.querySelector('textarea').value).toBe('');
  expect(mockSnack).toHaveBeenCalledWith('field_report_saved', 'success');
});

it('preserves the ten-file limit, individual removal and object URL cleanup', () => {
  section();
  const files = Array.from({ length: 12 }, (_, index) => new File(['test'], `selected-${index}.jpg`, { type: 'image/jpeg' }));
  act(() => Simulate.change(container.querySelector('input[type="file"]'), { target: { files, value: '' } }));
  expect(container.querySelectorAll('img')).toHaveLength(10);
  click(container.querySelector('button[aria-label="remove_photo"]'));
  expect(container.querySelectorAll('img')).toHaveLength(9);
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(10);
  act(() => ReactDOM.unmountComponentAtNode(container));
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(19);
});

it('keeps loading disabled and does not submit a report twice', async () => {
  section();
  act(() => Simulate.change(container.querySelector('textarea'), { target: { value: 'Relato' } }));
  let resolve;
  mockDispatch.mockImplementation(() => new Promise((done) => { resolve = done; }));
  click(button('save_field_report'));
  expect(button('save_field_report').disabled).toBe(true);
  expect(container.querySelector('textarea').disabled).toBe(true);
  click(button('save_field_report'));
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(); await Promise.resolve(); });
  expect(container.querySelector('textarea').disabled).toBe(false);
});

it('keeps photo-only persistence and upload failures without losing the selected evidence', async () => {
  section();
  const file = new File(['test'], 'selected.jpg', { type: 'image/jpeg' });
  act(() => Simulate.change(container.querySelector('input[type="file"]'), { target: { files: [file], value: '' } }));
  mockUpload.mockResolvedValueOnce([]);
  await act(async () => { Simulate.click(button('save_field_report')); await Promise.resolve(); });
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(container.querySelectorAll('img')).toHaveLength(1);
  expect(mockSnack).toHaveBeenCalledWith('upload_error', 'error');
  await act(async () => { Simulate.click(button('save_field_report')); await Promise.resolve(); });
  expect(mockUpload).toHaveBeenLastCalledWith([], [file], false);
  expect(mockDispatch).toHaveBeenCalledWith({ workOrder: { id: 71 }, content: '[Relato em campo] Photo evidence registered.', files: [{ id: 55 }] });
  expect(container.querySelectorAll('img')).toHaveLength(0);
});
