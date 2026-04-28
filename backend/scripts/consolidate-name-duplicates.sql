-- Consolidation des doublons de noms (casse + chiffres en fin)
-- Généré le 2026-04-28

BEGIN;

-- ============================================================
-- 1. Baby-Foot  ←  BABY-FOOT
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Baby-Foot' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'BABY-FOOT' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Baby-Foot' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'BABY-FOOT' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'BABY-FOOT';

-- ============================================================
-- 2. Cocktail Signature  ←  Cocktail Signature 2 + Cocktail Signature 3
--    (+ nettoyage de l'espace final sur le nom gardé)
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE trim(name) = 'Cocktail Signature' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Cocktail Signature 2' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE trim(name) = 'Cocktail Signature' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Cocktail Signature 2' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'Cocktail Signature 2';

UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE trim(name) = 'Cocktail Signature' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Cocktail Signature 3' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE trim(name) = 'Cocktail Signature' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Cocktail Signature 3' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'Cocktail Signature 3';

-- Supprime l'espace final sur le nom gardé
UPDATE articles SET name = 'Cocktail Signature' WHERE trim(name) = 'Cocktail Signature' AND name <> 'Cocktail Signature';

-- ============================================================
-- 3. Lapin Sauté Chasseur  ←  Lapin sauté chasseur
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Lapin Sauté Chasseur' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Lapin sauté chasseur' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Lapin Sauté Chasseur' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Lapin sauté chasseur' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'Lapin sauté chasseur';

-- ============================================================
-- 4. Mix Grill  ←  Mix grill1
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Mix Grill' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Mix grill1' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Mix Grill' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Mix grill1' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'Mix grill1';

-- ============================================================
-- 5. MONACO  ←  Monaco1
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'MONACO' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Monaco1' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'MONACO' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Monaco1' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'Monaco1';

-- ============================================================
-- 6. Poisson Entier Grillé  ←  Poisson entier grillé1
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Poisson Entier Grillé' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Poisson entier grillé1' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Poisson Entier Grillé' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Poisson entier grillé1' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'Poisson entier grillé1';

-- ============================================================
-- 7. Salade Béthania  ←  Salade Béthania  (espace final)
--    (+ nettoyage de l'espace final sur le nom gardé)
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Salade Béthania' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE trim(name) = 'Salade Béthania' AND name <> 'Salade Béthania' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Salade Béthania' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE trim(name) = 'Salade Béthania' AND name <> 'Salade Béthania' LIMIT 1);
UPDATE articles SET is_active = false WHERE trim(name) = 'Salade Béthania' AND name <> 'Salade Béthania';

-- ============================================================
-- 8. Salade de Blomvi  ←  Salade de Blomvi 1
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Salade de Blomvi' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Salade de Blomvi 1' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Salade de Blomvi' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Salade de Blomvi 1' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'Salade de Blomvi 1';

-- ============================================================
-- 9. Salade Haricots Verts et Gésiers Confits  ←  Salade haricots verts et gésiers confits
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Salade Haricots Verts et Gésiers Confits' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Salade haricots verts et gésiers confits' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Salade Haricots Verts et Gésiers Confits' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Salade haricots verts et gésiers confits' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'Salade haricots verts et gésiers confits';

-- ============================================================
-- 10. Sport Actif  ←  Sport actif
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Sport Actif' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Sport actif' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Sport Actif' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Sport actif' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'Sport actif';

-- ============================================================
-- 11. Suppl riz blanc  ←  Suppl riz blanc  (espace final, 0 commande)
-- ============================================================
UPDATE articles SET is_active = false WHERE trim(name) = 'Suppl riz blanc' AND name <> 'Suppl riz blanc';

-- ============================================================
-- 12. Yaourt Maison Au Coulis De Mangue  ←  Yaourt Maison Au Coulis De Mangue2
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Yaourt Maison Au Coulis De Mangue' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Yaourt Maison Au Coulis De Mangue2' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Yaourt Maison Au Coulis De Mangue' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'Yaourt Maison Au Coulis De Mangue2' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'Yaourt Maison Au Coulis De Mangue2';

-- ============================================================
-- Vérification finale
-- ============================================================
SELECT
  regexp_replace(lower(trim(name)), '\s*[0-9]+$', '') AS nom_base,
  array_agg(name ORDER BY name) AS variantes_actives,
  count(*) AS nb
FROM articles
WHERE is_active = true
GROUP BY regexp_replace(lower(trim(name)), '\s*[0-9]+$', '')
HAVING count(*) > 1
ORDER BY nom_base;

COMMIT;
