import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: corsHeaders },
    );
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return Response.json(
      { error: "Authentication is required." },
      { status: 401, headers: corsHeaders },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !vapidPublicKey ||
    !vapidPrivateKey ||
    !vapidSubject
  ) {
    return Response.json(
      { error: "Push notification service is not configured." },
      { status: 503, headers: corsHeaders },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return Response.json(
      { error: "The access token is invalid or expired." },
      { status: 401, headers: corsHeaders },
    );
  }

  let payload: { title?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "A valid JSON notification payload is required." },
      { status: 400, headers: corsHeaders },
    );
  }
  const title =
    typeof payload.title === "string" ? payload.title.slice(0, 120) : "Tempo";
  const body =
    typeof payload.body === "string"
      ? payload.body.slice(0, 240)
      : "Your timer session is complete.";

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("endpoint,subscription")
    .eq("user_id", userData.user.id);
  if (subscriptionError) {
    return Response.json(
      { error: "Unable to load push subscriptions." },
      { status: 500, headers: corsHeaders },
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const expiredEndpoints: string[] = [];
  const results = await Promise.allSettled(
    (subscriptions ?? []).map(async (item) => {
      try {
        await webpush.sendNotification(
          item.subscription,
          JSON.stringify({ title, body, url: "./" }),
        );
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? error.statusCode
            : null;
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.push(item.endpoint);
          return;
        }
        throw error;
      }
    }),
  );
  const { error: cleanupError } =
    expiredEndpoints.length > 0
      ? await supabase
          .from("push_subscriptions")
          .delete()
          .in("endpoint", expiredEndpoints)
      : { error: null };
  const failures = results.filter((result) => result.status === "rejected");

  if (cleanupError || failures.length > 0) {
    return Response.json(
      {
        sent: results.length - failures.length,
        failed: failures.length,
        cleanupError: cleanupError?.message,
      },
      { status: 502, headers: corsHeaders },
    );
  }

  return Response.json(
    { sent: results.length },
    { headers: corsHeaders },
  );
});
