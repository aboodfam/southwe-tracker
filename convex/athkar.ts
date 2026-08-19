import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { LIMITS, assertIntegerInRange, cleanLongText, cleanText, enforceRateLimit } from "./security";

type DefaultDhikr = {
  text: string;
  translation?: string;
  targetCount: number;
  category: string;
};

// Built-in Athkar (Arabic without diacritics; categories match the UI tabs).
const DEFAULT_ATHKAR: DefaultDhikr[] = [
  {
    "category": "morning",
    "text": "بسم الله الرحمن الرحيم\nقُلْ هُوَ اللهُ أَحَدٌ، اللهُ الصَّمَدُ، لَمْ يَلِدْ وَلَمْ يُولَدْ، وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "أعوذ بالله من الشيطان الرجيم\nاللهُ لا إلهَ إلا هو الحيُّ القيومُ لا تأخذه سنةٌ ولا نومٌ له ما في السماوات وما في الأرض من ذا الذي يشفع عنده إلا بإذنه يعلم ما بين أيديهم وما خلفهم ولا يحيطون بشيءٍ من علمه إلا بما شاء وسع كرسيه السماوات والأرض ولا يؤوده حفظهما وهو العلي العظيم - آية الكرسي\n[255 البقرة]",
    "targetCount": 1
  },
  {
    "category": "morning",
    "text": "بسم الله الرحمن الرحيم\nقُلْ أَعُوذُ بِرَبِّ النَّاسِ، مَلِكِ النَّاسِ، إِلٰهِ النَّاسِ، مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ، الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ، مِنَ الْجِنَّةِ وَالنَّاسِ.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "بسم الله الرحمن الرحيم\nقُلْ أَعُوذُ بِرَبِّ الْفَلَقِ، مِن شَرِّ مَا خَلَقَ، وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ، وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ، وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك، وأنا على عهدك ووعدك ما استطعت، أعوذ بك من شر ما صنعت، أبوء لك بنعمتك علي، وأبوء بذنبي فاغفر لي فإنه لا يغفر الذنوب إلا أنت.",
    "translation": "من قالها موقنًا بها حين يمسي ومات من ليلته دخل الجنة وكذلك حين يصبح.",
    "targetCount": 1
  },
  {
    "category": "morning",
    "text": "أصبحنا وأصبح الملك لله والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير. رب أسألك خير ما في هذا اليوم وخير ما بعده، وأعوذ بك من شر ما في هذا اليوم وشر ما بعده. رب أعوذ بك من الكسل وسوء الكبر. رب أعوذ بك من عذاب في النار وعذاب في القبر.",
    "targetCount": 1
  },
  {
    "category": "morning",
    "text": "اللهم إني أصبحت أشهدك، وأشهد حملة عرشك، وملائكتك، وجميع خلقك، أنك أنت الله لا إله إلا أنت وحدك لا شريك لك، وأن محمدًا عبدك ورسولك.",
    "translation": "من قالها أعتقه الله من النار.",
    "targetCount": 4
  },
  {
    "category": "morning",
    "text": "رضيت بالله ربًا وبالإسلام دينًا وبمحمد صلى الله عليه وسلم نبيًا.",
    "translation": "من قالها حين يصبح وحين يمسي كان حقًا على الله أن يرضيه يوم القيامة.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم.",
    "translation": "من قالها كفاه الله ما أهمه من أمر الدنيا والآخرة.",
    "targetCount": 7
  },
  {
    "category": "morning",
    "text": "اللهم ما أصبح بي من نعمة أو بأحد من خلقك فمنك وحدك لا شريك لك، فلك الحمد ولك الشكر.",
    "translation": "من قالها حين يصبح أدى شكر يومه.",
    "targetCount": 1
  },
  {
    "category": "morning",
    "text": "اللهم بك أصبحنا، وبك أمسينا، وبك نحيا وبك نموت، وإليك النشور.",
    "targetCount": 1
  },
  {
    "category": "morning",
    "text": "بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم.",
    "translation": "لم يضره من الله شيء.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "سبحان الله وبحمده، عدد خلقه، ورضا نفسه، وزنة عرشه، ومداد كلماته.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "أصبحنا على فطرة الإسلام، وعلى كلمة الإخلاص، وعلى دين نبينا محمد صلى الله عليه وسلم، وعلى ملة أبينا إبراهيم حنيفًا مسلمًا وما كان من المشركين.",
    "targetCount": 1
  },
  {
    "category": "morning",
    "text": "اللهم عافني في بدني، اللهم عافني في سمعي، اللهم عافني في بصري، لا إله إلا أنت.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "اللهم إني أعوذ بك من الكفر، والفقر، وأعوذ بك من عذاب القبر، لا إله إلا أنت.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "يا حي يا قيوم برحمتك أستغيث، أصلح لي شأني كله ولا تكلني إلى نفسي طرفة عين.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "اللهم إني أسألك العفو والعافية في الدنيا والآخرة. اللهم إني أسألك العفو والعافية في ديني ودنياي وأهلي ومالي. اللهم استر عوراتي وآمن روعاتي. اللهم احفظني من بين يدي ومن خلفي وعن يميني وعن شمالي ومن فوقي وأعوذ بعظمتك أن أغتال من تحتي.",
    "targetCount": 1
  },
  {
    "category": "morning",
    "text": "اللهم عالم الغيب والشهادة فاطر السماوات والأرض رب كل شيء ومليكه، أشهد أن لا إله إلا أنت، أعوذ بك من شر نفسي ومن شر الشيطان وشركه، وأن أقترف على نفسي سوءًا أو أجره إلى مسلم.",
    "targetCount": 1
  },
  {
    "category": "morning",
    "text": "أصبحنا وأصبح الملك لله رب العالمين. اللهم إني أسألك خير هذا اليوم: فتحه، ونصره، ونوره، وبركته، وهداه، وأعوذ بك من شر ما فيه وشر ما بعده.",
    "targetCount": 1
  },
  {
    "category": "morning",
    "text": "اللهم صل وسلم وبارك على نبينا محمد.",
    "translation": "من صلى علي حين يصبح وحين يمسي أدركته شفاعتي يوم القيامة.",
    "targetCount": 10
  },
  {
    "category": "morning",
    "text": "أعوذ بكلمات الله التامات من شر ما خلق.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "اللهم إني أعوذ بك من الهم والحزن، وأعوذ بك من العجز والكسل، وأعوذ بك من الجبن والبخل، وأعوذ بك من غلبة الدين وقهر الرجال.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "اللهم إني أعوذ بك من أن أشرك بك شيئًا أعلمه، وأستغفرك لما لا أعلمه.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "يا رب، لك الحمد كما ينبغي لجلال وجهك، ولعظيم سلطانك.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "أستغفر الله العظيم الذي لا إله إلا هو الحي القيوم، وأتوب إليه.",
    "targetCount": 3
  },
  {
    "category": "morning",
    "text": "اللهم أنت ربي لا إله إلا أنت، عليك توكلت، وأنت رب العرش العظيم، ما شاء الله كان، وما لم يشأ لم يكن، ولا حول ولا قوة إلا بالله العلي العظيم، أعلم أن الله على كل شيء قدير، وأن الله قد أحاط بكل شيء علماً، اللهم إني أعوذ بك من شر نفسي ومن شر كل دابة أنت آخذ بناصيتها، إن ربي على صراط مستقيم.",
    "targetCount": 1
  },
  {
    "category": "morning",
    "text": "اللهم إني أسألك علماً نافعاً، ورزقاً طيباً، وعملاً متقبلاً.",
    "targetCount": 1
  },
  {
    "category": "morning",
    "text": "سبحان الله وبحمده.",
    "translation": "كانت له عدد عشر رقاب، وكتبت له مئة حسنة، ومحيت عنه مئة سيئة، وكانت له حرزًا من الشيطان.",
    "targetCount": 100
  },
  {
    "category": "morning",
    "text": "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.",
    "targetCount": 100
  },
  {
    "category": "morning",
    "text": "أستغفر الله وأتوب إليه.",
    "targetCount": 100
  },
{
    "category": "evening",
    "text": "اية الكرسي: الله لا اله الا هو الحي القيوم لا تاخذه سنة ولا نوم له ما في السماوات وما في الارض من ذا الذي يشفع عنده الا باذنه يعلم ما بين ايديهم وما خلفهم ولا يحيطون بشيء من علمه الا بما شاء وسع كرسيه السماوات والارض ولا يؤوده حفظهما وهو العلي العظيم.",
    "targetCount": 1
  },
  {
    "category": "evening",
    "text": "قل هو الله احد. الله الصمد. لم يلد ولم يولد. ولم يكن له كفوا احد.",
    "targetCount": 3
  },
  {
    "category": "evening",
    "text": "قل اعوذ برب الفلق. من شر ما خلق. ومن شر غاسق اذا وقب. ومن شر النفاثات في العقد. ومن شر حاسد اذا حسد.",
    "targetCount": 3
  },
  {
    "category": "evening",
    "text": "قل اعوذ برب الناس. ملك الناس. اله الناس. من شر الوسواس الخناس. الذي يوسوس في صدور الناس. من الجنة والناس.",
    "targetCount": 3
  },
  {
    "category": "evening",
    "text": "امسينا وامسى الملك لله والحمد لله، لا اله الا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير. رب اسالك خير ما في هذه الليلة وخير ما بعدها واعوذ بك من شر ما في هذه الليلة وشر ما بعدها. رب اعوذ بك من الكسل وسوء الكبر. رب اعوذ بك من عذاب في النار وعذاب في القبر.",
    "targetCount": 1
  },
  {
    "category": "evening",
    "text": "اللهم بك امسينا وبك اصبحنا وبك نحيا وبك نموت واليك المصير.",
    "targetCount": 1
  },
  {
    "category": "evening",
    "text": "رضيت بالله ربا وبالاسلام دينا وبمحمد صلى الله عليه وسلم نبيا.",
    "targetCount": 3
  },
  {
    "category": "evening",
    "text": "بسم الله الذي لا يضر مع اسمه شيء في الارض ولا في السماء وهو السميع العليم.",
    "targetCount": 3
  },
  {
    "category": "evening",
    "text": "حسبي الله لا اله الا هو عليه توكلت وهو رب العرش العظيم.",
    "targetCount": 7
  },
  {
    "category": "evening",
    "text": "سبحان الله وبحمده.",
    "targetCount": 100
  },
  {
    "category": "evening",
    "text": "اللهم اني اسالك العفو والعافية في الدنيا والاخرة. اللهم اني اسالك العفو والعافية في ديني ودنياي واهلي ومالي. اللهم استر عوراتي وامن روعاتي. اللهم احفظني من بين يدي ومن خلفي وعن يميني وعن شمالي ومن فوقي واعوذ بعظمتك ان اغتال من تحتي.",
    "targetCount": 1
  },
  {
    "category": "prayer",
    "text": "استغفر الله.",
    "targetCount": 3
  },
  {
    "category": "prayer",
    "text": "اللهم انت السلام ومنك السلام تباركت يا ذا الجلال والاكرام.",
    "targetCount": 1
  },
  {
    "category": "prayer",
    "text": "سبحان الله.",
    "targetCount": 33
  },
  {
    "category": "prayer",
    "text": "الحمد لله.",
    "targetCount": 33
  },
  {
    "category": "prayer",
    "text": "الله اكبر.",
    "targetCount": 34
  },
  {
    "category": "prayer",
    "text": "اية الكرسي: الله لا اله الا هو الحي القيوم لا تاخذه سنة ولا نوم له ما في السماوات وما في الارض من ذا الذي يشفع عنده الا باذنه يعلم ما بين ايديهم وما خلفهم ولا يحيطون بشيء من علمه الا بما شاء وسع كرسيه السماوات والارض ولا يؤوده حفظهما وهو العلي العظيم.",
    "targetCount": 1
  },
  {
    "category": "prayer",
    "text": "لا اله الا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير. اللهم لا مانع لما اعطيت ولا معطي لما منعت ولا ينفع ذا الجد منك الجد.",
    "targetCount": 1
  },
  {
    "category": "before_sleep",
    "text": "اية الكرسي: الله لا اله الا هو الحي القيوم لا تاخذه سنة ولا نوم له ما في السماوات وما في الارض من ذا الذي يشفع عنده الا باذنه يعلم ما بين ايديهم وما خلفهم ولا يحيطون بشيء من علمه الا بما شاء وسع كرسيه السماوات والارض ولا يؤوده حفظهما وهو العلي العظيم.",
    "targetCount": 1
  },
  {
    "category": "before_sleep",
    "text": "امن الرسول بما انزل اليه من ربه والمؤمنون... (اخر ايتين من سورة البقرة).",
    "targetCount": 1
  },
  {
    "category": "before_sleep",
    "text": "قل هو الله احد. الله الصمد. لم يلد ولم يولد. ولم يكن له كفوا احد.",
    "targetCount": 3
  },
  {
    "category": "before_sleep",
    "text": "قل اعوذ برب الفلق. من شر ما خلق. ومن شر غاسق اذا وقب. ومن شر النفاثات في العقد. ومن شر حاسد اذا حسد.",
    "targetCount": 3
  },
  {
    "category": "before_sleep",
    "text": "قل اعوذ برب الناس. ملك الناس. اله الناس. من شر الوسواس الخناس. الذي يوسوس في صدور الناس. من الجنة والناس.",
    "targetCount": 3
  },
  {
    "category": "before_sleep",
    "text": "سبحان الله.",
    "targetCount": 33
  },
  {
    "category": "before_sleep",
    "text": "الحمد لله.",
    "targetCount": 33
  },
  {
    "category": "before_sleep",
    "text": "الله اكبر.",
    "targetCount": 34
  },
  {
    "category": "before_sleep",
    "text": "باسمك اللهم اموت واحيا.",
    "targetCount": 1
  },
  {
    "category": "waking_up",
    "text": "الحمد لله الذي احيانا بعد ما اماتنا واليه النشور.",
    "targetCount": 1
  },
  {
    "category": "waking_up",
    "text": "لا اله الا الله وحده لا شريك له له الملك وله الحمد وهو على كل شيء قدير. سبحان الله والحمد لله ولا اله الا الله والله اكبر ولا حول ولا قوة الا بالله.",
    "targetCount": 1
  }
];

export const getAthkar = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("athkar")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(LIMITS.athkarTotal);
  },
});

export const ensureDefaultAthkar = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    // Don't throw here: the UI can call this during auth init.
    if (!userId) return { seeded: false, count: 0 };

    const existing = await ctx.db
      .query("athkar")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(LIMITS.athkarTotal);

    const MORNING_SENTINEL =
      "سبحان الله وبحمده، عدد خلقه، ورضا نفسه، وزنة عرشه، ومداد كلماته.";

    const existingMorning = existing.filter((d) => d.category === "morning");
    const hasMorningSentinel = existingMorning.some((d) => d.text === MORNING_SENTINEL);
    const didReplaceMorning = existingMorning.length > 0 && !hasMorningSentinel;

    if (didReplaceMorning) {
      for (const d of existingMorning) await ctx.db.delete(d._id);
      const morningDefaults = DEFAULT_ATHKAR.filter((d) => d.category === "morning");
      for (const item of morningDefaults) {
        await ctx.db.insert("athkar", {
          userId,
          text: item.text,
          translation: item.translation,
          targetCount: item.targetCount,
          currentCount: 0,
          category: item.category,
          isCompleted: false,
        });
      }
    }

    const after = await ctx.db
      .query("athkar")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(LIMITS.athkarTotal);

    const existingTexts = new Set(after.map((d) => d.text));
    let added = 0;
    for (const item of DEFAULT_ATHKAR) {
      if (existingTexts.has(item.text)) continue;
      if (after.length + added >= LIMITS.athkarTotal) break;
      await ctx.db.insert("athkar", {
        userId,
        text: item.text,
        translation: item.translation,
        targetCount: item.targetCount,
        currentCount: 0,
        category: item.category,
        isCompleted: false,
      });
      added += 1;
    }

    return { seeded: added > 0 || didReplaceMorning, count: added };
  },
});

export const incrementCount = mutation({
  args: { dhikrId: v.id("athkar") },
  handler: async (ctx, { dhikrId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const dhikr = await ctx.db.get(dhikrId);
    if (!dhikr || dhikr.userId !== userId) throw new Error("Dhikr not found");

    // Idempotent at the target: avoids pointless writes if a button is double-clicked.
    if (dhikr.currentCount >= dhikr.targetCount) return { completed: true };

    const next = Math.min(dhikr.currentCount + 1, dhikr.targetCount);
    const completed = next >= dhikr.targetCount;
    await ctx.db.patch(dhikrId, { currentCount: next, isCompleted: completed });
    return { completed };
  },
});

export const resetCount = mutation({
  args: { dhikrId: v.id("athkar") },
  handler: async (ctx, { dhikrId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const dhikr = await ctx.db.get(dhikrId);
    if (!dhikr || dhikr.userId !== userId) throw new Error("Dhikr not found");
    if (dhikr.currentCount === 0 && !dhikr.isCompleted) return;
    await ctx.db.patch(dhikrId, { currentCount: 0, isCompleted: false });
  },
});

const ALLOWED_CATEGORIES = new Set(["morning", "evening", "prayer", "before_sleep", "waking_up", "custom"]);
function cleanCategory(category: string) {
  const clean = cleanText(category, "Category", LIMITS.dhikrCategory).toLowerCase();
  if (!ALLOWED_CATEGORIES.has(clean)) throw new Error("Invalid Athkar category");
  return clean;
}

export const addDhikr = mutation({
  args: {
    text: v.string(),
    translation: v.optional(v.string()),
    targetCount: v.number(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await enforceRateLimit(ctx, userId, "athkar:structure", 20, 60_000);
    const existing = await ctx.db
      .query("athkar")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(LIMITS.athkarTotal);
    if (existing.length >= LIMITS.athkarTotal) {
      throw new Error(`You can have up to ${LIMITS.athkarTotal} Athkar entries`);
    }

    const text = cleanLongText(args.text, "Dhikr", LIMITS.dhikrText);
    const translation = args.translation === undefined ? undefined : cleanLongText(args.translation, "Translation", LIMITS.dhikrTranslation, { optional: true });
    const targetCount = assertIntegerInRange(args.targetCount, "Target count", 1, 1_000);
    const category = cleanCategory(args.category);

    return await ctx.db.insert("athkar", {
      userId,
      text,
      translation,
      targetCount,
      currentCount: 0,
      category,
      isCompleted: false,
    });
  },
});

export const updateDhikr = mutation({
  args: {
    dhikrId: v.id("athkar"),
    text: v.string(),
    translation: v.optional(v.string()),
    targetCount: v.number(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await enforceRateLimit(ctx, userId, "athkar:structure", 20, 60_000);
    const dhikr = await ctx.db.get(args.dhikrId);
    if (!dhikr || dhikr.userId !== userId) throw new Error("Dhikr not found");

    const text = cleanLongText(args.text, "Dhikr", LIMITS.dhikrText);
    const translation = args.translation === undefined ? undefined : cleanLongText(args.translation, "Translation", LIMITS.dhikrTranslation, { optional: true });
    const targetCount = assertIntegerInRange(args.targetCount, "Target count", 1, 1_000);
    const category = cleanCategory(args.category);
    const currentCount = Math.min(dhikr.currentCount, targetCount);

    await ctx.db.patch(args.dhikrId, {
      text,
      translation,
      targetCount,
      category,
      currentCount,
      isCompleted: currentCount >= targetCount,
    });
  },
});

export const deleteDhikr = mutation({
  args: { dhikrId: v.id("athkar") },
  handler: async (ctx, { dhikrId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await enforceRateLimit(ctx, userId, "athkar:structure", 20, 60_000);

    const dhikr = await ctx.db.get(dhikrId);
    if (!dhikr || dhikr.userId !== userId) throw new Error("Dhikr not found");
    await ctx.db.delete(dhikrId);
  },
});

export const resetCategory = mutation({
  args: { category: v.string() },
  handler: async (ctx, { category }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await enforceRateLimit(ctx, userId, "athkar:reset", 12, 60_000);
    const clean = cleanCategory(category);
    const toReset = await ctx.db
      .query("athkar")
      .withIndex("by_user_category", (q) => q.eq("userId", userId).eq("category", clean))
      .take(LIMITS.athkarTotal);

    let reset = 0;
    for (const doc of toReset) {
      if (doc.currentCount === 0 && !doc.isCompleted) continue;
      await ctx.db.patch(doc._id, { currentCount: 0, isCompleted: false });
      reset += 1;
    }
    return { reset };
  },
});
