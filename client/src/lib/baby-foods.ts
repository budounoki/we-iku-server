export interface BabyFoodIngredient {
  name: string;
  category: string;
}

export interface BabyFoodProduct {
  id: string;
  brand: string;
  name: string;
  stage: "5m" | "7m" | "9m" | "12m";
  ingredients: BabyFoodIngredient[];
}

export const BABY_FOOD_STAGE_LABELS: Record<string, string> = {
  "5m": "5〜6ヶ月ごろ",
  "7m": "7〜8ヶ月ごろ",
  "9m": "9〜11ヶ月ごろ",
  "12m": "12〜18ヶ月ごろ",
};

export const BABY_FOOD_PRODUCTS: BabyFoodProduct[] = [
  // === 和光堂 5〜6ヶ月 ===
  {
    id: "wako-5m-01",
    brand: "和光堂",
    name: "はじめての離乳食 裏ごしかぼちゃ",
    stage: "5m",
    ingredients: [
      { name: "かぼちゃ", category: "vegetables" },
    ],
  },
  {
    id: "wako-5m-02",
    brand: "和光堂",
    name: "はじめての離乳食 裏ごしにんじん",
    stage: "5m",
    ingredients: [
      { name: "にんじん", category: "vegetables" },
    ],
  },
  {
    id: "wako-5m-03",
    brand: "和光堂",
    name: "はじめての離乳食 裏ごしほうれん草",
    stage: "5m",
    ingredients: [
      { name: "ほうれん草", category: "vegetables" },
    ],
  },
  {
    id: "wako-5m-04",
    brand: "和光堂",
    name: "はじめての離乳食 裏ごしとうもろこし",
    stage: "5m",
    ingredients: [
      { name: "とうもろこし", category: "vegetables" },
    ],
  },
  {
    id: "wako-5m-05",
    brand: "和光堂",
    name: "はじめての離乳食 裏ごしりんご",
    stage: "5m",
    ingredients: [
      { name: "りんご", category: "fruits" },
    ],
  },
  {
    id: "wako-5m-06",
    brand: "和光堂",
    name: "はじめての離乳食 なめらかキューブ いちご",
    stage: "5m",
    ingredients: [
      { name: "いちご", category: "fruits" },
    ],
  },
  {
    id: "wako-5m-07",
    brand: "和光堂",
    name: "はじめての離乳食 なめらかキューブ もも",
    stage: "5m",
    ingredients: [
      { name: "もも", category: "fruits" },
    ],
  },
  {
    id: "wako-5m-08",
    brand: "和光堂",
    name: "はじめての離乳食 裏ごし豆腐",
    stage: "5m",
    ingredients: [
      { name: "豆腐", category: "protein_beans" },
    ],
  },
  {
    id: "wako-5m-09",
    brand: "和光堂",
    name: "はじめての離乳食 裏ごしたい",
    stage: "5m",
    ingredients: [
      { name: "たい", category: "protein_fish" },
    ],
  },
  {
    id: "wako-5m-10",
    brand: "和光堂",
    name: "はじめての離乳食 鶏ささみと野菜",
    stage: "5m",
    ingredients: [
      { name: "鶏ささみ", category: "protein_meat" },
      { name: "にんじん", category: "vegetables" },
      { name: "さつまいも", category: "vegetables" },
    ],
  },
  // === キューピー 5〜6ヶ月 ===
  {
    id: "kewpie-5m-01",
    brand: "キューピー",
    name: "瓶詰 かぼちゃとさつまいも",
    stage: "5m",
    ingredients: [
      { name: "かぼちゃ", category: "vegetables" },
      { name: "さつまいも", category: "vegetables" },
    ],
  },
  {
    id: "kewpie-5m-02",
    brand: "キューピー",
    name: "瓶詰 にんじんとじゃがいも",
    stage: "5m",
    ingredients: [
      { name: "にんじん", category: "vegetables" },
      { name: "じゃがいも", category: "vegetables" },
    ],
  },
  {
    id: "kewpie-5m-03",
    brand: "キューピー",
    name: "瓶詰 りんごとバナナ",
    stage: "5m",
    ingredients: [
      { name: "りんご", category: "fruits" },
      { name: "バナナ", category: "fruits" },
    ],
  },
  {
    id: "kewpie-5m-04",
    brand: "キューピー",
    name: "瓶詰 しらすと豆腐",
    stage: "5m",
    ingredients: [
      { name: "しらす", category: "protein_fish" },
      { name: "豆腐", category: "protein_beans" },
    ],
  },
  // === 和光堂 7〜8ヶ月 ===
  {
    id: "wako-7m-01",
    brand: "和光堂",
    name: "グーグーキッチン かぼちゃのおかゆ",
    stage: "7m",
    ingredients: [
      { name: "おかゆ（7倍がゆ）", category: "grains" },
      { name: "かぼちゃ", category: "vegetables" },
    ],
  },
  {
    id: "wako-7m-02",
    brand: "和光堂",
    name: "グーグーキッチン 鮭とほうれん草のおかゆ",
    stage: "7m",
    ingredients: [
      { name: "おかゆ（7倍がゆ）", category: "grains" },
      { name: "さけ", category: "protein_fish" },
      { name: "ほうれん草", category: "vegetables" },
    ],
  },
  {
    id: "wako-7m-03",
    brand: "和光堂",
    name: "グーグーキッチン 鶏ささみと野菜のうどん",
    stage: "7m",
    ingredients: [
      { name: "うどん", category: "grains" },
      { name: "鶏ささみ", category: "protein_meat" },
      { name: "にんじん", category: "vegetables" },
      { name: "玉ねぎ", category: "vegetables" },
    ],
  },
  {
    id: "wako-7m-04",
    brand: "和光堂",
    name: "グーグーキッチン ポテトのポタージュ",
    stage: "7m",
    ingredients: [
      { name: "じゃがいも", category: "vegetables" },
      { name: "玉ねぎ", category: "vegetables" },
      { name: "牛乳", category: "protein_egg_dairy" },
    ],
  },
  {
    id: "wako-7m-05",
    brand: "和光堂",
    name: "グーグーキッチン まぐろとにんじんのおかゆ",
    stage: "7m",
    ingredients: [
      { name: "おかゆ（7倍がゆ）", category: "grains" },
      { name: "まぐろ", category: "protein_fish" },
      { name: "にんじん", category: "vegetables" },
    ],
  },
  // === キューピー 7〜8ヶ月 ===
  {
    id: "kewpie-7m-01",
    brand: "キューピー",
    name: "瓶詰 チキンとトマト煮",
    stage: "7m",
    ingredients: [
      { name: "鶏ささみ", category: "protein_meat" },
      { name: "トマト", category: "vegetables" },
      { name: "玉ねぎ", category: "vegetables" },
    ],
  },
  {
    id: "kewpie-7m-02",
    brand: "キューピー",
    name: "瓶詰 豆腐と野菜のあんかけ",
    stage: "7m",
    ingredients: [
      { name: "豆腐", category: "protein_beans" },
      { name: "にんじん", category: "vegetables" },
      { name: "ブロッコリー", category: "vegetables" },
    ],
  },
  {
    id: "kewpie-7m-03",
    brand: "キューピー",
    name: "瓶詰 卵と野菜のスープ",
    stage: "7m",
    ingredients: [
      { name: "卵黄", category: "protein_egg_dairy" },
      { name: "にんじん", category: "vegetables" },
      { name: "玉ねぎ", category: "vegetables" },
    ],
  },
  // === ピジョン 7〜8ヶ月 ===
  {
    id: "pigeon-7m-01",
    brand: "ピジョン",
    name: "管理栄養士さんのおいしいレシピ かぼちゃとひじき",
    stage: "7m",
    ingredients: [
      { name: "かぼちゃ", category: "vegetables" },
      { name: "おかゆ（7倍がゆ）", category: "grains" },
    ],
  },
  {
    id: "pigeon-7m-02",
    brand: "ピジョン",
    name: "管理栄養士さんのおいしいレシピ さけとブロッコリー",
    stage: "7m",
    ingredients: [
      { name: "さけ", category: "protein_fish" },
      { name: "ブロッコリー", category: "vegetables" },
      { name: "じゃがいも", category: "vegetables" },
    ],
  },
  // === 和光堂 9〜11ヶ月 ===
  {
    id: "wako-9m-01",
    brand: "和光堂",
    name: "グーグーキッチン 鶏と根菜の煮物",
    stage: "9m",
    ingredients: [
      { name: "鶏もも肉", category: "protein_meat" },
      { name: "にんじん", category: "vegetables" },
      { name: "大根", category: "vegetables" },
      { name: "じゃがいも", category: "vegetables" },
    ],
  },
  {
    id: "wako-9m-02",
    brand: "和光堂",
    name: "グーグーキッチン まぐろとほうれん草のそうめん",
    stage: "9m",
    ingredients: [
      { name: "そうめん", category: "grains" },
      { name: "まぐろ", category: "protein_fish" },
      { name: "ほうれん草", category: "vegetables" },
    ],
  },
  {
    id: "wako-9m-03",
    brand: "和光堂",
    name: "グーグーキッチン 和風だし煮うどん",
    stage: "9m",
    ingredients: [
      { name: "うどん", category: "grains" },
      { name: "にんじん", category: "vegetables" },
      { name: "小松菜", category: "vegetables" },
      { name: "だし（かつお）", category: "other" },
    ],
  },
  {
    id: "wako-9m-04",
    brand: "和光堂",
    name: "グーグーキッチン 豆腐と納豆の和風おかゆ",
    stage: "9m",
    ingredients: [
      { name: "おかゆ（7倍がゆ）", category: "grains" },
      { name: "豆腐", category: "protein_beans" },
      { name: "納豆", category: "protein_beans" },
    ],
  },
  // === キューピー 9〜11ヶ月 ===
  {
    id: "kewpie-9m-01",
    brand: "キューピー",
    name: "瓶詰 牛肉と野菜のやわらか煮",
    stage: "9m",
    ingredients: [
      { name: "牛ひき肉", category: "protein_meat" },
      { name: "にんじん", category: "vegetables" },
      { name: "じゃがいも", category: "vegetables" },
      { name: "玉ねぎ", category: "vegetables" },
    ],
  },
  {
    id: "kewpie-9m-02",
    brand: "キューピー",
    name: "瓶詰 レバーと野菜",
    stage: "9m",
    ingredients: [
      { name: "レバー", category: "protein_meat" },
      { name: "にんじん", category: "vegetables" },
      { name: "ほうれん草", category: "vegetables" },
    ],
  },
  {
    id: "kewpie-9m-03",
    brand: "キューピー",
    name: "瓶詰 たらとブロッコリーのチーズ煮",
    stage: "9m",
    ingredients: [
      { name: "たら", category: "protein_fish" },
      { name: "ブロッコリー", category: "vegetables" },
      { name: "チーズ", category: "protein_egg_dairy" },
    ],
  },
  // === 和光堂 12〜18ヶ月 ===
  {
    id: "wako-12m-01",
    brand: "和光堂",
    name: "グーグーキッチン 鶏と野菜のカレーうどん",
    stage: "12m",
    ingredients: [
      { name: "うどん", category: "grains" },
      { name: "鶏もも肉", category: "protein_meat" },
      { name: "にんじん", category: "vegetables" },
      { name: "玉ねぎ", category: "vegetables" },
    ],
  },
  {
    id: "wako-12m-02",
    brand: "和光堂",
    name: "グーグーキッチン ツナと野菜のトマトパスタ",
    stage: "12m",
    ingredients: [
      { name: "パスタ", category: "grains" },
      { name: "ツナ（水煮）", category: "protein_fish" },
      { name: "トマト", category: "vegetables" },
      { name: "玉ねぎ", category: "vegetables" },
    ],
  },
  {
    id: "wako-12m-03",
    brand: "和光堂",
    name: "グーグーキッチン 豚肉と根菜の和風うどん",
    stage: "12m",
    ingredients: [
      { name: "うどん", category: "grains" },
      { name: "豚ひき肉", category: "protein_meat" },
      { name: "大根", category: "vegetables" },
      { name: "にんじん", category: "vegetables" },
      { name: "みそ", category: "other" },
    ],
  },
  {
    id: "wako-12m-04",
    brand: "和光堂",
    name: "グーグーキッチン さけとほうれん草のクリームパスタ",
    stage: "12m",
    ingredients: [
      { name: "パスタ", category: "grains" },
      { name: "さけ", category: "protein_fish" },
      { name: "ほうれん草", category: "vegetables" },
      { name: "牛乳", category: "protein_egg_dairy" },
    ],
  },
  // === キューピー 12〜18ヶ月 ===
  {
    id: "kewpie-12m-01",
    brand: "キューピー",
    name: "瓶詰 チキンのトマト煮込みごはん",
    stage: "12m",
    ingredients: [
      { name: "鶏もも肉", category: "protein_meat" },
      { name: "トマト", category: "vegetables" },
      { name: "玉ねぎ", category: "vegetables" },
      { name: "パスタ", category: "grains" },
    ],
  },
  {
    id: "kewpie-12m-02",
    brand: "キューピー",
    name: "瓶詰 牛肉と野菜のシチュー",
    stage: "12m",
    ingredients: [
      { name: "牛ひき肉", category: "protein_meat" },
      { name: "じゃがいも", category: "vegetables" },
      { name: "にんじん", category: "vegetables" },
      { name: "玉ねぎ", category: "vegetables" },
      { name: "牛乳", category: "protein_egg_dairy" },
    ],
  },
];

export const BABY_FOOD_BRANDS = [...new Set(BABY_FOOD_PRODUCTS.map(p => p.brand))];
