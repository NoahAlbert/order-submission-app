import { createSupabaseClient, requireAdmin, json } from '../../_lib.js';

const VALID_IMG_SOURCE_FLAGS = ['scryfall', 'custom-frames', 'custom-art', 'client'];
const VALID_SLEEVING = ['none', 'penny', 'colored'];

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
    frameStyle, cardImages, cardFrameStyles, sleeving,
  } = body;

  // Email is optional: the form stopped collecting it. "I'm providing my own
  // images" hides the card list too, so that is only required for the sources
  // that actually print from one.
  const needsCardlist = imgSourceFlag !== 'client';
  if (!name || !orderSize || !imgSourceFlag || (needsCardlist && !cardlist)) {
    return json({ error: 'Missing required fields' }, 400);
  }
  if (!VALID_IMG_SOURCE_FLAGS.includes(imgSourceFlag)) {
    return json({ error: 'Invalid img_source_flag' }, 400);
  }
  // Absent means unsleeved — the form defaults to it, and a stale cached copy
  // of the page that predates the field should still submit cleanly.
  const sleevingValue = sleeving || 'none';
  if (!VALID_SLEEVING.includes(sleevingValue)) {
    return json({ error: 'Invalid sleeving' }, 400);
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
      email: email || null,
      order_size: Number(orderSize),
      img_source_flag: imgSourceFlag,
      img_source: imgSource,
      cardlist: cardlist || '',
      custom_requests: customRequests || null,
      // Order-level style, plus the per-line resolutions so each column stands
      // alone. Blank whenever the chosen source does not use our frames.
      frame_style: frameStyle || null,
      card_images: cardImages || null,
      card_frame_styles: cardFrameStyles || null,
      sleeving: sleevingValue,
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json(data, 201);
}
