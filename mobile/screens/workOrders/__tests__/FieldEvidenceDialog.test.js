import React, { useState } from 'react';
import { act, create } from 'react-test-renderer';
import { FlatList, Image } from 'react-native';
import { Button, IconButton, PaperProvider } from 'react-native-paper';

// The real i18n instance (compatibilityJSON: 'v3' + the real translation
// files), so the selected-count assertions exercise the actual plural
// resolution instead of a stubbed t(). This is what caught the original
// bug: the key was stored in the v4 _one/_other format, which never
// resolves under v3 compat, so the dialog rendered the raw key.
import i18n from '../../../i18n/i18n';
import FieldEvidenceDialog from '../FieldEvidenceDialog';

// react-native-paper's <Portal> (used by <Dialog>) needs a PaperProvider
// ancestor to resolve where to render into - without it, mounting throws.
const wrap = (children) => <PaperProvider>{children}</PaperProvider>;

const makeFiles = (count) =>
  Array.from({ length: count }, (_, index) => ({
    uri: `file:///evidence-${index}.jpg`,
    name: `evidence-${index}.jpg`,
    type: 'image/jpeg'
  }));

const defaultProps = {
  visible: true,
  files: [],
  saving: false,
  onPickFromGallery: jest.fn(),
  onTakePhoto: jest.fn(),
  onRemoveFile: jest.fn(),
  onCancel: jest.fn(),
  onSave: jest.fn()
};

const renderDialog = (props) => {
  let root;
  act(() => {
    root = create(wrap(<FieldEvidenceDialog {...defaultProps} {...props} />));
  });
  return root;
};

const getByTestId = (node, testID) =>
  node.findAll((n) => n.props.testID === testID)[0];
const queryAllByTestId = (node, testID) =>
  node.findAll((n) => n.props.testID === testID);

// react-native-paper forwards testID through several internal layers, so
// findAllByProps over-matches; filtering by component type keeps exactly
// one match per logical control.
const getButton = (root, testID) =>
  root.root.findAllByType(Button).find((b) => b.props.testID === testID);
const getSaveButton = (root) => getButton(root, 'field-evidence-save-button');
const getCancelButton = (root) =>
  getButton(root, 'field-evidence-cancel-button');
const getRemoveButton = (root, uri) =>
  root.root
    .findAllByType(IconButton)
    .find((b) => b.props.testID === `field-evidence-remove-${uri}`);
const getCounterText = (root) => {
  const node = getByTestId(root.root, 'field-evidence-selected-count');
  return node ? node.props.children : null;
};
const getGridArea = (root) => getByTestId(root.root, 'field-evidence-grid-area');
const getList = (root) => root.root.findByType(FlatList);

const flattenStyle = (style) =>
  Array.isArray(style) ? Object.assign({}, ...style.flat()) : style;

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise((resolve) => i18n.on('initialized', resolve));
  }
  await i18n.changeLanguage('pt_br');
});

describe('FieldEvidenceDialog - selected count (i18n plural)', () => {
  test('renders a translated singular label for 1 photo, not the raw key', () => {
    const root = renderDialog({ files: makeFiles(1) });

    expect(getCounterText(root)).toBe('1 foto selecionada');
  });

  test('renders a translated plural label for several photos', () => {
    const root = renderDialog({ files: makeFiles(5) });

    expect(getCounterText(root)).toBe('5 fotos selecionadas');
  });

  test('never renders the raw i18n key', () => {
    [1, 5, 20, 30].forEach((count) => {
      const root = renderDialog({ files: makeFiles(count) });
      expect(getCounterText(root)).not.toBe('field_evidence_selected_count');
      expect(getCounterText(root)).toContain(String(count));
    });
  });

  test('English locale resolves the same key', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(i18n.t('field_evidence_selected_count', { count: 1 })).toBe(
      '1 photo selected'
    );
    expect(i18n.t('field_evidence_selected_count', { count: 7 })).toBe(
      '7 photos selected'
    );
    await act(async () => {
      await i18n.changeLanguage('pt_br');
    });
  });

  test('hides the counter when nothing is selected', () => {
    const root = renderDialog({ files: [] });

    expect(queryAllByTestId(root.root, 'field-evidence-selected-count')).toHaveLength(
      0
    );
  });
});

describe('FieldEvidenceDialog - layout stays usable as photos pile up', () => {
  // The regression this dialog was rebuilt for: with ~20+ photos the
  // preview list grew unbounded and pushed Cancel/Save off screen.
  test.each([0, 1, 5, 20, 30])(
    'with %i photos the Save and Cancel buttons are still rendered',
    (count) => {
      const root = renderDialog({ files: makeFiles(count) });

      expect(getSaveButton(root)).toBeTruthy();
      expect(getCancelButton(root)).toBeTruthy();
    }
  );

  test.each([0, 1, 5, 20, 30])(
    'with %i photos the preview area keeps a bounded maxHeight',
    (count) => {
      const root = renderDialog({ files: makeFiles(count) });
      const style = flattenStyle(getGridArea(root).props.style);

      expect(typeof style.maxHeight).toBe('number');
      expect(style.maxHeight).toBeGreaterThan(0);
    }
  );

  test('the footer buttons live OUTSIDE the scrollable preview area', () => {
    const root = renderDialog({ files: makeFiles(30) });
    const gridArea = getGridArea(root);

    // If Save/Cancel were inside the bounded, scrollable region they could
    // be scrolled out of reach - they must be siblings of it, not children.
    const buttonsInsideGrid = gridArea.findAllByType(Button);
    expect(buttonsInsideGrid).toHaveLength(0);
    expect(getSaveButton(root)).toBeTruthy();
  });

  test('the grid scrolls the full selection (all photos are in the list data)', () => {
    const root = renderDialog({ files: makeFiles(30) });
    const list = getList(root);

    // FlatList virtualizes, so not every thumbnail is mounted at once -
    // what matters is that the whole selection is scrollable content.
    expect(list.props.data).toHaveLength(30);
    expect(list.props.nestedScrollEnabled).toBe(true);
  });

  test('Save is disabled with no photos and enabled once photos exist', () => {
    expect(getSaveButton(renderDialog({ files: [] })).props.disabled).toBe(true);
    expect(
      getSaveButton(renderDialog({ files: makeFiles(3) })).props.disabled
    ).toBe(false);
  });

  test('saving disables Save and Cancel so a second tap cannot double-submit', () => {
    const root = renderDialog({ files: makeFiles(3), saving: true });

    expect(getSaveButton(root).props.disabled).toBe(true);
    expect(getCancelButton(root).props.disabled).toBe(true);
  });

  test('renders a thumbnail with its own remove button per photo', () => {
    const files = makeFiles(5);
    const root = renderDialog({ files });

    expect(root.root.findAllByType(Image)).toHaveLength(5);
    files.forEach((file) => {
      expect(getRemoveButton(root, file.uri)).toBeTruthy();
    });
  });

  test('keeps the gallery and camera entry points', () => {
    const onPickFromGallery = jest.fn();
    const onTakePhoto = jest.fn();
    const root = renderDialog({ onPickFromGallery, onTakePhoto });

    const labels = root.root
      .findAllByType(Button)
      .map((b) => b.props.children);
    expect(labels).toContain(i18n.t('choose_from_gallery'));
    expect(labels).toContain(i18n.t('take_photo'));
  });

  test('renders nothing when not visible', () => {
    const root = renderDialog({ visible: false, files: makeFiles(3) });

    expect(root.root.findAllByType(FlatList)).toHaveLength(0);
  });
});

describe('FieldEvidenceDialog - removing photos', () => {
  test('tapping a photo X reports that exact URI to the parent', () => {
    const onRemoveFile = jest.fn();
    const files = makeFiles(5);
    const root = renderDialog({ files, onRemoveFile });

    act(() => {
      getRemoveButton(root, files[2].uri).props.onPress();
    });

    expect(onRemoveFile).toHaveBeenCalledTimes(1);
    expect(onRemoveFile).toHaveBeenCalledWith(files[2].uri);
  });

  test('remove buttons are disabled while saving', () => {
    const files = makeFiles(3);
    const root = renderDialog({ files, saving: true });

    expect(getRemoveButton(root, files[0].uri).props.disabled).toBe(true);
  });
});

// Mirrors FieldExecutionSection's own evidence state wiring (the
// removeEvidenceFile filter-by-URI plus the evidenceFiles state passed to
// submitFieldEvidenceWithCleanup) so the full pick -> remove -> submit loop
// is covered end to end. The real screen is ~1200 lines wired into Redux,
// navigation and several contexts; if this state pair is ever extracted
// into a hook, point this harness at the real export instead.
function EvidenceHarness({ initialFiles, onSubmit }) {
  const [files, setFiles] = useState(initialFiles);

  return (
    <FieldEvidenceDialog
      visible
      files={files}
      saving={false}
      onPickFromGallery={() =>
        setFiles((current) => {
          const existing = new Set(current.map((file) => file.uri));
          const picked = [
            { uri: 'file:///gallery-a.jpg', name: 'a.jpg', type: 'image/jpeg' },
            // Same URI as an already-selected photo: must be deduplicated.
            ...current.slice(0, 1)
          ].filter((file) => !existing.has(file.uri));
          return [...current, ...picked];
        })
      }
      onTakePhoto={() =>
        setFiles((current) => [
          ...current,
          { uri: 'file:///camera-1.jpg', name: 'camera-1.jpg', type: 'image/jpeg' }
        ])
      }
      onRemoveFile={(uri) =>
        setFiles((current) => current.filter((file) => file.uri !== uri))
      }
      onCancel={jest.fn()}
      onSave={() => onSubmit(files)}
    />
  );
}

describe('FieldEvidenceDialog - pick / remove / submit loop', () => {
  const renderHarness = (initialFiles, onSubmit = jest.fn()) => {
    let root;
    act(() => {
      root = create(
        wrap(
          <EvidenceHarness initialFiles={initialFiles} onSubmit={onSubmit} />
        )
      );
    });
    return root;
  };

  test('removing a photo from the middle updates the counter and the grid immediately', () => {
    const files = makeFiles(5);
    const root = renderHarness(files);

    expect(getCounterText(root)).toBe('5 fotos selecionadas');

    act(() => {
      getRemoveButton(root, files[2].uri).props.onPress();
    });

    expect(getCounterText(root)).toBe('4 fotos selecionadas');
    expect(getList(root).props.data.map((file) => file.uri)).toEqual([
      files[0].uri,
      files[1].uri,
      files[3].uri,
      files[4].uri
    ]);
  });

  test('removing every photo empties the grid, hides the counter and disables Save', () => {
    const files = makeFiles(3);
    const root = renderHarness(files);

    files.forEach((file) => {
      act(() => {
        getRemoveButton(root, file.uri).props.onPress();
      });
    });

    expect(getList(root).props.data).toHaveLength(0);
    expect(queryAllByTestId(root.root, 'field-evidence-selected-count')).toHaveLength(
      0
    );
    expect(getSaveButton(root).props.disabled).toBe(true);
  });

  test('submit receives exactly the remaining files - a removed photo never reaches upload', () => {
    const onSubmit = jest.fn();
    const files = makeFiles(4);
    const root = renderHarness(files, onSubmit);

    act(() => {
      getRemoveButton(root, files[1].uri).props.onPress();
    });
    act(() => {
      getSaveButton(root).props.onPress();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.map((file) => file.uri)).toEqual([
      files[0].uri,
      files[2].uri,
      files[3].uri
    ]);
    expect(submitted.map((file) => file.uri)).not.toContain(files[1].uri);
  });

  test('a photo added from the camera shows up in the grid and the counter', () => {
    const root = renderHarness(makeFiles(2));

    act(() => {
      root.root
        .findAllByType(Button)
        .find((b) => b.props.children === i18n.t('take_photo'))
        .props.onPress();
    });

    expect(getCounterText(root)).toBe('3 fotos selecionadas');
    expect(getList(root).props.data.map((file) => file.uri)).toContain(
      'file:///camera-1.jpg'
    );
  });

  test('a photo added from the gallery shows up, and an already-selected URI is not duplicated', () => {
    const files = makeFiles(2);
    const root = renderHarness(files);

    act(() => {
      root.root
        .findAllByType(Button)
        .find((b) => b.props.children === i18n.t('choose_from_gallery'))
        .props.onPress();
    });

    const uris = getList(root).props.data.map((file) => file.uri);
    expect(uris).toContain('file:///gallery-a.jpg');
    // The duplicate of files[0] offered by the picker was dropped.
    expect(uris).toHaveLength(3);
    expect(uris.filter((uri) => uri === files[0].uri)).toHaveLength(1);
  });
});
