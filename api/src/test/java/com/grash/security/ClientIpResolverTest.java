package com.grash.security;

import com.grash.utils.Helper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Politica unica de "IP do cliente": o cliente nunca escolhe o IP.
 * Topologia coberta: cliente -> [borda] -> nginx do frontend -> backend. O par TCP do backend e' sempre o
 * nginx do frontend; cada proxy que ACRESCENTA ao X-Forwarded-For escreve o IP de quem o chamou no fim da lista.
 */
class ClientIpResolverTest {

    private static final String NGINX = "172.18.0.5";          // par TCP do backend (proxy confiavel)
    private static final String PUBLIC_DIRECT = "198.51.100.9"; // cliente chegando direto no backend

    private final ClientIpResolver oneHop = new ClientIpResolver(ClientIpResolver.DEFAULT_TRUSTED_PROXIES, 1);
    private final ClientIpResolver twoHops = new ClientIpResolver(ClientIpResolver.DEFAULT_TRUSTED_PROXIES, 2);

    @AfterEach
    void restoreDefaultPolicy() {
        Helper.setClientIpResolver(new ClientIpResolver());
    }

    private MockHttpServletRequest request(String remoteAddr, String... xForwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/signin");
        request.setRemoteAddr(remoteAddr);
        for (String value : xForwardedFor) request.addHeader("X-Forwarded-For", value);
        return request;
    }

    // --- cliente direto (par TCP nao confiavel): nenhum header vale ---

    @Test
    void directClient_cannotForgeIp_withAnyHeader() {
        MockHttpServletRequest request = request(PUBLIC_DIRECT, "203.0.113.77");
        request.addHeader("X-Real-IP", "203.0.113.78");
        request.addHeader("CF-Connecting-IP", "203.0.113.79");
        request.addHeader("True-Client-IP", "203.0.113.80");

        assertEquals(PUBLIC_DIRECT, oneHop.resolve(request));
        assertEquals(PUBLIC_DIRECT, twoHops.resolve(request));
    }

    // --- atras do nginx (1 proxy que acrescenta) ---

    @Test
    void behindNginx_usesTheAddressNginxAppended_notWhatTheClientSent() {
        // O cliente mandou "203.0.113.77"; o nginx acrescentou o IP que ele viu (198.51.100.7).
        assertEquals("198.51.100.7", oneHop.resolve(request(NGINX, "203.0.113.77, 198.51.100.7")));
        assertEquals("198.51.100.7", oneHop.resolve(request(NGINX, "203.0.113.78, 10.0.0.1, 198.51.100.7")));
    }

    @Test
    void behindNginx_realIpAndCdnHeadersAreIgnored() {
        MockHttpServletRequest request = request(NGINX, "198.51.100.7");
        request.addHeader("X-Real-IP", "203.0.113.99");
        request.addHeader("CF-Connecting-IP", "203.0.113.98");
        request.addHeader("True-Client-IP", "203.0.113.97");

        assertEquals("198.51.100.7", oneHop.resolve(request));
    }

    @Test
    void behindNginx_withoutForwardedHeader_fallsBackToTcpPeer() {
        assertEquals(NGINX, oneHop.resolve(request(NGINX)));
    }

    // --- cadeia com borda + nginx (2 proxies que acrescentam) ---

    @Test
    void behindEdgeAndNginx_twoHops_picksTheAddressTheEdgeAppended() {
        // cliente forjou "203.0.113.77"; a borda acrescentou o cliente real; o nginx acrescentou a borda.
        assertEquals("198.51.100.7",
                twoHops.resolve(request(NGINX, "203.0.113.77, 198.51.100.7, 192.0.2.10")));
    }

    @Test
    void multipleHeaderLines_areTreatedAsOneChain() {
        assertEquals("198.51.100.7",
                twoHops.resolve(request(NGINX, "203.0.113.77", "198.51.100.7", "192.0.2.10")));
    }

    // --- formatos da cadeia (cenario D) ---

    @Test
    void chainFormats_singleAddress_and_addressPlusProxy() {
        assertEquals("203.0.113.10", oneHop.resolve(request(NGINX, "203.0.113.10")));
        // "cliente, proxy": com 1 salto o cliente e' o ULTIMO item (o que o proprio nginx escreveu)...
        assertEquals("10.0.0.2", oneHop.resolve(request(NGINX, "203.0.113.10, 10.0.0.2")));
        // ...com 2 saltos (borda + nginx) o cliente e' o penultimo.
        assertEquals("203.0.113.10", twoHops.resolve(request(NGINX, "203.0.113.10, 10.0.0.2")));
    }

    @Test
    void chainShorterThanConfiguredHops_fallsBackToTcpPeer_neverToClientText() {
        // Configurado para 2 saltos, mas so' chegou 1 item: nao confia em nada do cabecalho.
        assertEquals(NGINX, twoHops.resolve(request(NGINX, "203.0.113.77")));
    }

    @Test
    void invalidOrGarbageEntries_fallBackToTcpPeer() {
        assertEquals(NGINX, oneHop.resolve(request(NGINX, "not-an-ip")));
        assertEquals(NGINX, oneHop.resolve(request(NGINX, "203.0.113.999")));
        assertEquals(NGINX, oneHop.resolve(request(NGINX, "unknown")));
        assertEquals(NGINX, oneHop.resolve(request(NGINX, "evil.example.com")));
        assertEquals(NGINX, oneHop.resolve(request(NGINX, ", ,")));
    }

    @Test
    void addressWithPortAndIpv6_areNormalised() {
        assertEquals("198.51.100.7", oneHop.resolve(request(NGINX, "198.51.100.7:51234")));
        assertEquals("2001:db8::1", oneHop.resolve(request(NGINX, "203.0.113.77, 2001:DB8::1")));
        assertEquals("2001:db8::1", oneHop.resolve(request(NGINX, "[2001:db8::1]:4711")));
    }

    // --- proxies confiaveis explicitos ---

    @Test
    void explicitTrustedProxyList_isHonoured_andOthersAreNot() {
        ClientIpResolver onlyEdge = new ClientIpResolver("192.0.2.0/24", 1);

        // peer dentro da faixa confiavel: usa o cabecalho
        assertEquals("198.51.100.7", onlyEdge.resolve(request("192.0.2.10", "203.0.113.77, 198.51.100.7")));
        // peer privado FORA da lista (p.ex. outro container/LAN): cabecalho ignorado
        assertEquals("172.18.0.5", onlyEdge.resolve(request("172.18.0.5", "203.0.113.77, 198.51.100.7")));
    }

    @Test
    void zeroHops_disablesForwardedHeaders() {
        ClientIpResolver noProxy = new ClientIpResolver(ClientIpResolver.DEFAULT_TRUSTED_PROXIES, 0);

        assertEquals(NGINX, noProxy.resolve(request(NGINX, "198.51.100.7")));
    }

    @Test
    void invalidTrustedProxyEntry_failsFast() {
        assertThrows(IllegalArgumentException.class, () -> new ClientIpResolver("not-a-cidr/99", 1));
    }

    @Test
    void ipv6TcpPeer_isSupported() {
        assertEquals("2001:db8::5", oneHop.resolve(request("2001:db8::5", "203.0.113.77")));
        assertEquals("198.51.100.7", oneHop.resolve(request("::1", "198.51.100.7")));
    }

    // --- Helper.extractClientIp usa a MESMA politica (uploads publicos, demo, mini-endpoints) ---

    @Test
    void helperExtractClientIp_usesTheSamePolicy() {
        Helper.setClientIpResolver(oneHop);

        assertEquals("198.51.100.7", Helper.extractClientIp(request(NGINX, "203.0.113.77, 198.51.100.7")));
        assertEquals(PUBLIC_DIRECT, Helper.extractClientIp(request(PUBLIC_DIRECT, "203.0.113.77")));
    }
}
