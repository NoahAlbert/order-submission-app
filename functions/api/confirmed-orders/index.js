import { createSupabaseClient, requireAdmin, json } from '../../_lib.js';

// GET /api/confirmed-orders — admin-only, lists every confirmed order.
export async function onRequestGet(context) {
  const authError = requireAdmin(context.request, context.env);
  if (authError) return authError;

  const supabase = createSupabaseClient(context.env);
  // The originating order comes along embedded: the admin table shows the
  // client's name, size and sleeving choice, none of which are worth copying
  // into this table just to avoid a join.
  const { data, error } = await supabase
    .from('confirmed_orders')
    .select('*, orders(*)')
    .order('confirmed_at', { ascending: false });

  if (error) return json({ error: error.message }, 500);
  return json(data);
}

// POST /api/confirmed-orders — admin-only, promotes an order into the
// confirmed table once its price has been agreed with the client.
export async function onRequestPost(context) {
  const authError = requireAdmin(context.request, context.env);
  if (authError) return authError;

  const { orderId } = await context.request.json();
  if (!orderId) return json({ error: 'Missing orderId' }, 400);

  const supabase = createSupabaseClient(context.env);
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, price_quote, sleeving')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) return json({ error: orderError.message }, 500);
  if (!order) return json({ error: 'Order not found' }, 404);

  const { data, error } = await supabase
    .from('confirmed_orders')
    .insert({
      order_id: order.id,
      // Start from the quote rather than an empty box — confirming usually
      // means agreeing to that number, or nudging it.
      confirmed_price: order.price_quote,
      // An unsleeved order has no sleeving step to wait on, so this is done
      // the moment it is confirmed. The admin page greys the box to match, and
      // PATCH refuses to unset it.
      cut_and_sleeved: order.sleeving === 'none',
    })
    .select('*, orders(*)')
    .single();

  // order_id is the primary key, so a double-click lands here rather than
  // creating a second record.
  if (error && error.code === '23505') {
    return json({ error: 'That order is already confirmed' }, 409);
  }
  if (error) return json({ error: error.message }, 500);
  return json(data, 201);
}
