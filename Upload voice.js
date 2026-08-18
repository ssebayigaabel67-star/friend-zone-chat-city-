export default async function handler(req, res) {

  // ======================
  // ONLY POST ALLOWED
  // ======================

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });

  }


  try {

    // ======================
    // CHECK API KEY
    // ======================

    const apiKey =
      process.env.FILEPOST_API_KEY;


    if (!apiKey) {

      return res.status(500).json({
        success: false,
        error:
          "FILEPOST_API_KEY is not configured"
      });

    }


    // ======================
    // CHECK CONTENT TYPE
    // ======================

    const contentType =
      req.headers["content-type"] || "";


    if (
      !contentType.includes(
        "multipart/form-data"
      )
    ) {

      return res.status(400).json({
        success: false,
        error:
          "Request must use multipart/form-data"
      });

    }


    // ======================
    // TEMPORARY RESPONSE
    // ======================

    return res.status(200).json({

      success: true,

      message:
        "Voice upload endpoint is ready.",

      receivedContentType:
        contentType

    });


  } catch (error) {

    console.error(
      "Voice backend error:",
      error
    );


    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Server error"
    });

  }

}