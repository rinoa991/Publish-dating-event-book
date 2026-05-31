# 约会事件薄：手机共享版部署说明

## 免费吗？

两个人或少量朋友使用，通常可以用免费额度：

- Vercel Hobby：个人项目免费部署静态网页。
- Supabase Free：免费数据库和实时同步额度足够轻量打分使用。

## 1. 创建 Supabase 数据库

1. 打开 https://supabase.com 并创建项目。
2. 进入 SQL Editor。
3. 复制 `supabase-schema.sql` 的内容运行。
4. 进入 Project Settings > API。
5. 复制 Project URL 和 anon public key。
6. 打开 `config.js`，填入：

```js
window.DATE_BOOK_SUPABASE_URL = "你的 Project URL";
window.DATE_BOOK_SUPABASE_ANON_KEY = "你的 anon public key";
```

## 2. 部署网页

推荐 Vercel：

1. 打开 https://vercel.com
2. 新建项目并上传/导入本文件夹。
3. 部署后得到一个 HTTPS 链接。

## 3. 使用

1. 打开部署后的网页。
2. 点“复制共享链接”发给对方。
3. 一个人选择“评分人A”，另一个人选择“评分人B”。
4. 双方改分数后会同步看到结果。
