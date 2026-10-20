import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { Searchbar, Text } from 'react-native-paper';
import { ERIONE_MOBILE_IDENTITY } from '../../../config/erioneVisualIdentity';
import { FIELD_UI } from '../../../components/erione/FieldWorkOrderUI';

export default function WorkOrderSearchBar({
  appliedQuery,
  onSubmit
}: {
  appliedQuery: string;
  onSubmit: (query: string) => void;
}) {
  // Draft typing must not update the list criteria or re-render every OS card.
  const [draft, setDraft] = useState(appliedQuery);
  useEffect(() => {
    setDraft(appliedQuery);
  }, [appliedQuery]);

  const submit = (text = draft) => {
    const query = text.trim();
    setDraft(query);
    onSubmit(query);
    Keyboard.dismiss();
  };
  const pending = draft.trim() !== appliedQuery.trim();

  return (
    <View>
      <Searchbar
        testID="work-order-search"
        placeholder="Buscar por OS ou serviço"
        value={draft}
        onChangeText={setDraft}
        onIconPress={() => submit()}
        onSubmitEditing={(event) => submit(event.nativeEvent.text)}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        searchAccessibilityLabel="Pesquisar ordens de serviço"
        clearAccessibilityLabel="Limpar busca de ordens de serviço"
        onClearIconPress={() => {
          setDraft('');
          onSubmit('');
        }}
        style={s.search}
        inputStyle={s.input}
      />
      <Text style={[s.helper, pending && s.pending]}>
        {pending
          ? 'Texto alterado. Toque na lupa ou em Buscar no teclado para pesquisar.'
          : appliedQuery
          ? `Busca aplicada: ${appliedQuery}`
          : 'Digite e toque na lupa ou em Buscar no teclado.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  search: {
    backgroundColor: ERIONE_MOBILE_IDENTITY.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FIELD_UI.border,
    elevation: 0
  },
  input: { fontSize: 14, minHeight: 52 },
  helper: {
    color: ERIONE_MOBILE_IDENTITY.colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 4
  },
  pending: { color: ERIONE_MOBILE_IDENTITY.colors.primary }
});
