package com.grash.service;


import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.grash.dto.BrandConfig;
import com.grash.dto.license.LicenseEntitlement;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class BrandingService {

    private final ObjectMapper objectMapper;
    private final LicenseService licenseService;
    @Value("${white-labeling.custom-colors:#{null}}")
    private String customColors;
    @Value("${white-labeling.brand-config:#{null}}")
    private String brandRawConfig;

    public String getMailBackgroundColor() {
        String backgroundColor = "#5569ff";
        if (customColors != null && !customColors.isEmpty()) {
            ObjectMapper mapper = new ObjectMapper();
            try {
                JsonNode node = mapper.readTree(customColors);
                backgroundColor = node.get("emailColors").asText();
            } catch (Exception e) {
                log.warn("Failed to parse custom branding colors", e);
            }
        }
        return backgroundColor;
    }

    public BrandConfig getBrandConfig() {
        BrandConfig defaultConfig = BrandConfig.builder()
                .name("Erione CMMS")
                .shortName("Erione")
                .website("https://erione.com.br")
                .mail("contato@erione.com.br")
                .phone("")
                .addressStreet("")
                .addressCity("")
                .build();
        if (!licenseService.hasEntitlement(LicenseEntitlement.BRANDING)) return defaultConfig;
        if (brandRawConfig == null || brandRawConfig.isEmpty()) {
            return defaultConfig;
        } else {
            try {
                return objectMapper.readValue(brandRawConfig, BrandConfig.class);
            } catch (Exception e) {
                return defaultConfig;
            }
        }
    }
}
