package com.grash.exception;

import com.grash.dto.SuccessResponse;
import com.grash.dto.WorkOrderCompletionErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.error.ErrorAttributeOptions;
import org.springframework.boot.web.servlet.error.DefaultErrorAttributes;
import org.springframework.boot.web.servlet.error.ErrorAttributes;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.xml.bind.ValidationException;

import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandlerController {

    @Bean
    public ErrorAttributes errorAttributes() {
        return new DefaultErrorAttributes() {
            @Override
            public Map<String, Object> getErrorAttributes(WebRequest webRequest, ErrorAttributeOptions options) {
                return super.getErrorAttributes(webRequest,
                        ErrorAttributeOptions.defaults().excluding(ErrorAttributeOptions.Include.EXCEPTION));
            }
        };
    }

    @ExceptionHandler(CustomException.class)
    public ResponseEntity<SuccessResponse> handleCustomException(HttpServletResponse res, CustomException ex) {
        log.warn("Business rule violation: {}", ex.getMessage());
        return new ResponseEntity<>(new SuccessResponse(false, ex.getMessage()), ex.getHttpStatus());
    }

    // Handler dedicado, separado do CustomException/SuccessResponse
    // existentes - a WorkOrder que nao atende os requisitos de conclusao
    // (Sprint 3B) responde 409 com a lista de codigos estaveis do que falta,
    // nao so uma mensagem generica.
    @ExceptionHandler(WorkOrderCompletionException.class)
    public ResponseEntity<WorkOrderCompletionErrorResponse> handleWorkOrderCompletionException(
            WorkOrderCompletionException ex) {
        log.warn("Work order completion requirements not met: {}", ex.getMissingRequirements());
        return new ResponseEntity<>(new WorkOrderCompletionErrorResponse(false, ex.getMessage(),
                ex.getMissingRequirements()), HttpStatus.CONFLICT);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<SuccessResponse> handleAccessDeniedException(HttpServletResponse res) {
        return new ResponseEntity<>(new SuccessResponse(false, "Access is denied"), HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<SuccessResponse> handleHttpRequestMethodNotSupportedException(HttpServletResponse res,
                                                                                        Exception ex) {
        return new ResponseEntity<>(new SuccessResponse(false, ex.getMessage()), HttpStatus.METHOD_NOT_ALLOWED);
    }

    @ResponseBody
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(ValidationException.class)
    ResponseEntity<SuccessResponse> handleValidationException(ValidationException ex) {
        return new ResponseEntity<>(new SuccessResponse(false, ex.getMessage()), HttpStatus.BAD_REQUEST);
    }

    @ResponseBody
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<SuccessResponse> handleMethodArgumentNotValidException(MethodArgumentNotValidException ex) {
        return new ResponseEntity<>(new SuccessResponse(false, ex.getMessage()), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<SuccessResponse> handleMaxUploadSizeExceededException(HttpServletResponse res,
                                                                                 MaxUploadSizeExceededException ex) {
        return new ResponseEntity<>(new SuccessResponse(false, "Arquivo muito grande. O tamanho máximo permitido é " +
                "35MB."), HttpStatus.PAYLOAD_TOO_LARGE);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<SuccessResponse> handleException(HttpServletResponse res, Exception ex) {
        log.error("Unexpected error", ex);
        return new ResponseEntity<>(new SuccessResponse(false, "Erro interno do servidor."), HttpStatus.INTERNAL_SERVER_ERROR);
    }

}

