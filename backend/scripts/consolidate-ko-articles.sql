-- Consolidation des articles KO
-- Généré le 2026-04-28 depuis ko-mapping.json
-- Opération : réassigner order_items + invoice_items vers l'article cible, puis désactiver l'article KO

BEGIN;

-- ============================================================
-- KO1 → 1/2 Poulet Grillé
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = '1/2 Poulet Grillé' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO1' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = '1/2 Poulet Grillé' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO1' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO1';

-- ============================================================
-- KO2 → Pizza végétarienne  (0 commande)
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Pizza végétarienne' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO2' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Pizza végétarienne' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO2' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO2';

-- ============================================================
-- KO3 → Pizza au Fruits de Mer
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Pizza au Fruits de Mer' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO3' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Pizza au Fruits de Mer' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO3' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO3';

-- ============================================================
-- KO4 → Sauce Claire Agouti
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Sauce Claire Agouti' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO4' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Sauce Claire Agouti' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO4' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO4';

-- ============================================================
-- KO5 → 1/2 Poulet Grillé
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = '1/2 Poulet Grillé' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO5' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = '1/2 Poulet Grillé' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO5' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO5';

-- ============================================================
-- KO6 → Martini Blanc
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Martini Blanc' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO6' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Martini Blanc' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO6' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO6';

-- ============================================================
-- KO7 → Mojito
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Mojito' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO7' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Mojito' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO7' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO7';

-- ============================================================
-- KO8 → Baileys
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Baileys' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO8' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Baileys' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO8' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO8';

-- ============================================================
-- KO9 → Baileys
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Baileys' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO9' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Baileys' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO9' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO9';

-- ============================================================
-- KO10 → Cuba Libre
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Cuba Libre' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO10' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Cuba Libre' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO10' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO10';

-- ============================================================
-- KO11 → Zombie
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Zombie' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO11' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Zombie' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO11' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO11';

-- ============================================================
-- KO12 → COCKTAIL CAÎPHIROSKA
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'COCKTAIL CAÎPHIROSKA' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO12' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'COCKTAIL CAÎPHIROSKA' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO12' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO12';

-- ============================================================
-- KO13 → Castel 50CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Castel 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO13' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Castel 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO13' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO13';

-- ============================================================
-- KO14 → Castel 50CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Castel 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO14' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Castel 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO14' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO14';

-- ============================================================
-- KO15 → Eau Minérale Voltic 1,5L
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Eau Minérale Voltic 1,5L' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO15' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Eau Minérale Voltic 1,5L' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO15' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO15';

-- ============================================================
-- KO16 → Eau Minérale Voltic 1,5L
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Eau Minérale Voltic 1,5L' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO16' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Eau Minérale Voltic 1,5L' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO16' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO16';

-- ============================================================
-- KO18 → Awooyo
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Awooyo' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO18' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Awooyo' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO18' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO18';

-- ============================================================
-- KO19 → Awooyo
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Awooyo' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO19' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Awooyo' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO19' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO19';

-- ============================================================
-- KO20 → Tropique grenadine (Mocktail)
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Tropique grenadine (Mocktail)' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO20' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Tropique grenadine (Mocktail)' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO20' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO20';

-- ============================================================
-- KO21 → Awooyo
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Awooyo' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO21' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Awooyo' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO21' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO21';

-- ============================================================
-- KO23 → Guiness 33CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Guiness 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO23' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Guiness 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO23' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO23';

-- ============================================================
-- KO24 → Beaufort 33CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Beaufort 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO24' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Beaufort 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO24' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO24';

-- ============================================================
-- KO25 → Doppel 50CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Doppel 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO25' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Doppel 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO25' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO25';

-- ============================================================
-- KO26 → Djama Pilsner 50CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Djama Pilsner 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO26' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Djama Pilsner 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO26' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO26';

-- ============================================================
-- KO27 → Chill 50CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Chill 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO27' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Chill 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO27' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO27';

-- ============================================================
-- KO28 → Eau Minérale Voltic 1,5L
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Eau Minérale Voltic 1,5L' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO28' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Eau Minérale Voltic 1,5L' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO28' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO28';

-- ============================================================
-- KO30 → Chap Cocktail 50CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Chap Cocktail 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO30' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Chap Cocktail 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO30' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO30';

-- ============================================================
-- KO31 → Chap Cocktail 50CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Chap Cocktail 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO31' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Chap Cocktail 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO31' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO31';

-- ============================================================
-- KO32 → Djama Pilsner 50CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Djama Pilsner 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO32' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Djama Pilsner 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO32' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO32';

-- ============================================================
-- KO33 → Doppel 50CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Doppel 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO33' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Doppel 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO33' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO33';

-- ============================================================
-- KO34 → Cocktail Liha
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Cocktail Liha' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO34' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Cocktail Liha' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO34' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO34';

-- ============================================================
-- KO35 → Pils 33CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Pils 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO35' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Pils 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO35' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO35';

-- ============================================================
-- KO36 → Castel 50CL  (0 commande)
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Castel 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO36' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Castel 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO36' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO36';

-- ============================================================
-- KO37 → Beaufort 33CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Beaufort 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO37' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Beaufort 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO37' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO37';

-- ============================================================
-- KO38 → Eku
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Eku' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO38' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Eku' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO38' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO38';

-- ============================================================
-- KO39 → Eau Minérale Prima 0,5L
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Eau Minérale Prima 0,5L' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO39' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Eau Minérale Prima 0,5L' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO39' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO39';

-- ============================================================
-- KO40 → Eau Minérale Voltic 0,5L
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Eau Minérale Voltic 0,5L' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO40' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Eau Minérale Voltic 0,5L' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO40' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO40';

-- ============================================================
-- KO41 → Jus d'Orange 33cl  (nom avec espace final dans la base)
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE trim(name) = 'Jus d''Orange 33cl' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO41' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE trim(name) = 'Jus d''Orange 33cl' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO41' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO41';

-- ============================================================
-- KO42 → COCKTAIL MONACO
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'COCKTAIL MONACO' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO42' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'COCKTAIL MONACO' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO42' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO42';

-- ============================================================
-- KO43 → Pils 33CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Pils 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO43' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Pils 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO43' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO43';

-- ============================================================
-- KO44 → Beaufort 33CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Beaufort 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO44' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Beaufort 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO44' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO44';

-- ============================================================
-- KO45 → Beaufort 33CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Beaufort 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO45' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Beaufort 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO45' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO45';

-- ============================================================
-- KO46 → Youzou Sprite
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Youzou Sprite' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO46' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Youzou Sprite' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO46' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO46';

-- ============================================================
-- KO47 → Youki Cocktail 33CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Youki Cocktail 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO47' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Youki Cocktail 33CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO47' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO47';

-- ============================================================
-- KO48 → Djama Panaché 50CL
-- ============================================================
UPDATE order_items   SET article_id = (SELECT id FROM articles WHERE name = 'Djama Panaché 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO48' LIMIT 1);
UPDATE invoice_items SET article_id = (SELECT id FROM articles WHERE name = 'Djama Panaché 50CL' LIMIT 1) WHERE article_id = (SELECT id FROM articles WHERE name = 'KO48' LIMIT 1);
UPDATE articles SET is_active = false WHERE name = 'KO48';

-- ============================================================
-- Vérification finale
-- ============================================================
SELECT
  'order_items KO restants' AS check_label,
  count(*) AS nb
FROM order_items oi
JOIN articles a ON a.id = oi.article_id
WHERE a.name ~ '^KO[0-9]+$'

UNION ALL

SELECT
  'invoice_items KO restants',
  count(*)
FROM invoice_items ii
JOIN articles a ON a.id = ii.article_id
WHERE a.name ~ '^KO[0-9]+$'

UNION ALL

SELECT
  'articles KO encore actifs',
  count(*)
FROM articles
WHERE name ~ '^KO[0-9]+$' AND is_active = true;

COMMIT;
