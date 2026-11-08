package com.ceventic.android;

import java.util.Map;

final class NativeStrings {
  private static final Map<String, String[]> TEXT =
      Map.ofEntries(
          Map.entry(
              "Recorded goals complete.",
              new String[] {
                "أكملت أهدافك المسجّلة.",
                "Objetivos registrados cumplidos.",
                "Objectifs enregistrés atteints.",
                "已完成记录中的目标。"
              }),
          Map.entry(
              "Every recorded goal with a target was completed.",
              new String[] {
                "حققت جميع أهداف الإنجاز المسجّلة.",
                "Cumpliste todos los objetivos de finalización registrados.",
                "Tous les objectifs de réalisation enregistrés ont été atteints.",
                "所有已记录的完成目标均已达成。"
              }),
          Map.entry(
              "More tasks completed.",
              new String[] {
                "أنجزت مهام أكثر.",
                "Completaste más tareas.",
                "Vous avez terminé plus de tâches.",
                "完成了更多任务。"
              }),
          Map.entry(
              "More habit check-ins.",
              new String[] {
                "سجّلت عاداتك أكثر.",
                "Más registros de hábitos.",
                "Plus de suivis d’habitudes.",
                "习惯打卡更多了。"
              }),
          Map.entry(
              "More Athkar sessions.",
              new String[] {
                "أكملت جلسات أذكار أكثر.",
                "Más sesiones de Athkar.",
                "Plus de séances d’Athkar.",
                "完成了更多祈念时段。"
              }),
          Map.entry(
              "More workouts saved.",
              new String[] {
                "حفظت حصص تدريب أكثر.",
                "Más entrenamientos guardados.",
                "Plus de séances enregistrées.",
                "保存了更多训练。"
              }),
          Map.entry(
              "More exercises checked.",
              new String[] {
                "أنجزت تمارين أكثر.",
                "Completaste más ejercicios.",
                "Vous avez coché plus d’exercices.",
                "勾选完成了更多动作。"
              }),
          Map.entry(
              "A step forward in your recorded activity.",
              new String[] {
                "خطوة للأمام في نشاطك المسجّل.",
                "Un paso adelante en tu actividad registrada.",
                "Un pas en avant dans votre activité enregistrée.",
                "已记录的活动又向前迈进了一步。"
              }),
          Map.entry(
              "You kept your rhythm.",
              new String[] {
                "حافظت على إيقاعك.",
                "Mantuviste tu ritmo.",
                "Vous avez gardé votre rythme.",
                "你保持了自己的节奏。"
              }),
          Map.entry(
              "You matched your previous recorded total.",
              new String[] {
                "حققت نفس إجمالي الفترة السابقة المسجّل.",
                "Igualaste tu total registrado anterior.",
                "Vous avez égalé votre total enregistré précédent.",
                "与上一时段的记录总数持平。"
              }),
          Map.entry(
              "Room to build again.",
              new String[] {
                "فرصة لتبدأ من جديد.",
                "Una oportunidad para retomar.",
                "Une occasion de reprendre.",
                "可以重新慢慢积累。"
              }),
          Map.entry(
              "A quieter recorded total. Start again at your own pace.",
              new String[] {
                "كان نشاطك المسجّل أقل. ابدأ من جديد بالوتيرة التي تناسبك.",
                "Un total registrado menor. Retoma a tu ritmo.",
                "Un total enregistré plus faible. Reprenez à votre rythme.",
                "记录总数较少。按自己的节奏重新开始。"
              }),
          Map.entry(
              "Your progress starts here.",
              new String[] {
                "تقدّمك يبدأ هنا.",
                "Tu progreso empieza aquí.",
                "Vos progrès commencent ici.",
                "你的进步从这里开始。"
              }),
          Map.entry(
              "Not enough history to compare yet. Each record builds your picture.",
              new String[] {
                "لا يوجد سجل كافٍ للمقارنة بعد. كل تسجيل يجعل الصورة أوضح.",
                "Aún no hay suficiente historial para comparar. Cada registro cuenta.",
                "L’historique ne suffit pas encore pour comparer. Chaque enregistrement précise"
                    + " votre bilan.",
                "暂时没有足够历史记录可供比较。每次记录都能让进度更清晰。"
              }),
          Map.entry(
              "vs previous period",
              new String[] {
                "مقارنة بالفترة السابقة",
                "respecto al periodo anterior",
                "par rapport à la période précédente",
                "相比上一时段"
              }),
          Map.entry("Previously", new String[] {"سابقًا", "Antes", "Précédemment", "之前"}),
          Map.entry("Previous", new String[] {"السابقة", "Anterior", "Précédente", "上一时段"}),
          Map.entry(
              "This period", new String[] {"هذه الفترة", "Este periodo", "Cette période", "本时段"}),
          Map.entry(
              "Recorded days",
              new String[] {"الأيام المسجّلة", "Días registrados", "Jours enregistrés", "有记录的天数"}),
          Map.entry(
              "Keep building at your own pace.",
              new String[] {
                "واصل بالوتيرة التي تناسبك.",
                "Sigue avanzando a tu ritmo.",
                "Continuez à votre rythme.",
                "按自己的节奏继续积累。"
              }),
          Map.entry(
              "Your overview", new String[] {"لمحتك العامة", "Tu resumen", "Votre aperçu", "你的概览"}),
          Map.entry("Your rhythm", new String[] {"إيقاعك", "Tu ritmo", "Votre rythme", "你的节奏"}),
          Map.entry("Training", new String[] {"التدريب", "Entrenamiento", "Entraînement", "训练"}),
          Map.entry(
              "Completed sessions",
              new String[] {
                "الجلسات المكتملة", "Sesiones completadas", "Séances terminées", "已完成时段"
              }),
          Map.entry(
              "Daily recap",
              new String[] {"ملخّص يومي", "Resumen diario", "Bilan quotidien", "每日总结"}),
          Map.entry(
              "Weekly recap",
              new String[] {"ملخّص أسبوعي", "Resumen semanal", "Bilan hebdomadaire", "每周总结"}),
          Map.entry(
              "Monthly recap",
              new String[] {"ملخّص شهري", "Resumen mensual", "Bilan mensuel", "每月总结"}),
          Map.entry(
              "Recorded activity",
              new String[] {
                "النشاط المسجّل", "Actividad registrada", "Activité enregistrée", "已记录活动"
              }),
          Map.entry(
              "Your activity", new String[] {"نشاطك", "Tu actividad", "Votre activité", "你的活动"}),
          Map.entry(
              "Progress is offline. Check connection in Recap settings.",
              new String[] {
                "التقدم غير متاح الآن. افحص الاتصال من إعدادات الملخص.",
                "Progreso sin conexión. Comprueba la conexión en ajustes.",
                "Progression hors ligne. Vérifiez la connexion dans les réglages.",
                "进度暂时离线。请在总结设置中检查连接。"
              }),
          Map.entry(
              "Unlock detected",
              new String[] {
                "تم رصد فتح الهاتف", "Desbloqueo detectado", "Déverrouillage détecté", "已检测到解锁"
              }),
          Map.entry(
              "Your unlock screen is working",
              new String[] {
                "شاشة فتح الهاتف تعمل",
                "La pantalla de desbloqueo funciona",
                "Votre écran de déverrouillage fonctionne",
                "解锁屏幕正常工作"
              }),
          Map.entry(
              "Connect your account to see your progress here.",
              new String[] {
                "اربط حسابك لعرض تقدمك هنا.",
                "Conecta tu cuenta para ver tu progreso.",
                "Connectez votre compte pour voir vos progrès.",
                "连接账户以查看进度。"
              }),
          Map.entry(
              "Syncing your saved progress…",
              new String[] {
                "جارٍ مزامنة تقدمك المحفوظ…",
                "Sincronizando tu progreso…",
                "Synchronisation de vos progrès…",
                "正在同步已保存的进度…"
              }),
          Map.entry(
              "No completed recap with recorded activity yet.",
              new String[] {
                "لا يوجد ملخص مكتمل بنشاط مسجل بعد.",
                "Todavía no hay un resumen con actividad registrada.",
                "Aucun bilan terminé avec une activité enregistrée.",
                "暂无包含已记录活动的完整总结。"
              }),
          Map.entry(
              "Shown on every unlock",
              new String[] {
                "يظهر عند كل فتح للهاتف",
                "Se muestra en cada desbloqueo",
                "Affiché à chaque déverrouillage",
                "每次解锁时显示"
              }),
          Map.entry(
              "Athkar sessions",
              new String[] {"جلسات الأذكار", "Sesiones de Athkar", "Séances d’Athkar", "祈念时段"}),
          Map.entry("Your day", new String[] {"ملخّص يومك", "Tu día", "Votre journée", "你的一天"}),
          Map.entry(
              "Your week", new String[] {"ملخّص أسبوعك", "Tu semana", "Votre semaine", "你的一周"}),
          Map.entry("Your month", new String[] {"ملخّص شهرك", "Tu mes", "Votre mois", "你的一个月"}),
          Map.entry(
              "Tasks done",
              new String[] {"المهام المنجزة", "Tareas hechas", "Tâches terminées", "已完成任务"}),
          Map.entry(
              "Habit check-ins",
              new String[] {
                "تسجيلات العادات", "Registros de hábitos", "Suivis d’habitudes", "习惯打卡"
              }),
          Map.entry(
              "Workouts saved",
              new String[] {
                "التمارين المحفوظة", "Entrenamientos guardados", "Séances enregistrées", "已保存训练"
              }),
          Map.entry(
              "Exercises checked",
              new String[] {
                "التمارين المنجزة", "Ejercicios marcados", "Exercices cochés", "已勾选动作"
              }),
          Map.entry(
              "Athkar sessions recorded",
              new String[] {
                "جلسات الأذكار المسجّلة",
                "Sesiones de Athkar registradas",
                "Séances d’Athkar enregistrées",
                "已记录祈念时段"
              }),
          Map.entry("Continue", new String[] {"متابعة", "Continuar", "Continuer", "继续"}),
          Map.entry("Close", new String[] {"إغلاق", "Cerrar", "Fermer", "关闭"}),
          Map.entry("Day", new String[] {"اليوم", "Día", "Jour", "日"}),
          Map.entry("Week", new String[] {"الأسبوع", "Semana", "Semaine", "周"}),
          Map.entry("Month", new String[] {"الشهر", "Mes", "Mois", "月"}),
          Map.entry(
              "Activity days",
              new String[] {"أيام النشاط", "Días con actividad", "Jours d’activité", "有活动的天数"}),
          Map.entry(
              "Unrecorded days are not failures.",
              new String[] {
                "غياب التسجيل لا يعني الفشل.",
                "Un día sin registros no es un fracaso.",
                "Un jour sans données n’est pas un échec.",
                "没有记录并不代表失败。"
              }),
          Map.entry(
              "Athkar history starts with this update. Only scheduled and prayer sessions are"
                  + " counted.",
              new String[] {
                "يبدأ سجلّ الأذكار من هذا التحديث. يشمل الجلسات المجدولة وأذكار الصلاة فقط.",
                "El historial de Athkar empieza con esta actualización. Solo cuenta sesiones"
                    + " programadas y tras la oración.",
                "L’historique Athkar débute avec cette mise à jour. Seules les séances programmées"
                    + " et après la prière comptent.",
                "祈念历史从此次更新开始，仅统计定时及礼拜后时段。"
              }),
          Map.entry(
              "Sample preview — not your account data",
              new String[] {
                "معاينة تجريبية — ليست بيانات حسابك",
                "Vista de ejemplo: no son tus datos",
                "Exemple : pas les données de votre compte",
                "示例预览，并非你的账户数据"
              }));

  static String text(RecapStore store, String key) {
    int i =
        switch (store.locale()) {
          case "ar" -> 0;
          case "es" -> 1;
          case "fr" -> 2;
          case "zh" -> 3;
          default -> -1;
        };
    return i < 0 || !TEXT.containsKey(key) ? key : TEXT.get(key)[i];
  }
}
