# Entrega PDF: cache, bulk e status - 27/10/2026

## Tres commits aprovados

1. 8aa3f726c4ef0a7fa18fe744547764c9d630fcee:
   feat(reports): cache individual work order PDFs by content.
   SHA-256 do conteudo, autorizacao por acesso, trava PostgreSQL, URL renovada,
   migration aditiva e limpeza de derivados apos sete dias sem uso.
2. 5190fd027764ab2c837a57d5020c957db204f05b:
   feat(reports): allow bulk PDFs for all customer work orders.
   Somente concluidas (padrao) ou Todas, preservando cliente/periodo/fuso,
   historico distinguivel, datas neutras/validacao e layout responsivo.
3. O commit que inclui este documento:
   fix(reports): translate en-route status in generated PDFs.
   EN_ROUTE em messages/mailMessages pt-BR/fallback e regressao com o
   EmailConfiguration real, cobrindo todos os status no individual/bulk.

Hashes finais dos tres commits e confirmacao do push ficam no registro
curado Graphify e no vault Obsidian, depois da publicacao. Este documento
nao pode conter o proprio SHA antes de ser comitado.

Escopo exclui APK/mobile, arquivos de ambiente/credenciais, PDFs/ZIPs,
backups/logs/fixtures/temporarios, teste antigo de Customer Scope e notas
de tarefas anteriores. Nao usar git add . para esta entrega.

## Verificacoes

Separacao feita no indice, sem alterar a copia de trabalho: somente os
dois hunks de cache do controller no primeiro commit; bulk no segundo.
Copia limpa do indice do cache: 50 testes e Maven package passaram.
Copia limpa do indice do bulk: 69 testes e Maven package passaram.
Frontend correspondente ao indice: 26 suites / 232 testes passaram.
Pacote final com traducao em copia limpa do indice: 71 testes passaram,
sem falhas/erros/skips, e Maven package BUILD SUCCESS (54,223 s).
Evidencia tmp/pdf-release-final-index-tests-20261027.log. As tres copias
limpas excluem o teste antigo de Customer Scope e todos os temporarios.

DEV integrado: dois clientes separados com 12 OS cada, Todas/Criado em,
28/09 a 27/10 (30 dias), 100 fotos/dez assinaturas/14 OS sem assinatura.
Traducao resolvida, fontes e dados originais preservados. Detalhes em
PDF-Status-Em-Deslocamento-2026-10-27.md e notas das respectivas features.
Paginacao/espacos e ordenacao dos anexos NAO foram corrigidos nesta entrega.

## Producao: depois do pull

Estes comandos sao orientacoes, NAO foram executados no servidor por esta
tarefa. Usar janela de manutencao e a pasta/configuracao Compose de producao.
Caminho historico registrado: /var/www/html/cmms-erione; confirmar no servidor.
Preservar o .env de producao. Se o deploy usa -f/--env-file/project-name,
usar exatamente as mesmas opcoes em TODOS os comandos docker compose.

Antes do pull, conferir git status e nao descartar modificacoes desconhecidas.
O pull deve ser fast-forward: git pull --ff-only origin main. Depois dele,
confirmar os tres commits e a presenca da migration
api/src/main/resources/db/changelog/2026_10_22_00000000001_work_order_pdf_cache.xml.

Fazer backup PostgreSQL antes de iniciar a API nova. Exemplo em Bash, fora
da raiz web e do Git, com permissoes privadas; o bloco para em caso de erro:

```bash
(
  set -eu
  umask 077
  backup_dir="$HOME/backups/cmms-erione"
  mkdir -p "$backup_dir"
  chmod 700 "$backup_dir"
  backup="$backup_dir/antes-pdf-$(date +%Y%m%d-%H%M%S).dump"
  docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup"
  test -s "$backup"
  docker compose exec -T postgres pg_restore -l < "$backup" > /dev/null
  echo "Backup legivel: $backup"
)
```

Essa verificacao le o catalogo do dump, nao substitui um ensaio de restauracao.
O dump nao copia as fotos/arquivos do MinIO; manter a rotina de backup de
storage existente. Nao continuar se o backup falhar ou estiver vazio.

Construir as imagens separadamente para reduzir pico de memoria. A API e
o frontend atuais continuam ativos durante o build. So seguir se ambos
os builds passarem; o bloco abaixo interrompe em erro:

```bash
(
  set -e
  docker compose build api
  docker compose build frontend
  docker compose up -d --no-deps api frontend
  docker compose ps
  docker compose logs --tail=150 api frontend
)
```

Isto recria somente api e frontend com as novas imagens. Nao e suficiente
usar apenas docker restart, pois ele reutiliza a imagem antiga. PostgreSQL,
MinIO e seus volumes nao sao recriados. Pode haver indisponibilidade breve.
Aguardar Started ApiApplication e ausencia de erros Liquibase/Hibernate antes
de testar login e gerar relatorios. Repetir logs se a inicializacao ainda
estiver em curso; monitorar tambem pelo mecanismo habitual do servidor.

Liquibase aplica automaticamente a tabela work_order_pdf_cache e seu indice.
Migration aditiva, sem apagar/alterar dados de OS ou arquivos de origem.
Nenhum comando SQL manual ou nova variavel de ambiente necessario.

Nao executar down -v, remover volumes, limpar bucket, importar as fixtures
DEV ou copiar o .env local. Nao reiniciar o projeto campo-erione.

## Validar depois

- PDF individual: gerar duas vezes sem alterar OS, verificar acesso/arquivo;
  alterar dado exibido e confirmar relatorio atualizado.
- Bulk: cliente e periodo conhecidos, comparar Somente concluidas e Todas;
  conferir nome do cliente, contagem, fotos, assinatura/status em deslocamento.
- Manter o padrao Somente concluidas para clientes antigos e o assistente.
- Se a API falhar na migration/startup, preservar logs/backup e investigar;
  nao improvisar exclusao de tabelas ou restauracao destrutiva.
