import { route } from "@fal-ai/server-proxy/nextjs";
import { NextRequest, NextResponse } from "next/server";

const proxyHandlers = route;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a token generation request
    if (body.allowed_apps && Array.isArray(body.allowed_apps)) {
      const apiKey = process.env.FAL_API_KEY;

      if (!apiKey) {
        return NextResponse.json(
          { error: "FAL_API_KEY not configured" },
          { status: 500 }
        );
      }

      // Forward token request to fal.ai
      const response = await fetch("https://rest.alpha.fal.ai/tokens/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Key ${apiKey}`,
        },
        body: JSON.stringify({
          allowed_apps: body.allowed_apps,
          token_expiration: body.token_expiration || 5000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error("Token generation failed:", {
          status: response.status,
          body: errorText,
        });
        return NextResponse.json(
          { error: `Token generation failed: ${response.statusText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    // Otherwise, use the standard proxy
    return proxyHandlers.POST(request);
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const { GET, PUT } = proxyHandlers;
