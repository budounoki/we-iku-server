import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Users, Gift, BellRing, Lightbulb, CheckCircle2,
  MessageSquare, BarChart3, Heart, Send, ShoppingBag,
  Baby, Droplets, Moon, Thermometer, AlertTriangle,
  Handshake, ExternalLink, Sparkles, Trophy, Sun, Clock, NotebookPen,
  Utensils, ListChecks, BarChart, CalendarX, FolderOpen, Sprout,
  CalendarDays, Edit3, Milk, HeartPulse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BottomNav } from "@/components/Navigation";

function Step({ num, title, desc, tip }: { num: number; title: string; desc: React.ReactNode; tip?: string }) {
  return (
    <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm" data-testid={`step-${num}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-400 text-white flex items-center justify-center text-sm font-bold shrink-0">
          {num}
        </div>
        <p className="text-[15px] font-bold text-gray-800">{title}</p>
      </div>
      <div className="text-[13.5px] leading-relaxed text-gray-500 pl-11">
        {desc}
      </div>
      {tip && (
        <div className="bg-purple-50 rounded-xl p-3 mt-3 ml-11">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
            <p className="text-[12.5px] leading-relaxed text-purple-600">{tip}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: typeof Baby; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-[16px] p-4 shadow-sm border border-gray-100 mb-2.5 flex gap-3.5 items-start" data-testid={`feature-${title}`}>
      <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-purple-500" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800 mb-1">{title}</p>
        <p className="text-[13px] leading-relaxed text-gray-500">{desc}</p>
      </div>
    </div>
  );
}

function PartnerInvite() {
  return (
    <div>
      <div className="bg-gradient-to-br from-purple-500 to-purple-400 rounded-[20px] p-6 mb-5 text-white">
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
          <Users className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-lg font-bold mb-1.5">パートナーを招待しよう</h2>
        <p className="text-[13px] opacity-85 leading-relaxed">
          We育は「ふたり」で使ってこそ本領発揮。招待は3分で完了します。
        </p>
      </div>

      <p className="text-[13.5px] leading-relaxed text-gray-500 mb-4">
        パートナーを招待すると、育児記録・貢献度ダッシュボード・Weボードのすべてがリアルタイムで共有されます。
      </p>

      <h3 className="text-[15px] font-bold text-purple-900 mb-3">招待の手順</h3>

      <Step num={1} title="パートナー用の招待コードを取得"
        desc="モニター登録時に、パートナー用の招待コードが必要な旨をWe育のLINE公式アカウントにメッセージしてください。パートナー専用のコードをお送りします。" />

      <Step num={2} title="パートナーにコードとURLを共有"
        desc={<>招待コードとアプリのURL（<span className="text-purple-600 font-semibold">we-iku.com</span>）をパートナーに伝えてください。LINEでそのまま転送するのが簡単です。</>} />

      <Step num={3} title="パートナーがログイン＋コード入力"
        desc="パートナーもLINEでログインし、招待コードを入力すればアカウント作成完了です。"
        tip="パートナーもホーム画面への追加をお忘れなく！設定ガイドをシェアしてあげてください。" />

      <Step num={4} title="アプリ内でパートナー連携"
        desc="設定画面 →「パートナー設定」からパートナーを連携します。連携が完了すると、すべての育児データがリアルタイムで同期されます。" />

      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-[18px] p-4 mt-4">
        <p className="text-sm font-bold text-purple-600 mb-2">連携するとできること</p>
        <div className="text-[13px] leading-loose text-purple-600 space-y-1">
          <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> 育児記録がリアルタイム同期</div>
          <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4 shrink-0" /> 貢献度ダッシュボードで分担を可視化</div>
          <div className="flex items-center gap-2"><Heart className="w-4 h-4 shrink-0" /> 「ありがとう」を送り合える</div>
          <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 shrink-0" /> Weボードでクイックメッセージ</div>
          <div className="flex items-center gap-2"><Gift className="w-4 h-4 shrink-0" /> ご褒美ショップのポイントを共有</div>
        </div>
      </div>
    </div>
  );
}

function RewardShop() {
  return (
    <div>
      <div className="bg-gradient-to-br from-indigo-400 to-purple-500 rounded-[20px] p-6 mb-5 text-white">
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
          <Gift className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-lg font-bold mb-1.5">ご褒美ショップを設定しよう</h2>
        <p className="text-[13px] opacity-85 leading-relaxed">
          「ありがとう」で貯まるWeポイント。ふたりだけのご褒美を設定しましょう。
        </p>
      </div>

      <p className="text-[13.5px] leading-relaxed text-gray-500 mb-4">
        育児の頑張りが「ありがとう」→ ポイント → ご褒美、という形で報われる仕組みです。最初からいくつかのクーポンが用意されていますが、ふたりに合ったオリジナルクーポンを追加するのがおすすめです。
      </p>

      <h3 className="text-[15px] font-bold text-purple-900 mb-3">最初から入っているクーポン</h3>

      <FeatureCard icon={Handshake} title="30分のマッサージ" desc="200ポイントで交換。パートナーからの至福の30分。" />
      <FeatureCard icon={ExternalLink} title="1時間の一人おでかけ" desc="300ポイント。カフェでも散歩でも、自分だけの時間。" />
      <FeatureCard icon={ShoppingBag} title="好きなランチ出前" desc="500ポイント。頑張った自分に好きなものを。" />
      <FeatureCard icon={Moon} title="朝までぐっすり睡眠" desc="1000ポイント。夜泣き対応をパートナーにお任せ。最高のご褒美。" />

      <h3 className="text-[15px] font-bold text-purple-900 mt-5 mb-3">カスタムクーポンを追加する</h3>

      <Step num={1} title="ご褒美タブを開く"
        desc="ナビゲーションの「ご褒美」アイコンをタップします。" />

      <Step num={2} title="「カスタムクーポンを追加」をタップ"
        desc="画面下部にある点線のボタンをタップします。" />

      <Step num={3} title="クーポンの内容を設定"
        desc="クーポン名（例：「映画に行く権利」）と必要ポイント数を入力します。"
        tip="ふたりで相談してポイント数を決めるのがおすすめ。お互いが納得できる「レート」にしましょう。" />

      <div className="bg-amber-50 rounded-[18px] p-4 mt-4 border border-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-amber-600" />
          <p className="text-sm font-bold text-amber-700">クーポンのアイデア集</p>
        </div>
        <div className="text-[13px] leading-loose text-amber-800">
          ・ 30分のゲーム時間（150pt）<br/>
          ・ 好きなスイーツを買ってきてもらう（200pt）<br/>
          ・ 半日のフリータイム（800pt）<br/>
          ・ 二人でディナー（デート）（1500pt）<br/>
          ・ 推しのライブに行く（2000pt）
        </div>
      </div>
    </div>
  );
}

function CryingRescue() {
  return (
    <div>
      <div className="bg-gradient-to-br from-pink-400 to-purple-400 rounded-[20px] p-6 mb-5 text-white">
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
          <BellRing className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-lg font-bold mb-1.5">泣き止みレスキューの使い方</h2>
        <p className="text-[13px] opacity-85 leading-relaxed">
          深夜3時、赤ちゃんが泣き止まない。そんな時の頼れる味方です。
        </p>
      </div>

      <p className="text-[13.5px] leading-relaxed text-gray-500 mb-4">
        ホーム画面の大きな紫色のボタン「泣き止みレスキュー」。SOSボタンを押すだけで、お子さまの状況に合わせた対処法を順番にガイドします。
      </p>

      <h3 className="text-[15px] font-bold text-purple-900 mb-3">使い方</h3>

      <Step num={1} title="SOSボタンをタップ"
        desc="ホーム画面の泣き止みレスキューにある「SOS」ボタンを押します。パニックの時でもワンタップで起動できます。" />

      <Step num={2} title="消去法ナビがスタート"
        desc="直近の育児ログ（最後の授乳時間、おむつ交換、睡眠時間など）をもとに、泣いている原因を一つずつ確認していきます。" />

      <Step num={3} title="対処法リストが表示"
        desc="可能性の高い順に対処法が表示されます。一つずつ試してみてください。"
        tip="「解決！」をタップすると記録に残ります。次回以降の参考にもなります。" />

      <h3 className="text-[15px] font-bold text-purple-900 mt-5 mb-3">ガイドの内容例</h3>

      <FeatureCard icon={Baby} title="おなかが空いているかも"
        desc="前回の授乳から3時間経っています。ミルクを試してみましょう。" />
      <FeatureCard icon={Droplets} title="おむつの確認"
        desc="最後のおむつ交換から2時間。チェックしてみてください。" />
      <FeatureCard icon={Moon} title="眠いのかもしれません"
        desc="起きてから4時間。抱っこやスワドルで寝かしつけを試してみましょう。" />
      <FeatureCard icon={Thermometer} title="体調の確認"
        desc="いつもと泣き方が違うと感じたら、体温を測ってみましょう。" />

      <div className="bg-red-50 rounded-[18px] p-4 mt-4 border border-red-200">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <p className="text-sm font-bold text-red-700">大切なお知らせ</p>
        </div>
        <p className="text-[13px] leading-relaxed text-red-800">
          泣き止みレスキューは育児のサポートツールであり、医療上のアドバイスではありません。お子さまの体調に不安がある場合は、必ず医療機関にご相談ください。
        </p>
      </div>

      <div className="bg-purple-50 rounded-[18px] p-4 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-purple-600" />
          <p className="text-sm font-bold text-purple-600">パートナーとの連携</p>
        </div>
        <p className="text-[13px] leading-relaxed text-purple-600">
          泣き止みレスキューを使うと、パートナーの画面にも通知が届きます。「今、赤ちゃんが泣いていて対応中」ということが伝わるので、駆けつけてバトンタッチしやすくなります。
        </p>
      </div>
    </div>
  );
}

function WhatsNew() {
  return (
    <div>
      <div className="bg-gradient-to-br from-amber-400 to-pink-400 rounded-[20px] p-6 mb-5 text-white">
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-lg font-bold mb-1.5">最新アップデート</h2>
        <p className="text-[13px] opacity-90 leading-relaxed">
          We育がもっと使いやすくなりました。新機能をご紹介します。
        </p>
      </div>

      <p className="text-[11px] text-gray-400 font-bold mb-3">2026年4月21日のアップデート</p>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Clock className="w-4.5 h-4.5 text-violet-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">抱っこに「終了時刻」を追加</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12">
          抱っこの記録で、開始時刻だけでなく「何時まで抱っこしたか」も入力できるようになりました。所要時間が自動計算されます。
        </p>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Sun className="w-4.5 h-4.5 text-indigo-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">画面の明るさを自分で時間設定</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12">
          自動ダークモードの切り替え時間を、自分のライフスタイルに合わせて自由に設定できるようになりました。日をまたぐ設定（例：22時〜7時）も可能です。
        </p>
        <p className="text-[11px] text-purple-500 mt-2 pl-12">
          設定 → 画面の明るさ → 自動
        </p>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Trophy className="w-4.5 h-4.5 text-amber-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">チーム育児スキルが大進化</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12 mb-2">
          全レベルが常に表示され、先のレベルを先取りで見られるようになりました。スキル数も大幅に増え、達成数に応じて「新米→ビギナー→中堅→達人→マスター→レジェンド」と称号が進化します。
        </p>
        <div className="bg-amber-50 rounded-xl p-3 ml-12 mt-2">
          <p className="text-[12px] text-amber-700 leading-relaxed">
            追加スキル例：公園リレー、ねんねルーティン、病気のチーム対応、ルール統一、ほめ言葉リレー、おこづかい、家族会議 など
          </p>
        </div>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <NotebookPen className="w-4.5 h-4.5 text-blue-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">ねんね記録にコメント欄</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12">
          ねんねログに「メモ」を残せるようになりました。寝かしつけの様子や夜泣きの内容など、後から振り返れます。タイムラインの編集ダイアログからも編集できます。
        </p>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-orange-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">おやつ記録がもっと簡単に</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12">
          内容入力が任意になりました。空欄のまま「サッと記録」を押すだけで「おやつを食べました」と記録できます。
        </p>
      </Card>

      <p className="text-[11px] text-gray-400 font-bold mb-3 mt-8">これまでのアップデート</p>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
            <HeartPulse className="w-4.5 h-4.5 text-rose-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">ママのからだ記録</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12 mb-2">
          産後のからだを、あなただけのために記録できます。お通じ・悪露・会陰の痛み・気分・睡眠・授乳トラブル・体重むくみまで。
        </p>
        <div className="bg-rose-50 rounded-xl p-3 ml-12 mt-2">
          <p className="text-[12px] text-rose-700 leading-relaxed">
            この記録はパートナーには見えません。記録が2件以上たまると「過去の記録 ▼ 見る」ボタンで全件まとめて確認・編集できます。けんこう画面の一番下から入力できます。
          </p>
        </div>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Baby className="w-4.5 h-4.5 text-violet-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">「抱っこ」記録ボタンが新登場</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12">
          「ずっと抱っこしていたことをパートナーに知ってほしい」というご要望にお応えしました。0〜6歳全フェーズで使えます。開始・終了時刻を入力すると「パパが抱っこしました（30分間）」のように記録されます。
        </p>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Milk className="w-4.5 h-4.5 text-blue-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">分析にミルク量(ml)グラフ</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12">
          分析ページにミルク量(ml)の表示を追加。7日間のグラフと先週比の比較ができます。
        </p>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <Edit3 className="w-4.5 h-4.5 text-orange-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">症状・体温ログを編集可能に</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12">
          「嘔吐」などの症状ログをタップすると、時刻・症状・メモを後から編集できるようになりました。
        </p>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center shrink-0">
            <CalendarDays className="w-4.5 h-4.5 text-cyan-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">健康ログに日付を表示</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12">
          体温・症状・予防接種のログに「今日」「4月9日」のような日付が追加されました。いつの記録かひと目でわかります。
        </p>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center shrink-0">
            <Sprout className="w-4.5 h-4.5 text-pink-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">寝かしつけの言葉をやさしく</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12">
          「ねんね予測がすぎた時の言葉が強くて焦った」というご意見を受け、寝かしつけにまつわるすべての言葉と色合いをやさしいトーンに見直しました。予測時刻が過ぎても、焦らせず、責めず、あなたのペースで大丈夫という気持ちが伝わる表現に。
        </p>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <FolderOpen className="w-4.5 h-4.5 text-emerald-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">振り返りに「園・予定」タブ</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12">
          振り返りページに「園・予定」タブを追加。園の記録・入学準備・しつけ・よていの4つがひとまとめで確認できます。当月に記録があるとタブに件数バッジも表示されます。「全部」タブでも一緒に見られます。
        </p>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
            <CalendarX className="w-4.5 h-4.5 text-yellow-600" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">分析から「あの日」を除外できる</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12">
          「おばあちゃんちに預けた日、記録ゼロで平均が崩れてる…」そんな日を除外できます。分析ページの最上部「分析から除外する日」パネルから、除外したい日をタップするだけ。
        </p>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <BarChart className="w-4.5 h-4.5 text-indigo-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">睡眠の合計 → 1日の平均に</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12">
          大きく表示していた夜間・昼間の合計を「1日あたりの平均時間」に変更。「夜は平均◯時間寝てくれている」がひと目でわかります。時間帯別ランキング(上位3位)はこれまでどおり14日間の合計で表示します。
        </p>
      </Card>

      <Card className="p-4 rounded-[20px] mb-3 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Utensils className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <p className="text-[15px] font-bold text-gray-800">離乳食の食べ具合が7段階に</p>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 pl-12 mb-2">
          より細かく食べ具合を記録できるようになりました。
        </p>
        <div className="bg-amber-50 rounded-xl p-3 ml-12 mt-2">
          <p className="text-[12px] text-amber-700 leading-relaxed">
            イヤイヤ → 少し → 1/3 → 半分 → 2/3 → 8割 → 完食
          </p>
        </div>
      </Card>

      <div className="bg-purple-50 rounded-[18px] p-4 mt-5">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
          <p className="text-[12.5px] leading-relaxed text-purple-600">
            ご要望・ご感想はLINEからお気軽にお寄せください。皆さまの声がWe育を育てます。
          </p>
        </div>
      </div>
    </div>
  );
}

const tabs = [
  { id: "whatsnew", label: "新機能", icon: Sparkles },
  { id: "partner", label: "パートナー招待", icon: Users },
  { id: "reward", label: "ご褒美ショップ", icon: Gift },
  { id: "rescue", label: "泣き止みレスキュー", icon: BellRing },
] as const;

export default function Tips() {
  const [activeTab, setActiveTab] = useState<string>("whatsnew");

  const ActiveComponent = activeTab === "whatsnew" ? WhatsNew
    : activeTab === "partner" ? PartnerInvite
    : activeTab === "reward" ? RewardShop
    : CryingRescue;

  return (
    <div className="min-h-screen bg-[#FFFBF7] pb-24">
      <div className="bg-purple-900 px-5 pt-5 pb-4 text-center text-white">
        <div className="flex items-center justify-between mb-2">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="text-white/80 rounded-full" data-testid="button-tips-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div />
        </div>
        <p className="text-[13px] opacity-70 mb-1">We育</p>
        <h1 className="text-[19px] font-bold" data-testid="text-tips-title">使い方ヒント</h1>
      </div>

      <div className="flex gap-1.5 px-3 pt-3 bg-white shadow-sm sticky top-0 z-10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 pb-3 text-center rounded-t-xl transition-all ${
                isActive ? "border-b-[3px] border-purple-600" : "border-b-[3px] border-transparent"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className={`w-5 h-5 mx-auto mb-1 ${isActive ? "text-purple-600" : "text-gray-400"}`} />
              <span className={`text-[11px] ${isActive ? "font-bold text-purple-600" : "text-gray-400"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-4 pt-5 pb-10 max-w-lg mx-auto">
        <ActiveComponent />
      </div>

      <div className="px-5 py-5 text-center border-t border-purple-100">
        <p className="text-xs text-gray-500 mb-3">ご不明な点はお気軽にどうぞ</p>
        <a
          href="https://line.me"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-7 py-3 bg-[#06C755] text-white rounded-full text-sm font-bold shadow-sm"
          data-testid="link-line-contact"
        >
          <Send className="w-4 h-4" />
          LINE で質問する
        </a>
        <p className="text-[11px] text-gray-400 mt-4">
          We育（ウィーイク）| Produced by ぶどうの木
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
