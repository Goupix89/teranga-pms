package com.hotelpms.pos.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Calendar

private val LabourRed = Color(0xFFB71C1C)

private fun isTodayMay1(): Boolean {
    val cal = Calendar.getInstance()
    return cal.get(Calendar.MONTH) == Calendar.MAY && cal.get(Calendar.DAY_OF_MONTH) == 1
}

@Composable
fun LabourDayBanner() {
    if (!isTodayMay1()) return

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(LabourRed)
            .padding(horizontal = 16.dp, vertical = 10.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("🌹", fontSize = 18.sp)
            Spacer(Modifier.width(4.dp))
            Text("✊", fontSize = 16.sp)
            Spacer(Modifier.width(10.dp))

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "Bonne Fête du Travail !",
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
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = Color.White.copy(alpha = 0.2f),
                    ) {
                        Text(
                            text = "1er Mai",
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "Hommage à tous les travailleurs ⚙️",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 11.sp,
                        fontStyle = FontStyle.Italic,
                    )
                }
            }

            Spacer(Modifier.width(10.dp))
            Text("✊", fontSize = 16.sp)
            Spacer(Modifier.width(4.dp))
            Text("🌹", fontSize = 18.sp)
        }
    }
}
