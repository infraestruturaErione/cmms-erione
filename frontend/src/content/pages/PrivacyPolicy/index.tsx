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
    title: '1. Quais dados coletamos',
    body: [
      'Coletamos dados informados pelo usuario ou pela empresa contratante, como nome, e-mail, telefone, funcao, empresa, clientes permitidos e dados necessarios para acesso ao Erione CMMS.',
      'Durante o uso operacional, o Erione CMMS pode registrar ordens de servico, solicitacoes, comentarios, relatos tecnicos, fotos, anexos, assinatura, datas, horarios, status, check-in, check-out e dados de localizacao quando o usuario autoriza no dispositivo.'
    ]
  },
  {
    title: '2. Como usamos os dados',
    body: [
      'Usamos os dados para autenticar usuarios, operar o sistema CMMS, exibir ordens de servico, registrar execucao em campo, permitir acompanhamento administrativo, gerar historicos, evidencias, relatorios e melhorar a seguranca da operacao.',
      'A localizacao, quando autorizada, e usada para registrar eventos operacionais como deslocamento, check-in e check-out em ordens de servico.'
    ]
  },
  {
    title: '3. Compartilhamento',
    body: [
      'Os dados podem ser visualizados por usuarios autorizados dentro da mesma empresa, conforme permissoes e escopos definidos pelo administrador.',
      'Nao vendemos dados pessoais. Podemos compartilhar dados apenas com provedores tecnicos necessarios para hospedagem, armazenamento, seguranca, suporte e funcionamento do servico, sempre dentro da finalidade operacional do Erione CMMS.'
    ]
  },
  {
    title: '4. Armazenamento e seguranca',
    body: [
      'Mantemos medidas tecnicas e organizacionais para proteger os dados contra acesso nao autorizado, perda, uso indevido ou alteracao indevida.',
      'Arquivos, fotos e evidencias podem ser armazenados em infraestrutura propria ou em provedores de armazenamento contratados para suportar o funcionamento do sistema.'
    ]
  },
  {
    title: '5. Retencao',
    body: [
      'Os dados sao mantidos enquanto forem necessarios para prestar o servico, cumprir obrigacoes legais, preservar historicos operacionais ou atender necessidades legitimas da empresa contratante.',
      'A exclusao ou correcao de dados pode depender das regras de auditoria, historico de manutencao e requisitos legais aplicaveis.'
    ]
  },
  {
    title: '6. Direitos do titular',
    body: [
      'Quando aplicavel, o titular pode solicitar confirmacao de tratamento, acesso, correcao, portabilidade, anonimização, bloqueio ou exclusao de dados pessoais, observados os limites legais e contratuais.',
      'Solicitacoes devem ser enviadas pelos canais de contato informados nesta politica.'
    ]
  },
  {
    title: '7. Cookies e tecnologias similares',
    body: [
      'O Erione CMMS pode usar cookies, armazenamento local e tecnologias similares para manter sessao, seguranca, preferencias e funcionamento da aplicacao.',
      'O bloqueio dessas tecnologias pode afetar login, navegacao e recursos essenciais do sistema.'
    ]
  },
  {
    title: '8. Alteracoes nesta politica',
    body: [
      'Podemos atualizar esta Politica de Privacidade para refletir mudancas no produto, requisitos legais ou melhorias de seguranca.',
      'A versao publicada nesta pagina e a referencia publica vigente.'
    ]
  }
];

export default function PrivacyPolicy() {
  const theme = useTheme();

  return (
    <>
      <Helmet>
        <title>Politica de Privacidade | Erione CMMS</title>
        <meta
          name="description"
          content="Politica de Privacidade publica do Erione CMMS."
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
                  Politica de Privacidade
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Ultima atualizacao: 12 de junho de 2026
                </Typography>
              </Box>

              <Typography variant="body1">
                Esta Politica de Privacidade explica como o Erione CMMS coleta,
                usa, armazena e protege dados pessoais e dados operacionais
                relacionados ao uso da plataforma web e do aplicativo mobile.
              </Typography>

              <Typography variant="body1">
                O Erione CMMS e uma solucao de gestao de manutencao, ordens de
                servico, solicitacoes, ativos, evidencias de campo e execucao
                tecnica. O tratamento de dados ocorre para viabilizar esses
                fluxos operacionais.
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
                  9. Contato
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Para duvidas ou solicitacoes relacionadas a privacidade,
                  entre em contato pelo site oficial da Erione:{' '}
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
