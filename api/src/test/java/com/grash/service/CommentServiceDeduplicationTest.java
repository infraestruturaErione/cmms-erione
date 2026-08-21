package com.grash.service;

import com.grash.dto.comment.CommentPostDTO;
import com.grash.factory.MailServiceFactory;
import com.grash.mapper.CommentMapper;
import com.grash.model.Comment;
import com.grash.model.Company;
import com.grash.model.File;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.repository.CommentRepository;
import com.grash.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CommentServiceDeduplicationTest {

    private static final long WORK_ORDER_ID = 100L;
    private static final long USER_ID = 200L;
    private static final long COMPANY_ID = 300L;
    private static final String CONTENT = "[Relato em campo] Evidencia fotografica registrada.";

    @Mock
    private CommentRepository commentRepository;
    @Mock
    private CommentMapper commentMapper;
    @Mock
    private WorkOrderService workOrderService;
    @Mock
    private EntityManager entityManager;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private org.springframework.context.MessageSource messageSource;
    @Mock
    private MailServiceFactory mailServiceFactory;

    private CommentService commentService;
    private WorkOrder workOrder;
    private User user;
    private final AtomicLong commentIds = new AtomicLong(1L);

    @BeforeEach
    void setUp() {
        commentService = spy(new CommentService(commentRepository, commentMapper, workOrderService, entityManager,
                userRepository, notificationService, messageSource, mailServiceFactory));

        Company company = new Company();
        company.setId(COMPANY_ID);
        user = new User();
        user.setId(USER_ID);
        user.setCompany(company);

        workOrder = new WorkOrder();
        workOrder.setId(WORK_ORDER_ID);

        when(workOrderService.checkAccessToWorkOrderId(WORK_ORDER_ID, user)).thenReturn(workOrder);
        when(userRepository.findByIdInAndCompany_Id(anySet(), eq(COMPANY_ID))).thenReturn(List.of());
        doNothing().when(commentService).sendCommentNotifications(any(), any(), anySet(), any(), anyBoolean());
        when(commentMapper.fromPostDto(any())).thenAnswer(invocation -> {
            CommentPostDTO dto = invocation.getArgument(0);
            Comment comment = new Comment();
            comment.setWorkOrder(dto.getWorkOrder());
            comment.setContent(dto.getContent());
            comment.setFiles(new ArrayList<>(dto.getFiles()));
            return comment;
        });
        when(commentRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            Comment comment = invocation.getArgument(0);
            comment.setId(commentIds.getAndIncrement());
            return comment;
        });
    }

    @Test
    void sameWorkOrderUserContentAndFileIds_deduplicates() {
        Comment existing = comment(10L, 11L);
        whenRecentCandidates(existing);

        Comment result = commentService.create(request(10L, 11L), user);

        assertSame(existing, result);
        verify(commentMapper, never()).fromPostDto(any());
        verify(commentRepository, never()).saveAndFlush(any());
    }

    @Test
    void sameFileCountButDifferentIds_createsNewComment() {
        Comment existing = comment(10L, 11L);
        whenRecentCandidates(existing);

        Comment result = commentService.create(request(20L, 21L), user);

        assertNotSame(existing, result);
        verify(commentRepository).saveAndFlush(any());
    }

    @Test
    void sameIdsInDifferentOrder_deduplicatesDeterministically() {
        Comment existing = comment(10L, 11L);
        whenRecentCandidates(existing);

        Comment result = commentService.create(request(11L, 10L), user);

        assertSame(existing, result);
        verify(commentRepository, never()).saveAndFlush(any());
    }

    @Test
    void commonCommentWithoutFiles_preservesDeduplication() {
        Comment existing = comment();
        whenRecentCandidates(existing);

        Comment result = commentService.create(request(), user);

        assertSame(existing, result);
        verify(commentRepository, never()).saveAndFlush(any());
    }

    @Test
    void outsideTimeWindow_createsNewCommentAndKeepsEightSecondCutoff() {
        whenRecentCandidates();
        long beforeCall = System.currentTimeMillis();

        commentService.create(request(10L), user);

        long afterCall = System.currentTimeMillis();
        ArgumentCaptor<Date> cutoffCaptor = ArgumentCaptor.forClass(Date.class);
        verify(commentRepository).findByWorkOrder_IdAndUser_IdAndContentAndCreatedAtAfterOrderByCreatedAtDesc(
                eq(WORK_ORDER_ID), eq(USER_ID), eq(CONTENT), cutoffCaptor.capture());
        long cutoff = cutoffCaptor.getValue().getTime();
        assertTrue(cutoff >= beforeCall - 8_000L && cutoff <= afterCall - 8_000L);
        verify(commentRepository).saveAndFlush(any());
    }

    @Test
    void rapidEvidenceSubmissionsWithTwoDifferentPhotosEach_createTwoComments() {
        whenRecentCandidates();
        Comment first = commentService.create(request(10L, 11L), user);
        whenRecentCandidates(first);

        Comment second = commentService.create(request(20L, 21L), user);

        assertNotSame(first, second);
        verify(commentRepository, org.mockito.Mockito.times(2)).saveAndFlush(any());
    }

    private void whenRecentCandidates(Comment... comments) {
        when(commentRepository.findByWorkOrder_IdAndUser_IdAndContentAndCreatedAtAfterOrderByCreatedAtDesc(
                eq(WORK_ORDER_ID), eq(USER_ID), eq(CONTENT), any(Date.class)))
                .thenReturn(List.of(comments));
    }

    private CommentPostDTO request(Long... fileIds) {
        CommentPostDTO dto = new CommentPostDTO();
        dto.setWorkOrder(workOrder);
        dto.setContent(CONTENT);
        dto.setFiles(files(fileIds));
        return dto;
    }

    private Comment comment(Long... fileIds) {
        Comment comment = new Comment();
        comment.setWorkOrder(workOrder);
        comment.setUser(user);
        comment.setContent(CONTENT);
        comment.setFiles(files(fileIds));
        return comment;
    }

    private List<File> files(Long... ids) {
        return java.util.Arrays.stream(ids).map(id -> {
            File file = new File();
            file.setId(id);
            return file;
        }).toList();
    }
}
