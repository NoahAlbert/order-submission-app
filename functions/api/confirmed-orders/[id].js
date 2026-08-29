import { createSupabaseClient, requireAdmin, json } from '../../_lib.js';

// The four fulfillment flags, tracked independently of each other.
const BOOLEAN_FIELDS = ['paid', 'printed', 'cut_and_sleeved', 'delivered'];

// PATCH /api/confirmed-orders/:orderId — admin-only, updates the confirmed
// price and the fulfillment checkboxes.
export async function onRequestPatch(context) {
  const authError = requireAdmin(context.request, context.env);
  if (authError) return authError;

  const { id } = context.params;
  const body = await context.request.json();
  const update = {};

  if ('confirmed_price' in body) {
    update.confirmed_price = body.confirmed_price === null || body.confirmed_price === ''
      ? null
      : Number(body.confirmed_price);
  }
  for (const field of BOOLEAN_FIELDS) {
    if (field in body) update[field] = Boolean(body[field]);
  }
  if (Object.keys(update).length === 0) {
    return json({ error: 'No valid fields to update' }, 400);
  }

  const supabase = createSupabaseClient(context.env);

  // Unsleeved orders are cut and sleeved by definition. The admin page greys
  // the checkbox out; this is the half of that rule that actually holds.
  if (update.cut_and_sleeved === false) {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('sleeving')
      .eq('id', id)
      .maybeSingle();
    if (orderError) return json({ error: orderError.message }, 500);
    if (order && order.sleeving === 'none') {
      return json({ error: 'An unsleeved order is always cut and sleeved' }, 400);
    }
  }

  const { data, error } = await supabase
    .from('confirmed_orders')
    .update(update)
    .eq('order_id', id)
    .select('*, orders(*)')
    .single();

  if (error) return json({ error: error.message }, 500);
  return json(data);
}

// DELETE /api/confirmed-orders/:orderId — admin-only, drops the fulfillment
// record. The order itself stays in All orders, unconfirmed and free to be
// confirmed again; its status is left alone, since un-confirming is not the
// same decision as un-accepting.
export async function onRequestDelete(context) {
  const authError = requireAdmin(context.request, context.env);
  if (authError) return authError;

  const supabase = createSupabaseClient(context.env);
  const { error } = await supabase
    .from('confirmed_orders')
    .delete()
    .eq('order_id', context.params.id);

  if (error) return json({ error: error.message }, 500);
  return json({ deleted: true });
}
