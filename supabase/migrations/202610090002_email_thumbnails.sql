-- Email clients render WebP inconsistently, so each menu image gets a small
-- JPEG sibling for receipts. Writes remain server-only (service_role).
update storage.buckets set allowed_mime_types = array['image/webp','image/jpeg'] where id = 'menu-images';
