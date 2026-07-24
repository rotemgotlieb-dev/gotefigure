// Companion cron Worker for the orders reconcile lane (docs/reconcile-runbook.md option 1).
// Exists because the site worker's adapter entry exports fetch only (no scheduled handler).
// Fires on the cron trigger, POSTs the token-gated reconcile endpoint in REPORT-ONLY mode,
// and logs the drift report. It never sends {"apply": true}: backfill stays a human act.
// Fail-closed: a missing RECONCILE_TOKEN secret logs and stops; it never calls unauthenticated.
export default {
  async scheduled(_event, env, _ctx) {
    if (!env.RECONCILE_TOKEN) {
      console.error(JSON.stringify({ evt: 'reconcile_cron_misconfigured', reason: 'no_token' }));
      return;
    }
    const target = env.RECONCILE_URL || 'https://gotefigure.com/api/orders/reconcile';
    let res;
    try {
      res = await fetch(target, {
        method: 'POST',
        headers: { 'x-reconcile-token': env.RECONCILE_TOKEN, 'content-type': 'application/json' },
        body: '{}', // report-only, full pull; never {"apply": true} from the cron
      });
    } catch (e) {
      console.error(JSON.stringify({ evt: 'reconcile_cron_fetch_failed', error: String(e) }));
      return;
    }
    let report = null;
    try {
      report = await res.json();
    } catch {
      // non-JSON body: status alone still tells the story below
    }
    const drift = (report?.missingLocal?.length ?? 0) + (report?.missingRemote?.length ?? 0);
    const line = {
      evt: 'reconcile_cron_report',
      status: res.status,
      ok: report?.ok ?? false,
      remoteCount: report?.remoteCount,
      localCount: report?.localCount,
      missingLocal: report?.missingLocal?.length,
      missingRemote: report?.missingRemote?.length,
      truncated: report?.truncated,
    };
    // Drift or any failure logs at error level so it stands out in the tail; clean runs log info.
    if (res.status !== 200 || drift > 0) console.error(JSON.stringify(line));
    else console.log(JSON.stringify(line));
  },
};
