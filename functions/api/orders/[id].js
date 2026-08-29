import { createSupabaseClient, requireAdmin, json } from '../../_lib.js';

// Whether the order has been taken, not how far along it is — the fulfillment
// stages are the flags on a confirmed order.
const VALID_STATUSES = ['new', 'accepted', 'rejected'];

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

// DELETE /api/orders/:id — admin-only, removes the order outright.
// confirmed_orders.order_id cascades, so this also drops the fulfillment
// record if the order had been confirmed; the admin page says so before asking.
export async function onRequestDelete(context) {
  const authError = requireAdmin(context.request, context.env);
  if (authError) return authError;

  const supabase = createSupabaseClient(context.env);
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', context.params.id);

  if (error) return json({ error: error.message }, 500);
  return json({ deleted: true });
}
