# 令和8年 年末調整おたすけナビ

年末調整の申告書を、質問と実際の記入欄を見ながら準備するWebアプリです。知り合いとURLで共有できるよう、GitHub Pages用にまとめています。

**公開設定後のURL：** https://sanokendays-sketch.github.io/nenmatsu-navi-2026/

現時点では公開用ファイルの準備段階です。GitHub上でリポジトリを作成し、Pages設定後に上記URLを確認してください。

## できること

- 本人・給与、配偶者、扶養家族、障害者・ひとり親・学生、保険、iDeCo等の質問を8ページで案内。
- 令和8年分の申告書画像と、回答に基づく記入候補を表示。
- 必要書類、会社担当者へ確認する事項、提出前チェックを整理。
- 結果をブラウザーの印刷機能でPDFに保存。
- 生命保険・地震保険は各100件まで入力。紙の欄を超える契約は添付別紙明細へ振り分け。

## 使い方

1. 公開されたURLをEdgeやChrome等で開きます。
2. 給与明細や控除証明書を用意し、質問に回答します。
3. 結果画面の記入内容・必要書類・確認事項を確認します。
4. 必要に応じて「PDFとして保存」または「別紙明細をPDF保存・印刷」を使います。

スマートフォンでの操作・PDF保存は開発環境では未確認です。共有後に各利用端末で確認してください。

## 入力内容の扱い

回答は端末のブラウザー内だけで処理し、アプリからサーバーへ送信しません。回答を永続保存せず、ページの再読み込み・終了で消えます。GitHub Pagesの配信元は閲覧時のIPアドレスを記録します。[GitHubの説明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)

[プライバシー・利用上の案内](docs/privacy.html) を公開画面にも表示しています。

## 対象・現在の確認範囲

令和8年分、2026年12月1日以降の年末調整を想定した計算基準です。早期の年末調整の基準切り替えはありません。国税庁の公式サービスではありません。回答から算出した金額は申告書記入の候補です。要確認の項目は勤務先へ確認してください。

給与以外の複雑な所得、住宅ローン控除額、年調年税額・還付額・追加徴収額は自動計算しません。社会保険料の支払先別内訳も自動配分しません。

元の実装では自動テスト84件・JavaScript構文チェック27ファイルの成功記録があります。今回は公開用フォルダーの構成・ファイル参照・ソースとの一致を確認する工程です。実ブラウザーの表示・印刷・PDF保存・多数契約の改ページと、公開URLの動作は未確認です。

## GitHub Pagesの設定

1. リポジトリ名を **nenmatsu-navi-2026**、公開範囲を **Public** にして作成。
2. このフォルダーの中身をリポジトリ直下へアップロード。README.md、docs、src、scripts等が直下に来る構成です。
3. Settings → Pages → Source を **Deploy from a branch** に設定。
4. Branch を **main**、Folder を **/docs** にして Save。
5. 公開完了後に表示されるURLを開き、入力とPDF保存を確認して知り合いへ共有。

[GitHubの公開手順](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 開発時の更新

ソースは src、公開ファイルは docs にあります。Node.js 20以降で、ソース修正後に次を実行してください。依存パッケージのインストールは不要です。

    npm run build

生成された docs/app.bundle.js と、変更したソース・素材をGitHubへアップロードします。計算と質問の基準は src/rules-2026.js に集約しています。

## 根拠資料

- [令和8年分 扶養控除等申告書・記載例](https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/305.pdf)
- [令和8年分 基礎控除等申告書・記載例](https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/306.pdf)
- [令和8年分 保険料控除申告書・記載例](https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/307.pdf)
- [令和8年分 住宅ローン控除申告書・記載例](https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/308.pdf)
- [保険料控除申告の手続・適用時期](https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/gensen/annai/1648_05.htm)

公開版の準備日：2026-09-28。素材は国税庁資料から取得。公式PDF原本は変更していません。

## 不具合の連絡

Issuesに、使用端末・ブラウザー、直前の操作、期待した結果、実際の結果を記載してください。実在する氏名や給与額を載せる必要はありません。架空の値でも再現できる手順があれば助かります。
