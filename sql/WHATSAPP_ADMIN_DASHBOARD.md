# WhatsApp Automation System - Admin Dashboard Guide

## Overview

This document provides all the necessary details to build an admin dashboard for managing the DukaaOn WhatsApp automation system.

---

## Database Tables

### 1. `whatsapp_template_config` - Template Management

**Purpose:** Configure all WhatsApp message templates. Update template IDs, enable/disable templates, set rate limits.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `template_key` | TEXT | Unique identifier (e.g., `NEW_ORDER_RECEIVED`) |
| `template_name` | TEXT | Human-readable name |
| `authkey_template_id` | TEXT | **Authkey.io template ID** - update this to change templates |
| `category` | TEXT | `order`, `payment`, `delivery`, `marketing`, `support` |
| `description` | TEXT | What this template does |
| `variable_count` | INTEGER | Number of variables in template |
| `variable_mapping` | JSONB | Maps positions to field names |
| `is_automatic` | BOOLEAN | Auto-send on trigger event? |
| `is_enabled` | BOOLEAN | **Enable/disable template** |
| `trigger_event` | TEXT | Event that triggers auto-send |
| `trigger_conditions` | JSONB | Additional conditions for triggering |
| `send_time_preference` | TEXT | `immediate`, `morning`, `evening`, `scheduled` |
| `cooldown_minutes` | INTEGER | Min time between sends to same user |
| `max_sends_per_day` | INTEGER | Max sends per user per day |
| `priority` | INTEGER | 1-10, higher = more important |
| `created_at` | TIMESTAMPTZ | When created |
| `updated_at` | TIMESTAMPTZ | Last update |

**Admin Actions:**
- ✅ Update `authkey_template_id` when templates change in Authkey
- ✅ Toggle `is_enabled` to enable/disable
- ✅ Set `cooldown_minutes` and `max_sends_per_day` for rate limiting
- ✅ Configure `trigger_event` for automated sending

---

### 2. `whatsapp_messages` - Message History

**Purpose:** Log of all incoming and outgoing WhatsApp messages.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `phone_number` | TEXT | User's phone number |
| `direction` | TEXT | `inbound` or `outbound` |
| `message_type` | TEXT | `text`, `template`, `media`, `ai_response` |
| `content` | TEXT | Message content |
| `template_key` | TEXT | Which template was used |
| `template_variables` | JSONB | Variables sent with template |
| `related_order_id` | UUID | Associated order |
| `related_user_id` | UUID | Associated user |
| `ai_intent` | TEXT | Detected intent (for inbound) |
| `ai_confidence` | DECIMAL | Confidence score |
| `ai_response` | TEXT | AI-generated response |
| `language` | TEXT | Message language |
| `status` | TEXT | `pending`, `sent`, `delivered`, `read`, `failed`, `processed` |
| `error_message` | TEXT | Error if failed |
| `authkey_message_id` | TEXT | Authkey's message ID |
| `created_at` | TIMESTAMPTZ | When sent/received |
| `processed_at` | TIMESTAMPTZ | When processed |

**Admin Actions:**
- 📊 View message history
- 🔍 Search by phone number, order ID, status
- 📈 Analytics on delivery rates, response times
- 🚨 Monitor failed messages

---

### 3. `whatsapp_conversations` - Conversation Tracking

**Purpose:** Track active conversations with users for context.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `phone_number` | TEXT | User's phone (unique) |
| `user_id` | UUID | Linked user profile |
| `user_role` | TEXT | `retailer`, `wholesaler`, `manufacturer` |
| `last_message_at` | TIMESTAMPTZ | Last message timestamp |
| `last_message_content` | TEXT | Last message preview |
| `last_message_direction` | TEXT | `inbound` or `outbound` |
| `context` | JSONB | AI conversation context |
| `pending_action` | TEXT | Action waiting for response |
| `pending_order_id` | UUID | Order being discussed |
| `total_messages` | INTEGER | Total message count |
| `ai_interactions` | INTEGER | Number of AI responses |

**Admin Actions:**
- 👥 View active conversations
- 📊 Monitor engagement levels
- 🔍 Search users by phone/role

---

### 4. `whatsapp_order_responses` - Order Actions via WhatsApp

**Purpose:** Track seller actions on orders via WhatsApp (confirm, reject, etc.)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `order_id` | UUID | Related order |
| `seller_id` | UUID | Seller who responded |
| `phone_number` | TEXT | Seller's phone |
| `action` | TEXT | `confirm`, `reject`, `partial`, `out_of_stock`, `ready`, `delay`, `cancel`, `modify` |
| `reason` | TEXT | Reason for action |
| `items_affected` | JSONB | Items affected (for partial/oos) |
| `new_eta` | TIMESTAMPTZ | New ETA (for delay) |
| `message_id` | UUID | Source message |
| `processed` | BOOLEAN | Has been processed? |
| `processed_at` | TIMESTAMPTZ | When processed |

**Admin Actions:**
- 📋 View all order responses
- ⚠️ Monitor unprocessed actions
- 📊 Analytics on response types

---

### 5. `whatsapp_template_sends` - Send History & Analytics

**Purpose:** Track every template message sent for rate limiting and analytics.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `template_key` | TEXT | Which template |
| `phone_number` | TEXT | Recipient |
| `user_id` | UUID | Recipient user |
| `related_order_id` | UUID | Related order |
| `variables_used` | JSONB | Variables sent |
| `language_used` | TEXT | Language |
| `status` | TEXT | `sent`, `delivered`, `read`, `failed` |
| `authkey_response` | JSONB | Full Authkey response |
| `error_message` | TEXT | Error if failed |
| `created_at` | TIMESTAMPTZ | When sent |

**Admin Actions:**
- 📊 Template usage analytics
- 📈 Delivery/read rates per template
- 🔍 Debug failed sends
- 💰 Track WhatsApp costs

---

## Template Categories & Events

### Order Templates
| Template Key | Trigger Event | Description |
|--------------|--------------|-------------|
| `NEW_ORDER_RECEIVED` | `order.created` | Notify seller of new order |
| `ORDER_CONFIRMED` | `order.confirmed` | Notify retailer order confirmed |
| `ORDER_REJECTED` | `order.rejected` | Notify retailer order rejected |
| `ORDER_PARTIALLY_AVAILABLE` | `order.partial` | Some items unavailable |
| `ORDER_READY_FOR_PICKUP` | `order.ready` | Order ready for delivery |
| `ORDER_CANCELLED_BY_SELLER` | `order.cancelled.seller` | Seller cancelled |
| `ORDER_CANCELLED_BY_RETAILER` | `order.cancelled.retailer` | Retailer cancelled |
| `ORDER_SUMMARY_DAILY` | `schedule.daily` | Daily summary |

### Payment Templates
| Template Key | Trigger Event | Description |
|--------------|--------------|-------------|
| `PAYMENT_RECEIVED` | `payment.received` | Payment confirmed |
| `PAYMENT_REMINDER` | `payment.reminder` | Upcoming due date |
| `PAYMENT_OVERDUE` | `payment.overdue` | Past due date |
| `PAYMENT_PARTIAL` | `payment.partial` | Partial payment received |
| `CREDIT_LIMIT_REACHED` | `credit.limit_warning` | Credit limit warning |

### Delivery Templates
| Template Key | Trigger Event | Description |
|--------------|--------------|-------------|
| `DELIVERY_ASSIGNED` | `delivery.assigned` | Driver assigned |
| `DELIVERY_STARTED` | `delivery.started` | Out for delivery |
| `DELIVERY_ARRIVING` | `delivery.arriving` | Driver nearby |
| `DELIVERY_COMPLETED` | `delivery.completed` | Delivered |
| `DELIVERY_DELAYED` | `delivery.delayed` | Delay notification |

### Marketing Templates
| Template Key | Trigger Event | Description |
|--------------|--------------|-------------|
| `REORDER_REMINDER` | `schedule.weekly_reorder` | Stock reorder reminder |
| `LOW_STOCK_ALERT` | `analytics.low_stock` | Running low alert |
| `WELCOME_MESSAGE` | `user.registered` | New user welcome |
| `INACTIVE_USER` | `schedule.inactive_check` | Win back inactive |

### Support Templates
| Template Key | Trigger Event | Description |
|--------------|--------------|-------------|
| `SUPPORT_TICKET_CREATED` | `support.created` | Ticket created |
| `SUPPORT_TICKET_RESOLVED` | `support.resolved` | Ticket resolved |
| `GENERAL_RESPONSE` | (manual) | Custom response |

---

## SQL Queries for Dashboard

### Template Management

```sql
-- Get all templates with status
SELECT 
  template_key,
  template_name,
  category,
  authkey_template_id,
  is_enabled,
  is_automatic,
  trigger_event,
  cooldown_minutes,
  max_sends_per_day
FROM whatsapp_template_config
ORDER BY category, template_key;

-- Update template ID
UPDATE whatsapp_template_config 
SET authkey_template_id = 'NEW_ID', updated_at = NOW()
WHERE template_key = 'ORDER_CONFIRMED';

-- Enable/disable template
UPDATE whatsapp_template_config 
SET is_enabled = false, updated_at = NOW()
WHERE template_key = 'INACTIVE_USER';

-- Set rate limits
UPDATE whatsapp_template_config 
SET 
  cooldown_minutes = 60,
  max_sends_per_day = 3,
  updated_at = NOW()
WHERE template_key = 'PAYMENT_REMINDER';
```

### Message Analytics

```sql
-- Messages sent today
SELECT 
  template_key,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM whatsapp_template_sends
WHERE created_at >= CURRENT_DATE
GROUP BY template_key
ORDER BY total DESC;

-- Delivery rate by template
SELECT 
  template_key,
  COUNT(*) as total,
  ROUND(COUNT(CASE WHEN status = 'delivered' THEN 1 END)::DECIMAL / COUNT(*) * 100, 2) as delivery_rate
FROM whatsapp_template_sends
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY template_key
ORDER BY delivery_rate DESC;

-- Failed messages with errors
SELECT 
  id,
  template_key,
  phone_number,
  error_message,
  created_at
FROM whatsapp_template_sends
WHERE status = 'failed'
AND created_at >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY created_at DESC;

-- Top users by message count
SELECT 
  wc.phone_number,
  wc.user_role,
  wc.total_messages,
  wc.ai_interactions,
  wc.last_message_at
FROM whatsapp_conversations wc
ORDER BY total_messages DESC
LIMIT 20;
```

### Order Response Analytics

```sql
-- Order responses by action
SELECT 
  action,
  COUNT(*) as total,
  COUNT(CASE WHEN processed THEN 1 END) as processed
FROM whatsapp_order_responses
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY action
ORDER BY total DESC;

-- Unprocessed order responses (needs attention!)
SELECT 
  wor.id,
  wor.order_id,
  wor.action,
  wor.reason,
  wor.created_at,
  p.business_details->>'shopName' as seller_name
FROM whatsapp_order_responses wor
LEFT JOIN profiles p ON wor.seller_id = p.id
WHERE wor.processed = false
ORDER BY wor.created_at ASC;

-- Average response time by seller
SELECT 
  wor.seller_id,
  p.business_details->>'shopName' as seller_name,
  COUNT(*) as total_responses,
  AVG(EXTRACT(EPOCH FROM (wor.created_at - o.created_at))/60)::INTEGER as avg_response_minutes
FROM whatsapp_order_responses wor
JOIN orders o ON wor.order_id = o.id
LEFT JOIN profiles p ON wor.seller_id = p.id
WHERE wor.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY wor.seller_id, seller_name
ORDER BY avg_response_minutes ASC;
```

### Conversation Analytics

```sql
-- Active conversations (last 24 hours)
SELECT 
  phone_number,
  user_role,
  total_messages,
  ai_interactions,
  last_message_content,
  last_message_at
FROM whatsapp_conversations
WHERE last_message_at >= NOW() - INTERVAL '24 hours'
ORDER BY last_message_at DESC;

-- AI usage stats
SELECT 
  DATE(last_message_at) as date,
  COUNT(*) as active_conversations,
  SUM(ai_interactions) as ai_interactions
FROM whatsapp_conversations
WHERE last_message_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(last_message_at)
ORDER BY date DESC;
```

---

## Admin Dashboard Features

### 1. Template Manager
- **List all templates** with enable/disable toggle
- **Edit template** - Update Authkey ID, rate limits, trigger event
- **Template status** - Show which have Authkey IDs configured
- **Category filter** - Filter by order/payment/delivery/marketing/support

### 2. Message History
- **Search** by phone, order ID, date range
- **Filter** by direction, status, template
- **Export** to CSV for analysis
- **Retry failed** messages

### 3. Analytics Dashboard
- **Messages today/week/month** with charts
- **Delivery rate** per template
- **Failed message alerts**
- **Top templates** by usage
- **Response time** analytics

### 4. Conversation View
- **Active conversations** list
- **Conversation detail** - full message history
- **AI interactions** log
- **User context** view

### 5. Order Response Monitor
- **Pending responses** that need processing
- **Response analytics** by type
- **Seller response times**
- **Alert on unprocessed** responses

### 6. Settings
- **Authkey balance** check
- **Default rate limits**
- **Language preferences**
- **Webhook status** (Edge Function)

---

## API Endpoints (Supabase)

All operations use Supabase client. Example:

```typescript
import { supabase } from '@/services/supabase/supabase';

// Get all templates
const { data } = await supabase
  .from('whatsapp_template_config')
  .select('*')
  .order('category', { ascending: true });

// Update template
await supabase
  .from('whatsapp_template_config')
  .update({ 
    authkey_template_id: 'NEW_ID',
    updated_at: new Date().toISOString()
  })
  .eq('template_key', 'ORDER_CONFIRMED');

// Get message history
const { data } = await supabase
  .from('whatsapp_messages')
  .select('*')
  .eq('direction', 'outbound')
  .order('created_at', { ascending: false })
  .limit(100);
```

---

## Webhook Configuration

### Supabase Edge Function
- **URL:** `https://xcpznnkpjgyrpbvpnvit.supabase.co/functions/v1/whatsapp-webhook`
- **Method:** POST
- **Auth:** None (webhook from Authkey)

### Environment Variables
| Variable | Description |
|----------|-------------|
| `AUTHKEY_API_KEY` | API key for sending messages |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | For Edge Function |

---

## Rate Limiting

The system uses the `check_whatsapp_rate_limit` function to enforce:
1. **Cooldown** - Minimum time between sends to same user
2. **Daily limit** - Maximum sends per user per day

Configure per template in `whatsapp_template_config`.

---

## Seller Commands (Inbound)

When sellers reply to WhatsApp messages:

| Command | Action |
|---------|--------|
| `confirm` / `yes` / `ok` / `✅` | Confirm order |
| `reject [reason]` / `no` / `❌` | Reject order |
| `ready` | Order ready for pickup |
| `delay [time]` | Update delivery ETA |
| `out of stock [items]` | Mark items unavailable |

### Retailer Commands
| Command | Action |
|---------|--------|
| `track` | Get order status |
| `reorder` | Repeat last order |
| `help` | Get command list |

---

## Language Support

Supported languages:
- English (en)
- Hindi (hi)
- Kannada (kn)
- Tamil (ta)
- Telugu (te)

Language is auto-detected from message content.

---

## Files Reference

| File | Purpose |
|------|---------|
| `services/whatsapp/AuthkeyWhatsAppService.ts` | Sends messages via Authkey API |
| `services/whatsapp/WhatsAppTemplates.ts` | Fetches template configs from DB |
| `services/whatsapp/WhatsAppAIService.ts` | AI-powered responses |
| `services/whatsapp/index.ts` | Exports and convenience functions |
| `supabase/functions/whatsapp-webhook/index.ts` | Handles incoming messages |
| `supabase/migrations/20260125_whatsapp_*.sql` | Database schema |
