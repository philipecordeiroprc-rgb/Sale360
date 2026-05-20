--
-- PostgreSQL database dump
--

\restrict rHeMSYuieMp5EibDr8qdc1nyOhSE33QK8DpECFXOWFyoqELLbpqEazXTWZDmL97

-- Dumped from database version 17.10 (322a063)
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: CashType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CashType" AS ENUM (
    'IN',
    'OUT'
);


--
-- Name: CmdStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CmdStatus" AS ENUM (
    'OPEN',
    'CLOSED',
    'CANCELLED'
);


--
-- Name: CreditType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CreditType" AS ENUM (
    'LOAN',
    'PAYMENT',
    'PURCHASE',
    'TOPUP',
    'ADJUSTMENT'
);


--
-- Name: DeliveryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DeliveryStatus" AS ENUM (
    'PENDING',
    'PREPARING',
    'IN_TRANSIT',
    'DELIVERED',
    'CANCELLED'
);


--
-- Name: DimensionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DimensionType" AS ENUM (
    'TAMANHO_LETRA',
    'TAMANHO_NUMERO',
    'COR',
    'VOLUME',
    'PESO',
    'PERSONALIZADO'
);


--
-- Name: DiscountType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DiscountType" AS ENUM (
    'PERCENTAGE',
    'FIXED'
);


--
-- Name: MovementType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MovementType" AS ENUM (
    'INITIAL_STOCK',
    'PURCHASE_IN',
    'PURCHASE_CANCEL',
    'SALE_OUT',
    'SALE_CANCEL',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'TRANSFER'
);


--
-- Name: OrderSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderSource" AS ENUM (
    'PDV',
    'ONLINE',
    'WHATSAPP',
    'DELIVERY',
    'COMAND'
);


--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'COMPLETED',
    'CANCELLED',
    'REFUNDED',
    'PENDING'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PAID',
    'PENDING',
    'PARTIAL',
    'CREDIT_STORE'
);


--
-- Name: Plan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Plan" AS ENUM (
    'PRO',
    'GROW',
    'PRIME'
);


--
-- Name: PlatformRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlatformRole" AS ENUM (
    'USER',
    'SUPER_ADMIN'
);


--
-- Name: Provider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Provider" AS ENUM (
    'MERCADOPAGO',
    'WHATSAPP',
    'IFOOD',
    'GOOGLE_SHOPPING',
    'INSTAGRAM',
    'FACEBOOK',
    'CORREIOS'
);


--
-- Name: PurchaseStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PurchaseStatus" AS ENUM (
    'DRAFT',
    'CONFIRMED',
    'RECEIVED',
    'CANCELLED'
);


--
-- Name: Status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Status" AS ENUM (
    'TRIAL',
    'ACTIVE',
    'SUSPENDED',
    'CANCELLED'
);


--
-- Name: SyncStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SyncStatus" AS ENUM (
    'SYNCED',
    'PENDING',
    'CONFLICT',
    'FAILED'
);


--
-- Name: Unit; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Unit" AS ENUM (
    'UN',
    'KG',
    'G',
    'L',
    'M',
    'ML',
    'PC',
    'CX',
    'PAR',
    'FD',
    'PCT',
    'M2'
);


--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'OWNER',
    'MANAGER',
    'CASHIER'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cash_flows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_flows (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    type public."CashType" NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    "isRecurrent" boolean DEFAULT false NOT NULL,
    "recurrenceDay" integer,
    "dueDate" timestamp(3) without time zone NOT NULL,
    "paidAt" timestamp(3) without time zone,
    "orderId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    color text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "variationTemplateId" text
);


--
-- Name: command_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.command_items (
    id text NOT NULL,
    "commandId" text NOT NULL,
    "productId" text,
    "productName" text NOT NULL,
    quantity numeric(10,3) NOT NULL,
    "unitPrice" numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    notes text
);


--
-- Name: commission_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_items (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "userId" text NOT NULL,
    "productId" text,
    rate numeric(5,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: coupon_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_categories (
    "couponId" text NOT NULL,
    "categoryId" text NOT NULL
);


--
-- Name: coupon_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_products (
    "couponId" text NOT NULL,
    "productId" text NOT NULL
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    code text NOT NULL,
    description text,
    "discountType" public."DiscountType" NOT NULL,
    "discountValue" numeric(10,2) NOT NULL,
    "minOrderValue" numeric(10,2),
    "maxDiscount" numeric(10,2),
    "usageLimit" integer,
    "usageCount" integer DEFAULT 0 NOT NULL,
    "validFrom" timestamp(3) without time zone,
    "validUntil" timestamp(3) without time zone,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_transactions (
    id text NOT NULL,
    "customerId" text NOT NULL,
    type public."CreditType" NOT NULL,
    amount numeric(10,2) NOT NULL,
    "balanceAfter" numeric(10,2) NOT NULL,
    "referenceId" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    document text,
    "creditBalance" numeric(10,2) DEFAULT 0 NOT NULL,
    "totalPurchases" integer DEFAULT 0 NOT NULL,
    "totalSpent" numeric(10,2) DEFAULT 0 NOT NULL,
    "lastPurchaseAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliveries (
    id text NOT NULL,
    "orderId" text NOT NULL,
    address text NOT NULL,
    neighborhood text,
    city text,
    "zipCode" text,
    "deliveryFee" numeric(10,2),
    status public."DeliveryStatus" DEFAULT 'PENDING'::public."DeliveryStatus" NOT NULL,
    "driverName" text,
    "driverPhone" text,
    "pickupAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "estimatedTime" integer
);


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    "pushToken" text,
    "lastSyncAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integrations (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    provider public."Provider" NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "webhookUrl" text,
    "isActive" boolean DEFAULT true NOT NULL,
    config jsonb,
    "lastSyncAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_batches (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "productId" text,
    "variationId" text,
    "purchaseItemId" text,
    quantity numeric(10,3) NOT NULL,
    "remainingQty" numeric(10,3) NOT NULL,
    "unitCost" numeric(10,2) NOT NULL,
    "receivedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "productId" text,
    "variationId" text,
    type public."MovementType" NOT NULL,
    quantity numeric(10,3) NOT NULL,
    "unitCost" numeric(10,2),
    "totalCost" numeric(10,2),
    "batchId" text,
    "orderId" text,
    "purchaseId" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "productId" text,
    "productName" text NOT NULL,
    quantity numeric(10,3) NOT NULL,
    "unitPrice" numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    "costPrice" numeric(10,2),
    "totalCost" numeric(10,2),
    "variationId" text,
    "taxRate" numeric(5,2)
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "deviceId" text,
    "userId" text,
    "customerId" text,
    "orderNumber" integer NOT NULL,
    "localId" text,
    status public."OrderStatus" DEFAULT 'COMPLETED'::public."OrderStatus" NOT NULL,
    source public."OrderSource" DEFAULT 'PDV'::public."OrderSource" NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) NOT NULL,
    "paidAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "paymentMethod" text NOT NULL,
    "paymentStatus" public."PaymentStatus" DEFAULT 'PAID'::public."PaymentStatus" NOT NULL,
    "syncStatus" public."SyncStatus" DEFAULT 'SYNCED'::public."SyncStatus" NOT NULL,
    notes text,
    "createdAtDevice" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "customerName" text,
    "couponDiscount" numeric(10,2),
    "couponId" text,
    "dueDate" timestamp(3) without time zone
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id text NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: payment_method_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_method_configs (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "paymentMethod" text NOT NULL,
    "taxRate" numeric(5,2) NOT NULL
);


--
-- Name: product_variations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variations (
    id text NOT NULL,
    "productId" text NOT NULL,
    name text NOT NULL,
    "priceModifier" numeric(10,2) DEFAULT 0 NOT NULL,
    "stockQty" numeric(10,3) DEFAULT 0 NOT NULL,
    sku text,
    barcode text,
    "lowStockAt" numeric(10,3)
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    description text,
    sku text,
    barcode text,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    "costPrice" numeric(10,2),
    unit public."Unit" DEFAULT 'UN'::public."Unit" NOT NULL,
    "stockQty" numeric(10,3) DEFAULT 0 NOT NULL,
    "lowStockAt" numeric(10,3),
    "imageUrl" text,
    active boolean DEFAULT true NOT NULL,
    "isFractional" boolean DEFAULT false NOT NULL,
    "hasVariations" boolean DEFAULT false NOT NULL,
    "categoryId" text,
    "aiGenerated" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "taxRate" numeric(5,2),
    "operationalCost" numeric(10,2)
);


--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_items (
    id text NOT NULL,
    "purchaseId" text NOT NULL,
    "productId" text,
    "variationId" text,
    "productName" text NOT NULL,
    quantity numeric(10,3) NOT NULL,
    "unitCost" numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    "marginPct" numeric(5,2),
    "salePrice" numeric(10,2),
    "taxRatePct" numeric(5,2),
    "operationalCost" numeric(10,2)
);


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchases (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "supplierId" text NOT NULL,
    "orderNumber" integer NOT NULL,
    status public."PurchaseStatus" DEFAULT 'DRAFT'::public."PurchaseStatus" NOT NULL,
    notes text,
    subtotal numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) NOT NULL,
    "receivedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "customerId" text
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    cnpj text,
    ie text,
    email text,
    phone text,
    whatsapp text,
    "contactName" text,
    address text,
    "addressNumber" text,
    complement text,
    neighborhood text,
    city text,
    state text,
    "zipCode" text,
    notes text,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: table_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_commands (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "tableNumber" text NOT NULL,
    status public."CmdStatus" DEFAULT 'OPEN'::public."CmdStatus" NOT NULL,
    "customerName" text,
    "customerPhone" text,
    "openedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp(3) without time zone,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    discount numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    "paymentMethod" text,
    "paymentReceived" numeric(10,2)
);


--
-- Name: tenant_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_users (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "userId" text NOT NULL,
    role public."UserRole" DEFAULT 'CASHIER'::public."UserRole" NOT NULL,
    pin text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id text NOT NULL,
    slug text NOT NULL,
    "companyName" text NOT NULL,
    plan public."Plan" DEFAULT 'PRO'::public."Plan" NOT NULL,
    status public."Status" DEFAULT 'TRIAL'::public."Status" NOT NULL,
    "trialEndsAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "featureOverrides" jsonb
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    password text NOT NULL,
    "avatarUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    role public."PlatformRole" DEFAULT 'USER'::public."PlatformRole" NOT NULL
);


--
-- Name: variation_dimensions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variation_dimensions (
    id text NOT NULL,
    "templateId" text NOT NULL,
    type public."DimensionType" NOT NULL,
    label text NOT NULL,
    options text NOT NULL,
    "orderIndex" integer DEFAULT 0 NOT NULL
);


--
-- Name: variation_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variation_templates (
    id text NOT NULL,
    "tenantId" text,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: cash_flows cash_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flows
    ADD CONSTRAINT cash_flows_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: command_items command_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.command_items
    ADD CONSTRAINT command_items_pkey PRIMARY KEY (id);


--
-- Name: commission_items commission_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_items
    ADD CONSTRAINT commission_items_pkey PRIMARY KEY (id);


--
-- Name: coupon_categories coupon_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_categories
    ADD CONSTRAINT coupon_categories_pkey PRIMARY KEY ("couponId", "categoryId");


--
-- Name: coupon_products coupon_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_products
    ADD CONSTRAINT coupon_products_pkey PRIMARY KEY ("couponId", "productId");


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: deliveries deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);


--
-- Name: inventory_batches inventory_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_batches
    ADD CONSTRAINT inventory_batches_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: payment_method_configs payment_method_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method_configs
    ADD CONSTRAINT payment_method_configs_pkey PRIMARY KEY (id);


--
-- Name: product_variations product_variations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variations
    ADD CONSTRAINT product_variations_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: table_commands table_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_commands
    ADD CONSTRAINT table_commands_pkey PRIMARY KEY (id);


--
-- Name: tenant_users tenant_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: variation_dimensions variation_dimensions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_dimensions
    ADD CONSTRAINT variation_dimensions_pkey PRIMARY KEY (id);


--
-- Name: variation_templates variation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_templates
    ADD CONSTRAINT variation_templates_pkey PRIMARY KEY (id);


--
-- Name: cash_flows_tenantId_dueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cash_flows_tenantId_dueDate_idx" ON public.cash_flows USING btree ("tenantId", "dueDate");


--
-- Name: cash_flows_tenantId_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cash_flows_tenantId_type_idx" ON public.cash_flows USING btree ("tenantId", type);


--
-- Name: categories_tenantId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "categories_tenantId_name_key" ON public.categories USING btree ("tenantId", name);


--
-- Name: coupons_tenantId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "coupons_tenantId_code_key" ON public.coupons USING btree ("tenantId", code);


--
-- Name: coupons_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "coupons_tenantId_idx" ON public.coupons USING btree ("tenantId");


--
-- Name: customers_tenantId_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "customers_tenantId_phone_idx" ON public.customers USING btree ("tenantId", phone);


--
-- Name: deliveries_orderId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "deliveries_orderId_key" ON public.deliveries USING btree ("orderId");


--
-- Name: deliveries_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deliveries_status_idx ON public.deliveries USING btree (status);


--
-- Name: devices_tenantId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "devices_tenantId_name_key" ON public.devices USING btree ("tenantId", name);


--
-- Name: integrations_tenantId_provider_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "integrations_tenantId_provider_key" ON public.integrations USING btree ("tenantId", provider);


--
-- Name: inventory_batches_tenantId_productId_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_batches_tenantId_productId_receivedAt_idx" ON public.inventory_batches USING btree ("tenantId", "productId", "receivedAt");


--
-- Name: inventory_batches_tenantId_variationId_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_batches_tenantId_variationId_receivedAt_idx" ON public.inventory_batches USING btree ("tenantId", "variationId", "receivedAt");


--
-- Name: inventory_movements_tenantId_batchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_movements_tenantId_batchId_idx" ON public.inventory_movements USING btree ("tenantId", "batchId");


--
-- Name: inventory_movements_tenantId_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_movements_tenantId_orderId_idx" ON public.inventory_movements USING btree ("tenantId", "orderId");


--
-- Name: inventory_movements_tenantId_productId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_movements_tenantId_productId_createdAt_idx" ON public.inventory_movements USING btree ("tenantId", "productId", "createdAt");


--
-- Name: inventory_movements_tenantId_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_movements_tenantId_type_idx" ON public.inventory_movements USING btree ("tenantId", type);


--
-- Name: inventory_movements_tenantId_variationId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_movements_tenantId_variationId_createdAt_idx" ON public.inventory_movements USING btree ("tenantId", "variationId", "createdAt");


--
-- Name: orders_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "orders_tenantId_createdAt_idx" ON public.orders USING btree ("tenantId", "createdAt" DESC);


--
-- Name: orders_tenantId_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "orders_tenantId_customerId_idx" ON public.orders USING btree ("tenantId", "customerId");


--
-- Name: orders_tenantId_orderNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "orders_tenantId_orderNumber_idx" ON public.orders USING btree ("tenantId", "orderNumber");


--
-- Name: orders_tenantId_syncStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "orders_tenantId_syncStatus_idx" ON public.orders USING btree ("tenantId", "syncStatus");


--
-- Name: password_reset_tokens_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_reset_tokens_token_idx ON public.password_reset_tokens USING btree (token);


--
-- Name: password_reset_tokens_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX password_reset_tokens_token_key ON public.password_reset_tokens USING btree (token);


--
-- Name: payment_method_configs_tenantId_paymentMethod_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "payment_method_configs_tenantId_paymentMethod_key" ON public.payment_method_configs USING btree ("tenantId", "paymentMethod");


--
-- Name: products_tenantId_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "products_tenantId_active_idx" ON public.products USING btree ("tenantId", active);


--
-- Name: products_tenantId_barcode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "products_tenantId_barcode_idx" ON public.products USING btree ("tenantId", barcode);


--
-- Name: products_tenantId_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "products_tenantId_categoryId_idx" ON public.products USING btree ("tenantId", "categoryId");


--
-- Name: purchases_tenantId_orderNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "purchases_tenantId_orderNumber_idx" ON public.purchases USING btree ("tenantId", "orderNumber");


--
-- Name: purchases_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "purchases_tenantId_status_idx" ON public.purchases USING btree ("tenantId", status);


--
-- Name: suppliers_cnpj_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX suppliers_cnpj_key ON public.suppliers USING btree (cnpj);


--
-- Name: suppliers_tenantId_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "suppliers_tenantId_active_idx" ON public.suppliers USING btree ("tenantId", active);


--
-- Name: suppliers_tenantId_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "suppliers_tenantId_name_idx" ON public.suppliers USING btree ("tenantId", name);


--
-- Name: table_commands_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "table_commands_tenantId_status_idx" ON public.table_commands USING btree ("tenantId", status);


--
-- Name: tenant_users_tenantId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "tenant_users_tenantId_userId_key" ON public.tenant_users USING btree ("tenantId", "userId");


--
-- Name: tenants_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: cash_flows cash_flows_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flows
    ADD CONSTRAINT "cash_flows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: categories categories_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: categories categories_variationTemplateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "categories_variationTemplateId_fkey" FOREIGN KEY ("variationTemplateId") REFERENCES public.variation_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: command_items command_items_commandId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.command_items
    ADD CONSTRAINT "command_items_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES public.table_commands(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: commission_items commission_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_items
    ADD CONSTRAINT "commission_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: coupon_categories coupon_categories_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_categories
    ADD CONSTRAINT "coupon_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: coupon_categories coupon_categories_couponId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_categories
    ADD CONSTRAINT "coupon_categories_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES public.coupons(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: coupon_products coupon_products_couponId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_products
    ADD CONSTRAINT "coupon_products_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES public.coupons(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: coupon_products coupon_products_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_products
    ADD CONSTRAINT "coupon_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: coupons coupons_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT "coupons_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: credit_transactions credit_transactions_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT "credit_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: customers customers_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: deliveries deliveries_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT "deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: devices devices_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: integrations integrations_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT "integrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_batches inventory_batches_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_batches
    ADD CONSTRAINT "inventory_batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_batches inventory_batches_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_batches
    ADD CONSTRAINT "inventory_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_batches inventory_batches_variationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_batches
    ADD CONSTRAINT "inventory_batches_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES public.product_variations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT "inventory_movements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public.inventory_batches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT "inventory_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT "inventory_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_variationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT "inventory_movements_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES public.product_variations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: order_items order_items_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order_items order_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: order_items order_items_variationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "order_items_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES public.product_variations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_couponId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES public.coupons(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: orders orders_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: password_reset_tokens password_reset_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payment_method_configs payment_method_configs_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method_configs
    ADD CONSTRAINT "payment_method_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_variations product_variations_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variations
    ADD CONSTRAINT "product_variations_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: products products_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_items purchase_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT "purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_items purchase_items_purchaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES public.purchases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_items purchase_items_variationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT "purchase_items_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES public.product_variations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchases purchases_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT "purchases_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchases purchases_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT "purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchases purchases_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT "purchases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: suppliers suppliers_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: table_commands table_commands_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_commands
    ADD CONSTRAINT "table_commands_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_users tenant_users_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT "tenant_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_users tenant_users_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT "tenant_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: variation_dimensions variation_dimensions_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_dimensions
    ADD CONSTRAINT "variation_dimensions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.variation_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: variation_templates variation_templates_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_templates
    ADD CONSTRAINT "variation_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict rHeMSYuieMp5EibDr8qdc1nyOhSE33QK8DpECFXOWFyoqELLbpqEazXTWZDmL97

