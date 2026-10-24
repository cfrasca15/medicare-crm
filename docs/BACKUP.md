# Nightly backup to Google Drive

Every night the Unraid server copies the CRM database, encrypts it with a
password only you know, and uploads it to a private **CRM Backups** folder in
your Google Workspace Drive. The last 30 days are kept.

The database holds client health information, so:

- Use your **Google Workspace** account, never a personal Gmail.
- Accept Google's HIPAA Business Associate Amendment first: Admin console
  (admin.google.com) > Account > Account settings > Legal and compliance.
  (Google moves this menu occasionally; search the Admin console for "HIPAA".)
- Turn on 2-step verification, and never share the CRM Backups folder.
- The files are encrypted before they leave the server, so a copy on Drive is
  unreadable without your backup password. **Keep that password somewhere safe
  outside the server** (a password manager). Without it the backups can't be
  opened.

## One-time setup on Unraid

1. **Install rclone.** Apps tab > search "rclone" > install the rclone plugin.
2. **Connect it to Google Drive.** In Unraid's terminal:

   ```bash
   rclone config
   ```

   - `n` (new remote), name it `gdrive`, storage type `drive` (Google Drive).
   - Leave client id / secret blank, scope `3` (drive.file: rclone can only
     see files it created), leave the rest at the defaults.
   - "Use web browser to automatically authenticate?" answer `n`, then follow
     the instructions: run the shown `rclone authorize` command on your PC
     (install rclone there too) and paste the result back. Sign in with your
     **Workspace** account.
   - Test: `rclone mkdir "gdrive:CRM Backups"` then `rclone lsd gdrive:` shows it.
3. **Create the backup password file** (pick a long password; this is the
   only thing that can decrypt the backups):

   ```bash
   nano /boot/config/crm-backup.pass
   chmod 600 /boot/config/crm-backup.pass
   ```

4. **Install the script.** Apps tab > install **User Scripts**. Settings >
   User Scripts > Add New Script, name it `crm-backup`, click its gear >
   Edit Script, and paste the contents of `scripts/unraid/crm-backup.sh` from
   this repository. Set the schedule to **Custom**: `30 2 * * *` (2:30 AM daily).
5. **Run it once now** (Run Script) and check that a `crm-....db.gz.enc` file
   appears in the CRM Backups folder on Drive.

The CRM container must have been rebuilt after this update (it needs
`scripts/backup-db.mjs`).

## Restoring a backup

1. Download the backup file from Drive to the Unraid server (or use
   `rclone copy "gdrive:CRM Backups/crm-YYYY-MM-DD_HHMM.db.gz.enc" /tmp/`).
2. Decrypt and unpack it:

   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
     -in /tmp/crm-YYYY-MM-DD_HHMM.db.gz.enc -out /tmp/crm.db.gz \
     -pass file:/boot/config/crm-backup.pass
   gunzip /tmp/crm.db.gz
   ```

3. Put it in place of the live database and restart:

   ```bash
   cd /mnt/user/compose/medicare-crm
   docker compose stop
   docker cp /tmp/crm.db medicare-crm:/app/data/prod.db
   docker compose start
   ```

   (`prod.db` is the file named in `DATABASE_URL` in `docker.env`.)
