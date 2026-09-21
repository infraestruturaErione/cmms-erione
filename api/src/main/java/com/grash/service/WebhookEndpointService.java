package com.grash.service;

import com.grash.dto.license.LicenseEntitlement;
import com.grash.dto.webhookEndpoint.WebhookEndpointPatchDTO;
import com.grash.dto.webhookEndpoint.WebhookEndpointPostDTO;
import com.grash.exception.CustomException;
import com.grash.mapper.WebhookEndpointMapper;
import com.grash.model.*;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.PlanFeatures;
import com.grash.repository.WebhookEndpointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class WebhookEndpointService {

    private final WebhookEndpointRepository webhookEndpointRepository;
    private final WebhookEndpointMapper webhookEndpointMapper;
    private final LicenseService licenseService;

    // Liga o gerenciamento de webhooks nesta instalacao. Desligado por padrao: a instalacao
    // interna nao usa o modulo, entao a API de gerenciamento fica fechada ate alguem habilitar
    // (WEBHOOK_MANAGEMENT_ENABLED=true) de proposito. MANTER false na Erione ate serem tratados:
    // PATCH parcial que zera campos, ids de categorias de outra empresa aceitos na criacao e
    // SSRF no envio (URL sem bloqueio de faixas internas).
    @Value("${webhook.management-enabled:false}")
    private boolean managementEnabled;

    /**
     * Regra unica de quem pode gerenciar webhooks (criar, listar, editar, excluir, rotacionar
     * segredo): modulo habilitado na instalacao + licenca + plano da empresa + permissao SETTINGS.
     * Todas as operacoes passam por aqui pra nao haver metodo com regra diferente.
     */
    private void assertCanManage(User user) {
        if (!(managementEnabled
                && licenseService.hasEntitlement(LicenseEntitlement.WEBHOOK)
                && user.getRole().getViewPermissions().contains(PermissionEntity.SETTINGS)
                && user.getCompany().getSubscription().getSubscriptionPlan().getFeatures()
                .contains(PlanFeatures.WEBHOOK)))
            throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
    }

    // Lookup sempre restrito a empresa do usuario. "Nao existe" e "e de outra empresa" sao
    // indistinguiveis (404) - nao revela a existencia de recurso alheio.
    private WebhookEndpoint findOwned(Long id, User user) {
        return webhookEndpointRepository.findByIdAndCompanyId(id, user.getCompany().getId())
                .orElseThrow(() -> new CustomException("Webhook endpoint not found", HttpStatus.NOT_FOUND));
    }

    public WebhookEndpoint create(WebhookEndpointPostDTO webhookEndpointReq, User user) {
        assertCanManage(user);
        if (webhookEndpointReq.getEvent().name().contains("_CHANGE"))
            webhookEndpointReq.setSerialize(true);
        WebhookEndpoint webhookEndpoint = webhookEndpointMapper.fromPostDto(webhookEndpointReq);
        webhookEndpoint.setSecret(generateWebhookSecret());
        return webhookEndpointRepository.save(webhookEndpoint);
    }

    public List<WebhookEndpoint> getActiveEndpoints(User user) {
        assertCanManage(user);
        return webhookEndpointRepository.findByCompanyIdAndEnabled(user.getCompany().getId(), true);
    }

    public WebhookEndpoint update(Long id, WebhookEndpointPatchDTO webhookEndpointReq, User user) {
        assertCanManage(user);
        WebhookEndpoint savedWebhookEndpoint = findOwned(id, user);
        WebhookEndpoint webhookEndpoint1 = webhookEndpointMapper.updateWebhookEndpoint(savedWebhookEndpoint,
                webhookEndpointReq);
        return webhookEndpointRepository.save(webhookEndpoint1);
    }

    public void delete(Long id, User user) {
        assertCanManage(user);
        webhookEndpointRepository.delete(findOwned(id, user));
    }

    public String rotateSecret(Long endpointId, User user) {
        assertCanManage(user);
        WebhookEndpoint endpoint = findOwned(endpointId, user);

        String newSecret = generateWebhookSecret();
        endpoint.setSecret(newSecret);
        webhookEndpointRepository.save(endpoint);

        return newSecret;
    }

    private String generateWebhookSecret() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return "whsec_" + HexFormat.of().formatHex(bytes);
    }

}