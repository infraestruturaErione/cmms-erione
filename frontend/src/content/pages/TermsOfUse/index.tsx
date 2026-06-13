import {
  Box,
  Card,
  Container,
  Divider,
  Link,
  Stack,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import Logo from 'src/components/LogoSign';
import { ERIONE_VISUAL_IDENTITY } from '../../../config/erioneVisualIdentity';

const sections = [
  {
    title: '1. Aceite dos termos',
    body: [
      'Ao acessar ou utilizar o Erione CMMS, o usuario declara estar ciente e de acordo com estes Termos de Uso, com a Politica de Privacidade e com as regras operacionais definidas pela empresa contratante.',
      'Caso nao concorde com estes termos, o usuario nao deve utilizar a plataforma.'
    ]
  },
  {
    title: '2. Finalidade do Erione CMMS',
    body: [
      'O Erione CMMS e uma plataforma para gestao de manutencao, ordens de servico, solicitacoes, ativos, execucao em campo, evidencias, assinaturas, historicos e relatorios operacionais.',
      'O sistema deve ser utilizado apenas para finalidades profissionais, tecnicas e administrativas autorizadas.'
    ]
  },
  {
    title: '3. Contas de usuario e responsabilidade',
    body: [
      'Cada usuario e responsavel por manter suas credenciais em sigilo e por todas as acoes realizadas com sua conta.',
      'O compartilhamento de login, senha ou acesso com terceiros nao autorizados e proibido.'
    ]
  },
  {
    title: '4. Uso adequado da plataforma',
    body: [
      'O usuario deve registrar informacoes verdadeiras, completas e relacionadas a operacao, incluindo relatos tecnicos, fotos, anexos, status, feedbacks e assinaturas quando aplicavel.',
      'E proibido usar o sistema para inserir conteudo ilegal, ofensivo, fraudulento, malicioso ou que possa comprometer a seguranca, disponibilidade ou integridade da plataforma.'
    ]
  },
  {
    title: '5. Dados, evidencias e registros operacionais',
    body: [
      'Registros de ordens de servico, comentarios, evidencias, localizacao autorizada, check-in, check-out, assinatura e conclusao podem ser armazenados para controle operacional, auditoria, historico e relatorios.',
      'A empresa contratante e os administradores autorizados podem visualizar dados conforme permissoes, responsabilidades e escopos configurados no sistema.'
    ]
  },
  {
    title: '6. Disponibilidade e manutencao',
    body: [
      'A Erione busca manter o servico disponivel e seguro, mas podem ocorrer indisponibilidades temporarias por manutencao, atualizacoes, falhas de infraestrutura, conexao, provedores ou fatores externos.',
      'Recursos do aplicativo mobile que dependem de internet, localizacao, camera ou armazenamento podem variar conforme permissao do dispositivo e condicoes de conectividade.'
    ]
  },
  {
    title: '7. Propriedade intelectual',
    body: [
      'Marcas, interfaces, codigo, documentacao, identidade visual e demais componentes do Erione CMMS pertencem a Erione ou a seus respectivos licenciadores.',
      'O uso da plataforma nao concede ao usuario qualquer direito de propriedade sobre esses elementos.'
    ]
  },
  {
    title: '8. Suspensao de acesso',
    body: [
      'A Erione ou a empresa contratante podem suspender, limitar ou remover acessos em caso de uso indevido, risco de seguranca, desligamento, alteracao de funcao, encerramento contratual ou violacao destes termos.',
      'Permissoes e visibilidade de dados sao definidas pelos administradores autorizados da empresa contratante.'
    ]
  },
  {
    title: '9. Alteracoes dos termos',
    body: [
      'Estes Termos de Uso podem ser atualizados para refletir melhorias do produto, mudancas legais, ajustes de seguranca ou alteracoes operacionais.',
      'A versao publicada nesta pagina e a referencia publica vigente.'
    ]
  }
];

export default function TermsOfUse() {
  const theme = useTheme();

  return (
    <>
      <Helmet>
        <title>Termos de Uso | Erione CMMS</title>
        <meta
          name="description"
          content="Termos de Uso publicos do Erione CMMS."
        />
      </Helmet>
      <Box
        sx={{
          minHeight: '100vh',
          py: { xs: 4, md: 8 },
          bgcolor: '#f6f9fa',
          backgroundImage: `linear-gradient(135deg, ${alpha(
            ERIONE_VISUAL_IDENTITY.primary,
            0.08
          )}, transparent 42%), linear-gradient(25deg, transparent 0 62%, ${alpha(
            ERIONE_VISUAL_IDENTITY.accent,
            0.08
          )} 62% 100%)`
        }}
      >
        <Container maxWidth="md">
          <Card
            sx={{
              p: { xs: 3, md: 5 },
              borderRadius: 2,
              border: `1px solid ${alpha(
                ERIONE_VISUAL_IDENTITY.primary,
                0.14
              )}`,
              boxShadow: `0 18px 48px ${alpha(
                ERIONE_VISUAL_IDENTITY.primaryDark,
                0.12
              )}`
            }}
          >
            <Stack spacing={3}>
              <Box>
                <Logo />
                <Typography variant="h1" sx={{ mt: 3, mb: 1 }}>
                  Termos de Uso
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Ultima atualizacao: 12 de junho de 2026
                </Typography>
              </Box>

              <Typography variant="body1">
                Estes Termos de Uso regulam o acesso e a utilizacao do Erione
                CMMS por usuarios autorizados da plataforma web e do aplicativo
                mobile.
              </Typography>

              <Typography variant="body1">
                O Erione CMMS deve ser utilizado como ferramenta operacional de
                gestao, execucao e acompanhamento de ordens de servico,
                solicitacoes, ativos, evidencias e atividades tecnicas.
              </Typography>

              <Divider />

              {sections.map((section) => (
                <Box key={section.title}>
                  <Typography variant="h3" sx={{ mb: 1 }}>
                    {section.title}
                  </Typography>
                  <Stack spacing={1}>
                    {section.body.map((paragraph) => (
                      <Typography
                        key={paragraph}
                        variant="body1"
                        color="text.secondary"
                      >
                        {paragraph}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ))}

              <Divider />

              <Box>
                <Typography variant="h3" sx={{ mb: 1 }}>
                  10. Contato
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Para duvidas relacionadas a estes termos, entre em contato
                  pelo site oficial da Erione:{' '}
                  <Link
                    href="https://erione.com.br/"
                    target="_blank"
                    rel="noopener noreferrer"
                    color={theme.palette.primary.main}
                  >
                    erione.com.br
                  </Link>
                  .
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Container>
      </Box>
    </>
  );
}
