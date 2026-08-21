package com.grash.repository;

import com.grash.model.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.Date;
import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long>,
        JpaSpecificationExecutor<Comment> {

    long countByWorkOrderId(Long workOrderId);

    List<Comment> findByWorkOrder_IdInAndContentStartingWithOrderByCreatedAtDesc(Collection<Long> workOrderIds,
                                                                                 String contentPrefix);

    // Usado para detectar reenvio duplicado (retry de rede/duplo clique) do
    // mesmo relato de campo em uma janela curta de tempo.
    List<Comment> findByWorkOrder_IdAndUser_IdAndContentAndCreatedAtAfterOrderByCreatedAtDesc(
            Long workOrderId, Long userId, String content, Date after);
}
