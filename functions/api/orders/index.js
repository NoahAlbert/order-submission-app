import { createSupabaseClient, requireAdmin, json } from '../../_lib.js';

const VALID_IMG_SOURCE_FLAGS = ['scryfall', 'custom-frames', 'custom-art', 'client'];

// GET /api/orders — admin-only, lists all orders.
export async function onRequestGet(context) {
  const authError = requireAdmin(context.request, context.env);
  if (authError) return authError;

  const supabase = createSupabaseClient(context.env);
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return json({ error: error.message }, 500);
  return json(data);
}

// POST /api/orders — public, creates a new order.
export async function onRequestPost(context) {
  const body = await context.request.json();
  const {
    name, email, orderSize, imgSourceFlag, imgSourceLink,
    cardlist, customRequests, imgSourceFile,
  } = body;

  if (!name || !email || !orderSize || !imgSourceFlag || !cardlist) {
    return json({ error: 'Missing required fields' }, 400);
  }
  if (!VALID_IMG_SOURCE_FLAGS.includes(imgSourceFlag)) {
    return json({ error: 'Invalid img_source_flag' }, 400);
  }

  const supabase = createSupabaseClient(context.env);
  let imgSource = null;

  if (imgSourceFile && imgSourceFile.data) {
    const bytes = Uint8Array.from(atob(imgSourceFile.data), (c) => c.charCodeAt(0));
    const path = `${crypto.randomUUID()}-${imgSourceFile.filename || 'upload'}`;
    const { error: uploadError } = await supabase.storage
      .from('order-uploads')
      .upload(path, bytes, { contentType: imgSourceFile.mimeType || 'application/octet-stream' });
    if (uploadError) return json({ error: uploadError.message }, 500);
    const { data: pub } = supabase.storage.from('order-uploads').getPublicUrl(path);
    imgSource = pub.publicUrl;
  } else if (imgSourceLink) {
    imgSource = imgSourceLink;
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      name,
      email,
      order_size: Number(orderSize),
      img_source_flag: imgSourceFlag,
      img_source: imgSource,
      cardlist,
      custom_requests: customRequests || null,
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json(data, 201);
}
