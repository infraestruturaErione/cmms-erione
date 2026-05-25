package com.grash.configuration;

import com.grash.security.CurrentUserResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;


@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private static final long MAX_AGE_SECS = 3600;
    private final CurrentUserResolver currentUserResolver;
    @Value("${frontend.url}")
    private String frontendUrl;
    @Value("${frontend.home-url}")
    private String frontendHomeUrl;
    @Value("${frontend.extra-origins}")
    private String extraOrigins;
    @Value("${security.cors.enabled}")
    private boolean enableCors;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        if (enableCors) {
            List<String> origins = new ArrayList<>();
            origins.add(frontendUrl);
            if (frontendHomeUrl != null && !frontendHomeUrl.isEmpty()) {
                origins.add(frontendHomeUrl);
            }
            if (extraOrigins != null && !extraOrigins.isEmpty()) {
                origins.addAll(Arrays.stream(extraOrigins.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .collect(Collectors.toList()));
            }
            registry.addMapping("/**")
                    .allowedOrigins(origins.toArray(new String[0]))
                    .allowedMethods("HEAD", "OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE")
                    .allowCredentials(true)
                    .maxAge(MAX_AGE_SECS);
        } else registry.addMapping("/**").allowedMethods("*");
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> argumentResolvers) {
        argumentResolvers.add(currentUserResolver);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/images/**")
                .addResourceLocations("classpath:/static/images/")
                .addResourceLocations("file:/app/static/images/")
                .addResourceLocations("file:/app/static/config/");
    }
}
