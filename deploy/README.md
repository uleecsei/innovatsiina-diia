# Google Cloud UAT

VM: `innovatsiina-diia-uat`, zone `europe-central2-c`, project
`project-1f5b7786-4ba0-4f71-926`.

Use the personal CLI configuration, without changing the work account:

```bash
export CLOUDSDK_CONFIG="$HOME/.config/gcloud-innovatsiina-diia"
gcloud compute ssh innovatsiina-diia-uat \
  --zone=europe-central2-c --project=project-1f5b7786-4ba0-4f71-926
```

The initial deployment lives at `/srv/innovatsiina-diia/app`. Compose uses
`deploy/compose.yaml` and the server-only `deploy/.env`. Only Caddy publishes
ports 80 and 443. MongoDB is isolated on an internal Docker network with no host
port. This single-host UAT setup relies on that isolation; do not expose MongoDB.

The public host is `34-116-129-204.sslip.io`. Its IP is reserved in Google Cloud.
Caddy obtains and renews HTTPS certificates. The free DNS service is external
and can later be replaced by an owned domain through `SITE_HOST` in `deploy/.env`.
UAT responses include `X-Robots-Tag: noindex, nofollow, noarchive`, and robots.txt
disallows crawling. This discourages indexing but is not access control.

MongoDB and Caddy certificates use named volumes with a fixed Compose project
name. Uploads live at `/srv/innovatsiina-diia/uploads`, outside the source tree.
Never run `docker compose down -v`: it deletes persistent volumes.

After uploading an updated source checkout, build before replacing running apps:

```bash
cd /srv/innovatsiina-diia/app
sudo docker compose -f deploy/compose.yaml --env-file deploy/.env build
sudo docker compose -f deploy/compose.yaml --env-file deploy/.env up -d --wait
sudo docker compose -f deploy/compose.yaml --env-file deploy/.env ps
```

The first deployment copies local content, uploaded files and the existing
administrator password hash. Active administrator sessions are not transferred.
Log in again with the existing credentials. Do not re-import the local database
on routine deploys: doing so would overwrite changes made on UAT.

The contact form requires separate Resend settings. They are intentionally not
copied from the developer's environment. Add `RESEND_API_KEY`, `CONTACT_FROM`
and `CONTACT_TO` to the API service environment when mail delivery is configured.

Initial migration backups are stored under `/srv/innovatsiina-diia/backups`
(root-only). These are on the same VM and are not off-site disaster recovery.
Before ending the cloud trial, export both MongoDB and uploads to another host.
Automatic deployment from GitHub and scheduled off-site backups are not yet
configured by this initial deployment.
