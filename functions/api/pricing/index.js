import { createSupabaseClient, requireAdmin, json } from '../../_lib.js';

// The full set of priced aspects. `base` applies to every order; the rest are
// keyed by img_source_flag so a quote is always exactly base + one of them.
// Fixed here rather than open-ended so a PUT can't invent rows the form's quote
// would never look at.
const PRICING_IDS = ['base', 'scryfall', 'custom-frames', 'custom-art', 'client'];

// GET /api/pricing — public: the order form quotes from these before submitting.
export async function onRequestGet(context) {
  const supabase = createSupabaseClient(context.env);
  const { data, error } = await supabase
    .from('pricing')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return json({ error: error.message }, 500);
  return json(data);
}

// PUT /api/pricing — admin-only: replaces the numbers on the rows sent.
// Body is an array of { id, per_sheet, per_deck, is_minimum }.
export async function onRequestPut(context) {
  const authError = requireAdmin(context.request, context.env);
  if (authError) return authError;

  const body = await context.request.json();
  if (!Array.isArray(body) || body.length === 0) {
    return json({ error: 'Expected a non-empty array of pricing rows' }, 400);
  }

  const updates = [];
  for (const row of body) {
    if (!PRICING_IDS.includes(row.id)) {
      return json({ error: `Unknown pricing id: ${row.id}` }, 400);
    }
    const perSheet = Number(row.per_sheet);
    const perDeck = Number(row.per_deck);
    if (!Number.isFinite(perSheet) || !Number.isFinite(perDeck) || perSheet < 0 || perDeck < 0) {
      return json({ error: `Prices for "${row.id}" must be numbers of 0 or more` }, 400);
    }
    updates.push({
      id: row.id,
      per_sheet: perSheet,
      per_deck: perDeck,
      is_minimum: Boolean(row.is_minimum),
      updated_at: new Date().toISOString(),
    });
  }

  const supabase = createSupabaseClient(context.env);
  // Update rather than upsert: `label` and `sort_order` are NOT NULL and are not
  // client-editable, so an upsert of an unknown id would fail on them anyway.
  for (const update of updates) {
    const { id, ...fields } = update;
    const { error } = await supabase.from('pricing').update(fields).eq('id', id);
    if (error) return json({ error: error.message }, 500);
  }

  const { data, error } = await supabase
    .from('pricing')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return json({ error: error.message }, 500);
  return json(data);
}
