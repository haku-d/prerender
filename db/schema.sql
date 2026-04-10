\restrict 5BSGjW4a2xAMBct2em6QpSm6ubJj0kpWgzqDfeUHeR1BGcxnaHtAV37s4iCHD8C

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.12 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bot_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_requests (
    id integer NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    url text NOT NULL,
    path text NOT NULL,
    bot_name text NOT NULL,
    user_agent text NOT NULL,
    cache_status text NOT NULL,
    http_status integer NOT NULL,
    render_duration_ms integer
);


--
-- Name: bot_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_requests_id_seq OWNED BY public.bot_requests.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: bot_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_requests ALTER COLUMN id SET DEFAULT nextval('public.bot_requests_id_seq'::regclass);


--
-- Name: bot_requests bot_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_requests
    ADD CONSTRAINT bot_requests_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: idx_bot_requests_bot_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_requests_bot_name ON public.bot_requests USING btree (bot_name);


--
-- Name: idx_bot_requests_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_requests_path ON public.bot_requests USING btree (path);


--
-- Name: idx_bot_requests_requested_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_requests_requested_at ON public.bot_requests USING btree (requested_at);


--
-- PostgreSQL database dump complete
--

\unrestrict 5BSGjW4a2xAMBct2em6QpSm6ubJj0kpWgzqDfeUHeR1BGcxnaHtAV37s4iCHD8C


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20260401000000');
