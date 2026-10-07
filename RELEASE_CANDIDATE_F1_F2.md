# 勤務表 F1＋F2：公開判断用の候補（2026-10-07）

**公開すると、応援・休職に不要な「週休不能」理由を出さなくなり、固定希望と手動ロックの勤務コードが矛盾する場合は、両値を残して生成前に知らせる。** キャッシュをv17へ更新する。公開・main統合は未承認で、この資料と専用branchの保存までを実施した。

- 公開先：[勤務表ツール](https://futsalife24-bot.github.io/work-shift/)
- GitHub：[work-shift](https://github.com/futsalife24-bot/work-shift)
- 最新main／今回base：`d5959cec6b08978d8d4914c006477e2b02c641f8`
- 候補branch：`fix/fixed-lock-conflict-20261007`
- **製品内容のhead：`26aeef520dae5bcaa4e088cdb5465279c1bcb127`**。この資料の追加以降は製品コードを変えていない。最終記録commitのSHAは完了報告に記載。
- F1：`c410dfb`、F2実装：`2af8b17`、F2実画面検証：`5e96200`。現branchは最新mainからこれらだけを積んだ履歴で、分析branchのfixture・結果JSON・未適用patchは含まない。再分離は不要と判断した。
- ローカル：`C:/Users/futsa/Documents/Codex/2026-10-06/4-pro20x-hub/work-shift-analysis`。元clone・既存分析・F1の専用branchは変更しない。

## 公開中のものとの差

最新mainをfetchし、公開HTMLと [公開sw.js](https://futsalife24-bot.github.io/work-shift/sw.js) を読み取り取得した。両方ともmainの対応ファイルとLF正規化後に一致。現在は応援・休職機能まで公開済み、F1＋F2は未公開、SWはv16。ブラウザや実ユーザー保存は使っていない。

|ファイル|候補に含まれる変更|
|---|---|
|`src/app.js` / `index.html`|F1の週休候補判定とF2の生成前チェックの2箇所。同一のソースと生成物。勤務表UIのレイアウト全体は変更しない|
|`sw.js`|キャッシュ名だけ `kinmuhyo-v16` → `kinmuhyo-v17`。ネットワーク優先・オフライン起動・保存形式は維持|
|`test-impossible-exemptions.cjs`|F1の既存例外と通常条件を確認する架空10ケース|
|`test-fixed-lock-conflicts.cjs`|F2の状態保持・正常対照・空/不正コード・エスケープ・13件通知の10条件|
|`test-fixed-lock-ui.cjs`|通知→閉じる→修正→再生成・保存再読込・320/390pxの局所確認|
|`test-release-cache.cjs`|今回のv17キャッシュ準備の隔離VM確認|
|`test-release-cache-ui.cjs`|旧mainのv16→候補v17をlocalhostで実更新し、オフライン再起動・架空データと文字サイズ保持を確認|
|`CHANGE_GUIDE.md` / この資料|変更・検証履歴と今回の公開判断材料|

F1は応援の全週と休職を含む週を既存の通常評価と同じ除外条件へ揃える。通常社員の週休不能や人数不足まで消す修正ではない。

F2は「固定入力とロックは保持」という既存の案内を守る。例えば固定が休み、ロックが8時勤務なら、その人・日付・両コードを示し生成を止める。利用者が入力を揃えれば再生成できる。正常生成は従来どおり。矛盾13件以上は全件数・先頭12件・残件数を明記する。片方の強制上書き、保存移行、担当区だけの衝突判定、他の生成入口の変更は含めない。

SWのv17は今回候補のHTMLを新しいキャッシュ名で事前取得するための準備。アプリ本体は従来どおりネットワーク優先で、勤務データのlocalStorageは操作しない。公開直後に全端末が一斉更新される保証ではなく、端末がオンラインになって更新を受け取る必要がある。

## 確認済みと公開前後の残項目

F1のNode10ケース、F2のNode10条件とF1基点の正常対照比較、build・構文・差分チェックは各修正時に合格済み。F2の実画面は貸出UI040で通知・確認・実パレット修正・再生成・保存再読込、320/390pxの13件表示、JSエラー0を確認済み。製品HTML/JSはその後変更していないので、今回それらを繰り返していない。証拠と限界は [CHANGE_GUIDE](CHANGE_GUIDE.md) に記録している。

今回追加の `node test-release-cache.cjs` とSW/テストの構文・差分チェックは合格。隔離VMでv17のinstall、v16キャッシュ整理、ネットワーク優先、オフライン応答、画像キャッシュ、POST非介入を確認した。

その後、貸出 `UI-20261007-044` で `test-release-cache-ui.cjs` を実行し、**ローカル実ブラウザの更新確認も合格**した。旧mainのHTML/SWを専用127.0.0.1の一時portで配信し、同一originで候補v17に切り替えてService Workerを更新。旧v16キャッシュが消え、v17内のHTMLが候補ハッシュと一致することを確認した。新規隔離Edgeでネットワークを実際にオフラインへ切り替えて再読込し、候補HTMLで起動した。架空8人・28日分の勤務データ、保存JSON、アプリstate、文字サイズ「大」の保存値・選択値・倍率1.25が更新前後とオフライン再起動後に完全一致。JavaScript実行エラー0、製品の追加修正なし。

再現は既存Playwright環境で `BROWSER_CHANNEL=msedge` と新しい `WORK_SHIFT_UI_LEASE` を指定し、`node test-release-cache-ui.cjs`。`--prepare` ならブラウザ・サーバーを起動せず資材ハッシュだけを照合する。旧mainは上記baseのGit blob、架空fixtureは既存Node回帰から再利用。今回は旧/新HTMLと候補SWが本資料末尾のハッシュに一致。試験後は専用context・browser・サーバーを終了しviewportを破棄、UI044返却済み。結果JSONは一時ファイル `C:/Users/futsa/AppData/Local/Temp/work-shift-f1-f2-cache-ui-20261007.json` に保存した（`F2_CACHE_RESULT_PATH` 指定で再生成可能）。成功済みF1/F2や全画面テストは繰り返していない。

公開前後に必要な残項目は以下。**この準備タスクでは実行しない。**

1. 本人のmain統合・公開承認を確認する。今回の候補準備はその承認ではない。repoの既存記録に、この局所修正へ別途独立監査を必須とする規定はない。
2. 公開操作前にmain・公開物・候補SHAを再照合し、変化があれば実差分と必要検証を見直す。
3. 承認された手順でmainへ反映した後、Pagesの成功・配信HTML/SWの一致・公開版の必要な局所確認を行う。既存記録ではmainルートが配信元で、公開設定を変える必要はない。

実職場データへの適合、通常可動セルの探索品質、実スマホの性能、今回範囲外の印刷/Excel等の再試験は未実施。SWの実確認は新規隔離Edge・localhostであり、既存利用者の端末/PWAや公開origin上の更新を実測したものではない。ブラウザ自体を終了した後のオフライン再起動までは確認せず、同じ隔離contextでのネットワーク停止とページ再読込を確認した。既存の成功済み全件検証は反復していない。保存版・タグ・追加cloneの作成、merge、deploy、公開設定変更、実ユーザー保存操作は行っていない。指定 `gpt-6-astra/high`、実設定は未確認。MainVaultは親担当が記録する。

## 再照合用ハッシュ

SHA256、UTF-8・LF正規化。今回の公開取得ファイルはrawでも同じ値。

|対象|SHA256|
|---|---|
|公開HTML＝main HTML|`f8f5cb1688e0124e4eaa3a143c2ab14a325413022bb459696aaea6d1210e97e1`|
|公開SW＝main SW（v16）|`e2453a1af4164a1cc3b8c18014406744fe13a3342c62bbfb2d7e500b7206faf0`|
|候補HTML|`bd1f5ca96b14db88c7354ca3fd522f6885e9a31e12ccfcad6ff92a611e0def88`|
|候補src/app.js|`bc99953c99df3125c70a4b20bd35fea87bda2dea472e5071a5e1892b7b6aabc4`|
|候補SW（v17）|`649fca5e0bf45589ab37948d80c0bb930ea4a9b181716a710377c0de457d930f`|
