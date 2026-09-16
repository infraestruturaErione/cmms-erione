package com.grash;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Smoke de inicializacao: sobe o ApplicationContext INTEIRO, do jeito que a
 * aplicacao real sobe.
 *
 * Existe por causa de um incidente concreto: uma dependencia morta
 * (TaskService -> WorkOrderService, declarada e nunca usada) fechou o ciclo
 * WorkOrderService -> WorkOrderCompletionValidator -> TaskService ->
 * WorkOrderService. Centenas de testes unitarios continuaram verdes, o
 * modulo compilava e a imagem Docker era construida normalmente - mas o
 * Spring recusava o contexto em producao com "Requested bean is currently in
 * creation: Is there an unresolvable circular reference?", e a API nao
 * iniciava. "mvn test verde" nao provava que a aplicacao sobe; este teste
 * prova.
 *
 * Por isso ele NAO pode mockar os services centrais: e' justamente a
 * instanciacao real de todos os beans (que e' onde o Spring detecta ciclo de
 * injecao por construtor) que da valor a ele. O banco H2 aqui e' so o
 * substrato minimo pro contexto subir - nada neste teste valida persistencia.
 *
 * Tambem NAO deve ser "consertado" ligando
 * spring.main.allow-circular-references=true: isso mascara a dependencia
 * incorreta em vez de remove-la.
 */
@SpringBootTest(
        classes = ApplicationContextStartupTest.FullComponentScanConfig.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        // H2 no lugar do Postgres: o objetivo e' instanciar beans, nao exercitar
        // SQL. MODE=PostgreSQL e' necessario porque a inicializacao da aplicacao
        // (ApiApplication.afterSingletonsInstantiated -> checkUsageBasedLimit)
        // executa query nativa com sintaxe de Postgres ("OFFSET ? LIMIT 1",
        // UserRepository) - preferimos ensinar o H2 a entende-la a mexer em SQL
        // de producao so' pra acomodar teste. NON_KEYWORDS=VALUE porque a coluna
        // Task.value colide com palavra reservada.
        "spring.datasource.url=jdbc:h2:mem:ctxStartupTest;MODE=PostgreSQL;"
                + "DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        // Dialeto de Postgres (e nao o de H2) de proposito: com MODE=PostgreSQL
        // o H2 rejeita TINYINT, que o H2Dialect emitiria. O par
        // "H2 em modo PG + PostgreSQLDialect" mantem o DDL igual ao de producao.
        "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
        // Liquibase e' Postgres-especifico; o schema aqui vem do proprio mapeamento.
        "spring.liquibase.enabled=false",
        "spring.sql.init.mode=never",
        // Quartz continua com job-store JDBC, igual em producao (trocar pra
        // "memory" mudaria o comportamento do startup e ainda esbarraria no
        // driverDelegateClass do application.yml, que o RAMJobStore nao aceita).
        // As tabelas QRTZ_* normalmente vem do Liquibase; aqui o proprio Spring
        // as cria no H2, e o delegate passa a ser o padrao em vez do de Postgres.
        "spring.quartz.job-store-type=jdbc",
        "spring.quartz.jdbc.initialize-schema=always",
        "spring.quartz.properties.org.quartz.jobStore.driverDelegateClass="
                + "org.quartz.impl.jdbcjobstore.StdJDBCDelegate",
        // Valores que o application.yml espera de variaveis de ambiente.
        "security.jwt.token.secret-key=ZXJpb25lLWNtbXMtY29udGV4dC1zdGFydHVwLXRlc3Qta2V5LW5vdC1mb3ItcHJvZHVjdGlvbi0wMTIzNDU2Nzg5",
        "security.invitation-via-email=false",
        "security.rate-limit.enabled=false",
        "frontend.url=http://localhost:3000",
        "api.host=http://localhost:8080",
        "mail.recipients=",
        "mail.enable=false",
        "storage.type=minio",
        "oauth2.provider=",
        "management.health.mail.enabled=false",
        "springdoc.api-docs.enabled=false",
        "springdoc.swagger-ui.enabled=false"
})
class ApplicationContextStartupTest {

    /**
     * Varre e instancia TODOS os @Component/@Service/@Repository/@Controller de
     * com.grash - que e' onde o Spring detecta ciclo de injecao por construtor,
     * o defeito que este smoke existe pra pegar.
     *
     * A unica classe excluida e' a propria ApiApplication, e nao por causa de
     * wiring: ela implementa SmartInitializingSingleton e, DEPOIS que todos os
     * singletons ja foram criados, roda inicializacao de dados que passa por
     * UserRepository.hasMorePaidUsersThan - uma @Query nativa com sintaxe
     * exclusiva de Postgres ("... OFFSET :threshold LIMIT 1") que o H2 nao
     * analisa nem em MODE=PostgreSQL. Preferimos excluir esse unico bean a
     * reescrever SQL de producao so' pra acomodar teste.
     *
     * O que fica de fora daqui (a inicializacao de dados e o startup real
     * contra Postgres/Liquibase) e' coberto pelo passo seguinte do pipeline:
     * subir o container e bater no /health de verdade. Este teste e' o guarda
     * rapido do grafo de beans; o container e' a prova final.
     */
    @Configuration
    @EnableAutoConfiguration
    @ComponentScan(
            basePackages = "com.grash",
            excludeFilters = {
                    @ComponentScan.Filter(
                            type = FilterType.ASSIGNABLE_TYPE,
                            classes = ApiApplication.class),
                    // As classes de teste ficam no mesmo pacote raiz e varias
                    // tem @Configuration aninhada com @EnableJpaRepositories
                    // proprio; sem excluir, elas registram os mesmos
                    // repositorios de novo e o contexto quebra por bean
                    // duplicado - ruido de teste, nao problema da aplicacao.
                    @ComponentScan.Filter(
                            type = FilterType.REGEX,
                            pattern = "com\\.grash\\..*Test(\\$.*)?")
            })
    static class FullComponentScanConfig {
    }

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void applicationContextStartsWithoutCircularReferences() {
        assertNotNull(applicationContext, "ApplicationContext deve ter sido criado");

        // Os tres beans do ciclo que derrubou a API. Pedi-los explicitamente
        // garante que a falha, se voltar, aponte pro lugar certo em vez de sair
        // como um erro generico de contexto.
        assertNotNull(applicationContext.getBean(com.grash.service.WorkOrderService.class));
        assertNotNull(applicationContext.getBean(com.grash.service.WorkOrderCompletionValidator.class));
        assertNotNull(applicationContext.getBean(com.grash.service.TaskService.class));

        // O job do Quartz tambem precisa ser injetavel - e' ele que gera OS de
        // Preventiva e que depende de TaskBaseService.
        assertNotNull(applicationContext.getBean(com.grash.job.WorkOrderCreationJob.class));
        assertNotNull(applicationContext.getBean(com.grash.service.TaskBaseService.class));

        assertTrue(applicationContext.getBeanDefinitionCount() > 0,
                "Contexto deve conter beans registrados");
    }

    @Test
    void circularReferencesWorkaroundStaysOff() {
        // Guarda-corpo: se alguem religar allow-circular-references pra fazer o
        // contexto subir, o smoke perde o sentido e este teste avisa.
        String allowCircular = applicationContext.getEnvironment()
                .getProperty("spring.main.allow-circular-references", "false");
        assertTrue("false".equalsIgnoreCase(allowCircular),
                "spring.main.allow-circular-references deve continuar desligado - "
                        + "ele mascara dependencia incorreta em vez de remove-la");
    }
}
