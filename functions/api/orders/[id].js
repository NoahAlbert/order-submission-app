import { createSupabaseClient, requireAdmin, json } from '../../_lib.js';

const VALID_STATUSES = ['new', 'wip', 'complete', 'delivered'];

// PATCH /api/orders/:id — admin-only, updates status/paid/price_quote.
export async function onRequestPatch(context) {
  const authError = requireAdmin(context.request, context.env);
  if (authError) return authError;

  const { id } = context.params;
  const body = await context.request.json();
  const update = {};

  if ('status' in body) {
    if (!VALID_STATUSES.includes(body.status)) return json({ error: 'Invalid status' }, 400);
    update.status = body.status;
  }
  if ('paid' in body) {
    update.paid = Boolean(body.paid);
  }
  if ('price_quote' in body) {
    update.price_quote = body.price_quote === null || body.price_quote === '' ? null : Number(body.price_quote);
  }
  if (Object.keys(update).length === 0) {
    return json({ error: 'No valid fields to update' }, 400);
  }

  const supabase = createSupabaseClient(context.env);
  const { data, error } = await supabase
    .from('orders')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json(data);
}
