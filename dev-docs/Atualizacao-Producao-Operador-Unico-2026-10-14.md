# Atualizacao de producao - operador unico e APK de teste

Estes comandos NAO foram executados em producao. Caminho registrado no vault: /var/www/html/cmms-erione. Confirmar o caminho e os mesmos arquivos Compose/flags usados atualmente no servidor. Nao substituir o .env de producao pelo .env local.

## Antes de atualizar

As alteracoes atuais de API, web e mobile ainda estao no working tree local. Git pull so recebe commits ja enviados ao repositorio: primeiro revisar, commitar e fazer push dos arquivos da feature, com autorizacao do responsavel. Nao executar git add . com os temporarios presentes.

O APK de teste aponta para https://cmms.erione.com.br/api, usa assinatura interna de teste e inclui JavaScript/Hermes. Nao depende do Metro, Expo Go ou de um servidor JS no PC. OTA automatica foi desativada somente no staging desse APK para nao substituir o codigo validado por um bundle remoto anterior. Nao e um AAB para publicacao.

A API precisa da migration nova de operador; atualizacao apenas do APK nao instala a regra no servidor. Coordenar a distribuicao do novo aplicativo com a atualizacao do backend. Apps anteriores podem nao ter o botao explicito para assumir OS legadas ja em andamento. Operacoes feitas no APK conectado a producao geram dados reais.

## Comandos no servidor Linux

Executar dentro de uma janela de manutencao. Se producao usa flags -f/--env-file, acrescentar as MESMAS flags a cada comando docker compose. Executar os blocos na ordem, conferindo o resultado de cada um.

```bash
cd /var/www/html/cmms-erione
git status --short
git branch --show-current
docker compose config --services
docker compose ps
```

Nao continuar se houver modificacoes locais desconhecidas ou branch diferente da que deve receber a feature. Os servicos usados no Compose do repositorio sao postgres, api e frontend. Nao alterar containers do outro projeto.

Backup logico, sem parar/apagar banco ou volumes:

```bash
mkdir -p backups
chmod 700 backups
backup="backups/atlas-before-execution-owner-$(date +%Y%m%d-%H%M%S).dump"
if docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup"; then
  chmod 600 "$backup"
  test -s "$backup" && echo "Backup criado: $backup"
else
  echo "Backup falhou. Nao continuar o deploy."
fi
```

Confirmar que o backup existe, nao esta vazio e pode ser lido pelo pg_restore apropriado. Ele pode conter dados sensiveis: nao adicionar ao Git nem distribuir. Preservar tambem o backup de storage/MinIO existente; este dump nao copia arquivos de evidencias.

Depois do commit/push e backup confirmado:

```bash
git pull --ff-only origin main
git log -1 --oneline
test -f api/src/main/resources/db/changelog/2026_10_14_00000000001_workorder_execution_owner.xml
docker compose build api
docker compose build frontend
```

Continuar somente se pull, verificacao da migration e builds terminarem sem erro. Construir as imagens nao para os containers atuais. Os builds estao separados para reduzir o pico de memoria no servidor documentado de 4 GB.

```bash
docker compose up -d --no-deps api frontend
docker compose ps
docker compose logs --tail=150 api frontend
```

Liquibase roda automaticamente na inicializacao da API. Verificar ausencia de falha de migration/Hibernate e aguardar a API iniciar. A migration e aditiva e nullable; nao faz backfill ficticio. O comando nao recria postgres nem minio, mas recria API/frontend e pode causar indisponibilidade breve.

## Validar depois

Conferir login web e APK, criacao de OS e data no card Home; dois tecnicos atribuídos disputando inicio (somente um ganha); operador preenchendo questionario/relato/fotos/assinatura/check-out/conclusao; acompanhante em leitura; retry de conclusao sem duplicar efeitos; edicao administrativa e PDF. Testar inicialmente com OS claramente identificada para homologacao, sem alterar atendimentos reais inadvertidamente.

Nao usar docker compose down -v, docker volume rm, docker system prune ou comandos de limpeza/reset do banco. Se a API falhar, nao improvisar rollback/restauracao do banco: preservar logs e avaliar compatibilidade antes de recuperar.
