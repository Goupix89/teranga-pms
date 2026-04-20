package com.hotelpms.pos.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// === Teranga Sober Palette ===
// Names kept for backwards compatibility; hex values retuned for a sober,
// high-contrast look: deep oxblood primary, teal-green secondary, ochre tertiary,
// neutral linen background that lets each accent carry weight.

// Rouge Dahomey — oxblood primary
val RougeDahomey = Color(0xFF7A2520)
val RougeDahomeyDark = Color(0xFF551914)
val RougeDahomeyLight = Color(0xFFB25148)
val RougeDahomeyContainer = Color(0xFFF4E4E1)

// Or Béninois — warm ochre accent (darker than before, used sparingly)
val OrBeninois = Color(0xFFB8853A)
val OrBeninoisDark = Color(0xFF8C6324)
val OrBeninoisLight = Color(0xFFD4A862)
val OrBeninoisContainer = Color(0xFFF7EBD3)

// Vert Béninois — deep teal-green for success / availability
val VertBeninois = Color(0xFF1F584F)
val VertBeninoisDark = Color(0xFF143B35)
val VertBeninoisLight = Color(0xFF4F8278)
val VertBeninoisContainer = Color(0xFFDDEAE6)

// Bronze d'Abomey — warm neutral
val BronzeAbomey = Color(0xFF7B6352)
val BronzeAbomeyDark = Color(0xFF4A3B30)
val BronzeAbomeyLight = Color(0xFFBAAA9A)

// Terre & Sable — earth neutrals for surface system
val TerreFon = Color(0xFF2A211C)
val SableOuidah = Color(0xFFF5F1EA)
val CremeGanvie = Color(0xFFFFFFFF)
val SurfaceVariant = Color(0xFFEDE6DA)
val Outline = Color(0xFFC9BDAD)

// Status colors (desaturated to sit comfortably on neutral surface)
val StatusAvailable = Color(0xFF2D7A4F)
val StatusOccupied = Color(0xFF8B2A22)
val StatusCleaning = Color(0xFFB8853A)
val StatusMaintenance = Color(0xFF7B6352)
val StatusPending = Color(0xFFC27D1E)

private val BeninLightColorScheme = lightColorScheme(
    primary = RougeDahomey,
    onPrimary = Color.White,
    primaryContainer = RougeDahomeyContainer,
    onPrimaryContainer = RougeDahomeyDark,
    secondary = VertBeninois,
    onSecondary = Color.White,
    secondaryContainer = VertBeninoisContainer,
    onSecondaryContainer = VertBeninoisDark,
    tertiary = OrBeninois,
    onTertiary = Color.White,
    tertiaryContainer = OrBeninoisContainer,
    onTertiaryContainer = OrBeninoisDark,
    background = SableOuidah,
    onBackground = TerreFon,
    surface = CremeGanvie,
    onSurface = TerreFon,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = BronzeAbomeyDark,
    outline = Outline,
    error = Color(0xFFB3261E),
    onError = Color.White,
)

private val BeninDarkColorScheme = darkColorScheme(
    primary = RougeDahomeyLight,
    onPrimary = RougeDahomeyDark,
    primaryContainer = RougeDahomey,
    onPrimaryContainer = Color.White,
    secondary = VertBeninoisLight,
    onSecondary = VertBeninoisDark,
    secondaryContainer = VertBeninois,
    onSecondaryContainer = Color.White,
    tertiary = OrBeninoisLight,
    onTertiary = TerreFon,
    tertiaryContainer = OrBeninoisDark,
    onTertiaryContainer = Color.White,
    background = TerreFon,
    onBackground = SableOuidah,
    surface = BronzeAbomeyDark,
    onSurface = SableOuidah,
    surfaceVariant = BronzeAbomey,
    onSurfaceVariant = BronzeAbomeyLight,
    outline = BronzeAbomey,
    error = Color(0xFFEF9A9A),
    onError = Color(0xFF7F0000),
)

// Typography
val BeninTypography = Typography(
    displayLarge = TextStyle(
        fontWeight = FontWeight.Bold,
        fontSize = 32.sp,
        letterSpacing = (-0.5).sp,
    ),
    displayMedium = TextStyle(
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
    ),
    headlineLarge = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
    ),
    headlineMedium = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
    ),
    titleLarge = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
    ),
    titleMedium = TextStyle(
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
    ),
    bodyLarge = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
    ),
    bodyMedium = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
    ),
    bodySmall = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
    ),
    labelLarge = TextStyle(
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
    ),
    labelMedium = TextStyle(
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
    ),
    labelSmall = TextStyle(
        fontWeight = FontWeight.Medium,
        fontSize = 10.sp,
    ),
)

@Composable
fun BeninTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) BeninDarkColorScheme else BeninLightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = BeninTypography,
        content = content
    )
}
