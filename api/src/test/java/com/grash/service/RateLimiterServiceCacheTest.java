package com.grash.service;

import com.github.benmanes.caffeine.cache.Ticker;
import io.github.bucket4j.Bucket;
import org.junit.jupiter.api.Test;

import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Os baldes por IP/usuario nao podem crescer sem limite quando alguem varia a chave (IP):
 * antes eram ConcurrentHashMap sem teto nem expiracao; agora cache com tamanho maximo e expiracao.
 */
class RateLimiterServiceCacheTest {

    private static class FakeTicker implements Ticker {
        private final AtomicLong nanos = new AtomicLong();

        @Override
        public long read() {
            return nanos.get();
        }

        void advance(Duration duration) {
            nanos.addAndGet(duration.toNanos());
        }
    }

    // Fora do Spring os @Value ficam 0; o balde autenticado exige valores positivos (mesmos padroes do application.yml).
    private static RateLimiterService withDefaults(RateLimiterService service) {
        ReflectionTestUtils.setField(service, "authenticatedShortTermRequests", 100);
        ReflectionTestUtils.setField(service, "authenticatedShortTermPeriodMinutes", 1);
        ReflectionTestUtils.setField(service, "authenticatedLongTermRequests", 1000);
        ReflectionTestUtils.setField(service, "authenticatedLongTermPeriodHours", 1);
        return service;
    }

    // E - o numero de chaves rastreadas respeita o teto, mesmo com muitas chaves distintas (IPs variados)
    @Test
    void trackedKeys_neverExceedTheConfiguredMaximum() {
        RateLimiterService service = new RateLimiterService(100, Ticker.systemTicker());

        for (int i = 0; i < 5_000; i++) {
            service.resolveAuthAttemptBucket("auth-ip:198.51." + (i / 256) + "." + (i % 256));
        }

        assertTrue(service.trackedKeyCount() <= 100,
                "chaves rastreadas: " + service.trackedKeyCount());
    }

    @Test
    void everyBucketFamily_isBounded() {
        RateLimiterService service = withDefaults(new RateLimiterService(50, Ticker.systemTicker()));

        for (int i = 0; i < 1_000; i++) {
            String key = "k" + i;
            service.resolveAuthAttemptBucket(key);
            service.resolveDemoBucket(key);
            service.resolveFileUploadBucket(key);
            service.resolvePublicMiniBucket(key);
            service.resolveAuthenticatedUserBucket(key);
        }

        assertTrue(service.trackedKeyCount() <= 5 * 50, "chaves rastreadas: " + service.trackedKeyCount());
    }

    // E - baldes inativos expiram; ativos permanecem (mesma instancia, mesmo consumo)
    @Test
    void idleBuckets_expire_activeBucketsStay() {
        FakeTicker ticker = new FakeTicker();
        RateLimiterService service = new RateLimiterService(1_000, ticker);

        Bucket idle = service.resolveAuthAttemptBucket("auth-ip:198.51.100.1");
        Bucket active = service.resolveAuthAttemptBucket("auth-ip:198.51.100.2");
        assertEquals(2, service.trackedKeyCount());

        ticker.advance(Duration.ofHours(12));
        assertSame(active, service.resolveAuthAttemptBucket("auth-ip:198.51.100.2")); // acesso renova o prazo
        ticker.advance(Duration.ofHours(13));                                        // idle: 25h sem uso

        assertEquals(1, service.trackedKeyCount());
        assertSame(active, service.resolveAuthAttemptBucket("auth-ip:198.51.100.2"));
        assertNotSame(idle, service.resolveAuthAttemptBucket("auth-ip:198.51.100.1")); // recriado, cheio
    }

    // A expiracao (24h) e' maior que a maior janela de reposicao, logo nao da' "reset" de graca ao atacante:
    // o balde por hora do login (60/h) ja teria se reposto por completo quando expira.
    @Test
    void expiration_isLongerThanTheLongestRefillWindow() {
        assertTrue(RateLimiterService.IDLE_EXPIRATION.compareTo(Duration.ofHours(5)) > 0);
    }

    // O limite em si nao mudou: 10 por minuto para tentativas de autenticacao.
    @Test
    void authAttemptLimit_isStillTenPerMinute() {
        RateLimiterService service = new RateLimiterService();
        Bucket bucket = service.resolveAuthAttemptBucket("auth-ip:198.51.100.7");

        for (int i = 0; i < 10; i++) assertTrue(bucket.tryConsume(1));
        assertFalse(bucket.tryConsume(1));
        // a mesma chave devolve o MESMO balde (nao um novo a cada chamada)
        assertSame(bucket, service.resolveAuthAttemptBucket("auth-ip:198.51.100.7"));
    }
}
