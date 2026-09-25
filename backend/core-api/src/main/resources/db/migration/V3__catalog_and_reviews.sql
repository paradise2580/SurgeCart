-- A storefront catalogue for the demo, plus customer reviews.
--
-- Images are served by the frontend from /products/*.webp (DummyJSON's
-- free demo product renders), so the catalogue has no runtime dependency on
-- a third-party image host.

ALTER TABLE products ADD COLUMN category VARCHAR(40);

-- The two V2 products get real imagery. Sale 1 keeps its 100 units of stock:
-- the README's benchmark walkthrough and the admin panel default to it.
UPDATE products SET title = 'Nocturne Steel Watch',
                    description = 'Brushed steel bracelet, sapphire-coated glass, 50 m water resistant.',
                    image_url = '/products/steel-watch.webp', base_price = 8999.00, category = 'Watches'
 WHERE id = 1;
UPDATE products SET title = 'Noir Structured Handbag',
                    description = 'Vegan leather tote with a gold-tone clasp and a detachable strap.',
                    image_url = '/products/handbag.webp', base_price = 8999.00, category = 'Bags'
 WHERE id = 2;

UPDATE sale_events SET sale_price = 2999.00, ends_at = now() + interval '30 days' WHERE id = 1;
UPDATE sale_events SET sale_price = 4499.00, sold_count = 31, per_user_limit = 2, status = 'LIVE',
                       starts_at = now() - interval '1 minute', ends_at = now() + interval '30 days'
 WHERE id = 2;

INSERT INTO products (title, description, image_url, base_price, category) VALUES
  ('Crimson Velvet Lipstick', 'Twelve-hour colour that stays soft, never dry.', '/products/lipstick.webp', 1299.00, 'Makeup'),
  ('Nude Glow Eyeshadow Palette', 'Twenty-one buttery shades from matte to metallic, with a mirror.', '/products/eyeshadow.webp', 2499.00, 'Makeup'),
  ('Gloss Lacquer Nail Duo', 'Chip-resistant gel-shine finish in two classic reds.', '/products/nail-polish.webp', 799.00, 'Nails'),
  ('Emerald Drop Earrings', 'Faceted crystal drops on gold-plated hooks.', '/products/earrings.webp', 3999.00, 'Jewellery'),
  ('Midnight Tortoise Sunglasses', 'Polarised lenses, UV400, lightweight acetate frame.', '/products/sunglasses.webp', 4999.00, 'Eyewear'),
  ('Scarlet Stiletto Heels', 'Patent finish, cushioned insole, 9 cm heel.', '/products/heels.webp', 5999.00, 'Footwear');

INSERT INTO sale_events (product_id, sale_price, total_stock, sold_count, per_user_limit, starts_at, ends_at, status)
SELECT p.id, v.sale_price, v.total_stock, v.sold_count, 2, now() - interval '1 minute', now() + interval '30 days', 'LIVE'
  FROM (VALUES
    ('Crimson Velvet Lipstick', 649.00, 200, 164),
    ('Nude Glow Eyeshadow Palette',    1199.00, 120,  58),
    ('Gloss Lacquer Nail Duo',          399.00, 150, 139),
    ('Emerald Drop Earrings',          1799.00,  60,  22),
    ('Midnight Tortoise Sunglasses',   1999.00,  80,  45),
    ('Scarlet Stiletto Heels',         2999.00,  40,  12)
  ) AS v(title, sale_price, total_stock, sold_count)
  JOIN products p ON p.title = v.title;

CREATE TABLE reviews (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id),
    author_name     VARCHAR(60)  NOT NULL,
    rating          INTEGER      NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         VARCHAR(500) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_created_at ON reviews (created_at DESC);

-- Sample reviews so a fresh install doesn't open on an empty section.
INSERT INTO reviews (author_name, rating, comment, created_at) VALUES
  ('Priya S.', 5, 'Got the lipstick at half price and checkout took ten seconds. The countdown makes it genuinely exciting.', now() - interval '3 days'),
  ('Rahul M.', 5, 'Watched the stock bar drop from 40 to 3 while I paid. Still got mine. No double charge, no drama.', now() - interval '2 days'),
  ('Ananya K.', 4, 'Beautiful earrings, fast delivery. Wish the drops lasted a little longer!', now() - interval '1 day'),
  ('Karan V.', 5, 'The only flash sale site that has never oversold on me. Refreshingly honest.', now() - interval '6 hours');
