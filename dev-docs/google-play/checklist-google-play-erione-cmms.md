# Checklist Google Play - Erione CMMS

Documento de preparacao para submissao futura na Google Play. Revisar antes de preencher dados definitivos no Play Console.

## Identidade do app

- App name: Erione CMMS
- Nome visivel no app: Erione CMMS
- Package Android atual: `com.erione.cmms`
- Privacy Policy URL provisoria: `https://erione.com.br/privacidade`
- Terms URL provisoria: `https://erione.com.br/termos`

## Pendencias antes da submissao

- Confirmar URLs publicas finais de Termos de Uso e Politica de Privacidade.
- Revisao juridica dos documentos legais.
- Definir conta demo para revisor Google Play.
- Validar app em Android fisico com camera, galeria, assinatura e fluxo tecnico.
- Revisar Data Safety no Play Console com responsavel legal/privacidade.
- Avaliar renome futuro do projeto/scheme iOS `AtlasCMMS` em fase separada.
- Revisar traducoes nao PT/EN que ainda mencionam Atlas.

## App access para reviewer

- Informar se o app exige login: sim.
- Fornecer credencial demo de ambiente de teste, nunca senha real de producao.
- Explicar passos minimos para teste:
  1. Login.
  2. Abrir uma ordem de servico.
  3. Adicionar relato.
  4. Adicionar evidencia.
  5. Concluir OS.

## Permissoes usadas

| Permissao | Uso no app | Justificativa Play Console |
|---|---|---|
| Internet | Comunicacao com API Erione CMMS | Autenticacao, consulta e atualizacao de dados operacionais |
| Camera | Fotos/evidencias, leitura de codigo/barcode quando usada | Registrar evidencias de campo e apoiar identificacao de ativos |
| Galeria/arquivos | Anexar imagens e documentos | Permitir anexos em OS, ativos, locais e evidencias |
| Localizacao/coordenadas | Deslocamento, check-in, check-out, coordenadas operacionais quando registradas | Rastreabilidade operacional do atendimento em campo |
| Notificacoes | Alertas de OS, mensagens e atualizacoes | Avisar usuarios sobre atualizacoes relevantes |
| NFC | Identificacao de ativos quando habilitada | Apoiar leitura de tags NFC em ativos compativeis |
| Microfone/audio | Notas de audio quando usadas | Permitir registros operacionais em audio, se habilitado no fluxo |

## Data Safety provavel

Marcar como rascunho para validacao humana:

- Dados pessoais basicos: nome, e-mail, perfil/funcao.
- Conteudo gerado pelo usuario: comentarios, relatos, fotos, arquivos, assinaturas.
- Dados de app/atividade: acoes realizadas, datas e horarios.
- Localizacao: apenas quando o app registra coordenadas operacionais de campo.
- Finalidades: funcionalidade do app, seguranca, auditoria, gerenciamento operacional, relatorios.
- Venda de dados: nao.
- Compartilhamento: apenas usuarios autorizados da operacao e provedores necessarios para infraestrutura/hospedagem.

## Observacoes

Nao preencher o Play Console como definitivo sem revisao juridica e validacao da infraestrutura final.
