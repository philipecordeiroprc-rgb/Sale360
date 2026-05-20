--
-- PostgreSQL database cluster dump
--

\restrict 2IRE9kDjqlxLWRk80x2jDCGEV1Nt7shdTypefGc00RxC41qbhEomfYthdqThvS6

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE cloud_admin;
ALTER ROLE cloud_admin WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS;
CREATE ROLE neon_service;
ALTER ROLE neon_service WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS;
CREATE ROLE neon_superuser;
ALTER ROLE neon_superuser WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB NOLOGIN REPLICATION BYPASSRLS;
CREATE ROLE neondb_owner;
ALTER ROLE neondb_owner WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS;

--
-- User Configurations
--


--
-- Role memberships
--

GRANT neon_superuser TO neon_service WITH INHERIT TRUE GRANTED BY cloud_admin;
GRANT neon_superuser TO neondb_owner WITH INHERIT TRUE GRANTED BY cloud_admin;
GRANT pg_create_subscription TO neon_superuser WITH INHERIT TRUE GRANTED BY cloud_admin;
GRANT pg_monitor TO neon_superuser WITH ADMIN OPTION, INHERIT TRUE GRANTED BY cloud_admin;
GRANT pg_read_all_data TO neon_superuser WITH INHERIT TRUE GRANTED BY cloud_admin;
GRANT pg_signal_backend TO neon_superuser WITH ADMIN OPTION, INHERIT TRUE GRANTED BY cloud_admin;
GRANT pg_write_all_data TO neon_superuser WITH INHERIT TRUE GRANTED BY cloud_admin;




\unrestrict 2IRE9kDjqlxLWRk80x2jDCGEV1Nt7shdTypefGc00RxC41qbhEomfYthdqThvS6

--
-- PostgreSQL database cluster dump complete
--

