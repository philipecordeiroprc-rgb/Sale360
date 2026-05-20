--
-- PostgreSQL database dump
--

\restrict y3FrHXU79dj8gnkuxjTlqaVJ9RiQ8ahhiWTUIlRcSqCNF7K9ow94d2N6GP0xZDi

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
-- Data for Name: cash_flows; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.cash_flows (id, "tenantId", type, category, description, amount, "isRecurrent", "recurrenceDay", "dueDate", "paidAt", "orderId", "createdAt") VALUES ('cmpdimdot0025kdwbviaioxsr', 'cmpcsv29u0000kd30i9w2arj4', 'IN', 'venda', 'Venda #1', 60.00, false, NULL, '2026-05-20 03:41:46.06', '2026-05-20 03:41:46.06', 'cmpdimdly0021kdwb6bzofxf3', '2026-05-20 03:41:46.061');
INSERT INTO public.cash_flows (id, "tenantId", type, category, description, amount, "isRecurrent", "recurrenceDay", "dueDate", "paidAt", "orderId", "createdAt") VALUES ('cmpdkqn7w003nkdwbpkt2wwm8', 'cmpcsv29u0000kd30i9w2arj4', 'IN', 'venda', 'Venda #2', 30.00, false, NULL, '2026-05-20 04:41:04.268', '2026-05-20 04:41:04.268', 'cmpdkqn5e003jkdwbfnjffvn8', '2026-05-20 04:41:04.269');


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.categories (id, "tenantId", name, color, "sortOrder", "variationTemplateId") VALUES ('cmpd2cejx0001kdwbe40g4yby', 'cmpcsv29u0000kd30i9w2arj4', 'Doce de Leite Trufado', NULL, 0, 'cmpbh80dj000zuylovmqts17c');
INSERT INTO public.categories (id, "tenantId", name, color, "sortOrder", "variationTemplateId") VALUES ('cmpd2d9od0003kdwbuck5ledi', 'cmpcsv29u0000kd30i9w2arj4', 'Doce de Pote', NULL, 0, 'cmpbh80dj000zuylovmqts17c');
INSERT INTO public.categories (id, "tenantId", name, color, "sortOrder", "variationTemplateId") VALUES ('cmpd2drcy0005kdwb9gevuysg', 'cmpcsv29u0000kd30i9w2arj4', 'Embutidos', NULL, 0, 'cmpbh80dj000zuylovmqts17c');


--
-- Data for Name: command_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: commission_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: coupon_categories; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: coupon_products; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.coupon_products ("couponId", "productId") VALUES ('cmpdmr9je0009kdue9a4iar12', 'cmpd2ld1q000bkdwb89s7fx4w');


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.coupons (id, "tenantId", code, description, "discountType", "discountValue", "minOrderValue", "maxDiscount", "usageLimit", "usageCount", "validFrom", "validUntil", active, "createdAt", "updatedAt") VALUES ('cmpdmr9je0009kdue9a4iar12', 'cmpcsv29u0000kd30i9w2arj4', 'PROMO10', '10% nos doces', 'PERCENTAGE', 10.00, NULL, NULL, NULL, 0, '2026-05-20 00:00:00', '2026-05-22 00:00:00', true, '2026-05-20 05:37:32.427', '2026-05-20 05:39:25.454');


--
-- Data for Name: credit_transactions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.customers (id, "tenantId", name, phone, email, document, "creditBalance", "totalPurchases", "totalSpent", "lastPurchaseAt", notes, "createdAt", "updatedAt") VALUES ('cmpdjju1q002rkdwbvuhmqffl', 'cmpcsv29u0000kd30i9w2arj4', 'Philipe', '21981821078', NULL, '', 0.00, 0, 0.00, NULL, '', '2026-05-20 04:07:46.911', '2026-05-20 04:07:46.911');


--
-- Data for Name: deliveries; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: devices; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.devices (id, "tenantId", name, type, "pushToken", "lastSyncAt", "createdAt") VALUES ('cmpdjfh4o0027kdwbnw8h7zkt', 'cmpbh7yfp0000uylo0bdk6o7y', 'web_1779249863304_qs0lik', 'mobile', NULL, '2026-05-20 04:06:17.591', '2026-05-20 04:04:23.544');
INSERT INTO public.devices (id, "tenantId", name, type, "pushToken", "lastSyncAt", "createdAt") VALUES ('cmpdjgdcv002hkdwbetjmz9nx', 'cmpbh7yfp0000uylo0bdk6o7y', 'web_1779249905190_h22o5s', 'mobile', NULL, '2026-05-20 04:06:34.044', '2026-05-20 04:05:05.312');
INSERT INTO public.devices (id, "tenantId", name, type, "pushToken", "lastSyncAt", "createdAt") VALUES ('cmpdgqkkv000ykdwbutw8oyfd', 'cmpcsv29u0000kd30i9w2arj4', 'web_1779245343145_uk9nd7', 'mobile', NULL, '2026-05-20 13:23:48.046', '2026-05-20 02:49:02.383');
INSERT INTO public.devices (id, "tenantId", name, type, "pushToken", "lastSyncAt", "createdAt") VALUES ('cmpdjpfaq002tkdwb2t9pdwf4', 'cmpcsv29u0000kd30i9w2arj4', 'web_1779249905190_h22o5s', 'mobile', NULL, '2026-05-20 14:17:36.886', '2026-05-20 04:12:07.73');


--
-- Data for Name: integrations; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: inventory_batches; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.inventory_batches (id, "tenantId", "productId", "variationId", "purchaseItemId", quantity, "remainingQty", "unitCost", "receivedAt", "createdAt") VALUES ('cmpd3h4xb000ukdwbzynesrg7', 'cmpcsv29u0000kd30i9w2arj4', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4wq000skdwbzoblcuiu', 'cmpd3gukz000kkdwbq986hci4', 3.000, 3.000, 10.00, '2026-05-19 20:37:47.018', '2026-05-19 20:37:47.184');
INSERT INTO public.inventory_batches (id, "tenantId", "productId", "variationId", "purchaseItemId", quantity, "remainingQty", "unitCost", "receivedAt", "createdAt") VALUES ('cmpdia8ob0017kdwbnorns4sd', 'cmpcsv29u0000kd30i9w2arj4', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4t4000mkdwb40ruhy6i', 'cmpdia3tx0014kdwb04bdg9l3', 4.000, 4.000, 15.00, '2026-05-20 03:32:19.668', '2026-05-20 03:32:19.692');
INSERT INTO public.inventory_batches (id, "tenantId", "productId", "variationId", "purchaseItemId", quantity, "remainingQty", "unitCost", "receivedAt", "createdAt") VALUES ('cmpdia8qi001bkdwbmp8qow5l', 'cmpcsv29u0000kd30i9w2arj4', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4wq000skdwbzoblcuiu', 'cmpdia3tx0015kdwbov7qc8ol', 4.000, 4.000, 15.00, '2026-05-20 03:32:19.668', '2026-05-20 03:32:19.77');
INSERT INTO public.inventory_batches (id, "tenantId", "productId", "variationId", "purchaseItemId", quantity, "remainingQty", "unitCost", "receivedAt", "createdAt") VALUES ('cmpd3h4uf000okdwbnbe19vbj', 'cmpcsv29u0000kd30i9w2arj4', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4t4000mkdwb40ruhy6i', 'cmpd3gukz000jkdwb0q5a30u7', 3.000, 1.000, 10.00, '2026-05-19 20:37:47.018', '2026-05-19 20:37:47.08');


--
-- Data for Name: inventory_movements; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.inventory_movements (id, "tenantId", "productId", "variationId", type, quantity, "unitCost", "totalCost", "batchId", "orderId", "purchaseId", notes, "createdAt") VALUES ('cmpd3h4v7000qkdwb07xd4bzf', 'cmpcsv29u0000kd30i9w2arj4', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4t4000mkdwb40ruhy6i', 'PURCHASE_IN', 3.000, 10.00, 30.00, NULL, NULL, 'cmpd3gukz000hkdwbqgg3owpk', 'Compra #1 - Cocada Cremosa - 250g', '2026-05-19 20:37:47.107');
INSERT INTO public.inventory_movements (id, "tenantId", "productId", "variationId", type, quantity, "unitCost", "totalCost", "batchId", "orderId", "purchaseId", notes, "createdAt") VALUES ('cmpd3h4xg000wkdwb4m60g628', 'cmpcsv29u0000kd30i9w2arj4', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4wq000skdwbzoblcuiu', 'PURCHASE_IN', 3.000, 10.00, 30.00, NULL, NULL, 'cmpd3gukz000hkdwbqgg3owpk', 'Compra #1 - Cocada Cremosa - 500g', '2026-05-19 20:37:47.189');
INSERT INTO public.inventory_movements (id, "tenantId", "productId", "variationId", type, quantity, "unitCost", "totalCost", "batchId", "orderId", "purchaseId", notes, "createdAt") VALUES ('cmpdia8or0019kdwboot394lu', 'cmpcsv29u0000kd30i9w2arj4', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4t4000mkdwb40ruhy6i', 'PURCHASE_IN', 4.000, 15.00, 60.00, NULL, NULL, 'cmpdia3tx0012kdwbwncl3uv8', 'Compra #2 - Cocada Cremosa - 250g', '2026-05-20 03:32:19.707');
INSERT INTO public.inventory_movements (id, "tenantId", "productId", "variationId", type, quantity, "unitCost", "totalCost", "batchId", "orderId", "purchaseId", notes, "createdAt") VALUES ('cmpdia8qn001dkdwbqh89dtk9', 'cmpcsv29u0000kd30i9w2arj4', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4wq000skdwbzoblcuiu', 'PURCHASE_IN', 4.000, 15.00, 60.00, NULL, NULL, 'cmpdia3tx0012kdwbwncl3uv8', 'Compra #2 - Cocada Cremosa - 500g', '2026-05-20 03:32:19.775');
INSERT INTO public.inventory_movements (id, "tenantId", "productId", "variationId", type, quantity, "unitCost", "totalCost", "batchId", "orderId", "purchaseId", notes, "createdAt") VALUES ('cmpdimdjq001zkdwbvu1n6gz9', 'cmpcsv29u0000kd30i9w2arj4', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4t4000mkdwb40ruhy6i', 'SALE_OUT', -2.000, 10.00, -20.00, 'cmpd3h4uf000okdwbnbe19vbj', 'cmpdimdly0021kdwb6bzofxf3', NULL, 'Venda #1 - Cocada Cremosa - 250g', '2026-05-20 03:41:45.879');


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.order_items (id, "orderId", "productId", "productName", quantity, "unitPrice", total, "costPrice", "totalCost", "variationId", "taxRate") VALUES ('cmpdimdly0023kdwbiogp4o04', 'cmpdimdly0021kdwb6bzofxf3', 'cmpd2ld1q000bkdwb89s7fx4w', 'Cocada Cremosa - 250g', 2.000, 30.00, 60.00, 10.00, 20.00, 'cmpd3h4t4000mkdwb40ruhy6i', 0.00);
INSERT INTO public.order_items (id, "orderId", "productId", "productName", quantity, "unitPrice", total, "costPrice", "totalCost", "variationId", "taxRate") VALUES ('cmpdkqn5f003lkdwb64mlf84k', 'cmpdkqn5e003jkdwbfnjffvn8', 'cmpd2ld1q000bkdwb89s7fx4w', 'Cocada Cremosa - 250g', 1.000, 30.00, 30.00, NULL, NULL, NULL, NULL);


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.orders (id, "tenantId", "deviceId", "userId", "customerId", "orderNumber", "localId", status, source, subtotal, discount, total, "paidAmount", "paymentMethod", "paymentStatus", "syncStatus", notes, "createdAtDevice", "createdAt", "customerName", "couponDiscount", "couponId", "dueDate") VALUES ('cmpdimdly0021kdwb6bzofxf3', 'cmpcsv29u0000kd30i9w2arj4', NULL, 'cmpbmhxcg0000uyqg3okot21f', NULL, 1, 'local_1779248506633_spiywj', 'COMPLETED', 'PDV', 60.00, 0.00, 60.00, 0.00, 'Debito', 'PAID', 'SYNCED', NULL, NULL, '2026-05-20 03:41:45.958', 'Jorge', NULL, NULL, NULL);
INSERT INTO public.orders (id, "tenantId", "deviceId", "userId", "customerId", "orderNumber", "localId", status, source, subtotal, discount, total, "paidAmount", "paymentMethod", "paymentStatus", "syncStatus", notes, "createdAtDevice", "createdAt", "customerName", "couponDiscount", "couponId", "dueDate") VALUES ('cmpdkqn5e003jkdwbfnjffvn8', 'cmpcsv29u0000kd30i9w2arj4', 'web_1779249905190_h22o5s', NULL, 'cmpdjju1q002rkdwbvuhmqffl', 2, 'local_1779252051727_cmu7p1', 'COMPLETED', 'PDV', 30.00, 0.00, 30.00, 30.00, 'Pix', 'PAID', 'SYNCED', NULL, '2026-05-20 04:40:51.739', '2026-05-20 04:41:04.179', NULL, NULL, NULL, NULL);


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.password_reset_tokens (id, "userId", token, "expiresAt", "usedAt", "createdAt") VALUES ('cmpbhapmw0001uy740kohc8ip', 'cmpbh7yy70002uyloxiyqf6a5', 'e066f9b4488b3b50eed5f2b4e84a2766ac632810ce80b7e0938c72a5fae1082b', '2026-05-18 18:29:09.7', NULL, '2026-05-18 17:29:09.703');


--
-- Data for Name: payment_method_configs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.payment_method_configs (id, "tenantId", "paymentMethod", "taxRate") VALUES ('cmpdilfrg001fkdwb97zre817', 'cmpcsv29u0000kd30i9w2arj4', 'cash', 0.00);
INSERT INTO public.payment_method_configs (id, "tenantId", "paymentMethod", "taxRate") VALUES ('cmpdilfrg001hkdwb3v8ja95u', 'cmpcsv29u0000kd30i9w2arj4', 'pix', 0.00);
INSERT INTO public.payment_method_configs (id, "tenantId", "paymentMethod", "taxRate") VALUES ('cmpdilfrg001jkdwb0mzvxv5p', 'cmpcsv29u0000kd30i9w2arj4', 'debit', 5.00);
INSERT INTO public.payment_method_configs (id, "tenantId", "paymentMethod", "taxRate") VALUES ('cmpdilfrg001lkdwbwld4owaf', 'cmpcsv29u0000kd30i9w2arj4', 'credit', 0.00);
INSERT INTO public.payment_method_configs (id, "tenantId", "paymentMethod", "taxRate") VALUES ('cmpdilfrh001nkdwbnuumfmij', 'cmpcsv29u0000kd30i9w2arj4', 'credit_store', 0.00);


--
-- Data for Name: product_variations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.product_variations (id, "productId", name, "priceModifier", "stockQty", sku, barcode, "lowStockAt") VALUES ('cmpd3h4wq000skdwbzoblcuiu', 'cmpd2ld1q000bkdwb89s7fx4w', '500g', 0.00, 7.000, NULL, NULL, 1.000);
INSERT INTO public.product_variations (id, "productId", name, "priceModifier", "stockQty", sku, barcode, "lowStockAt") VALUES ('cmpd3h4t4000mkdwb40ruhy6i', 'cmpd2ld1q000bkdwb89s7fx4w', '250g', 0.00, 5.000, NULL, NULL, 1.000);


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.products (id, "tenantId", name, description, sku, barcode, price, "costPrice", unit, "stockQty", "lowStockAt", "imageUrl", active, "isFractional", "hasVariations", "categoryId", "aiGenerated", "createdAt", "updatedAt", "taxRate", "operationalCost") VALUES ('cmpd2g18a0007kdwb8sj3djed', 'cmpcsv29u0000kd30i9w2arj4', 'Salame Fatiado Tipo Hamburguês', 'Fatiados em Porções ideais', 'S1', '88888212112', 0.00, NULL, 'UN', 0.000, 2.000, NULL, true, false, false, 'cmpd2drcy0005kdwb9gevuysg', false, '2026-05-19 20:08:56.122', '2026-05-19 20:09:09.812', NULL, NULL);
INSERT INTO public.products (id, "tenantId", name, description, sku, barcode, price, "costPrice", unit, "stockQty", "lowStockAt", "imageUrl", active, "isFractional", "hasVariations", "categoryId", "aiGenerated", "createdAt", "updatedAt", "taxRate", "operationalCost") VALUES ('cmpd2jdf20009kdwbgkxbo9b6', 'cmpcsv29u0000kd30i9w2arj4', 'Doce de Leite c/ Maracujá', 'Doce de leite com sementes de maracujá', 'D2', '12313123131', 0.00, NULL, 'UN', 0.000, 2.000, NULL, true, false, false, 'cmpd2cejx0001kdwbe40g4yby', false, '2026-05-19 20:11:31.886', '2026-05-19 20:11:31.886', NULL, NULL);
INSERT INTO public.products (id, "tenantId", name, description, sku, barcode, price, "costPrice", unit, "stockQty", "lowStockAt", "imageUrl", active, "isFractional", "hasVariations", "categoryId", "aiGenerated", "createdAt", "updatedAt", "taxRate", "operationalCost") VALUES ('cmpd2ld1q000bkdwb89s7fx4w', 'cmpcsv29u0000kd30i9w2arj4', 'Cocada Cremosa', 'Cocada Cremosa Queimada Gourmet', 'B2', '888313123', 30.00, 10.00, 'UN', 11.000, 1.000, 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAUDBBAQDxAQEBAQEBAQEBAQEBAQEA0QEBAQDQ8NDQ8QEA0NDRANDQ0PDQ0NDRUNDxERExMTDQ0WGBYSGBASExIBBQUFCAcIDwkJDxUVEhUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFf/AABEIAeACgAMBIgACEQEDEQH/xAAcAAACAgMBAQAAAAAAAAAAAAAABQQGAgMHAQj/xABXEAABAgQEBAMEBgYGBggFAgcBAhEAAxIhBAUxQQYiUWETcYEHMpGhFEKxwdHwCCNS4eTxFWJko6TjGCQzRHKEFhdDVGWCksQ0Y4OTwlNzdJSisrTD0v/EABsBAAIDAQEBAAAAAAAAAAAAAAADAQIEBQYH/8QAOhEAAgIBBAAFAgUDAgQGAwAAAAECAxEEEiExBRMiQVEUYTJxgaHRFZGxI0IGM1KiFsHS4fDxNFOS/9oADAMBAAIRAxEAPwD4yggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAggggAIIIIACCCCAAgi0TeECCUlbEEginQgs116w44Q9nSZ8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', true, false, true, 'cmpd2d9od0003kdwbuck5ledi', false, '2026-05-19 20:13:04.718', '2026-05-20 04:41:04.253', 10.00, 2.00);


--
-- Data for Name: purchase_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.purchase_items (id, "purchaseId", "productId", "variationId", "productName", quantity, "unitCost", total, "marginPct", "salePrice", "taxRatePct", "operationalCost") VALUES ('cmpd3gukz000jkdwb0q5a30u7', 'cmpd3gukz000hkdwbqgg3owpk', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4t4000mkdwb40ruhy6i', 'Cocada Cremosa - 250g', 3.000, 10.00, 30.00, 10.00, 15.00, 10.00, 2.00);
INSERT INTO public.purchase_items (id, "purchaseId", "productId", "variationId", "productName", quantity, "unitCost", total, "marginPct", "salePrice", "taxRatePct", "operationalCost") VALUES ('cmpd3gukz000kkdwbq986hci4', 'cmpd3gukz000hkdwbqgg3owpk', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4wq000skdwbzoblcuiu', 'Cocada Cremosa - 500g', 3.000, 10.00, 30.00, 10.00, 15.00, 10.00, 2.00);
INSERT INTO public.purchase_items (id, "purchaseId", "productId", "variationId", "productName", quantity, "unitCost", total, "marginPct", "salePrice", "taxRatePct", "operationalCost") VALUES ('cmpdia3tx0014kdwb04bdg9l3', 'cmpdia3tx0012kdwbwncl3uv8', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4t4000mkdwb40ruhy6i', 'Cocada Cremosa - 250g', 4.000, 15.00, 60.00, 33.30, 30.00, 10.00, 2.00);
INSERT INTO public.purchase_items (id, "purchaseId", "productId", "variationId", "productName", quantity, "unitCost", total, "marginPct", "salePrice", "taxRatePct", "operationalCost") VALUES ('cmpdia3tx0015kdwbov7qc8ol', 'cmpdia3tx0012kdwbwncl3uv8', 'cmpd2ld1q000bkdwb89s7fx4w', 'cmpd3h4wq000skdwbzoblcuiu', 'Cocada Cremosa - 500g', 4.000, 15.00, 60.00, 33.30, 30.00, 10.00, 2.00);


--
-- Data for Name: purchases; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.purchases (id, "tenantId", "supplierId", "orderNumber", status, notes, subtotal, discount, total, "receivedAt", "createdAt", "updatedAt", "customerId") VALUES ('cmpd3gukz000hkdwbqgg3owpk', 'cmpcsv29u0000kd30i9w2arj4', 'cmpd2nzir000fkdwbubn4fetj', 1, 'RECEIVED', NULL, 60.00, 0.00, 60.00, '2026-05-19 20:37:47.018', '2026-05-19 20:37:33.779', '2026-05-19 20:37:47.024', NULL);
INSERT INTO public.purchases (id, "tenantId", "supplierId", "orderNumber", status, notes, subtotal, discount, total, "receivedAt", "createdAt", "updatedAt", "customerId") VALUES ('cmpdia3tx0012kdwbwncl3uv8', 'cmpcsv29u0000kd30i9w2arj4', 'cmpd2nan5000dkdwb15r90hhd', 2, 'RECEIVED', NULL, 120.00, 0.00, 120.00, '2026-05-20 03:32:19.668', '2026-05-20 03:32:13.413', '2026-05-20 03:32:19.674', NULL);


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.suppliers (id, "tenantId", name, cnpj, ie, email, phone, whatsapp, "contactName", address, "addressNumber", complement, neighborhood, city, state, "zipCode", notes, active, "createdAt", "updatedAt") VALUES ('cmpd2nan5000dkdwb15r90hhd', 'cmpcsv29u0000kd30i9w2arj4', 'Uai Queijos ', '000221212212211', NULL, 'uai@gmail.com', '21 999999982', '', '', '', '', '', '', '', '', '', '', true, '2026-05-19 20:14:34.913', '2026-05-19 20:14:34.913');
INSERT INTO public.suppliers (id, "tenantId", name, cnpj, ie, email, phone, whatsapp, "contactName", address, "addressNumber", complement, neighborhood, city, state, "zipCode", notes, active, "createdAt", "updatedAt") VALUES ('cmpd2nzir000fkdwbubn4fetj', 'cmpcsv29u0000kd30i9w2arj4', 'Mineiro raiz', '21200212121212', NULL, 'mineiro@gmail.com', '', '', '', '', '', '', '', '', '', '', '', true, '2026-05-19 20:15:07.155', '2026-05-19 20:15:07.155');


--
-- Data for Name: table_commands; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tenant_users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tenant_users (id, "tenantId", "userId", role, pin, "createdAt") VALUES ('cmpbh7z3k0004uylozelconpv', 'cmpbh7yfp0000uylo0bdk6o7y', 'cmpbh7yy70002uyloxiyqf6a5', 'OWNER', '1234', '2026-05-18 17:27:01.999');
INSERT INTO public.tenant_users (id, "tenantId", "userId", role, pin, "createdAt") VALUES ('cmpcswfep0002kd30h71gnxn8', 'cmpcsv29u0000kd30i9w2arj4', 'cmpbmhxcg0000uyqg3okot21f', 'OWNER', '', '2026-05-19 15:41:44.833');
INSERT INTO public.tenant_users (id, "tenantId", "userId", role, pin, "createdAt") VALUES ('cmpbmhxeg0002uyqg4yn3dkhk', 'cmpbh7yfp0000uylo0bdk6o7y', 'cmpbmhxcg0000uyqg3okot21f', 'CASHIER', '', '2026-05-18 19:54:44.439');


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tenants (id, slug, "companyName", plan, status, "trialEndsAt", "createdAt", "updatedAt", "featureOverrides") VALUES ('cmpcsv29u0000kd30i9w2arj4', 'o-gostin-da-roça-na-sua-mesa', 'Dali da Roça', 'PRIME', 'ACTIVE', NULL, '2026-05-19 15:40:41.154', '2026-05-19 15:40:41.154', NULL);
INSERT INTO public.tenants (id, slug, "companyName", plan, status, "trialEndsAt", "createdAt", "updatedAt", "featureOverrides") VALUES ('cmpbh7yfp0000uylo0bdk6o7y', 'moda-infantil', 'Fun Family', 'PRIME', 'ACTIVE', NULL, '2026-05-18 17:27:01.138', '2026-05-19 15:41:13.306', NULL);


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users (id, email, name, password, "avatarUrl", "createdAt", "updatedAt", role) VALUES ('cmpbh7ypm0001uyloso5ja9vd', 'super@sale360.app', 'Super Admin', '$2b$10$W19Ukgb092gf/xoZa83B9.bcRLR1b3eEGHXNls4o3DZEhZLcMoZ0i', NULL, '2026-05-18 17:27:01.498', '2026-05-18 17:27:01.498', 'SUPER_ADMIN');
INSERT INTO public.users (id, email, name, password, "avatarUrl", "createdAt", "updatedAt", role) VALUES ('cmpbh7yy70002uyloxiyqf6a5', 'admin@sale360.app', 'Admin Demo', '$2b$10$W19Ukgb092gf/xoZa83B9.bcRLR1b3eEGHXNls4o3DZEhZLcMoZ0i', NULL, '2026-05-18 17:27:01.807', '2026-05-18 17:27:01.807', 'USER');
INSERT INTO public.users (id, email, name, password, "avatarUrl", "createdAt", "updatedAt", role) VALUES ('cmpbmhxcg0000uyqg3okot21f', 'philipecordeiroprc@gmail.com', 'Philipe', '$2b$10$kaNfkKz1v.z1zpDZxRTlvuiJVAeP/Xz9kITWQ/lyjDwmvOn6b9lSa', NULL, '2026-05-18 19:54:44.368', '2026-05-19 15:42:14.886', 'USER');


--
-- Data for Name: variation_dimensions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpadeu7j0002uykc4zgrhlqm', 'cmpadeu7j0001uykcjt0vpoi3', 'TAMANHO_LETRA', 'Tamanho', '["PP","P","M","G","GG","XG","XGG"]', 0);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpadeu7j0003uykceowla336', 'cmpadeu7j0001uykcjt0vpoi3', 'TAMANHO_NUMERO', 'Tamanho (Núm.)', '["36","38","40","42","44","46","48","50","52","54","56"]', 1);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpadeu7j0004uykcs5g0nfuj', 'cmpadeu7j0001uykcjt0vpoi3', 'COR', 'Cor', '["Vermelho","Azul","Verde","Preto","Branco","Amarelo","Rosa","Cinza","Marrom","Laranja","Roxo","Bege"]', 2);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpadeufg0007uykcjbxbehek', 'cmpadeufg0006uykce9oth8id', 'TAMANHO_NUMERO', 'Tamanho', '["2","4","6","8","10","12","14","16","18","20"]', 0);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpadeufg0008uykc3kt8sq26', 'cmpadeufg0006uykce9oth8id', 'COR', 'Cor', '["Vermelho","Azul","Verde","Preto","Branco","Amarelo","Rosa","Cinza","Marrom","Laranja","Roxo","Bege"]', 1);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpadeuky000buykcaih6bhe5', 'cmpadeuky000auykcngq0sqi3', 'TAMANHO_NUMERO', 'Tamanho', '["33","34","35","36","37","38","39","40","41","42","43","44","45","46"]', 0);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpadeuky000cuykcussl3ixb', 'cmpadeuky000auykcngq0sqi3', 'COR', 'Cor', '["Preto","Branco","Marrom","Azul Marinho","Bege","Vermelho"]', 1);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpadeup8000fuykcimaurxem', 'cmpadeup8000euykcpdspkz0g', 'VOLUME', 'Volume', '["100ml","200ml","250ml","300ml","350ml","500ml","600ml","750ml","1L","1.5L","2L","5L","10L","20L"]', 0);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpadeutj000iuykc0e6sx0pu', 'cmpadeutj000huykc0rqk3mt4', 'PESO', 'Peso', '["50g","100g","200g","250g","500g","750g","1kg","2kg","5kg","10kg","20kg","50kg"]', 0);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpadeuxe000luykc5mcjox58', 'cmpadeuxe000kuykc1t4zah65', 'PERSONALIZADO', 'Unidade', '["UN","PC","CX","PAR","FD","PCT"]', 0);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpbh803e000quylo792age23', 'cmpbh803e000muylolya14oil', 'VOLUME', 'Volume', '["100ml","200ml","250ml","300ml","350ml","500ml","600ml","750ml","1L","1.5L","2L","5L","10L","20L"]', 0);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpbh803e000ruylobnzgd1qo', 'cmpbh803e000luylof0x3l4cx', 'TAMANHO_NUMERO', 'Tamanho', '["33","34","35","36","37","38","39","40","41","42","43","44","45","46"]', 0);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpbh803e000tuylowwxivlqt', 'cmpbh803e000ouylo97we4i4k', 'TAMANHO_NUMERO', 'Tamanho', '["2","4","6","8","10","12","14","16","18","20"]', 0);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpbh803g000yuylomd9bju45', 'cmpbh803g000xuylof1b3zzt5', 'PERSONALIZADO', 'Unidade', '["UN","PC","CX","PAR","FD","PCT"]', 0);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpbh803e000uuyloz05kbaz8', 'cmpbh803e000luylof0x3l4cx', 'COR', 'Cor', '["Preto","Branco","Marrom","Azul Marinho","Bege","Vermelho"]', 1);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpbh803f000wuylo2gfj5bbi', 'cmpbh803e000ouylo97we4i4k', 'COR', 'Cor', '["Vermelho","Azul","Verde","Preto","Branco","Amarelo","Rosa","Cinza","Marrom","Laranja","Roxo","Bege"]', 1);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpbh803e000puylo5ccjvs4y', 'cmpbh803e000nuylomtk81b38', 'TAMANHO_LETRA', 'Tamanho', '["PP","P","M","G","GG","XG","XGG"]', 0);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpbh803e000suylo29xjl1vn', 'cmpbh803e000nuylomtk81b38', 'TAMANHO_NUMERO', 'Tamanho (Núm.)', '["36","38","40","42","44","46","48","50","52","54","56"]', 1);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpbh803e000vuylonq6v3x37', 'cmpbh803e000nuylomtk81b38', 'COR', 'Cor', '["Vermelho","Azul","Verde","Preto","Branco","Amarelo","Rosa","Cinza","Marrom","Laranja","Roxo","Bege"]', 2);
INSERT INTO public.variation_dimensions (id, "templateId", type, label, options, "orderIndex") VALUES ('cmpbh80dj0010uylogfhkajn5', 'cmpbh80dj000zuylovmqts17c', 'PESO', 'Peso', '["50g","100g","200g","250g","500g","750g","1kg","2kg","5kg","10kg","20kg","50kg"]', 0);


--
-- Data for Name: variation_templates; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.variation_templates (id, "tenantId", name, "createdAt") VALUES ('cmpadeu7j0001uykcjt0vpoi3', NULL, 'Vestuário Adulto', '2026-05-17 22:52:37.615');
INSERT INTO public.variation_templates (id, "tenantId", name, "createdAt") VALUES ('cmpadeufg0006uykce9oth8id', NULL, 'Vestuário Infantil', '2026-05-17 22:52:37.901');
INSERT INTO public.variation_templates (id, "tenantId", name, "createdAt") VALUES ('cmpadeuky000auykcngq0sqi3', NULL, 'Calçados', '2026-05-17 22:52:38.098');
INSERT INTO public.variation_templates (id, "tenantId", name, "createdAt") VALUES ('cmpadeup8000euykcpdspkz0g', NULL, 'Volume (Líquidos)', '2026-05-17 22:52:38.252');
INSERT INTO public.variation_templates (id, "tenantId", name, "createdAt") VALUES ('cmpadeutj000huykc0rqk3mt4', NULL, 'Peso (Granel/Alimentos)', '2026-05-17 22:52:38.408');
INSERT INTO public.variation_templates (id, "tenantId", name, "createdAt") VALUES ('cmpadeuxe000kuykc1t4zah65', NULL, 'Unidades (Geral)', '2026-05-17 22:52:38.546');
INSERT INTO public.variation_templates (id, "tenantId", name, "createdAt") VALUES ('cmpbh803e000muylolya14oil', NULL, 'Volume (Líquidos)', '2026-05-18 17:27:03.29');
INSERT INTO public.variation_templates (id, "tenantId", name, "createdAt") VALUES ('cmpbh803e000luylof0x3l4cx', NULL, 'Calçados', '2026-05-18 17:27:03.29');
INSERT INTO public.variation_templates (id, "tenantId", name, "createdAt") VALUES ('cmpbh803g000xuylof1b3zzt5', NULL, 'Unidades (Geral)', '2026-05-18 17:27:03.292');
INSERT INTO public.variation_templates (id, "tenantId", name, "createdAt") VALUES ('cmpbh803e000nuylomtk81b38', NULL, 'Vestuário Adulto', '2026-05-18 17:27:03.29');
INSERT INTO public.variation_templates (id, "tenantId", name, "createdAt") VALUES ('cmpbh803e000ouylo97we4i4k', NULL, 'Vestuário Infantil', '2026-05-18 17:27:03.29');
INSERT INTO public.variation_templates (id, "tenantId", name, "createdAt") VALUES ('cmpbh80dj000zuylovmqts17c', NULL, 'Peso (Granel/Alimentos)', '2026-05-18 17:27:03.292');


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

\unrestrict y3FrHXU79dj8gnkuxjTlqaVJ9RiQ8ahhiWTUIlRcSqCNF7K9ow94d2N6GP0xZDi

