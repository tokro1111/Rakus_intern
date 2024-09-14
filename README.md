# ブランチ命名規則
## 機能を作る時のルール（issueドリブン開発）
1. 実装する機能のissuesを立てる。
2. issueのcreate_branchからブランチを切る
3. ブランチ名:feature/#{issue番号}_{機能名}

   例:issue番号が1→feature/#1_login_interface

# データベースについて

## パッケージのインストール
`npm install -S @supabase/supabase-js`
`npm install uuid`

## 環境変数の設定

chatappディレクトリ内の`.env`ファイル内に以下を記述
xxxx,yyyyの内容についてはslackにて共有します。

```
VITE_SUPABASE_URL="xxxx"
VITE_SUPABASE_ANON_KEY="yyyy"
```

以上のファイルおよびキーはgitなどで外部に共有しないようにお願いします。

## データベースに関する関数

| 関数 | 引数 | 内容 | 
|-----------|-----------|-----------|
| sendToDB   | (tableName:String, data:オブジェクト)  |データをDBに登録(INSERT)|
| getFromDB   |  tableName:String, room_id:String  |データをDBから抽出(SELECT)改良の余地あり|


## supabaseについて
### はじめに
`rakus_d_chatapp`というプロジェクトを作りました。
メール経由で管理者権限のインビテーションを送ります。
gitなどで連携会員登録ができます。

###  URLとKEYの取得方法

次の手順で VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を取得します。
1. Supabase ダッシュボードに移動します。
2. 左サイドバーの「Settings（設定）」をクリックします。
3. 「API」タブを選択します。
   
ここで、以下の情報を確認できます：
VITE_SUPABASE_URL: API URL の部分に表示されている URL。
VITE_SUPABASE_ANON_KEY: Project API keys の anon public キー。

こちらを.envに記述してください

### テーブルの閲覧および新規作成
`rakus_d_chatapp`に移動していただき、`Table Editor`があるのでそこで、Tableの閲覧、追加、削除ができます。

### テーブルについて

カラム名は小文字_小文字でお願いします。
新規にテーブルを作成した場合はここに書いてください。

テーブルの作成は`Table Editor`->`New Table`

1.　chat_messages
チャットの履歴を保存するテーブルを作ってあります。
以下がカラム名とそのデータの内容です。

| カラム名 | 内容 | 
|-----------|-----------|
| id   | デフォルトであるもの  |
| created_at   | デフォルトであるもの（作成・更新日時）   |
| unique_id   | データ固有のid   |
| room_id   | どのグループに属しているチャットか   |
| user_name   | 発信者の名前   |
| user_message   | チャットの中身   |
| user_message_type   | チャットの種類　（例：group_chat）   |
| submit_date  | 投稿日時   |

2． user_date

| カラム名 | 内容 | 
|-----------|-----------|
| id   | デフォルトであるもの  |
| created_at   | 作成日時  |
| user_name   | 発信者の名前 |
| user_bathdate   | 発信者の誕生日 |
| updated_at   | 更新日時  |
