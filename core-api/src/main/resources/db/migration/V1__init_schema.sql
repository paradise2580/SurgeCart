-- SurgeCart initial schema

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'BUYER',
    refresh_token_hash VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id              BIGSERIAL PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    image_url       VARCHAR(500),
    base_price      NUMERIC(12,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sale_events (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES products(id),
    sale_price      NUMERIC(12,2) NOT NULL,
    total_stock     INTEGER NOT NULL CHECK (total_stock >= 0),
    sold_count      INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
    per_user_limit  INTEGER NOT NULL DEFAULT 1,
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    version         BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_sold_within_stock CHECK (sold_count <= total_stock)
);

CREATE TABLE reservations (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    sale_event_id   BIGINT NOT NULL REFERENCES sale_events(id),
    token           VARCHAR(64) NOT NULL UNIQUE,
    status          VARCHAR(20) NOT NULL DEFAULT 'HELD',
    quantity        INTEGER NOT NULL DEFAULT 1,
    expires_at      TIMESTAMPTZ NOT NULL,
    order_id        BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id),
    sale_event_id       BIGINT NOT NULL REFERENCES sale_events(id),
    reservation_token   VARCHAR(64) NOT NULL,
    amount              NUMERIC(12,2) NOT NULL,
    payment_id          VARCHAR(100),
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE outbox (
    id              BIGSERIAL PRIMARY KEY,
    aggregate_id    VARCHAR(100) NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    payload         JSONB NOT NULL,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_orders_resv ON orders(reservation_token);
CREATE INDEX idx_resv_user_sale ON reservations(user_id, sale_event_id);
CREATE INDEX idx_resv_expires ON reservations(expires_at) WHERE status = 'HELD';
CREATE INDEX idx_sale_status_start ON sale_events(status, starts_at DESC);
CREATE INDEX idx_outbox_unpublished ON outbox(created_at) WHERE published_at IS NULL;
