package com.grash.security;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.regex.Pattern;

import com.grash.utils.Helper;

/**
 * UNICA politica de "IP do cliente" do backend (rate limit de login, uploads publicos, demo...).
 * <p>
 * Regra: o cliente NUNCA escolhe o IP. Headers de IP (X-Forwarded-For & cia) sao controlados por quem
 * envia a requisicao, entao so' valem quando vierem de um proxy CONFIAVEL, e mesmo assim so' a posicao
 * que o proprio proxy confiavel escreveu:
 * <ol>
 *   <li>O par TCP ({@code getRemoteAddr}) e' a unica fonte que o cliente nao consegue forjar. Se ele NAO for
 *   um proxy confiavel ({@code security.client-ip.trusted-proxies}), todos os headers sao ignorados.</li>
 *   <li>Se for, conta-se a cadeia de X-Forwarded-For DA DIREITA para a esquerda: cada proxy confiavel
 *   ACRESCENTA ao fim o endereco do qual recebeu a conexao. Com {@code security.client-ip.proxy-hops = N}
 *   proxies que acrescentam entre a internet e o backend, o cliente real e' o N-esimo item a partir da
 *   direita. Tudo a esquerda disso e' texto que o cliente mandou e e' descartado.</li>
 *   <li>Cadeia mais curta que N, item invalido ou ausente: cai no par TCP (nunca no valor do cliente).</li>
 * </ol>
 * Errar {@code proxy-hops} PARA MENOS e' seguro (varios clientes compartilham o balde do proxy); errar PARA
 * MAIS deixaria o cliente forjar o IP. Por isso o padrao e' 1 (o nginx do frontend).
 * <p>
 * X-Real-IP, CF-Connecting-IP e True-Client-IP NAO sao confiados: sem uma borda que os sobrescreva de forma
 * comprovada, sao tao forjaveis quanto o X-Forwarded-For.
 */
@Component
public class ClientIpResolver {

    public static final String DEFAULT_TRUSTED_PROXIES =
            "127.0.0.0/8,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7";
    private static final String UNKNOWN = "unknown";
    private static final Pattern IPV4 = Pattern.compile(
            "^(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}$");
    private static final Pattern IPV4_WITH_PORT = Pattern.compile("^([0-9.]+):(\\d{1,5})$");
    private static final Pattern BRACKETED_IPV6 = Pattern.compile("^\\[([0-9a-fA-F:.]+)](:\\d{1,5})?$");
    private static final Pattern IPV6_CHARS = Pattern.compile("^[0-9a-fA-F:.]{2,45}$");

    private final List<IpAddressMatcher> trustedProxies;
    private final int proxyHops;

    @Autowired
    public ClientIpResolver(
            @Value("${security.client-ip.trusted-proxies:" + DEFAULT_TRUSTED_PROXIES + "}") String trustedProxies,
            @Value("${security.client-ip.proxy-hops:1}") int proxyHops) {
        List<IpAddressMatcher> matchers = new ArrayList<>();
        for (String entry : trustedProxies.split(",")) {
            String trimmed = entry.trim();
            if (!trimmed.isEmpty()) matchers.add(new IpAddressMatcher(trimmed)); // falha no boot se invalido
        }
        this.trustedProxies = Collections.unmodifiableList(matchers);
        this.proxyHops = Math.max(0, proxyHops);
    }

    public ClientIpResolver() {
        this(DEFAULT_TRUSTED_PROXIES, 1);
    }

    // Helper.extractClientIp(req) (usado por controllers estaticos) passa a delegar a esta mesma politica.
    @PostConstruct
    void registerAsDefault() {
        Helper.setClientIpResolver(this);
    }

    public String resolve(HttpServletRequest request) {
        String peer = normalize(request.getRemoteAddr());
        if (peer == null) return UNKNOWN;
        if (proxyHops < 1 || !isTrustedProxy(peer)) return peer;

        List<String> chain = forwardedChain(request);
        if (chain.size() < proxyHops) return peer;
        String candidate = normalize(chain.get(chain.size() - proxyHops));
        return candidate != null ? candidate : peer;
    }

    private boolean isTrustedProxy(String ip) {
        for (IpAddressMatcher matcher : trustedProxies) {
            try {
                if (matcher.matches(ip)) return true;
            } catch (RuntimeException ignored) {
                // familia de IP diferente do CIDR (v4 x v6): simplesmente nao casa
            }
        }
        return false;
    }

    private List<String> forwardedChain(HttpServletRequest request) {
        List<String> chain = new ArrayList<>();
        Enumeration<String> headers = request.getHeaders("X-Forwarded-For");
        if (headers == null) return chain;
        for (String header : Collections.list(headers)) {
            for (String part : header.split(",")) {
                String trimmed = part.trim();
                if (!trimmed.isEmpty()) chain.add(trimmed);
            }
        }
        return chain;
    }

    /** Devolve o IP literal em forma canonica, ou null se nao for um IPv4/IPv6 valido. Nunca faz DNS. */
    static String normalize(String raw) {
        if (raw == null) return null;
        String value = raw.trim();
        if (value.isEmpty() || UNKNOWN.equalsIgnoreCase(value)) return null;

        java.util.regex.Matcher bracketed = BRACKETED_IPV6.matcher(value);
        if (bracketed.matches()) value = bracketed.group(1);
        else {
            java.util.regex.Matcher withPort = IPV4_WITH_PORT.matcher(value);
            if (withPort.matches()) value = withPort.group(1);
        }

        if (IPV4.matcher(value).matches()) return value;
        if (value.indexOf(':') >= 0 && IPV6_CHARS.matcher(value).matches() && countChar(value, ':') >= 2) {
            return value.toLowerCase();
        }
        return null;
    }

    private static int countChar(String value, char c) {
        int count = 0;
        for (int i = 0; i < value.length(); i++) if (value.charAt(i) == c) count++;
        return count;
    }
}
