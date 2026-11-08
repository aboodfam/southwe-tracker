package com.ceventic.android;

import java.util.Map;

final class NativeStrings {
  private static final Map<String, String[]> TEXT =
      Map.ofEntries(
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
