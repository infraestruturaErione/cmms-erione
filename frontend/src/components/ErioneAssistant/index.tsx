import { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Fab,
  IconButton,
  Link,
  Paper,
  Tooltip,
  Typography
} from '@mui/material';
import TextField from '@mui/material/TextField';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { ERIONE_VISUAL_IDENTITY as erione } from 'src/config/erioneVisualIdentity';
import useAuth from 'src/hooks/useAuth';
import api, { getErrorMessage } from 'src/utils/api';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  links?: AssistantLink[];
}

interface AssistantLink {
  label: string;
  url: string;
  kind: string;
  expiresAt?: string | null;
}

interface AssistantResponse {
  success: boolean;
  agentName: string;
  reply: string;
  intent: string;
  generatedReportId?: number | null;
  generatedReportRequestedAt?: string | null;
  generatedReportExpiresAt?: string | null;
  linkExpiresAt?: string | null;
  links?: AssistantLink[];
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 0,
  role: 'assistant',
  content:
    'Olá! Sou o Assistente de Relatórios Erione. Posso listar clientes, consultar relatórios operacionais, histórico bulk e gerar PDF de relatórios. Como posso ajudar?'
};

function renderMessageContent(content: string) {
  const parts: Array<{ type: 'text' | 'link'; text: string; url?: string }> = [];
  const regex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'link', text: match[1], url: match[2] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return parts.map((part, index) =>
    part.type === 'link' ? (
      <Link
        key={`link-${index}`}
        href={part.url}
        target="_blank"
        rel="noreferrer"
        sx={{ fontSize: 13.5, fontWeight: 700 }}
      >
        {part.text}
      </Link>
    ) : (
      <Typography key={`text-${index}`} component="span" sx={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>
        {part.text}
      </Typography>
    )
  );
}

export default function ErioneAssistant() {
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  const canUseAssistant =
    isAuthenticated &&
    !!user?.role?.code &&
    ['ADMIN', 'LIMITED_ADMIN'].includes(user.role.code);

  if (!canUseAssistant) return null;

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: trimmed
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post<AssistantResponse>('assistant/report/chat', {
        messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content
        }))
      });

      const reply: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.reply,
        links: response.links ?? []
      };
      setMessages((prev) => [...prev, reply]);
    } catch (error) {
      const reply: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: getErrorMessage(
          error,
          'Nao consegui consultar o agente de relatórios agora. Tente novamente.'
        )
      };
      setMessages((prev) => [...prev, reply]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end'
      }}
    >
      {open && (
        <Paper
          elevation={8}
          sx={{
            width: 380,
            maxWidth: 'calc(100vw - 32px)',
            height: 520,
            maxHeight: 'calc(100vh - 120px)',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 3,
            overflow: 'hidden',
            mb: 1.5
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              background: erione.sidebarGradient
            }}
          >
            <Avatar sx={{ width: 34, height: 34, bgcolor: erione.accent }}>
              <SmartToyIcon sx={{ fontSize: 20 }} />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                Assistente Erione
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                {loading ? 'Pensando...' : 'Online'}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: '#fff' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box
            ref={scrollRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 1.5,
              bgcolor: erione.surface,
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}
          >
            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%'
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor:
                      message.role === 'user' ? erione.primary : '#fff',
                    color: message.role === 'user' ? '#fff' : 'text.primary',
                    border: message.role === 'user' ? 'none' : '1px solid #e3e8ef'
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {renderMessageContent(message.content)}
                    {!!message.links?.length && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                        {message.links.map((link, index) => (
                          <Link
                            key={`${message.id}-attachment-${index}`}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            sx={{ fontSize: 13.5, fontWeight: 700 }}
                          >
                            {link.label}
                          </Link>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Paper>
              </Box>
            ))}
            {loading && (
              <Box sx={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={14} sx={{ color: erione.primary }} />
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  Consultando os dados...
                </Typography>
              </Box>
            )}
          </Box>

          {/* Input */}
          <Box sx={{ p: 1.5, bgcolor: '#fff', borderTop: '1px solid #e3e8ef' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Pergunte algo..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                multiline
                maxRows={3}
              />
              <Tooltip title="Enviar">
                <Button
                  variant="contained"
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  sx={{
                    minWidth: 44,
                    px: 1.5,
                    bgcolor: erione.primary,
                    '&:hover': { bgcolor: erione.primaryDark }
                  }}
                >
                  <SendIcon fontSize="small" />
                </Button>
              </Tooltip>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Floating button */}
      <Tooltip title={open ? 'Fechar assistente' : 'Assistente Erione'}>
        <Fab
          color="primary"
          aria-label="assistente erione"
          onClick={() => setOpen((prev) => !prev)}
          sx={{
            width: 56,
            height: 56,
            background: `linear-gradient(135deg, ${erione.primaryDark} 0%, ${erione.primary} 100%)`,
            boxShadow: '0 4px 14px rgba(42, 72, 153, 0.45)',
            '&:hover': { background: erione.primaryDark }
          }}
        >
          {open ? (
            <CloseIcon sx={{ fontSize: 26 }} />
          ) : (
            <ChatIcon sx={{ fontSize: 26 }} />
          )}
        </Fab>
      </Tooltip>
    </Box>
  );
}
