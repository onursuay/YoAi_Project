# Meta App Review — Permission Descriptions (Final)

> Copy-paste ready descriptions for Meta App Review submission.
> Revised for minimal claim surface — every statement must be demonstrable in the screencast video.

---

## 1. pages_manage_ads

**Tell us how you'll use this permission:**

YoAi is a SaaS advertising management platform. We use `pages_manage_ads` only where a Facebook Page is required as part of ad setup and lead ad workflows.

Specifically, we use this permission to:

1. Let the user create ads that are associated with their own Facebook Page.
2. Let the user select the correct Page identity during campaign setup.
3. Support lead ad workflows together with `leads_retrieval`, where Page-linked lead forms are used in campaign creation.

**User flow:**
- User logs into YoAi and connects their Meta account
- User opens the campaign creation flow
- User selects one of their own Facebook Pages
- User configures the campaign and lead form
- YoAi creates the ad using the selected Page as the Page identity
- The user can later manage the campaign from the YoAi dashboard

We use this permission only for the authenticated user's own Pages and advertising workflows. We do not access or manage Pages that do not belong to the authenticated user.

---

## 2. leads_retrieval

**Tell us how you'll use this permission:**

YoAi is a SaaS advertising management platform that supports lead generation campaigns. We use `leads_retrieval` to:

1. Retrieve the user's available lead generation forms from their own Facebook Pages.
2. Check whether the authenticated user has access to a selected lead form.
3. Display submitted lead entries inside the YoAi dashboard so the Page owner can review and manage their own leads.

**User flow:**
- User logs into YoAi and connects their Meta account
- User selects the "Lead Generation" objective when creating a campaign
- YoAi loads the user's available lead forms
- User selects a lead form for the campaign
- After leads are submitted, YoAi displays those leads in the dashboard for that same authenticated Page owner

Lead data is shown only to the authenticated user for their own Page assets. YoAi does not sell, share, or use lead data for unrelated purposes.

---

## 3. business_management

**Tell us how you'll use this permission:**

YoAi is a SaaS advertising management platform. We use `business_management` only for business asset discovery required for WhatsApp ad setup.

Specifically, we use this permission to:

1. Retrieve the businesses associated with the authenticated user.
2. Discover WhatsApp Business Accounts owned by those businesses.
3. Resolve which business-owned WhatsApp assets should be shown to the user during campaign setup.

**User flow:**
- User logs into YoAi and connects their Meta account
- User starts creating a campaign with WhatsApp as the destination
- YoAi looks up the user's business assets
- YoAi identifies available WhatsApp Business Accounts owned by the user's business
- The user selects the appropriate WhatsApp asset for the campaign

This permission is used only to discover the authenticated user's own business assets needed for campaign configuration. We do not use it for unrelated business data processing.

---

## 4. instagram_basic

**Tell us how you'll use this permission:**

YoAi is a SaaS advertising management platform. We use `instagram_basic` to:

1. Retrieve the Instagram Business Account linked to the user's Facebook Page.
2. Display the Instagram account information during onboarding and campaign setup.
3. Allow the user to confirm which Instagram Business Account will be used for publishing and advertising workflows.

**User flow:**
- User logs into YoAi and connects their Meta account
- YoAi retrieves the Instagram Business Account connected to the user's Page
- The Instagram account information is shown in the interface
- User confirms the Instagram account to use in publishing or ad workflows

This permission is used only for the authenticated user's own Instagram Business Account. We do not access Instagram accounts that do not belong to the user.

---

## 5. instagram_content_publish

**Tell us how you'll use this permission:**

YoAi is a SaaS advertising management platform with AI-powered creative generation. We use `instagram_content_publish` to allow users to publish content directly to their own Instagram Business Account from within YoAi.

Specifically, we use this permission to:

1. Publish AI-generated or user-uploaded images, videos, reels, or carousel content to the user's Instagram Business Account.
2. Let the user generate content in YoAi, preview it, and explicitly confirm publication.
3. Support a workflow where published Instagram content can later be reused in advertising workflows.

**User flow:**
- User logs into YoAi and connects their Meta account
- User creates or uploads content in YoAi
- User previews the content
- User clicks a publish action to publish it to Instagram
- YoAi publishes the content to the user's own Instagram Business Account
- The published content appears on the user's Instagram profile

Content is published only after explicit user action. YoAi does not publish content automatically without the user confirming the action.

---

## 6. whatsapp_business_management

**Tell us how you'll use this permission:**

YoAi is a SaaS advertising management platform. We use `whatsapp_business_management` to discover and display the authenticated user's WhatsApp Business assets during campaign setup.

Specifically, we use this permission to:

1. Discover the user's WhatsApp Business Accounts.
2. Retrieve the phone numbers associated with those WhatsApp Business Accounts.
3. Present the available business phone numbers so the user can choose which number to use as the destination for a Click-to-WhatsApp campaign.

**User flow:**
- User logs into YoAi and connects their Meta account
- User starts creating a campaign with WhatsApp as the destination
- YoAi discovers the user's WhatsApp Business Accounts and available phone numbers
- The user selects the number they want to use
- YoAi uses the selected number in campaign configuration

This permission is used only for the authenticated user's own WhatsApp Business assets. YoAi does not read or store message content through this permission.

---

## 7. whatsapp_business_messaging

**Tell us how you'll use this permission:**

YoAi is a SaaS advertising management platform. We use `whatsapp_business_messaging` only for Click-to-WhatsApp campaign setup and messaging destination configuration.

Specifically, we use this permission to:

1. Configure the user's own WhatsApp business number as the destination for a Click-to-WhatsApp ad.
2. Support ad flows where a person who clicks the ad is directed to a WhatsApp conversation with the advertiser's business number.

**User flow:**
- User logs into YoAi and connects their Meta account
- User creates a campaign and selects WhatsApp as the destination
- User selects one of their available WhatsApp business numbers
- YoAi creates the campaign using that number as the messaging destination
- When a person clicks the ad, they are directed to WhatsApp to contact the advertiser

YoAi does not read, store, or process WhatsApp conversation content between the advertiser and their customers as part of this permission use.

---

## Screencast Video Checklist

Record **one separate video per permission**. Each video should show only the feature that requires that specific permission. Do not combine multiple permissions into one video.

Each video must demonstrate:

1. **Login** — User logs into YoAi
2. **Connect** — User connects Meta account via Facebook Login (OAuth flow)
3. **Feature** — User uses the specific feature that requires the permission
4. **Result** — The successful outcome

### Video structure per permission:

| Permission | What to show in video |
|---|---|
| pages_manage_ads | Create campaign → select Page → ad created with Page identity |
| leads_retrieval | Create Lead campaign → select lead form → view submitted leads in dashboard |
| business_management | Create WhatsApp campaign → business asset discovery → WABA selection |
| instagram_basic | Connect flow → IG account detected → profile info displayed → account confirmed |
| instagram_content_publish | Create/upload content → preview → explicit publish click → post appears on IG |
| whatsapp_business_management | Create WhatsApp campaign → phone number list displayed → number selected |
| whatsapp_business_messaging | Create CTWA campaign → WhatsApp number as destination → campaign created |

### Video rules:
- Keep each video under **2 minutes**
- Show the feature working **end-to-end**
- Do NOT show any admin/developer tools — only the **user-facing interface**
- Every claim in the permission description **must** be visible in the video
- If a claim is not demonstrable, **remove it from the description** before submitting
