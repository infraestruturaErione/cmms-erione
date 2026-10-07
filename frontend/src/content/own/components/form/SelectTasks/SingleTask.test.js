import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { createTheme } from '@mui/material/styles';
import SingleTask from './SingleTask';
import { CompanySettingsContext } from '../../../../../contexts/CompanySettingsContext';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      if (key === 'task_updated_at_by')
        return `Atualizado por ${options.name} • ${options.date}`;
      return key;
    }
  })
}));
jest.mock('../../../../../hooks/useAuth', () => ({
  __esModule: true,
  default: () => ({
    user: { id: 5 },
    hasCreatePermission: () => true,
    hasFeature: () => true
  })
}));
jest.mock('../../../../../contexts/CompanySettingsContext', () => ({
  CompanySettingsContext: require('react').createContext({})
}));
jest.mock('../Field', () => () => null);
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));

const theme = createTheme({
  colors: {
    alpha: {
      black: { 5: '#fafafa', 10: '#eee', 20: '#ddd', 50: '#777', 70: '#444' },
      white: { 100: '#fff' }
    },
    primary: { main: '#3156a0' },
    success: { main: '#287b34', lighter: '#edf8ef' },
    warning: { main: '#9b6600', lighter: '#fff5e6' },
    error: { main: '#c53030', lighter: '#fff0f0' }
  }
});

const makeTask = (taskType = 'TEXT', overrides = {}) => ({
  id: 1,
  taskBase: {
    taskType,
    label: 'DIAGNOSTICO ENCONTRADO',
    options: [{ label: 'Opção A' }]
  },
  value: `Resposta longa\n${'Higigigigi'.repeat(100)}`,
  notes: 'Observação técnica\nLinha dois',
  images: [{ id: 7, url: '/photo.jpg' }],
  updatedBy: 5,
  updatedAt: '2026-10-07',
  ...overrides
});

const renderTask = (task, props = {}) => {
  const cache = createCache({ key: 'task-test' });
  cache.compat = true;
  const html = renderToStaticMarkup(
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CompanySettingsContext.Provider
          value={{
            getFormattedDate: () => '07/10/2026 14:43',
            getUserNameById: () => 'Técnico Piloto'
          }}
        >
          <SingleTask
            task={task}
            index={0}
            readOnly
            notes={new Map()}
            {...props}
          />
        </CompanySettingsContext.Provider>
      </ThemeProvider>
    </CacheProvider>
  );
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('style').forEach((el) => el.remove());
  return {
    container,
    css: Array.from(document.styleSheets)
      .flatMap((sheet) =>
        Array.from(sheet.cssRules).map((rule) => rule.cssText)
      )
      .join(''),
    text: container.textContent
  };
};

it.each(['TEXT', 'NUMBER', 'METER'])(
  'separates the %s answer below the question, preserving all content',
  (type) => {
    const task = makeTask(type);
    const { container, css, text } = renderTask(task);
    const answer = container.querySelector(
      'section[aria-label="task_answer_label"]'
    );
    expect(text).toContain('01DIAGNOSTICO ENCONTRADO');
    expect(text).toContain(
      { TEXT: 'text_field', NUMBER: 'number_field', METER: 'meter_reading' }[
        type
      ]
    );
    expect(answer.textContent).toContain(task.value);
    expect(answer.previousElementSibling.textContent).not.toContain(task.value);
    expect(answer.previousElementSibling.textContent).toContain(
      'DIAGNOSTICO ENCONTRADO'
    );
    expect(css).toMatch(/white-space:\s*pre-wrap/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(answer.querySelector('p').className).not.toContain('noWrap');
    expect(container.querySelectorAll('input, select, button')).toHaveLength(0);
  }
);

it('renders numeric zero as a response rather than an empty answer', () => {
  const { container } = renderTask(makeTask('NUMBER', { value: 0 }));
  expect(container.querySelector('section').textContent).toBe(
    'task_answer_label0'
  );
});

it.each([
  ['INSPECTION', 'PASS'],
  ['SUBTASK', 'COMPLETE'],
  ['MULTIPLE', 'Opção A']
])(
  'keeps the %s result compact and preserves notes, photos and update metadata',
  (type, value) => {
    const { container, text } = renderTask(makeTask(type, { value }));
    expect(
      container.querySelector('section[aria-label="task_answer_label"]')
    ).toBeNull();
    expect(text).toContain(value);
    expect(text).toContain('task_notes_labelObservação técnica\nLinha dois');
    expect(text).toContain('Atualizado por Técnico Piloto • 07/10/2026 14:43');
    expect(container.querySelector('img').getAttribute('src')).toBe(
      '/photo.jpg'
    );
  }
);

it('preserves editable inputs and disabled state', () => {
  const { container } = renderTask(makeTask('TEXT'), {
    readOnly: false,
    disabled: true
  });
  expect(container.querySelector('input').value).toContain('Resposta longa');
  expect(container.querySelector('input').disabled).toBe(true);
  expect(
    container.querySelector('section[aria-label="task_answer_label"]')
  ).toBeNull();
});
