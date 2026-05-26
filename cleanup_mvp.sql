-- ============================================================
-- LIMPEZA DE DADOS OPERACIONAIS MVP - ATLAS CMMS
-- Erione / Município Piloto
-- Gerado em: 2026-05-14
-- 
-- Uso:
--   docker exec -i atlas_db psql -U rootUser -d atlas < cleanup_mvp.sql
--
-- ATENÇÃO: Backup já realizado via pg_dump antes da execução.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. TABELAS OPERACIONAIS (DELETE DE TODOS OS REGISTROS)
-- ============================================================

-- work_order_history (CASCADE para work_order, mas sem registros)
DELETE FROM work_order_history;

-- work_order_files (CASCADE para work_order)
DELETE FROM work_order_files;

-- work_order_customers (CASCADE para work_order)
DELETE FROM work_order_customers;

-- work_order_assigned_to (CASCADE para work_order)
DELETE FROM work_order_assigned_to;

-- labor (CASCADE para work_order)
DELETE FROM labor;

-- additional_cost (CASCADE para work_order, se houver FK)
DELETE FROM additional_cost;

-- comment_files (CASCADE para comment)
DELETE FROM comment_files;

-- comment (CASCADE para work_order)
DELETE FROM comment;

-- work_order_aud (audit - sem FK restritiva para work_order)
DELETE FROM work_order_aud;

-- revinfo (tabela de revisão Hibernate Envers)
DELETE FROM revinfo;

-- work_order
DELETE FROM work_order;

-- notifications vinculadas a work_orders
DELETE FROM notification;

-- request_files (CASCADE para request)
DELETE FROM request_files;

-- request_customers (CASCADE para request)
DELETE FROM request_customers;

-- request_assigned_to (CASCADE para request)
DELETE FROM request_assigned_to;

-- t_request_file_associations (CASCADE para request)
DELETE FROM t_request_file_associations;

-- request
DELETE FROM request;

-- t_work_order_file_associations (CASCADE para work_order)
DELETE FROM t_work_order_file_associations;

-- t_asset_file_associations (CASCADE para asset)
DELETE FROM t_asset_file_associations;

-- t_asset_customer_associations (CASCADE para asset)
DELETE FROM t_asset_customer_associations;

-- t_asset_part_associations (CASCADE para asset)
DELETE FROM t_asset_part_associations;

-- t_asset_team_associations (CASCADE para asset)
DELETE FROM t_asset_team_associations;

-- t_asset_user_associations (CASCADE para asset)
DELETE FROM t_asset_user_associations;

-- t_asset_vendor_associations (CASCADE para asset)
DELETE FROM t_asset_vendor_associations;

-- asset_downtime (CASCADE para asset)
DELETE FROM asset_downtime;

-- asset
DELETE FROM asset;

-- t_location_file_associations (CASCADE para location)
DELETE FROM t_location_file_associations;

-- t_location_customer_associations (CASCADE para location)
DELETE FROM t_location_customer_associations;

-- t_location_team_associations (CASCADE para location)
DELETE FROM t_location_team_associations;

-- t_location_user_associations (CASCADE para location)
DELETE FROM t_location_user_associations;

-- t_location_vendor_associations (CASCADE para location)
DELETE FROM t_location_vendor_associations;

-- floor_plan (FK para location)
DELETE FROM floor_plan;

-- location (auto-referenciada, primeiro remove sem parent)
UPDATE location SET parent_location_id = NULL WHERE parent_location_id IS NOT NULL;
DELETE FROM location;

-- customer
DELETE FROM customer;

-- vendor
DELETE FROM vendor;

-- part_consumption (CASCADE para company)
DELETE FROM part_consumption;

-- part_quantity (CASCADE para company)
DELETE FROM part_quantity;

-- multi_parts (CASCADE para company)
DELETE FROM multi_parts;

-- t_multi_parts_part_associations
DELETE FROM t_multi_parts_part_associations;

-- t_part_customer_associations (CASCADE para part)
DELETE FROM t_part_customer_associations;

-- t_part_file_associations (CASCADE para part)
DELETE FROM t_part_file_associations;

-- t_part_team_associations (CASCADE para part)
DELETE FROM t_part_team_associations;

-- t_part_user_associations (CASCADE para part)
DELETE FROM t_part_user_associations;

-- t_part_vendor_associations (CASCADE para part)
DELETE FROM t_part_vendor_associations;

-- part
DELETE FROM part;

-- part_category
DELETE FROM part_category;

-- purchase_order (CASCADE para company)
DELETE FROM purchase_order;

-- purchase_order_category (CASCADE para company)
DELETE FROM purchase_order_category;

-- cost_category (CASCADE para company)
DELETE FROM cost_category;

-- time_category (CASCADE para company)
DELETE FROM time_category;

-- meter_category (CASCADE para company)
DELETE FROM meter_category;

-- meter (CASCADE para company)
DELETE FROM meter;

-- reading
DELETE FROM reading;

-- preventive_maintenance (CASCADE para company)
DELETE FROM preventive_maintenance;

-- preventive_maintenance_assigned_to
DELETE FROM preventive_maintenance_assigned_to;

-- preventive_maintenance_customers
DELETE FROM preventive_maintenance_customers;

-- preventive_maintenance_files
DELETE FROM preventive_maintenance_files;

-- schedule (CASCADE para company)
DELETE FROM schedule;

-- schedule_days_of_week
DELETE FROM schedule_days_of_week;

-- work_order_meter_trigger (CASCADE para company)
DELETE FROM work_order_meter_trigger;

-- work_order_meter_trigger_assigned_to
DELETE FROM work_order_meter_trigger_assigned_to;

-- work_order_meter_trigger_customers
DELETE FROM work_order_meter_trigger_customers;

-- work_order_meter_trigger_files
DELETE FROM work_order_meter_trigger_files;

-- checklist
DELETE FROM checklist;

-- checklist_task_bases
DELETE FROM checklist_task_bases;

-- task (CASCADE para company)
DELETE FROM task;

-- task_base (CASCADE para company)
DELETE FROM task_base;

-- task_option (CASCADE para company)
DELETE FROM task_option;

-- team (CASCADE para company)
DELETE FROM team;

-- deprecation (CASCADE para company)
DELETE FROM deprecation;

-- workflow (CASCADE para company)
DELETE FROM workflow;

-- workflow_action (CASCADE para company)
DELETE FROM workflow_action;

-- workflow_condition (CASCADE para company)
DELETE FROM workflow_condition;

-- workflow_secondary_conditions
DELETE FROM workflow_secondary_conditions;

-- relation (CASCADE para company)
DELETE FROM relation;

-- user_invitation (dados de convite, manter? apenas 1 registro do superadmin)
DELETE FROM user_invitation;

-- custom_field_value (CASCADE para asset/location/customer)
DELETE FROM custom_field_value;

-- ============================================================
-- 2. ARQUIVOS OPERACIONAIS (manter apenas logo da empresa)
--    file id=2 é usado como logo da company 2. Manter.
-- ============================================================
-- Atualizar referências de file para NULL antes de deletar
UPDATE company SET logo_id = NULL WHERE logo_id IS NOT NULL AND logo_id NOT IN (SELECT id FROM file WHERE id = 2);
-- Deletar apenas arquivos não usados por configurações do sistema
DELETE FROM file WHERE id NOT IN (SELECT logo_id FROM company WHERE logo_id IS NOT NULL);

-- ============================================================
-- 3. CATEGORIAS (se desejar remover categorias piloto)
--    Descomentar as linhas abaixo se quiser remover categorias
--    Asset: Camera IP, Camera Dome, Camera Bullet, Camera PTZ
--    WO: Manutenção corretiva, Vistoria
-- ============================================================
-- DELETE FROM asset_category;
-- DELETE FROM work_order_category;

COMMIT;

-- ============================================================
-- 4. RESET DE SEQUENCES
-- ============================================================
BEGIN;

-- Hibernate sequences (reset para próximo valor seguro)
ALTER SEQUENCE work_order_seq RESTART WITH 1;
ALTER SEQUENCE asset_seq RESTART WITH 1;
ALTER SEQUENCE location_seq RESTART WITH 1;
ALTER SEQUENCE customer_seq RESTART WITH 1;
ALTER SEQUENCE comment_seq RESTART WITH 1;
ALTER SEQUENCE labor_seq RESTART WITH 1;
ALTER SEQUENCE asset_category_seq RESTART WITH 1;
ALTER SEQUENCE work_order_category_seq RESTART WITH 1;
ALTER SEQUENCE notification_seq RESTART WITH 1;
ALTER SEQUENCE request_seq RESTART WITH 1;
ALTER SEQUENCE file_seq RESTART WITH 1;
ALTER SEQUENCE user_invitation_seq RESTART WITH 1;
ALTER SEQUENCE revinfo_revision_id_seq RESTART WITH 1;

COMMIT;

-- ============================================================
-- 5. RESET DE CUSTOM SEQUENCE (contadores de custom_id)
-- ============================================================
BEGIN;
UPDATE custom_sequence SET
    work_order_sequence = 1,
    asset_sequence = 1,
    preventive_maintenance_sequence = 1,
    location_sequence = 1,
    request_sequence = 1
WHERE id = 1;
COMMIT;
