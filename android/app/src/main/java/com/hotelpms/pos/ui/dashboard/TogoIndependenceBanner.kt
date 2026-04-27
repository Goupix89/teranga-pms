package com.hotelpms.pos.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Calendar

private val TogoGreen  = Color(0xFF006A4E)
private val TogoYellow = Color(0xFFFFCE00)
private val TogoRed    = Color(0xFFD21034)

private fun isTodayApril27(): Boolean {
    val cal = Calendar.getInstance()
    return cal.get(Calendar.MONTH) == Calendar.APRIL && cal.get(Calendar.DAY_OF_MONTH) == 27
}

@Composable
fun TogoIndependenceBanner() {
    if (!isTodayApril27()) return

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Brush.horizontalGradient(
                    colorStops = arrayOf(
                        0.00f to TogoGreen,
                        0.33f to TogoGreen,
                        0.33f to TogoYellow,
                        0.66f to TogoYellow,
                        0.66f to TogoRed,
                        1.00f to TogoRed,
                    )
                )
            )
            .padding(horizontal = 16.dp, vertical = 10.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxWidth(),
        ) {
            // Star decoration (left)
            Icon(
                Icons.Default.Star,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.7f),
                modifier = Modifier.size(14.dp),
            )
            Spacer(Modifier.width(10.dp))

            // Message
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "🇹🇬  Bonne fête de l'Indépendance !",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    style = LocalTextStyle.current.copy(
                        shadow = androidx.compose.ui.graphics.Shadow(
                            color = Color.Black.copy(alpha = 0.35f),
                            blurRadius = 4f,
                        )
                    ),
                )
                Spacer(Modifier.height(2.dp))
                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = Color.White.copy(alpha = 0.25f),
                    ) {
                        Text(
                            text = "27 Avril 1960 · 66 ans",
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "🕊️ Liberté, Travail, Solidarité",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 11.sp,
                        fontStyle = FontStyle.Italic,
                    )
                }
            }

            Spacer(Modifier.width(10.dp))
            // Star decoration (right)
            Icon(
                Icons.Default.Star,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.7f),
                modifier = Modifier.size(14.dp),
            )
        }
    }
}
