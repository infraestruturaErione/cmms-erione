package com.grash.controller;

import com.grash.factory.StorageServiceFactory;
import com.grash.mapper.FileMapper;
import com.grash.model.Comment;
import com.grash.model.Company;
import com.grash.model.File;
import com.grash.model.Role;
import com.grash.model.User;
import com.grash.model.WorkOrder;
import com.grash.model.abstracts.DateAudit;
import com.grash.model.enums.FileType;
import com.grash.model.enums.RoleType;
import com.grash.repository.CommentRepository;
import com.grash.repository.FileReferenceChecker;
import com.grash.repository.FileRepository;
import com.grash.service.AssetService;
import com.grash.service.FileService;
import com.grash.service.LicenseService;
import com.grash.service.LocationService;
import com.grash.service.PartService;
import com.grash.service.RateLimiterService;
import com.grash.service.RequestPortalService;
import com.grash.service.RequestService;
import com.grash.service.StorageService;
import com.grash.service.TaskService;
import com.grash.service.UserService;
import com.grash.service.WorkOrderService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DataJpaTest
@ContextConfiguration(classes = FileCleanupEvidenceIntegrationTest.TestJpaConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.liquibase.enabled=false"
})
class FileCleanupEvidenceIntegrationTest {
    @Configuration
    @EnableAutoConfiguration
    @EntityScan(basePackages = "com.grash.model")
    @EnableJpaRepositories(basePackages = "com.grash.repository")
    @Import({FileService.class, FileReferenceChecker.class})
    static class TestJpaConfig {
    }

    @Autowired
    private EntityManager entityManager;
    @Autowired
    private FileRepository fileRepository;
    @Autowired
    private CommentRepository commentRepository;
    @Autowired
    private FileService fileService;

    @MockBean
    private AssetService assetService;
    @MockBean
    private PartService partService;
    @MockBean
    private RequestService requestService;
    @MockBean
    private LocationService locationService;
    @MockBean
    private WorkOrderService workOrderService;

    private MockMvc mockMvc;
    private StorageService storageService;
    private Company company;
    private User uploader;
    private WorkOrder workOrder;

    @BeforeEach
    void setUp() {
        company = persistCompany();
        Role role = persistRole();
        uploader = persistUser(role);
        workOrder = persistWorkOrder();
        entityManager.flush();

        StorageServiceFactory storageServiceFactory = mock(StorageServiceFactory.class);
        storageService = mock(StorageService.class);
        UserService userService = mock(UserService.class);
        when(storageServiceFactory.getStorageService()).thenReturn(storageService);
        when(userService.whoami(org.mockito.ArgumentMatchers.any())).thenReturn(uploader);

        FileController controller = new FileController(
                storageServiceFactory,
                fileService,
                userService,
                mock(TaskService.class),
                workOrderService,
                mock(FileMapper.class),
                mock(LicenseService.class),
                mock(RequestPortalService.class),
                mock(RateLimiterService.class)
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void lostCommentResponse_cleanupKeepsFilesCommentAndWorkOrderAssociation() throws Exception {
        File file10 = persistFile("evidence-10.jpg");
        File file11 = persistFile("evidence-11.jpg");
        Comment comment = persistComment(file10, file11);
        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(post("/files/cleanup-unused")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload(file10.getId(), file11.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removed").isEmpty())
                .andExpect(jsonPath("$.skipped[0].fileId").value(file10.getId()))
                .andExpect(jsonPath("$.skipped[0].reason").value("IN_USE"))
                .andExpect(jsonPath("$.skipped[1].fileId").value(file11.getId()))
                .andExpect(jsonPath("$.skipped[1].reason").value("IN_USE"));

        assertTrue(fileRepository.existsById(file10.getId()));
        assertTrue(fileRepository.existsById(file11.getId()));
        Comment persistedComment = commentRepository.findById(comment.getId()).orElseThrow();
        assertEquals(List.of(file10.getId(), file11.getId()),
                persistedComment.getFiles().stream().map(File::getId).toList());
        assertEquals(workOrder.getId(), persistedComment.getWorkOrder().getId());
        verify(storageService, never()).delete(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void trulyUnassociatedFilesAreRemovedFromDatabase() throws Exception {
        File orphan10 = persistFile("orphan-10.jpg");
        File orphan11 = persistFile("orphan-11.jpg");
        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(post("/files/cleanup-unused")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload(orphan10.getId(), orphan11.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removed[0]").value(orphan10.getId()))
                .andExpect(jsonPath("$.removed[1]").value(orphan11.getId()))
                .andExpect(jsonPath("$.skipped").isEmpty());

        assertFalse(fileRepository.existsById(orphan10.getId()));
        assertFalse(fileRepository.existsById(orphan11.getId()));
        verify(storageService).delete(orphan10.getPath());
        verify(storageService).delete(orphan11.getPath());
    }

    @Test
    void mixedAssociatedAndOrphanFilesOnlyRemoveTheOrphan() throws Exception {
        File associated = persistFile("associated.jpg");
        File orphan = persistFile("orphan.jpg");
        persistComment(associated);
        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(post("/files/cleanup-unused")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload(associated.getId(), orphan.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removed[0]").value(orphan.getId()))
                .andExpect(jsonPath("$.skipped[0].fileId").value(associated.getId()))
                .andExpect(jsonPath("$.skipped[0].reason").value("IN_USE"));

        assertTrue(fileRepository.existsById(associated.getId()));
        assertFalse(fileRepository.existsById(orphan.getId()));
        verify(storageService, never()).delete(associated.getPath());
        verify(storageService).delete(orphan.getPath());
    }

    private Company persistCompany() {
        Company entity = new Company();
        entity.setName("Company A");
        stamp(entity);
        entityManager.persist(entity);
        return entity;
    }

    private Role persistRole() {
        Role role = new Role();
        role.setName("Technician");
        role.setRoleType(RoleType.ROLE_CLIENT);
        entityManager.persist(role);
        return role;
    }

    private User persistUser(Role role) {
        User user = new User();
        user.setFirstName("Field");
        user.setLastName("Technician");
        user.setEmail("field-technician@test.local");
        user.setUsername("field-technician@test.local");
        user.setPassword("test");
        user.setRole(role);
        user.setCompany(company);
        stamp(user);
        entityManager.persist(user);
        return user;
    }

    private WorkOrder persistWorkOrder() {
        WorkOrder entity = new WorkOrder();
        entity.setTitle("WO evidence cleanup test");
        entity.setCompany(company);
        stamp(entity);
        entityManager.persist(entity);
        return entity;
    }

    private File persistFile(String name) {
        File file = new File();
        file.setName(name);
        file.setPath("company " + company.getId() + "/" + name);
        file.setType(FileType.IMAGE);
        file.setCompany(company);
        file.setCreatedBy(uploader.getId());
        stamp(file);
        entityManager.persist(file);
        return file;
    }

    private Comment persistComment(File... files) {
        Comment comment = new Comment();
        comment.setCompany(company);
        comment.setCreatedBy(uploader.getId());
        comment.setUser(uploader);
        comment.setWorkOrder(workOrder);
        comment.setContent("[Relato em campo] Evidencia fotografica registrada.");
        comment.setFiles(new ArrayList<>(List.of(files)));
        stamp(comment);
        entityManager.persist(comment);
        return comment;
    }

    private void stamp(DateAudit entity) {
        Date now = new Date();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
    }

    private String payload(Long... ids) {
        return "{\"fileIds\":[" + String.join(",", List.of(ids).stream().map(String::valueOf).toList()) + "]}";
    }
}
