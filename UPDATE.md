# Daily dashboard refresh

Dashboard: https://claude.ai/artifact/Wig1LQ5jfv35bNxPW4fhzC ("تفاعل حساباتي", a Data-type artifact).
It reads three attached CSV files. This refresh re-collects them and swaps the attachments. Nothing is posted anywhere else.

1. In `C:\Users\malqr\claude\accounts-dashboard` run:
   `$env:TELEGRAM_BOT_TOKEN=[Environment]::GetEnvironmentVariable('TELEGRAM_BOT_TOKEN','User'); node collect.mjs`
   (never print the token). Then read `data\status.json`. If TikTok or Telegram failed, the script keeps the last known rows, so go on, and mention the problem at the end.
2. For each dataset id below, upload the file as an asset of the dashboard (Artifact tool, `url` = the dashboard, `asset: true`, `file_path`):
   - `accounts` ← `data\accounts.csv`
   - `posts` ← `data\posts.csv`
   - `history` ← `data\history.csv`
3. Read `datasets/<id>` with ArtifactData (`get`) to learn its current `source.url` and `version`, then `update` it (with `if_version`) to set
   `source.url` to the new `/_blob/<id>`, `updated: {at: <UTC now>, by: "Claude (daily refresh)"}` and `edit: {via: "claude", at: <UTC now>}`.
   Do all three in one `batch`.
4. Delete each old asset (Artifact `action: "delete"`, `path` = the 32-character id from the old `source.url`) only after the batch succeeded.
5. Do not change `files/index.html` or anything else. Finish with one line: date, followers per account, and any problem from status.json.
