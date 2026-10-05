import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = url.host;
  const protocol = url.protocol;
  const origin = `${protocol}//${host}`;

  let iconBase64 = "";
  try {
    const iconPath = path.join(process.cwd(), "public", "apple-touch-icon.png");
    if (fs.existsSync(iconPath)) {
      iconBase64 = fs.readFileSync(iconPath).toString("base64");
    }
  } catch {
    // Non-blocking fallback
  }

  const profileXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>ConsentText</key>
    <dict>
        <key>default</key>
        <string>Install Rhymvex Workspace on your home screen.</string>
    </dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>FullScreen</key>
            <true/>
            <key>IsRemovable</key>
            <true/>
            <key>Label</key>
            <string>Rhymvex</string>
            <key>PayloadDescription</key>
            <string>Rhymvex Client Portal &amp; Workspace</string>
            <key>PayloadDisplayName</key>
            <string>Rhymvex</string>
            <key>PayloadIdentifier</key>
            <string>com.rhymvex.workspace.webclip</string>
            <key>PayloadType</key>
            <string>com.apple.webClip.managed</string>
            <key>PayloadUUID</key>
            <string>e4b0a45e-9273-45c1-9d9e-1e42a98f1234</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>Precomposed</key>
            <true/>
            <key>URL</key>
            <string>${origin}/portal</string>
            ${iconBase64 ? `<key>Icon</key><data>${iconBase64}</data>` : ""}
        </dict>
    </array>
    <key>PayloadDisplayName</key>
    <string>Rhymvex Workspace</string>
    <key>PayloadIdentifier</key>
    <string>com.rhymvex.workspace.profile</string>
    <key>PayloadOrganization</key>
    <string>Rhymvex</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>7c9e8d4a-3f1b-4890-a29d-43958dc19abc</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;

  return new NextResponse(profileXml, {
    status: 200,
    headers: {
      "Content-Type": "application/x-apple-aspen-config; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rhymvex.mobileconfig"',
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
