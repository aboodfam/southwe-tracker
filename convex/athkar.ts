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

// Compared with the user's Khatmah recording (2026-09-14). Keep existing
// split cards (e.g. the three surahs) rather than duplicate combined cards.
// Quran text: https://quran.com/al-baqarah/285-286
// Prayer/sleep/waking references: https://sunnah.com/hisn (chapters 25, 28, 1).
const LAST_TWO_VERSES = "آمن الرسول بما أنزل إليه من ربه والمؤمنون كل آمن بالله وملائكته وكتبه ورسله لا نفرق بين أحد من رسله وقالوا سمعنا وأطعنا غفرانك ربنا وإليك المصير ﴿٢٨٥﴾\nلا يكلف الله نفسا إلا وسعها لها ما كسبت وعليها ما اكتسبت ربنا لا تؤاخذنا إن نسينا أو أخطأنا ربنا ولا تحمل علينا إصرا كما حملته على الذين من قبلنا ربنا ولا تحملنا ما لا طاقة لنا به واعف عنا واغفر لنا وارحمنا أنت مولانا فانصرنا على القوم الكافرين ﴿٢٨٦﴾";
const OLD_VERSES = "امن الرسول بما انزل اليه من ربه والمؤمنون... (اخر ايتين من سورة البقرة).";
const oldVersesDefault = DEFAULT_ATHKAR.find(d => d.text === OLD_VERSES)!;
oldVersesDefault.text = LAST_TWO_VERSES;
const wakingTahlil = DEFAULT_ATHKAR.find(d => d.category === "waking_up" && d.text.startsWith("لا اله"))!;
const OLD_WAKING_TAHLIL = wakingTahlil.text;
wakingTahlil.text = "حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم. لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، وهو على كل شيء قدير. سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر، ولا حول ولا قوة إلا بالله العلي العظيم. رب اغفر لي.";
wakingTahlil.translation = "يتضمن ذكر من تعار من الليل (صحيح البخاري 1154)؛ جملة حسبي الله من الآية 129 من سورة التوبة كما في التسجيل، وليست من لفظ ذلك الحديث.";
for (const item of DEFAULT_ATHKAR) {
  if (item.category === "before_sleep" && item.text.startsWith("قل ")) {
    item.translation = "تجمع الكفين وتنفث فيهما وتقرأ الإخلاص والفلق والناس، ثم تمسح بهما ما استطعت من جسدك، بدءا بالرأس والوجه؛ ثلاث مرات. صحيح البخاري 5017.";
  }
  // Use the recording's 33/33/33 + tahlil for new accounts. Existing saved
  // targets (including the valid 33/33/34 variant) are not overwritten.
  if (item.category === "prayer" && item.text === "الله اكبر.") item.targetCount = 33;
}

function fromMorning(prefix: string, category: string, targetCount?: number): DefaultDhikr {
  const source = DEFAULT_ATHKAR.find(d => d.category === "morning" && d.text.startsWith(prefix));
  if (!source) throw new Error(`Missing Athkar source: ${prefix}`);
  return { text: source.text, category, targetCount: targetCount ?? source.targetCount };
}

DEFAULT_ATHKAR.push(
  ...[
    "اللهم أنت ربي لا إله إلا أنت، خلقتني", "سبحان الله وبحمده، عدد خلقه",
    "اللهم عافني", "اللهم إني أعوذ بك من الكفر", "يا حي يا قيوم",
    "اللهم عالم الغيب", "أعوذ بكلمات", "اللهم صل وسلم",
    "اللهم إني أعوذ بك من أن أشرك", "اللهم إني أعوذ بك من الهم",
    "أستغفر الله العظيم", "يا رب، لك الحمد", "اللهم أنت ربي لا إله إلا أنت، عليك",
    "لا إله إلا الله وحده",
  ].map(prefix => fromMorning(prefix, "evening")),
  { category: "evening", text: LAST_TWO_VERSES, targetCount: 1 },
  { category: "evening", text: "اللهم إني أمسيت أشهدك، وأشهد حملة عرشك، وملائكتك، وجميع خلقك، أنك أنت الله لا إله إلا أنت وحدك لا شريك لك، وأن محمدا عبدك ورسولك.", targetCount: 4 },
  { category: "evening", text: "اللهم ما أمسى بي من نعمة أو بأحد من خلقك فمنك وحدك لا شريك لك، فلك الحمد ولك الشكر.", targetCount: 1 },
  { category: "evening", text: "أمسينا على فطرة الإسلام، وعلى كلمة الإخلاص، وعلى دين نبينا محمد صلى الله عليه وسلم، وعلى ملة أبينا إبراهيم حنيفا مسلما وما كان من المشركين.", targetCount: 1 },
  { category: "evening", text: "أمسينا وأمسى الملك لله رب العالمين، اللهم إني أسألك خير هذه الليلة: فتحها ونصرها ونورها وبركتها وهداها، وأعوذ بك من شر ما فيها وشر ما بعدها.", targetCount: 1 },
  { category: "prayer", text: "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، وهو على كل شيء قدير. لا حول ولا قوة إلا بالله، لا إله إلا الله، ولا نعبد إلا إياه، له النعمة وله الفضل وله الثناء الحسن، لا إله إلا الله مخلصين له الدين ولو كره الكافرون.", targetCount: 1 },
  { ...fromMorning("لا إله إلا الله وحده", "prayer", 1), translation: "تمام المائة بعد التسبيح والتحميد والتكبير ثلاثا وثلاثين. صحيح مسلم 597." },
  ...DEFAULT_ATHKAR.filter(d => d.category === "evening" && d.text.startsWith("قل ")).map(d => ({ ...d, category: "prayer", translation: "تقرأ مرة بعد كل صلاة، وثلاث مرات بعد الفجر والمغرب." })),
  { category: "prayer", text: "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، يحيي ويميت وهو على كل شيء قدير.", targetCount: 10, translation: "بعد الفجر والمغرب." },
  { ...fromMorning("اللهم إني أسألك علماً", "prayer"), translation: "بعد السلام من صلاة الفجر." },
  { category: "prayer", text: "اللهم أجرني من النار.", targetCount: 7, translation: "ورد في التسجيل بعد الفجر والمغرب؛ حديث تخصيصه بسبع مرات ضعفه الألباني (ضعيف الترغيب 250)." },
  { category: "prayer", text: "اللهم أعني على ذكرك وشكرك وحسن عبادتك.", targetCount: 1 },
  { category: "before_sleep", text: "باسمك ربي وضعت جنبي وبك أرفعه، فإن أمسكت نفسي فارحمها، وإن أرسلتها فاحفظها بما تحفظ به عبادك الصالحين.", targetCount: 1 },
  { category: "before_sleep", text: "اللهم إنك خلقت نفسي وأنت توفاها، لك مماتها ومحياها، إن أحييتها فاحفظها، وإن أمتها فاغفر لها، اللهم إني أسألك العافية.", targetCount: 1 },
  { category: "before_sleep", text: "اللهم قني عذابك يوم تبعث عبادك.", targetCount: 3 },
  { category: "before_sleep", text: "الحمد لله الذي أطعمنا وسقانا وكفانا وآوانا، فكم ممن لا كافي له ولا مؤوي.", targetCount: 1 },
  fromMorning("اللهم عالم الغيب", "before_sleep"),
  { category: "before_sleep", text: "اللهم أسلمت نفسي إليك، وفوضت أمري إليك، ووجهت وجهي إليك، وألجأت ظهري إليك، رغبة ورهبة إليك، لا ملجأ ولا منجا منك إلا إليك، آمنت بكتابك الذي أنزلت، وبنبيك الذي أرسلت.", targetCount: 1 },
  { ...fromMorning("بسم الله الذي", "waking_up", 1), translation: "كما ورد في التسجيل؛ الذكر مأثور صباحا ومساء ثلاث مرات، وليس تخصيصه بالاستيقاظ مرة واحدة ثابتا بهذا الحديث." },
  { ...fromMorning("حسبي الله", "waking_up", 1), translation: "دعاء قرآني (التوبة: 129)، مدرج في قسم الاستيقاظ في التسجيل دون نسبة تخصيصه بهذا الوقت إلى السنة." },
  { category: "waking_up", text: "الحمد لله الذي عافاني في جسدي، ورد علي روحي، وأذن لي بذكره.", targetCount: 1 },
);

// Match cosmetic spelling differences, but never deduplicate across categories.
function dhikrKey(category: string, text: string) {
  return category + ":" + text.normalize("NFKC")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06edـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/[^\p{L}\p{N}]/gu, "");
}

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

    // Repair only the exact old built-in placeholder, in place. Never reset
    // counts, delete custom entries, or replace a whole category on upgrade.
    for (const row of existing) {
      if (row.category === "before_sleep" && row.text === OLD_VERSES) {
        await ctx.db.patch(row._id, { text: LAST_TWO_VERSES });
        row.text = LAST_TWO_VERSES;
      }
      if (row.category === "waking_up" && row.text === OLD_WAKING_TAHLIL) {
        await ctx.db.patch(row._id, { text: wakingTahlil.text });
        row.text = wakingTahlil.text;
      }
      const matchingDefault = DEFAULT_ATHKAR.find(d => d.category === row.category && d.text === row.text);
      if (!row.translation && matchingDefault?.translation) {
        await ctx.db.patch(row._id, { translation: matchingDefault.translation });
      }
      if (row.category === "morning" && row.text === "سبحان الله وبحمده." && row.translation === "كانت له عدد عشر رقاب، وكتبت له مئة حسنة، ومحيت عنه مئة سيئة، وكانت له حرزًا من الشيطان.") {
        // This old note belongs to tahlil, not tasbih. Leave personal notes alone.
        await ctx.db.patch(row._id, { translation: undefined });
      }
    }
    const existingTexts = new Set(existing.map(d => dhikrKey(d.category, d.text)));
    let added = 0;
    for (const item of DEFAULT_ATHKAR) {
      const key = dhikrKey(item.category, item.text);
      if (existingTexts.has(key)) continue;
      if (existing.length + added >= LIMITS.athkarTotal) break;
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
      existingTexts.add(key);
    }

    return { seeded: added > 0, count: added };
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

    if (dhikr.category !== "custom" && dhikr.category !== "prayer") {
      const session = await ctx.db
        .query("athkarSessions")
        .withIndex("by_user_category_session", (q) =>
          q.eq("userId", userId).eq("category", dhikr.category).eq("sessionKey", "active")
        )
        .unique();
      if (session) {
        await ctx.db.patch(session._id, {
          completed: false,
          completedWindowKey: undefined,
          completedAt: undefined,
          updatedAt: Date.now(),
        });
      }
    }
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

    const session = await ctx.db
      .query("athkarSessions")
      .withIndex("by_user_category_session", (q) =>
        q.eq("userId", userId).eq("category", clean).eq("sessionKey", "active")
      )
      .unique();
    if (session) {
      await ctx.db.patch(session._id, {
        currentIndex: 0,
        completed: false,
        completedWindowKey: undefined,
        completedAt: undefined,
        updatedAt: Date.now(),
      });
    }
    return { reset };
  },
});


const SCHEDULED_CATEGORIES = new Set(["morning", "evening", "before_sleep", "waking_up"]);

function cleanSessionKey(sessionKey: string) {
  return cleanText(sessionKey, "Athkar session", 160);
}

function cleanWindowKey(windowKey: string) {
  return cleanText(windowKey, "Athkar window", 80);
}

async function getSession(ctx: any, userId: any, category: string, sessionKey: string) {
  return await ctx.db
    .query("athkarSessions")
    .withIndex("by_user_category_session", (q: any) =>
      q.eq("userId", userId).eq("category", category).eq("sessionKey", sessionKey)
    )
    .unique();
}

async function getCategoryDocs(ctx: any, userId: any, category: string) {
  return await ctx.db
    .query("athkar")
    .withIndex("by_user_category", (q: any) => q.eq("userId", userId).eq("category", category))
    .take(LIMITS.athkarTotal);
}

function firstIncompleteIndex(items: Array<{ currentCount: number; targetCount: number }>) {
  const index = items.findIndex((item) => item.currentCount < item.targetCount);
  return index === -1 ? Math.max(0, items.length - 1) : index;
}

export const getCategorySession = query({
  args: { category: v.string() },
  handler: async (ctx, { category }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const clean = cleanCategory(category);
    if (!SCHEDULED_CATEGORIES.has(clean)) return null;
    return await getSession(ctx, userId, clean, "active");
  },
});

export const prepareCategorySession = mutation({
  args: { category: v.string(), windowKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const category = cleanCategory(args.category);
    if (!SCHEDULED_CATEGORIES.has(category)) throw new Error("This Athkar section does not use scheduled progress");
    const windowKey = cleanWindowKey(args.windowKey);
    const items = await getCategoryDocs(ctx, userId, category);
    let session = await getSession(ctx, userId, category, "active");
    const allComplete = items.length > 0 && items.every((item: any) => item.currentCount >= item.targetCount);

    if (!session) {
      const id = await ctx.db.insert("athkarSessions", {
        userId,
        category,
        sessionKey: "active",
        currentIndex: firstIncompleteIndex(items),
        completed: allComplete,
        completedWindowKey: allComplete ? windowKey : undefined,
        completedAt: allComplete ? Date.now() : undefined,
        updatedAt: Date.now(),
      });
      return await ctx.db.get(id);
    }

    if (session.completed && session.completedWindowKey && session.completedWindowKey !== windowKey) {
      for (const item of items) {
        if (item.currentCount === 0 && !item.isCompleted) continue;
        await ctx.db.patch(item._id, { currentCount: 0, isCompleted: false });
      }
      await ctx.db.patch(session._id, {
        currentIndex: 0,
        completed: false,
        completedWindowKey: undefined,
        completedAt: undefined,
        updatedAt: Date.now(),
      });
      return { ...session, currentIndex: 0, completed: false, completedWindowKey: undefined, completedAt: undefined };
    }

    if (allComplete && !session.completed) {
      await ctx.db.patch(session._id, {
        currentIndex: Math.max(0, items.length - 1),
        completed: true,
        completedWindowKey: windowKey,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { ...session, currentIndex: Math.max(0, items.length - 1), completed: true, completedWindowKey: windowKey };
    }

    if (session.completed && !session.completedWindowKey) {
      await ctx.db.patch(session._id, { completedWindowKey: windowKey, updatedAt: Date.now() });
      return { ...session, completedWindowKey: windowKey };
    }

    const maxIndex = Math.max(0, items.length - 1);
    if (session.currentIndex > maxIndex) {
      await ctx.db.patch(session._id, { currentIndex: maxIndex, updatedAt: Date.now() });
      return { ...session, currentIndex: maxIndex };
    }
    return session;
  },
});

export const saveCategoryIndex = mutation({
  args: { category: v.string(), currentIndex: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const category = cleanCategory(args.category);
    if (!SCHEDULED_CATEGORIES.has(category)) return;
    const currentIndex = assertIntegerInRange(args.currentIndex, "Athkar position", 0, LIMITS.athkarTotal);
    await enforceRateLimit(ctx, userId, "athkar:position", 180, 60_000);
    const existing = await getSession(ctx, userId, category, "active");
    if (existing) {
      await ctx.db.patch(existing._id, { currentIndex, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("athkarSessions", {
        userId,
        category,
        sessionKey: "active",
        currentIndex,
        completed: false,
        updatedAt: Date.now(),
      });
    }
  },
});

export const markCategoryCompleted = mutation({
  args: { category: v.string(), windowKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const category = cleanCategory(args.category);
    if (!SCHEDULED_CATEGORIES.has(category)) return { completed: false };
    const windowKey = cleanWindowKey(args.windowKey);
    const items = await getCategoryDocs(ctx, userId, category);
    if (!items.length || !items.every((item: any) => item.currentCount >= item.targetCount)) return { completed: false };
    const existing = await getSession(ctx, userId, category, "active");
    const patch = {
      currentIndex: Math.max(0, items.length - 1),
      completed: true,
      completedWindowKey: windowKey,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("athkarSessions", { userId, category, sessionKey: "active", ...patch });
    return { completed: true };
  },
});

function normalizedPrayerCounts(items: any[], stored?: Array<{ dhikrId: any; count: number }>) {
  const previous = new Map((stored ?? []).map((row) => [String(row.dhikrId), row.count]));
  return items.map((item) => ({
    dhikrId: item._id,
    count: Math.max(0, Math.min(item.targetCount, previous.get(String(item._id)) ?? 0)),
  }));
}

function prayerSessionComplete(items: any[], counts: Array<{ dhikrId: any; count: number }>) {
  const byId = new Map(counts.map((row) => [String(row.dhikrId), row.count]));
  return items.length > 0 && items.every((item) => (byId.get(String(item._id)) ?? 0) >= item.targetCount);
}

export const getPrayerSession = query({
  args: { sessionKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const sessionKey = cleanSessionKey(args.sessionKey);
    const items = await getCategoryDocs(ctx, userId, "prayer");
    const session = await getSession(ctx, userId, "prayer", sessionKey);
    const counts = normalizedPrayerCounts(items, session?.counts);
    return {
      sessionKey,
      currentIndex: Math.min(session?.currentIndex ?? 0, Math.max(0, items.length - 1)),
      counts,
      completed: prayerSessionComplete(items, counts),
      completedAt: session?.completedAt,
    };
  },
});

export const ensurePrayerSession = mutation({
  args: { sessionKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const sessionKey = cleanSessionKey(args.sessionKey);
    const items = await getCategoryDocs(ctx, userId, "prayer");
    const existing = await getSession(ctx, userId, "prayer", sessionKey);
    if (existing) {
      const counts = normalizedPrayerCounts(items, existing.counts);
      const completed = prayerSessionComplete(items, counts);
      await ctx.db.patch(existing._id, { counts, completed, updatedAt: Date.now(), ...(completed && !existing.completedAt ? { completedAt: Date.now() } : {}) });
      return { currentIndex: Math.min(existing.currentIndex, Math.max(0, items.length - 1)), counts, completed };
    }

    const legacyCounts = sessionKey === "prayer:manual"
      ? items.map((item: any) => ({ dhikrId: item._id, count: Math.min(item.currentCount, item.targetCount) }))
      : items.map((item: any) => ({ dhikrId: item._id, count: 0 }));
    const completed = prayerSessionComplete(items, legacyCounts);
    await ctx.db.insert("athkarSessions", {
      userId,
      category: "prayer",
      sessionKey,
      currentIndex: completed ? Math.max(0, items.length - 1) : 0,
      counts: legacyCounts,
      completed,
      completedAt: completed ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return { currentIndex: completed ? Math.max(0, items.length - 1) : 0, counts: legacyCounts, completed };
  },
});

export const incrementPrayerSession = mutation({
  args: { sessionKey: v.string(), dhikrId: v.id("athkar") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const sessionKey = cleanSessionKey(args.sessionKey);
    const dhikr = await ctx.db.get(args.dhikrId);
    if (!dhikr || dhikr.userId !== userId || dhikr.category !== "prayer") throw new Error("Prayer dhikr not found");
    const items = await getCategoryDocs(ctx, userId, "prayer");
    let session = await getSession(ctx, userId, "prayer", sessionKey);
    if (!session) {
      const counts = items.map((item: any) => ({ dhikrId: item._id, count: 0 }));
      const id = await ctx.db.insert("athkarSessions", { userId, category: "prayer", sessionKey, currentIndex: 0, counts, completed: false, updatedAt: Date.now() });
      session = await ctx.db.get(id);
    }
    if (!session) throw new Error("Prayer session unavailable");
    const counts = normalizedPrayerCounts(items, session.counts);
    const row = counts.find((item) => String(item.dhikrId) === String(args.dhikrId));
    if (!row) throw new Error("Prayer dhikr not found");
    row.count = Math.min(dhikr.targetCount, row.count + 1);
    const completed = prayerSessionComplete(items, counts);
    await ctx.db.patch(session._id, {
      counts,
      completed,
      completedAt: completed ? (session.completedAt ?? Date.now()) : undefined,
      updatedAt: Date.now(),
    });
    return { count: row.count, completed };
  },
});

export const savePrayerIndex = mutation({
  args: { sessionKey: v.string(), currentIndex: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const sessionKey = cleanSessionKey(args.sessionKey);
    const currentIndex = assertIntegerInRange(args.currentIndex, "Athkar position", 0, LIMITS.athkarTotal);
    await enforceRateLimit(ctx, userId, "athkar:position", 180, 60_000);
    const items = await getCategoryDocs(ctx, userId, "prayer");
    const existing = await getSession(ctx, userId, "prayer", sessionKey);
    if (existing) {
      await ctx.db.patch(existing._id, { currentIndex, counts: normalizedPrayerCounts(items, existing.counts), updatedAt: Date.now() });
    } else {
      await ctx.db.insert("athkarSessions", {
        userId,
        category: "prayer",
        sessionKey,
        currentIndex,
        counts: items.map((item: any) => ({ dhikrId: item._id, count: 0 })),
        completed: false,
        updatedAt: Date.now(),
      });
    }
  },
});

export const resetPrayerDhikr = mutation({
  args: { sessionKey: v.string(), dhikrId: v.id("athkar") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const sessionKey = cleanSessionKey(args.sessionKey);
    const dhikr = await ctx.db.get(args.dhikrId);
    if (!dhikr || dhikr.userId !== userId || dhikr.category !== "prayer") throw new Error("Prayer dhikr not found");
    const items = await getCategoryDocs(ctx, userId, "prayer");
    const session = await getSession(ctx, userId, "prayer", sessionKey);
    if (!session) return;
    const counts = normalizedPrayerCounts(items, session.counts).map((row) => String(row.dhikrId) === String(args.dhikrId) ? { ...row, count: 0 } : row);
    await ctx.db.patch(session._id, { counts, completed: false, completedAt: undefined, updatedAt: Date.now() });
  },
});
