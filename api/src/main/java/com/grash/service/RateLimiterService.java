package com.grash.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

@Component
public class RateLimiterService {

    // Baldes por chave (IP/usuario) ficam em caches LIMITADOS e com expiracao: antes eram ConcurrentHashMap
    // sem teto, e quem variasse a chave (IP) fazia o mapa crescer sem limite. A expiracao por inatividade (24h)
    // e' maior que a maior janela de reposicao (demo: 5h), entao um balde que expira ja estaria cheio de novo -
    // o limite continua o mesmo. Se o teto for atingido o Caffeine descarta os menos usados.
    static final int DEFAULT_MAX_TRACKED_KEYS = 50_000;
    static final Duration IDLE_EXPIRATION = Duration.ofHours(24);

    private final Cache<String, Bucket> demoCache;
    private final Cache<String, Bucket> fileUploadCache;
    private final Cache<String, Bucket> publicMiniCache;
    private final Cache<String, Bucket> authenticatedUserCache;
    private final Cache<String, Bucket> authAttemptCache;

    public RateLimiterService() {
        this(DEFAULT_MAX_TRACKED_KEYS, Ticker.systemTicker());
    }

    // Visivel ao pacote para os testes (teto pequeno e relogio controlavel).
    RateLimiterService(int maxTrackedKeys, Ticker ticker) {
        this.demoCache = newCache(maxTrackedKeys, ticker);
        this.fileUploadCache = newCache(maxTrackedKeys, ticker);
        this.publicMiniCache = newCache(maxTrackedKeys, ticker);
        this.authenticatedUserCache = newCache(maxTrackedKeys, ticker);
        this.authAttemptCache = newCache(maxTrackedKeys, ticker);
    }

    private static Cache<String, Bucket> newCache(int maxTrackedKeys, Ticker ticker) {
        return Caffeine.newBuilder()
                .maximumSize(maxTrackedKeys)
                .expireAfterAccess(IDLE_EXPIRATION)
                .ticker(ticker)
                .build();
    }

    long trackedKeyCount() {
        long total = 0;
        for (Cache<String, Bucket> cache : List.of(demoCache, fileUploadCache, publicMiniCache,
                authenticatedUserCache, authAttemptCache)) {
            cache.cleanUp();
            total += cache.estimatedSize();
        }
        return total;
    }

    /**
     * -- GETTER --
     * Check if rate limiting is enabled
     */
    @Getter
    @Value("${security.rate-limit.enabled:true}")
    private boolean rateLimitEnabled;

    @Value("${security.rate-limit.authenticated.short-term-requests:100}")
    private int authenticatedShortTermRequests;

    @Value("${security.rate-limit.authenticated.short-term-period-minutes:1}")
    private int authenticatedShortTermPeriodMinutes;

    @Value("${security.rate-limit.authenticated.long-term-requests:1000}")
    private int authenticatedLongTermRequests;

    @Value("${security.rate-limit.authenticated.long-term-period-hours:1}")
    private int authenticatedLongTermPeriodHours;

    public Bucket resolveDemoBucket(String key) {
        return demoCache.get(key, this::newDemoBucket);
    }

    public Bucket resolveFileUploadBucket(String key) {
        return fileUploadCache.get(key, this::newFileUploadBucket);
    }

    public Bucket resolvePublicMiniBucket(String key) {
        return publicMiniCache.get(key, this::newPublicMiniBucket);
    }

    private Bucket newDemoBucket(String key) {
        // 1 request per minute
        Bandwidth onePerMinute = Bandwidth.classic(1, Refill.greedy(1, Duration.ofMinutes(1)));

        // 2 requests per 5 hours
        Bandwidth twoPer5Hours = Bandwidth.classic(2, Refill.greedy(2, Duration.ofHours(5)));

        return Bucket.builder()
                .addLimit(onePerMinute)
                .addLimit(twoPer5Hours)
                .build();
    }

    private Bucket newFileUploadBucket(String key) {
        // 1 requests per minute
        Bandwidth tenPerMinute = Bandwidth.classic(4, Refill.greedy(1, Duration.ofMinutes(1)));

        // 4 requests per hour
        Bandwidth fiftyPerHour = Bandwidth.classic(12, Refill.greedy(12, Duration.ofHours(1)));

        return Bucket.builder()
                .addLimit(tenPerMinute)
                .addLimit(fiftyPerHour)
                .build();
    }

    private Bucket newPublicMiniBucket(String key) {
        // 3 requests per minute
        Bandwidth thirtyPerMinute = Bandwidth.classic(10, Refill.greedy(10, Duration.ofMinutes(1)));

        //20
        Bandwidth twoHundredPerHour = Bandwidth.classic(60, Refill.greedy(60, Duration.ofHours(1)));

        return Bucket.builder()
                .addLimit(thirtyPerMinute)
                .addLimit(twoHundredPerHour)
                .build();
    }

    /**
     * Resolve rate limit bucket for authenticated users by user ID
     */
    public Bucket resolveAuthenticatedUserBucket(String userId) {
        return authenticatedUserCache.get(userId, this::newAuthenticatedUserBucket);
    }

    /**
     * Resolve rate limit bucket for unauthenticated auth attempts (login / password reset), keyed by client IP.
     * Protects against brute-force and email-spam on public endpoints that carry no user identity yet.
     */
    public Bucket resolveAuthAttemptBucket(String ipKey) {
        return authAttemptCache.get(ipKey, this::newAuthAttemptBucket);
    }

    private Bucket newAuthAttemptBucket(String key) {
        // 10 attempts per minute (bursts of legit retries / users behind shared NAT)
        Bandwidth perMinute = Bandwidth.classic(10, Refill.greedy(10, Duration.ofMinutes(1)));
        // 60 attempts per hour (hard ceiling against sustained brute-force)
        Bandwidth perHour = Bandwidth.classic(60, Refill.greedy(60, Duration.ofHours(1)));
        return Bucket.builder()
                .addLimit(perMinute)
                .addLimit(perHour)
                .build();
    }

    private Bucket newAuthenticatedUserBucket(String key) {
        // Short-term limit: e.g., 100 requests per minute
        Bandwidth shortTerm = Bandwidth.classic(
                authenticatedShortTermRequests,
                Refill.greedy(authenticatedShortTermRequests, Duration.ofMinutes(authenticatedShortTermPeriodMinutes))
        );

        // Long-term limit: e.g., 1000 requests per hour
        Bandwidth longTerm = Bandwidth.classic(
                authenticatedLongTermRequests,
                Refill.greedy(authenticatedLongTermRequests, Duration.ofHours(authenticatedLongTermPeriodHours))
        );

        return Bucket.builder()
                .addLimit(shortTerm)
                .addLimit(longTerm)
                .build();
    }
}
