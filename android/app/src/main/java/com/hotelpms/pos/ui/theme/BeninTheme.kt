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

// === Benin-inspired Color Palette ===

// Rouge Dahomey — inspired by the red walls of Abomey Royal Palaces
val RougeDahomey = Color(0xFFC0392B)
val RougeDahomeyDark = Color(0xFF962D22)
val RougeDahomeyLight = Color(0xFFE57373)
val RougeDahomeyContainer = Color(0xFFFDDEDE)

// Or Béninois — the gold of the flag and Abomey bronze sculptures
val OrBeninois = Color(0xFFF1C40F)
val OrBeninoisDark = Color(0xFFC29D0A)
val OrBeninoisLight = Color(0xFFF7DC6F)
val OrBeninoisContainer = Color(0xFFFFF9E0)

// Vert Béninois — the green of the national flag
val VertBeninois = Color(0xFF27AE60)
val VertBeninoisDark = Color(0xFF1E8449)
val VertBeninoisLight = Color(0xFF82E0AA)
val VertBeninoisContainer = Color(0xFFD5F5E3)

// Bronze d'Abomey — traditional brass and bronze
val BronzeAbomey = Color(0xFF8D6E63)
val BronzeAbomeyDark = Color(0xFF5D4037)
val BronzeAbomeyLight = Color(0xFFBCAAA4)

// Terre & Sable — earth tones of Benin
val TerreFon = Color(0xFF3E2723)
val SableOuidah = Color(0xFFFFF8E1)
val CremeGanvie = Color(0xFFFFFDE7)
val SurfaceVariant = Color(0xFFF5F0E1)
val Outline = Color(0xFFD7CCC8)

// Status colors
val StatusAvailable = Color(0xFF27AE60)
val StatusOccupied = Color(0xFFC0392B)
val StatusCleaning = Color(0xFFF1C40F)
val StatusMaintenance = Color(0xFF8D6E63)
val StatusPending = Color(0xFFF39C12)

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
    onTertiary = TerreFon,
    tertiaryContainer = OrBeninoisContainer,
    onTertiaryContainer = OrBeninoisDark,
    background = SableOuidah,
    onBackground = TerreFon,
    surface = CremeGanvie,
    onSurface = TerreFon,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = BronzeAbomeyDark,
    outline = Outline,
    error = Color(0xFFD32F2F),
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
