import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") ?? "Spotted";
  const subtitle = searchParams.get("subtitle") ?? "Celebrity Fashion Finds";
  const imageUrl = searchParams.get("image");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: "#000",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Background image (blurred) */}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.25,
            }}
          />
        )}

        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 100%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px 70px",
            width: "100%",
          }}
        >
          {/* Brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                fontSize: "28px",
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "-1px",
              }}
            >
              Spotted
            </span>
            <span
              style={{
                fontSize: "13px",
                color: "#888",
                letterSpacing: "4px",
                textTransform: "uppercase",
                paddingTop: "4px",
              }}
            >
              UK Celebrity Fashion
            </span>
          </div>

          {/* Title */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p
              style={{
                fontSize: "64px",
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1.1,
                letterSpacing: "-2px",
                margin: 0,
                maxWidth: "800px",
              }}
            >
              {title}
            </p>
            {subtitle && (
              <p
                style={{
                  fontSize: "24px",
                  color: "#999",
                  margin: 0,
                  fontWeight: 400,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Footer */}
          <p
            style={{
              fontSize: "16px",
              color: "#555",
              margin: 0,
            }}
          >
            spotted.co.uk · shop the look for less
          </p>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
