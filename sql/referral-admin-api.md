# Referral System Admin API Reference

## Overview

This document provides all the queries and data structures needed to manage the referral system from an external admin console.

All operations use Supabase client. Initialize with admin/service role key for full access:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SERVICE_ROLE_KEY' // Use service role for admin access
);
```

---

## 1. REFERRAL SETTINGS MANAGEMENT

### 1.1 Get All Settings

```typescript
const { data: settings, error } = await supabase
  .from('referral_settings')
  .select('*')
  .order('key');

// Returns:
// [
//   { id, key: 'referrer_reward', value: {...}, description, is_active, created_at, updated_at },
//   { id, key: 'referee_reward', value: {...}, ... },
//   ...
// ]
```

### 1.2 Get Single Setting

```typescript
const { data, error } = await supabase
  .from('referral_settings')
  .select('*')
  .eq('key', 'referrer_reward')
  .single();
```

### 1.3 Update Setting

```typescript
// Example: Update referrer reward amount
const { data, error } = await supabase
  .from('referral_settings')
  .update({
    value: {
      amount: 150,
      currency: 'INR',
      type: 'wallet_credit',
      description: '₹150 wallet credit when your friend places first order'
    },
    updated_at: new Date().toISOString()
  })
  .eq('key', 'referrer_reward');
```

### 1.4 Setting Keys Reference

| Key | Description | Value Structure |
|-----|-------------|-----------------|
| `referrer_reward` | Reward for referrer | `{ amount, currency, type, description }` |
| `referee_reward` | Reward for new user | `{ amount, currency, type, description }` |
| `min_order_for_reward` | Min order amount | `{ amount, currency }` |
| `max_referrals_per_user` | Referral limits | `{ limit, period, unlimited }` |
| `reward_expiry_days` | Reward validity | `{ days, can_expire }` |
| `program_status` | Enable/disable | `{ enabled, message }` |
| `sales_team_bonus` | Sales team reward | `{ amount, currency, per_signup, description }` |
| `ui_banner_title` | Banner title | `{ en: "...", hi: "...", te: "..." }` |
| `ui_banner_subtitle` | Banner subtitle | `{ en: "...", hi: "..." }` |
| `ui_banner_colors` | Banner colors | `{ gradient_start, gradient_end, text_color, code_bg_color, code_text_color }` |
| `share_message_template` | Share message | `{ en: "template with {{CODE}}", hi: "..." }` |
| `current_offer` | Special offer | `{ enabled, title, description, start_date, end_date, bonus_amount, min_referrals }` |
| `app_store_links` | Store links | `{ play_store, app_store, package_name }` |
| `milestone_rewards` | Milestone bonuses | `[{ referrals, bonus, title }, ...]` |
| `terms_and_conditions` | T&C text | `{ en: ["term1", "term2"], hi: [...] }` |

---

## 2. REWARD SETTINGS FORMS

### 2.1 Update Referrer Reward

```typescript
interface ReferrerReward {
  amount: number;
  currency: string;
  type: 'wallet_credit' | 'discount' | 'cashback';
  description: string;
}

async function updateReferrerReward(reward: ReferrerReward) {
  const { error } = await supabase
    .from('referral_settings')
    .update({ 
      value: reward,
      updated_at: new Date().toISOString()
    })
    .eq('key', 'referrer_reward');
  
  return { success: !error, error };
}
```

### 2.2 Update Referee Reward

```typescript
interface RefereeReward {
  amount: number;
  currency: string;
  type: 'discount' | 'wallet_credit';
  description: string;
}

async function updateRefereeReward(reward: RefereeReward) {
  const { error } = await supabase
    .from('referral_settings')
    .update({ 
      value: reward,
      updated_at: new Date().toISOString()
    })
    .eq('key', 'referee_reward');
  
  return { success: !error, error };
}
```

### 2.3 Toggle Referral Program

```typescript
async function toggleReferralProgram(enabled: boolean, message?: string) {
  const { error } = await supabase
    .from('referral_settings')
    .update({ 
      value: { 
        enabled, 
        message: message || (enabled ? 'Refer friends and earn rewards!' : 'Referral program is currently paused')
      },
      updated_at: new Date().toISOString()
    })
    .eq('key', 'program_status');
  
  return { success: !error, error };
}
```

---

## 3. SPECIAL OFFERS MANAGEMENT

### 3.1 Create/Update Special Offer

```typescript
interface SpecialOffer {
  enabled: boolean;
  title: string;
  description: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  bonus_amount: number;
  min_referrals: number;
}

async function updateSpecialOffer(offer: SpecialOffer) {
  const { error } = await supabase
    .from('referral_settings')
    .update({ 
      value: offer,
      updated_at: new Date().toISOString()
    })
    .eq('key', 'current_offer');
  
  return { success: !error, error };
}

// Example usage:
await updateSpecialOffer({
  enabled: true,
  title: 'Republic Day Special!',
  description: 'Refer 3 friends this week and get ₹500 bonus!',
  start_date: '2026-01-26',
  end_date: '2026-01-31',
  bonus_amount: 500,
  min_referrals: 3
});
```

### 3.2 Disable Special Offer

```typescript
async function disableSpecialOffer() {
  const { data: current } = await supabase
    .from('referral_settings')
    .select('value')
    .eq('key', 'current_offer')
    .single();
  
  const { error } = await supabase
    .from('referral_settings')
    .update({ 
      value: { ...current?.value, enabled: false },
      updated_at: new Date().toISOString()
    })
    .eq('key', 'current_offer');
  
  return { success: !error, error };
}
```

---

## 4. UI CUSTOMIZATION

### 4.1 Update Banner Colors

```typescript
interface BannerColors {
  gradient_start: string; // Hex color, e.g., '#FF9800'
  gradient_end: string;   // Hex color, e.g., '#F57C00'
  text_color: string;     // Hex color, e.g., '#FFFFFF'
  code_bg_color: string;  // Hex color for code box
  code_text_color: string;
}

async function updateBannerColors(colors: BannerColors) {
  const { error } = await supabase
    .from('referral_settings')
    .update({ 
      value: colors,
      updated_at: new Date().toISOString()
    })
    .eq('key', 'ui_banner_colors');
  
  return { success: !error, error };
}

// Example usage:
await updateBannerColors({
  gradient_start: '#6A11CB',
  gradient_end: '#2575FC',
  text_color: '#FFFFFF',
  code_bg_color: '#FFFFFF',
  code_text_color: '#6A11CB'
});
```

### 4.2 Update Banner Text (Multi-language)

```typescript
async function updateBannerTitle(titles: { [lang: string]: string }) {
  const { error } = await supabase
    .from('referral_settings')
    .update({ 
      value: titles,
      updated_at: new Date().toISOString()
    })
    .eq('key', 'ui_banner_title');
  
  return { success: !error, error };
}

// Example:
await updateBannerTitle({
  en: 'Refer & Earn',
  hi: 'रेफर करें और कमाएं',
  te: 'రిఫర్ చేసి సంపాదించండి',
  ta: 'பரிந்துரை செய்து சம்பாதிக்கவும்'
});
```

### 4.3 Update Share Message Template

```typescript
async function updateShareMessageTemplate(templates: { [lang: string]: string }) {
  // Templates can use placeholders: {{CODE}}, {{REFEREE_REWARD}}, {{REFERRER_REWARD}}, {{LINK}}
  const { error } = await supabase
    .from('referral_settings')
    .update({ 
      value: templates,
      updated_at: new Date().toISOString()
    })
    .eq('key', 'share_message_template');
  
  return { success: !error, error };
}

// Example:
await updateShareMessageTemplate({
  en: `Join dukaaOn with my referral code: {{CODE}}

🎁 You'll get ₹{{REFEREE_REWARD}} off on your first order!
🛒 Shop from nearby wholesalers at best prices

Download now: {{LINK}}`,
  hi: `मेरे रेफरल कोड से dukaaOn जॉइन करें: {{CODE}}

🎁 आपको अपने पहले ऑर्डर पर ₹{{REFEREE_REWARD}} की छूट मिलेगी!

अभी डाउनलोड करें: {{LINK}}`
});
```

---

## 5. SALES TEAM CODES MANAGEMENT

### 5.1 Create Sales Team Code

```typescript
interface SalesTeamCode {
  code: string;
  sales_person_name: string;
  custom_reward?: {
    amount: number;
    currency: string;
  };
  max_uses?: number;
  expires_at?: string;
}

async function createSalesTeamCode(data: SalesTeamCode) {
  const { data: result, error } = await supabase
    .from('referral_codes')
    .insert({
      code: data.code.toUpperCase(),
      code_type: 'sales_team',
      is_active: true,
      max_uses: data.max_uses || null,
      custom_reward: data.custom_reward || null,
      expires_at: data.expires_at || null,
      metadata: {
        sales_person_name: data.sales_person_name,
        created_at: new Date().toISOString()
      }
    })
    .select()
    .single();
  
  return { success: !error, data: result, error };
}

// Example:
await createSalesTeamCode({
  code: 'SALES_RAHUL',
  sales_person_name: 'Rahul Sharma',
  custom_reward: { amount: 50, currency: 'INR' },
  max_uses: 100
});
```

### 5.2 Get All Sales Team Codes

```typescript
async function getSalesTeamCodes() {
  const { data, error } = await supabase
    .from('referral_codes')
    .select(`
      *,
      referrals:referrals(count)
    `)
    .eq('code_type', 'sales_team')
    .order('created_at', { ascending: false });
  
  return { data, error };
}
```

### 5.3 Deactivate Sales Team Code

```typescript
async function deactivateSalesTeamCode(codeId: string) {
  const { error } = await supabase
    .from('referral_codes')
    .update({ 
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', codeId);
  
  return { success: !error, error };
}
```

---

## 6. REFERRAL TRACKING & ANALYTICS

### 6.1 Get Referral Dashboard Stats

```typescript
async function getReferralDashboardStats() {
  // Total referrals
  const { count: totalReferrals } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true });
  
  // Pending referrals
  const { count: pendingReferrals } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  
  // Successful referrals
  const { count: successfulReferrals } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'rewarded');
  
  // Total rewards paid
  const { data: rewardData } = await supabase
    .from('referral_rewards')
    .select('amount')
    .eq('status', 'credited');
  
  const totalRewardsPaid = rewardData?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  
  // Total link clicks
  const { count: totalClicks } = await supabase
    .from('referral_link_clicks')
    .select('*', { count: 'exact', head: true });
  
  // Conversion rate
  const conversionRate = totalClicks ? ((successfulReferrals || 0) / totalClicks * 100).toFixed(2) : 0;
  
  return {
    totalReferrals,
    pendingReferrals,
    successfulReferrals,
    totalRewardsPaid,
    totalClicks,
    conversionRate: `${conversionRate}%`
  };
}
```

### 6.2 Get All Referrals (with pagination)

```typescript
interface GetReferralsParams {
  page?: number;
  pageSize?: number;
  status?: 'pending' | 'verified' | 'rewarded' | 'expired' | 'invalid';
  codeType?: 'user' | 'sales_team' | 'influencer' | 'marketing';
}

async function getReferrals(params: GetReferralsParams = {}) {
  const { page = 1, pageSize = 20, status, codeType } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  let query = supabase
    .from('referrals')
    .select(`
      *,
      referrer:profiles!referrer_id(id, phone_number, business_details),
      referee:profiles!referee_id(id, phone_number, business_details),
      referral_code_data:referral_codes(code, code_type, metadata)
    `, { count: 'exact' })
    .range(from, to)
    .order('created_at', { ascending: false });
  
  if (status) {
    query = query.eq('status', status);
  }
  
  if (codeType) {
    query = query.eq('referral_code_data.code_type', codeType);
  }
  
  const { data, count, error } = await query;
  
  return { 
    data, 
    totalCount: count,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
    error 
  };
}
```

### 6.3 Get Sales Team Performance

```typescript
async function getSalesTeamPerformance() {
  const { data, error } = await supabase
    .from('referral_codes')
    .select(`
      id,
      code,
      metadata,
      current_uses,
      is_active,
      created_at,
      referrals:referrals(
        id,
        status,
        created_at
      )
    `)
    .eq('code_type', 'sales_team')
    .order('current_uses', { ascending: false });
  
  // Process data to get stats per sales person
  const performance = data?.map(code => ({
    code: code.code,
    salesPersonName: code.metadata?.sales_person_name || 'Unknown',
    totalSignups: code.current_uses || 0,
    pendingReferrals: code.referrals?.filter(r => r.status === 'pending').length || 0,
    successfulReferrals: code.referrals?.filter(r => r.status === 'rewarded').length || 0,
    isActive: code.is_active,
    createdAt: code.created_at
  }));
  
  return { data: performance, error };
}
```

### 6.4 Get Link Click Analytics

```typescript
async function getLinkClickAnalytics(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { data, error } = await supabase
    .from('referral_link_clicks')
    .select('*')
    .gte('clicked_at', startDate.toISOString())
    .order('clicked_at', { ascending: false });
  
  // Group by date
  const clicksByDate: { [date: string]: number } = {};
  const clicksBySource: { [source: string]: number } = {};
  const clicksByPlatform: { [platform: string]: number } = {};
  
  data?.forEach(click => {
    const date = click.clicked_at.split('T')[0];
    clicksByDate[date] = (clicksByDate[date] || 0) + 1;
    
    const source = click.click_source || 'unknown';
    clicksBySource[source] = (clicksBySource[source] || 0) + 1;
    
    const platform = click.platform || 'unknown';
    clicksByPlatform[platform] = (clicksByPlatform[platform] || 0) + 1;
  });
  
  return {
    totalClicks: data?.length || 0,
    convertedClicks: data?.filter(c => c.converted).length || 0,
    clicksByDate,
    clicksBySource,
    clicksByPlatform,
    error
  };
}
```

---

## 7. REFERRAL MANAGEMENT ACTIONS

### 7.1 Manually Approve Referral

```typescript
async function approveReferral(referralId: string) {
  const { error } = await supabase
    .from('referrals')
    .update({ 
      status: 'verified',
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', referralId);
  
  return { success: !error, error };
}
```

### 7.2 Manually Mark Referral as Rewarded

```typescript
async function markReferralRewarded(referralId: string) {
  // Get referral details
  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('id', referralId)
    .single();
  
  if (!referral) return { success: false, error: 'Referral not found' };
  
  // Update referral status
  const { error: updateError } = await supabase
    .from('referrals')
    .update({ 
      status: 'rewarded',
      rewarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', referralId);
  
  if (updateError) return { success: false, error: updateError };
  
  // Create reward record
  const { error: rewardError } = await supabase
    .from('referral_rewards')
    .insert({
      referral_id: referralId,
      user_id: referral.referrer_id,
      reward_type: 'wallet_credit',
      amount: referral.referrer_reward_amount,
      status: 'credited',
      credited_at: new Date().toISOString()
    });
  
  // Update referrer's wallet
  await supabase.rpc('add_to_wallet', {
    p_user_id: referral.referrer_id,
    p_amount: referral.referrer_reward_amount
  });
  
  return { success: !rewardError, error: rewardError };
}
```

### 7.3 Invalidate Referral

```typescript
async function invalidateReferral(referralId: string, reason: string) {
  const { error } = await supabase
    .from('referrals')
    .update({ 
      status: 'invalid',
      reward_note: reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', referralId);
  
  return { success: !error, error };
}
```

---

## 8. MILESTONE REWARDS MANAGEMENT

### 8.1 Update Milestone Rewards

```typescript
interface MilestoneReward {
  referrals: number;
  bonus: number;
  title: string;
}

async function updateMilestoneRewards(milestones: MilestoneReward[]) {
  const { error } = await supabase
    .from('referral_settings')
    .update({ 
      value: milestones,
      updated_at: new Date().toISOString()
    })
    .eq('key', 'milestone_rewards');
  
  return { success: !error, error };
}

// Example:
await updateMilestoneRewards([
  { referrals: 5, bonus: 200, title: 'Starter Bonus' },
  { referrals: 10, bonus: 500, title: 'Bronze Bonus' },
  { referrals: 25, bonus: 1500, title: 'Silver Bonus' },
  { referrals: 50, bonus: 5000, title: 'Gold Bonus' },
  { referrals: 100, bonus: 15000, title: 'Platinum Bonus' }
]);
```

---

## 9. TOP REFERRERS LEADERBOARD

```typescript
async function getTopReferrers(limit: number = 10) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, phone_number, business_details, total_referrals, total_referral_earnings, wallet_balance')
    .gt('total_referrals', 0)
    .order('total_referrals', { ascending: false })
    .limit(limit);
  
  return { data, error };
}
```

---

## 10. HELPER FUNCTION: Add to Wallet (Create if not exists)

Add this RPC function to your database:

```sql
CREATE OR REPLACE FUNCTION public.add_to_wallet(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount,
      total_referral_earnings = COALESCE(total_referral_earnings, 0) + p_amount
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_to_wallet TO authenticated;
```

---

## Summary: Admin Console Pages to Build

1. **Dashboard** - Overview stats, charts, quick actions
2. **Settings** - Reward amounts, program status, expiry settings
3. **UI Customization** - Colors, text, share message templates
4. **Special Offers** - Create/edit time-limited offers
5. **Sales Team** - Manage codes, view performance
6. **Referrals** - List all referrals, filter, approve/reject
7. **Analytics** - Click tracking, conversion rates, trends
8. **Leaderboard** - Top referrers
