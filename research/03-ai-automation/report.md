# Report 3 — AI Automation Stack for GoteFigure
*Compiled 2026-06-11 · sources inline · costs are current as of this date*

## TL;DR
- **Heads up: June 15, 2026 (4 days away)** — Claude plans split billing. Interactive Claude Code stays on your subscription; *programmatic* runs (headless `claude -p`, Agent SDK, scheduled agents) move to a separate monthly credit pool ($20/mo of credits on Pro, $100 on Max 5x). When credits run out, automated runs **fail silently** unless you pre-enable overflow billing.
- **Recommended setup: Claude Pro annual ($17/mo)** — its included $20/mo programmatic credit covers light scheduled automation. Add a pay-as-you-go API key with Batch mode (−50%) only if automation outgrows the credit. Don't buy Max until measured spend says so.
- **Content generation:** your hand-drawn art composites cleanly onto AI fashion models (the art is treated as a texture layer, not re-generated). Best-fit tools: Nightjar (~$0.10/img), FASHN.ai ($0.075/img), Photoroom for cleanup. Fourthwall's own mockups first; AI models for the shots that look too template-y.
- **Posting automation:** Postiz is the standout — open-source, self-hostable (free), 30+ platforms, and the only documented **native Claude Code integration** (a CLI agent Claude drives via a SKILL.md). Cheapest full stack: $0–29/mo + Claude Pro.

---

## 1. Claude Code: plans, the June 15 change, and the cheap setup

### Current plans (June 2026)
| Plan | Price | Claude Code | Programmatic credits (from Jun 15) |
|---|---|---|---|
| Pro | $20/mo ($17 annual) | ✅ | $20/mo |
| Max 5x | $100/mo | ✅ | $100/mo |
| Max 20x | $200/mo | ✅ | $200/mo |

Sources: [claude.com/pricing](https://claude.com/pricing), [support.claude.com — Agent SDK with your plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)

### The June 15 billing split (the "payment plan changes" you heard about)
- **Interactive** (you typing in the terminal/IDE, claude.ai chat): unchanged, draws from the normal subscription pool.
- **Programmatic** (headless `claude -p`, Agent SDK scripts, GitHub Actions, scheduled/cron agents): draws from a **separate monthly credit** per the table above. Credits are per-user, refresh monthly, and **automated requests fail silently when exhausted** unless overflow billing is enabled.
- Anthropic's guidance: production automation belongs on direct API billing, not subscription credentials.
Sources: [techtimes.com](https://www.techtimes.com/articles/317625/20260602/anthropic-ends-subscription-subsidy-agents-june-15-credit-pool-replaces-flat-rate-access.htm), [vantagepoint.io](https://vantagepoint.io/blog/ai/claude-agent-sdk-billing-change-june-15)

### API pricing (pay-as-you-go, per million tokens)
| Model | Input | Output | Use for |
|---|---|---|---|
| Opus 4.8 | $5 | $25 | hard reasoning, big builds |
| Sonnet 4.6 | $3 | $15 | most automation workloads |
| Haiku 4.5 | $1 | $5 | captions, classification, cheap loops |
- **Batch API: −50% on everything** (results within ~1h, max 24h) — ideal for "generate this week's captions overnight."
- **Prompt caching: cached reads cost ~0.1×** — a stable brand-voice system prompt reused across runs is nearly free after the first call.

### Recommended setup for you (cheapest sensible)
1. **Claude Pro annual — $17/mo.** Covers your interactive sessions + $20/mo of scheduled-agent credit.
2. Keep automation **light and batched**: one scheduled agent per day (caption generation, content planning) on **Haiku/Sonnet**, not Opus, with a cached system prompt. That realistically fits inside $20/mo of credits.
3. **Enable overflow billing OR add a separate API key before June 15** so scheduled runs don't silently die mid-month.
4. Upgrade to Max 5x ($100/mo) only when measured programmatic spend consistently exceeds ~$20/mo — not preemptively.
Sources: [morphllm.com](https://www.morphllm.com/claude-code-pricing), [ssdnodes.com](https://www.ssdnodes.com/blog/claude-code-pricing-in-2026-every-plan-explained-pro-max-api-teams/)

---

## 2. AI content generation: models wearing your designs

### How it works for hand-drawn art
These tools composite your flat product image (transparent PNG) onto an AI-generated model — the art is a texture layer, **not re-generated**, so your linework stays intact. (UNVERIFIED whether any tool specifically optimizes for illustrated tees vs. photo prints — test before committing.)

### Tool shortlist
| Tool | Free tier | Cost | Why it's on the list |
|---|---|---|---|
| **Nightjar** | trial | ~$0.10/image | visual coherence across a whole catalog |
| **FASHN.ai** | none | $0.075/img ($9/mo min) | API-first → scriptable from Claude Code |
| **VModel** | $10 credits (~500 swaps, never expire) | pay-as-you-go | best free testing budget |
| **Claid.ai** | yes | $9/mo, $0.09–0.50/img | up to 4K output, batch processing |
| **Photoroom** | limited | $99/mo API | background removal + cleanup workhorse |

Sources: [nightjar.so](https://nightjar.so/blog/best-tools-ai-virtual-try-on), [photoroom.com](https://www.photoroom.com/tools/virtual-model), [rewarx.com](https://www.rewarx.com/blogs/ai-fashion-photography-apps-2026)

### Fourthwall note
The Printify/Gelato built-in AI mockup generators don't apply to you (you're on Fourthwall). Workflow that does: **Fourthwall's standard mockups for PDP images → standalone AI on-model shots (FASHN/Nightjar) for social content and hero imagery** where the template look hurts. POD-seller consensus: AI on-model shots run 80–90% cheaper than photography at comparable quality ([gelato.com](https://www.gelato.com/blog/ai-print-on-demand)).

### Generating *new* imagery (backgrounds, scenes, text-in-image)
If a generated image needs readable text (drop announcements, story cards): **Ideogram 3.0** (Mar 2026) renders text correctly ~90% of the time first-try — current best in class ([jungminai.com](https://jungminai.com/best-ai-image-generator-for-print-on-demand-2026/)). Caution: keep generated imagery in *support* roles (backgrounds, mockup scenes) — the brand's value is that the art is genuinely hand-drawn. Don't dilute that signal.

---

## 3. Social posting automation

### Platform API reality check
| Platform | Automated posting | Limits / friction |
|---|---|---|
| Instagram Graph API | ✅ feed, Reels, Stories (Business/Creator acct + FB Page) | Meta App Review required for production; first-submission rejections common |
| TikTok Content Posting API | ✅ MP4 ≤1GB | ~25 videos/day/account cap (UNVERIFIED exact number); behavioral flags ~15/day |
| YouTube Data API v3 | ✅ free | 10,000 units/day; uploads now ~100 units → up to ~100 uploads/day free (big 2025→26 improvement) |

Sources: [zernio.com](https://zernio.com/blog/instagram-posting-api), [developers.tiktok.com](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post), [developers.google.com](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)

**ToS guardrails:** official APIs are the compliant path; never browser-bots (ban risk on all three). Risk is *behavioral* — inhuman cadence or identical-format spam triggers shadow-suppression even via official API. IG + TikTok now require AI-content disclosure (settable via API metadata).

### Schedulers
| Tool | Free tier | Paid | IG | TikTok | YT | Note |
|---|---|---|---|---|---|---|
| **Postiz** | self-hosted = free | cloud $29/mo | ✅ | ✅ | ✅ | open-source; **native Claude Code agent** |
| **Buffer** | 3 channels, 10 queued/channel | ~$6/mo | ✅ | ✅ | ✅ | has an MCP server |
| **Metricool** | 50 posts/mo + analytics | ~$22/mo | ✅ | ✅ | ✅ | best free analytics |
| Meta Business Suite | unlimited | — | ✅ | ❌ | ❌ | free native IG scheduler |

### Wiring it to Claude Code — three patterns
1. **Postiz Agent (most direct):** Postiz ships a CLI that Claude Code drives via a SKILL.md — Claude uploads media, writes platform-specific captions, schedules posts autonomously. Only documented native Claude Code integration as of June 2026. ([postiz.com/agent](https://postiz.com/agent))
2. **MCP servers:** Buffer/Zernio/Genviral ship MCP servers — Claude calls the scheduler as a tool inside its own loop. (UNVERIFIED per-platform coverage of each server.)
3. **n8n:** published templates wire Claude API → Postiz (trigger → caption generation → schedule). Self-hosted free, cloud ~$24/mo. ([n8n template](https://n8n.io/workflows/7046-auto-generate-platform-optimized-social-media-posts-from-wordpress-with-claude-and-postiz/))

---

## 4. The recommended GoteFigure automation stack

| Layer | Tool | Cost |
|---|---|---|
| Brain | Claude Pro (annual) + overflow/API key before Jun 15 | $17/mo |
| Models for automation | Haiku/Sonnet + batch + cached brand prompt | inside credits at first |
| On-model imagery | VModel free credits → FASHN.ai if it earns its keep | $0 → ~$9/mo |
| Cleanup | Photoroom free tier | $0 |
| Scheduler | Postiz self-hosted (or Buffer free to start) | $0 (cloud $29/mo if self-hosting is a pain) |
| **Total** | | **$17–55/mo** |

### What to automate vs. keep human
**Automate:** caption drafts in brand voice, cross-platform reformatting (1 video → YT Short + TikTok + Reel descriptions), posting schedule, hashtag research, weekly analytics digest, newsletter drafts.
**Keep human (this IS the brand):** the drawing itself, voice-overs/face content, community replies, final approve-before-post. A solo artist brand whose feed feels automated loses the only moat it has.

### The realistic daily pipeline
You already draw every day. The automation turns one daily drawing session into: phone-records process → scheduled Claude agent (cron, headless) drafts 3 platform captions in brand voice from your one-line description → pushes to Postiz with your approval gate → posts at optimal times. Your added daily cost: ~2 minutes of approval.

*Action plan for using this report: see Report 4's 90-day section — the automation build is sequenced there so it lands after the content habit exists, not before.*
