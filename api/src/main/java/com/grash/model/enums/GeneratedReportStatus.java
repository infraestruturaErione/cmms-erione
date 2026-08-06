package com.grash.model.enums;

// Hoje a geracao e sempre sincrona (o request so retorna quando o PDF ja
// esta pronto), entao todo registro nasce direto em DONE. QUEUED/PROCESSING
// existem so pra nao exigir migration nova se um dia a geracao virar
// assincrona (fila/worker em background).
public enum GeneratedReportStatus {
    QUEUED,
    PROCESSING,
    DONE,
    FAILED
}
