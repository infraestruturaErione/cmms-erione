package com.grash.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.grash.exception.CustomException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeepSeekChatClient {
    private final ObjectMapper objectMapper;

    @Value("${DEEPSEEK_API_KEY:}")
    private String apiKey;

    @Value("${DEEPSEEK_BASE_URL:https://api.deepseek.com}")
    private String baseUrl;

    @Value("${DEEPSEEK_MODEL:deepseek-chat}")
    private String model;

    public String chat(List<Map<String, String>> messages, boolean jsonMode) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new CustomException("DeepSeek nao configurado no backend", HttpStatus.SERVICE_UNAVAILABLE);
        }

        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        Map<String, Object> payload = new HashMap<>();
        payload.put("model", model);
        payload.put("messages", messages);
        payload.put("temperature", jsonMode ? 0.1 : 0.2);
        payload.put("max_tokens", jsonMode ? 500 : 1200);
        if (jsonMode) {
            payload.put("response_format", Map.of("type", "json_object"));
        }

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    baseUrl + "/chat/completions",
                    HttpMethod.POST,
                    new HttpEntity<>(payload, headers),
                    String.class
            );
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
            if (contentNode.isMissingNode() || contentNode.asText().isBlank()) {
                throw new CustomException("DeepSeek retornou resposta vazia", HttpStatus.BAD_GATEWAY);
            }
            return contentNode.asText();
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Erro ao chamar DeepSeek", ex);
            throw new CustomException("Falha ao consultar o DeepSeek", HttpStatus.BAD_GATEWAY);
        }
    }
}
