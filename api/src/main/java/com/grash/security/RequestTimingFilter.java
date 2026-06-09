package com.grash.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
public class RequestTimingFilter extends OncePerRequestFilter {
    @Value("${observability.request-timing.enabled:true}")
    private boolean enabled;

    @Value("${observability.request-timing.slow-threshold-ms:1000}")
    private long slowThresholdMs;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!enabled) {
            filterChain.doFilter(request, response);
            return;
        }

        long startedAt = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = System.currentTimeMillis() - startedAt;
            int status = response.getStatus();
            if (durationMs >= slowThresholdMs || status >= 500) {
                log.warn("http_request method={} path={} status={} durationMs={} remote={}",
                        request.getMethod(),
                        request.getRequestURI(),
                        status,
                        durationMs,
                        request.getRemoteAddr());
            }
        }
    }
}
