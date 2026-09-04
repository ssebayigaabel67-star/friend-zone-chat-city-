export const config = {
  api: {
    bodyParser: false
  }
};


export default async function handler(req, res) {

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });

  }


  try {

    const apiKey =
      process.env.FILEPOST_API_KEY;


    if (!apiKey) {

      return res.status(500).json({
        success: false,
        error:
          "FILEPOST_API_KEY is not configured"
      });

    }


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
          "Expected multipart/form-data"
      });

    }


    // ======================
    // READ RAW REQUEST BODY
    // ======================

    const chunks = [];

    for await (
      const chunk of req
    ) {

      chunks.push(chunk);

    }


    const body =
      Buffer.concat(chunks);


    if (!body.length) {

      return res.status(400).json({
        success: false,
        error: "No voice file received"
      });

    }


    // ======================
    // SEND TO FILEPOST
    // ======================

    const uploadResponse =
      await fetch(
        "https://filepost.dev/v1/upload",
        {
          method: "POST",

          headers: {

            "X-API-Key":
              apiKey,

            "Content-Type":
              contentType

          },

          body: body

        }
      );


    const result =
      await uploadResponse.json();


    if (
      !uploadResponse.ok
    ) {

      console.error(
        "FilePost error:",
        result
      );

      return res.status(
        uploadResponse.status
      ).json({

        success: false,

        error:
          result.detail ||
          "FilePost upload failed"

      });

    }


    // ======================
    // SUCCESS
    // ======================

    return res.status(200).json({

      success: true,

      audioURL:
        result.url,

      fileId:
        result.file_id,

      size:
        result.size

    });


  } catch (error) {

    console.error(
      "Voice upload error:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Voice upload failed"

    });

  }

}