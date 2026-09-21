package com.grash.security;

import com.grash.service.RateLimiterService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Rate limit de login: o bucket e' do IP REAL. Variar X-Forwarded-For nao troca de bucket.
 * Reproduz o bypass observado em producao (bucket saturado -> 429; com XFF inventado a request voltava a ser
 * processada) e prova que ele nao existe mais. Passa pelo filtro real + servico de buckets real.
 */
class RateLimitFilterClientIpTest {

    private static final String NGINX = "172.18.0.5"; // par TCP do backend
    private static final String CLIENT = "198.51.100.7";

    private RateLimitFilter oneHopFilter;
    private RateLimitFilter twoHopFilter;

    @BeforeEach
    void setUp() {
        oneHopFilter = filter(1);
        twoHopFilter = filter(2);
    }

    private RateLimitFilter filter(int hops) {
        RateLimiterService service = new RateLimiterService();
        ReflectionTestUtils.setField(service, "rateLimitEnabled", true);
        return new RateLimitFilter(service, new ClientIpResolver(ClientIpResolver.DEFAULT_TRUSTED_PROXIES, hops));
    }

    /** Devolve o status; 200 significa que a request PASSOU do rate limit e chegou na proxima etapa da cadeia. */
    private int attempt(RateLimitFilter filter, String remoteAddr, String... xForwardedFor) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/signin");
        request.setRequestURI("/auth/signin");
        request.setRemoteAddr(remoteAddr);
        for (String value : xForwardedFor) request.addHeader("X-Forwarded-For", value);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        return chain.getRequest() != null ? 200 : response.getStatus();
    }

    /** Esgota o balde por minuto (10) do cliente e confirma que o 11o vira 429. */
    private void saturate(RateLimitFilter filter, String remoteAddr, String... xForwardedFor) throws Exception {
        for (int i = 1; i <= 10; i++) {
            assertEquals(200, attempt(filter, remoteAddr, xForwardedFor), "tentativa " + i + " deveria passar");
        }
        assertEquals(429, attempt(filter, remoteAddr, xForwardedFor));
    }

    // A - o cliente nao troca de bucket variando o X-Forwarded-For (reproducao do bypass de producao)
    @Test
    void forgedXForwardedFor_doesNotReleaseASaturatedBucket() throws Exception {
        // nginx do frontend ACRESCENTA o IP que viu ao que o cliente mandou.
        saturate(oneHopFilter, NGINX, CLIENT);

        assertEquals(429, attempt(oneHopFilter, NGINX, CLIENT));                          // CONTROLE NORMAL
        assertEquals(429, attempt(oneHopFilter, NGINX, "203.0.113.77, " + CLIENT));       // XFF inventado A
        assertEquals(429, attempt(oneHopFilter, NGINX, "203.0.113.78, " + CLIENT));       // XFF inventado B
        assertEquals(429, attempt(oneHopFilter, NGINX, "10.0.0.1, " + CLIENT));           // XFF "interno"
        assertEquals(429, attempt(oneHopFilter, NGINX, "203.0.113.77", "203.0.113.78, " + CLIENT)); // 2 linhas
        assertEquals(429, attempt(oneHopFilter, NGINX, CLIENT));                          // CONTROLE FINAL
    }

    // A (variante) - a mesma conexao TCP variando SO' o header, sem o nginx no meio, tambem nao escapa
    @Test
    void directConnection_variedForwardedHeaders_shareTheSameBucket() throws Exception {
        String direct = "198.51.100.9";
        saturate(oneHopFilter, direct);

        assertEquals(429, attempt(oneHopFilter, direct, "203.0.113.77"));
        assertEquals(429, attempt(oneHopFilter, direct, "203.0.113.78"));
        assertEquals(429, attempt(oneHopFilter, direct, "10.0.0.1"));
        assertEquals(429, attempt(oneHopFilter, direct));
    }

    // Um cliente diferente (IP real diferente) continua com o proprio balde.
    @Test
    void differentRealClients_haveIndependentBuckets() throws Exception {
        saturate(oneHopFilter, NGINX, CLIENT);

        assertEquals(200, attempt(oneHopFilter, NGINX, "198.51.100.8"));
    }

    // B - sem X-Forwarded-For o rate limit normal segue funcionando (chave = par TCP)
    @Test
    void withoutForwardedHeader_normalRateLimitStillWorks() throws Exception {
        saturate(oneHopFilter, NGINX);

        assertEquals(429, attempt(oneHopFilter, NGINX));
    }

    // C - borda + nginx (2 saltos): o proxy confiavel representa o IP original; o cliente direto nao forja
    @Test
    void trustedEdgeProxy_representsTheOriginalClient_andDirectClientsCannotForgeIt() throws Exception {
        // borda acrescentou o cliente real (CLIENT), o nginx acrescentou a borda; o cliente forjou o 1o item.
        saturate(twoHopFilter, NGINX, "203.0.113.77, " + CLIENT + ", 192.0.2.10");

        assertEquals(429, attempt(twoHopFilter, NGINX, "203.0.113.99, " + CLIENT + ", 192.0.2.10"));
        // outro cliente real atras da mesma borda nao e' afetado
        assertEquals(200, attempt(twoHopFilter, NGINX, "203.0.113.77, 198.51.100.8, 192.0.2.10"));

        // um cliente direto (par nao confiavel) se declarando o CLIENT saturado nao herda o balde dele...
        assertEquals(200, attempt(twoHopFilter, "198.51.100.50", CLIENT));
        // ...nem escapa do proprio balde variando o header
        saturate(twoHopFilter, "198.51.100.51", "203.0.113.1");
        assertEquals(429, attempt(twoHopFilter, "198.51.100.51", "203.0.113.2"));
    }

    // D - formatos da cadeia (politica final: N-esimo item a partir da direita)
    @Test
    void chainFormats_areResolvedPerFinalPolicy() throws Exception {
        saturate(oneHopFilter, NGINX, "203.0.113.10");        // "203.0.113.10" -> chave 203.0.113.10
        assertEquals(429, attempt(oneHopFilter, NGINX, "9.9.9.9, 203.0.113.10"));
        assertEquals(429, attempt(oneHopFilter, NGINX, "203.0.113.10:5000"));

        // "203.0.113.10, 10.0.0.2" com 1 salto -> chave 10.0.0.2 (o que o nginx viu), balde proprio
        assertEquals(200, attempt(oneHopFilter, NGINX, "203.0.113.10, 10.0.0.2"));
    }

    // Caminhos que nao sao de autenticacao nao passam por este limite por IP
    @Test
    void nonAuthPaths_areNotIpRateLimited() throws Exception {
        for (int i = 0; i < 30; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/work-orders");
            request.setRequestURI("/work-orders");
            request.setRemoteAddr(NGINX);
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            oneHopFilter.doFilter(request, response, chain);
            assertNotNull(chain.getRequest());
            assertNull(response.getErrorMessage());
        }
    }
}
