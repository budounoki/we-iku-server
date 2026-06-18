import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type Tab = "privacy" | "terms";

export default function Legal() {
  const [tab, setTab] = useState<Tab>("privacy");

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-green-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-back-settings">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-black text-purple-800" data-testid="text-legal-title">
            {tab === "privacy" ? "プライバシーポリシー" : "サービス利用規約"}
          </h1>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${tab === "privacy" ? "bg-purple-600 text-white" : "bg-white text-purple-600 border border-purple-200"}`}
            onClick={() => setTab("privacy")}
            data-testid="button-tab-privacy"
          >
            プライバシーポリシー
          </button>
          <button
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${tab === "terms" ? "bg-purple-600 text-white" : "bg-white text-purple-600 border border-purple-200"}`}
            onClick={() => setTab("terms")}
            data-testid="button-tab-terms"
          >
            利用規約
          </button>
        </div>

        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          {tab === "privacy" ? <PrivacyPolicy /> : <TermsOfService />}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-black text-purple-800 mt-6 mb-2">{children}</h2>;
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-700 leading-relaxed mb-3">{children}</p>;
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside text-sm text-gray-700 leading-relaxed mb-3 space-y-1 pl-2">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

function PrivacyPolicy() {
  return (
    <div data-testid="content-privacy-policy">
      <h2 className="text-lg font-black text-purple-900 mb-1">We育（ウィーイク）</h2>
      <h3 className="text-base font-black text-purple-800 mb-2">プライバシーポリシー</h3>
      <p className="text-xs text-gray-500 mb-4">制定日：2026年3月4日<br />産前産後ケアホテル ぶどうの木</p>

      <Paragraph>
        本プライバシーポリシー（以下「本ポリシー」）は、産前産後ケアホテル ぶどうの木（以下「当社」）が提供する育児支援アプリケーション「We育（ウィーイク）」（以下「本アプリ」）における、ユーザーの個人情報およびプライバシー情報の取り扱いについて定めるものです。
      </Paragraph>
      <Paragraph>
        本アプリをご利用いただく前に、本ポリシーの内容をよくお読みください。本アプリをご利用いただいた場合、本ポリシーに同意いただいたものとみなします。
      </Paragraph>

      <SectionTitle>第1条（取得する情報）</SectionTitle>
      <Paragraph>当社は、本アプリの提供にあたり、以下の情報を取得します。</Paragraph>
      <p className="text-sm font-bold text-gray-800 mb-1">1-1. ユーザーが直接提供する情報</p>
      <List items={[
        "LINEアカウント情報（表示名、プロフィール画像、ユーザーID）",
        "お子さまの情報（ニックネーム、生年月日、性別）",
        "育児記録データ（授乳・ミルク、おむつ交換、睡眠、食事、トイレトレーニング等の記録）",
        "予防接種の記録（接種日、ワクチン種別）",
        "成長記録（身長、体重、「はじめて」の記録、ことばログ等）",
        "パートナーとの共有データ（Weボードのメッセージ、「ありがとう」の送受信記録、Weポイント）",
        "お問い合わせ内容、フィードバック",
      ]} />
      <p className="text-sm font-bold text-gray-800 mb-1">1-2. 自動的に取得する情報</p>
      <List items={[
        "アプリの利用状況（アクセス日時、利用機能、画面遷移）",
        "端末情報（OS種別、ブラウザ種別、画面サイズ）",
        "IPアドレス",
        "Cookieおよび類似技術による情報",
      ]} />

      <SectionTitle>第2条（利用目的）</SectionTitle>
      <Paragraph>当社は、取得した情報を以下の目的で利用します。</Paragraph>
      <List items={[
        "本アプリの機能提供（育児記録、パートナー間のデータ共有、AI機能による育児支援）",
        "お子さまの月齢・成長段階に応じたUIの最適化（消去法UI）",
        "予防接種スケジュールの管理および通知",
        "貢献度ダッシュボード、時給換算等の育児可視化機能の提供",
        "「ありがとう」ポイントおよびご褒美ショップ機能の運営",
        "本アプリの改善、新機能の開発",
        "ユーザーサポートへの対応",
        "利用状況の統計的分析（個人を特定しない形での分析）",
        "重要なお知らせ、アップデート情報等の通知",
      ]} />

      <SectionTitle>第3条（情報の共有・第三者提供）</SectionTitle>
      <Paragraph>当社は、以下の場合を除き、取得した個人情報を第三者に提供しません。</Paragraph>
      <List items={[
        "ユーザーの同意がある場合",
        "パートナーとしてユーザーが招待した相手への育児データの共有（本アプリの基本機能として）",
        "法令に基づき開示が求められた場合",
        "人の生命、身体または財産の保護のために必要があり、本人の同意を得ることが困難な場合",
        "統計的なデータなど、個人を識別できない状態に加工して提供する場合",
      ]} />

      <SectionTitle>第4条（AI機能におけるデータの取り扱い）</SectionTitle>
      <Paragraph>
        本アプリはAI技術を活用して、お子さまの月齢に応じた画面表示の最適化、睡眠予測、泣き止みレスキュー等の機能を提供します。
      </Paragraph>
      <Paragraph>
        AI機能の処理に使用するデータは、ユーザーが本アプリ内で入力した育児記録データに限定されます。AI機能の改善のために、個人を特定できない形でデータを統計的に分析する場合があります。
      </Paragraph>

      <SectionTitle>第5条（パートナー間のデータ共有）</SectionTitle>
      <Paragraph>本アプリは「ふたりで育てる」ことを目的としており、パートナー間で以下のデータが共有されます。</Paragraph>
      <List items={[
        "育児記録データ（授乳、おむつ、睡眠等）",
        "貢献度ダッシュボード（育児タスクの分担状況）",
        "Weボードのメッセージ",
        "「ありがとう」の送受信記録およびWeポイント",
        "お子さまの成長記録",
      ]} />
      <Paragraph>
        パートナーの招待はユーザー自身の操作によって行われ、招待されたパートナーは上記のデータを閲覧できます。パートナーの解除を行った場合、以降のデータ共有は停止されます。
      </Paragraph>

      <SectionTitle>第6条（お子さまの情報の保護）</SectionTitle>
      <Paragraph>当社は、お子さまの個人情報の保護を特に重視しています。</Paragraph>
      <List items={[
        "お子さまの情報は、本アプリの育児支援機能の提供に必要な範囲でのみ利用します",
        "お子さまの実名の入力は必須ではなく、ニックネームでのご利用を推奨しています",
        "お子さまの情報を広告目的で利用することはありません",
        "お子さまの情報を第三者に販売することは一切ありません",
      ]} />

      <SectionTitle>第7条（安全管理措置）</SectionTitle>
      <Paragraph>当社は、取得した個人情報の漏えい、滅失または毀損の防止のために、以下の安全管理措置を講じます。</Paragraph>
      <List items={[
        "通信の暗号化（SSL/TLS）",
        "データベースへのアクセス制限",
        "定期的なセキュリティ対策の見直し",
        "個人情報を取り扱う従業者に対する教育・監督",
      ]} />

      <SectionTitle>第8条（ユーザーの権利）</SectionTitle>
      <Paragraph>ユーザーは、当社に対して以下の請求を行うことができます。</Paragraph>
      <List items={[
        "保有する個人データの開示の請求",
        "個人データの内容が事実と異なる場合の訂正、追加または削除の請求",
        "個人データの利用停止または消去の請求",
        "個人データの第三者提供の停止の請求",
      ]} />
      <Paragraph>
        上記の請求は、本アプリ内のお問い合わせ機能または下記のお問い合わせ先までご連絡ください。ご本人確認のうえ、合理的な期間内に対応いたします。
      </Paragraph>

      <SectionTitle>第9条（アカウントの削除）</SectionTitle>
      <Paragraph>
        ユーザーは、本アプリのアカウントを削除することができます。アカウントを削除した場合、当該ユーザーに関連するすべてのデータ（育児記録、ポイント等）は、合理的な期間内に削除されます。ただし、法令により保存が義務付けられている情報については、当該法令に定める期間保存します。
      </Paragraph>

      <SectionTitle>第10条（Cookieおよび類似技術）</SectionTitle>
      <Paragraph>
        本アプリでは、サービスの品質向上およびユーザー体験の改善のために、Cookieおよび類似技術を使用する場合があります。ユーザーは、ブラウザの設定によりCookieの受け入れを拒否することができますが、一部の機能が利用できなくなる場合があります。
      </Paragraph>

      <SectionTitle>第11条（外部サービスとの連携）</SectionTitle>
      <Paragraph>
        本アプリは、LINEログインを利用した認証を提供しています。LINEログインを通じて取得する情報は、LINEヤフー株式会社のプライバシーポリシーに基づき取得されます。取得した情報の当社における利用については、本ポリシーが適用されます。
      </Paragraph>

      <SectionTitle>第12条（本ポリシーの変更）</SectionTitle>
      <Paragraph>
        当社は、必要に応じて本ポリシーの内容を変更することがあります。変更後のポリシーは、本アプリ内での通知またはLINE公式アカウントでの通知により効力を生じるものとします。
      </Paragraph>
      <Paragraph>
        ただし、個人情報の利用目的の変更など、ユーザーの同意が必要な変更を行う場合は、改めてユーザーの同意を取得します。
      </Paragraph>

      <SectionTitle>第13条（お問い合わせ先）</SectionTitle>
      <Paragraph>本ポリシーに関するお問い合わせは、以下までご連絡ください。</Paragraph>
      <div className="text-sm text-gray-700 leading-relaxed mb-3 pl-2">
        <p>事業者名：産前産後ケアホテル ぶどうの木</p>
        <p>サービス名：We育（ウィーイク）</p>
        <p>お問い合わせ方法：@we-iku</p>
      </div>

      <p className="text-xs text-gray-500 mt-6 text-right">2026年3月4日 制定</p>
    </div>
  );
}

function TermsOfService() {
  return (
    <div data-testid="content-terms-of-service">
      <h2 className="text-lg font-black text-purple-900 mb-1">We育（ウィーイク）</h2>
      <h3 className="text-base font-black text-purple-800 mb-2">サービス利用規約</h3>
      <p className="text-xs text-gray-500 mb-4">制定日：2026年3月4日<br />産前産後ケアホテル ぶどうの木</p>

      <Paragraph>
        本利用規約（以下「本規約」）は、産前産後ケアホテル ぶどうの木（以下「当社」）が提供する育児支援アプリケーション「We育（ウィーイク）」（以下「本アプリ」）の利用に関する条件を定めるものです。ユーザーの皆さまには、本規約に同意のうえ、本アプリをご利用いただきます。
      </Paragraph>

      <SectionTitle>第1条（定義）</SectionTitle>
      <Paragraph>本規約において、以下の用語は次の意味で使用します。</Paragraph>
      <List items={[
        "「ユーザー」とは、本アプリを利用するすべての方をいいます。",
        "「パートナー」とは、ユーザーが本アプリ上で育児データの共有相手として招待した方をいいます。",
        "「育児データ」とは、本アプリに入力された育児記録、成長記録、予防接種記録その他の情報をいいます。",
        "「Weポイント」とは、本アプリ内の「ありがとう」機能により付与されるポイントをいいます。",
        "「モニタープラン」とは、当社が指定する条件を満たすユーザーに提供する無料利用プランをいいます。",
      ]} />

      <SectionTitle>第2条（本規約への同意）</SectionTitle>
      <Paragraph>
        ユーザーは、本アプリの利用を開始した時点で、本規約に同意したものとみなされます。本規約に同意いただけない場合は、本アプリの利用をお控えください。
      </Paragraph>

      <SectionTitle>第3条（アカウントの登録）</SectionTitle>
      <List items={[
        "ユーザーは、LINEログインを通じて本アプリのアカウントを登録します。",
        "モニタープランをご利用の方は、当社が発行する招待コードの入力が必要です。",
        "ユーザーは、登録情報に虚偽がないことを保証するものとします。",
        "アカウントの管理責任はユーザーに帰属し、第三者への貸与、譲渡、売買等はできません。",
      ]} />

      <SectionTitle>第4条（モニタープラン）</SectionTitle>
      <Paragraph>モニタープランは、以下の条件を満たす方を対象とします。</Paragraph>
      <List items={[
        "0歳〜6歳のお子さまをお持ちの方",
        "過去に産前産後ケアホテル ぶどうの木をご利用いただいた方、またはご予約を入れている方",
      ]} />
      <List items={[
        "モニタープランの定員は先着50名様とします。",
        "モニタープランでは、お子さまが6歳になるまで、本アプリのすべての機能を無料でご利用いただけます。",
        "モニターユーザーには、アプリの改善のためにフィードバックのご協力をお願いする場合があります。",
      ]} />

      <SectionTitle>第5条（サービスの内容）</SectionTitle>
      <Paragraph>本アプリは、以下の機能を提供します（機能は随時追加・変更される場合があります）。</Paragraph>
      <List items={[
        "お子さまの月齢に応じた育児記録機能（消去法UI）",
        "パートナー間の育児データ共有・同期",
        "予防接種スケジュールのAI管理",
        "貢献度ダッシュボード・時給換算機能",
        "「ありがとう」ポイント・ご褒美ショップ",
        "Weボード（パートナー間のクイックメッセージ）",
        "AIによる育児支援機能（睡眠予測、泣き止みレスキュー等）",
      ]} />

      <SectionTitle>第6条（禁止事項）</SectionTitle>
      <Paragraph>ユーザーは、本アプリの利用にあたり、以下の行為を行ってはなりません。</Paragraph>
      <List items={[
        "法令または公序良俗に違反する行為",
        "当社または第三者の権利を侵害する行為",
        "本アプリの運営を妨害する行為",
        "不正アクセスまたはこれを試みる行為",
        "他のユーザーの個人情報を不正に収集する行為",
        "本アプリを本来の目的以外で使用する行為",
        "招待コードの不正使用、転売、共有等の行為",
        "その他、当社が不適切と判断する行為",
      ]} />

      <SectionTitle>第7条（Weポイントについて）</SectionTitle>
      <List items={[
        "Weポイントは、本アプリ内の「ありがとう」機能を通じて付与されます。",
        "Weポイントは、本アプリ内のご褒美ショップでのみ使用できます。",
        "Weポイントは、現金への換金、他のサービスへの移行はできません。",
        "アカウントを削除した場合、Weポイントは消滅します。",
      ]} />

      <SectionTitle>第8条（知的財産権）</SectionTitle>
      <Paragraph>
        本アプリに関する知的財産権（著作権、商標権等）は、当社または正当な権利者に帰属します。ユーザーが本アプリに入力した育児データについては、ユーザーに帰属します。ただし、当社は、本アプリの運営・改善に必要な範囲で、当該データを利用できるものとします。
      </Paragraph>

      <SectionTitle>第9条（免責事項）</SectionTitle>
      <List items={[
        "本アプリが提供する情報（AI機能による提案を含む）は、医療上のアドバイスを構成するものではありません。お子さまの健康に関する判断は、必ず医療専門家にご相談ください。",
        "当社は、本アプリの提供する情報の正確性、完全性、有用性について保証するものではありません。",
        "通信回線やシステム障害、天災等の不可抗力により生じた損害について、当社は責任を負いません。",
        "ユーザー間（パートナー間を含む）のトラブルについて、当社は責任を負いません。",
      ]} />

      <SectionTitle>第10条（サービスの変更・中断・終了）</SectionTitle>
      <List items={[
        "当社は、ユーザーに事前に通知することなく、本アプリの内容を変更し、または提供を中断することができます。",
        "当社は、相当の予告期間をもってユーザーに通知のうえ、本アプリの提供を終了することができます。",
        "サービス終了時には、ユーザーが育児データをエクスポートできる手段を提供するよう努めます。",
      ]} />

      <SectionTitle>第11条（損害賠償）</SectionTitle>
      <Paragraph>
        当社は、本アプリの利用に関してユーザーに生じた損害について、当社の故意または重大な過失による場合を除き、責任を負いません。当社が責任を負う場合であっても、その賠償額は、当該ユーザーが本アプリに関して当社に支払った金額を上限とします。
      </Paragraph>

      <SectionTitle>第12条（本規約の変更）</SectionTitle>
      <Paragraph>
        当社は、必要に応じて本規約を変更することがあります。変更後の規約は、本アプリ内での通知またはLINE公式アカウントでの通知により効力を生じるものとします。変更後に本アプリを利用した場合、変更後の規約に同意したものとみなされます。
      </Paragraph>

      <SectionTitle>第13条（準拠法・管轄）</SectionTitle>
      <List items={[
        "本規約は、日本法に準拠するものとします。",
        "本アプリに関する紛争については、当社の本店所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。",
      ]} />

      <SectionTitle>第14条（お問い合わせ先）</SectionTitle>
      <div className="text-sm text-gray-700 leading-relaxed mb-3 pl-2">
        <p>事業者名：産前産後ケアホテル ぶどうの木</p>
        <p>サービス名：We育（ウィーイク）</p>
        <p>お問い合わせ方法：@we-iku</p>
      </div>

      <p className="text-xs text-gray-500 mt-6 text-right">2026年3月4日 制定</p>
    </div>
  );
}
