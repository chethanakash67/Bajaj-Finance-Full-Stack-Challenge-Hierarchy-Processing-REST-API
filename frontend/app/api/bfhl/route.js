const { processGraphPayload } = require("../../../lib/graphService");

const USER_DETAILS = {
  user_id: process.env.USER_ID || "G_CHETHAN_AKASH",
  email_id: process.env.EMAIL_ID || "ga0822@srmist.edu.in",
  college_roll_number: process.env.COLLEGE_ROLL_NUMBER || "RA2311028010059",
};

function jsonResponse(payload, status = 200) {
  return Response.json(payload, { status });
}

export async function GET() {
  return jsonResponse({
    success: true,
    message: "Next.js API route is running.",
  });
}

export async function POST(request) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return jsonResponse(
      {
        success: false,
        message: "Content-Type must be application/json.",
      },
      415
    );
  }

  try {
    const payload = await request.json();
    const result = processGraphPayload(payload);

    return jsonResponse({
      ...USER_DETAILS,
      ...result,
    });
  } catch (error) {
    const isMalformedJson = error instanceof SyntaxError;
    const status = isMalformedJson ? 400 : error.statusCode || 500;

    return jsonResponse(
      {
        success: false,
        message: isMalformedJson ? "Malformed JSON request body." : error.message || "Internal server error.",
      },
      status
    );
  }
}
